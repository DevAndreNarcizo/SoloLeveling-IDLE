// Servidor HTTP (contas + arquivos do cliente) e WebSocket (jogo em tempo real).
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, type WebSocket } from 'ws'
import type { ClientMsg } from '../../shared/protocol.ts'
import { GAME_NAME } from '../../shared/content.ts'
import { Db } from './db.ts'
import { createMailer, type Mailer } from './mail.ts'
import { Payments, providerFromEnv, type PaymentProvider } from './payments.ts'
import { World, type Session } from './world.ts'

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..')
const PORT = Number(process.env.PORT ?? 3000)
const DIST = join(ROOT, 'client/dist')
const TICK_MS = 100
const USER_RE = /^[a-zA-Z0-9_]{3,16}$/
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
}
export interface ServerOptions { port?: number; database?: string; mailer?: Mailer; payments?: PaymentProvider | null; publicUrl?: string; authPerMinute?: number }

export async function startServer(opt: ServerOptions = {}) {
  // DATABASE_URL (Supabase/Postgres) em produção; sem ela, Postgres embutido em data/pg.
  const db = await Db.open(opt.database ?? process.env.DATABASE_URL ?? join(ROOT, 'data/pg'))
  const world = new World(db)
  const mailer = opt.mailer ?? createMailer()
  const payments = new Payments(db, opt.payments === undefined ? providerFromEnv() : opt.payments,
    (accountId, crystals, balance) => world.crystalsChanged(accountId, balance, `${crystals} cristais creditados.`))
  world.payments = payments

  // Limite de tentativas de login/cadastro/recuperação por IP (janela de 1 minuto).
  const attempts = new Map<string, { n: number; reset: number }>()
  const limited = (ip: string) => {
    const now = Date.now(), a = attempts.get(ip)
    if (!a || a.reset < now) { attempts.set(ip, { n: 1, reset: now + 60_000 }); return false }
    return ++a.n > (opt.authPerMinute ?? 12)
  }
  const json = (res: ServerResponse, code: number, body: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body))
  }
  const readBody = (req: IncomingMessage) => new Promise<Record<string, unknown>>((ok, fail) => {
    let size = 0; const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => { size += c.length; if (size > 2048) { fail(new Error('grande')); req.destroy() } else chunks.push(c) })
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch (e) { fail(e as Error) } })
    req.on('error', fail)
  })
  const validPass = (p: unknown): p is string => typeof p === 'string' && p.length >= 8 && p.length <= 72

  const api = async (req: IncomingMessage, res: ServerResponse, path: string) => {
    const ip = req.socket.remoteAddress ?? '?'
    if (path !== 'logout' && limited(ip)) return json(res, 429, { error: 'Muitas tentativas. Aguarde um minuto.' })
    let body: Record<string, unknown>
    try { body = await readBody(req) } catch { return json(res, 400, { error: 'Requisição inválida.' }) }
    if (path === 'register' || path === 'login') {
      const user = body.user, pass = body.pass
      if (typeof user !== 'string' || !USER_RE.test(user)) return json(res, 400, { error: 'Usuário: 3 a 16 letras, números ou _.' })
      if (!validPass(pass)) return json(res, 400, { error: 'Senha: de 8 a 72 caracteres.' })
      if (path === 'login') {
        const r = await db.login(user, pass)
        return 'token' in r ? json(res, 200, r) : json(res, 401, r)
      }
      const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null
      if (email && !EMAIL_RE.test(email)) return json(res, 400, { error: 'E-mail inválido.' })
      const r = await db.register(user, pass, email)
      return 'token' in r ? json(res, 200, r) : json(res, 409, r)
    }
    if (path === 'forgot') {
      // A resposta é sempre a mesma, exista ou não a conta: não revela quem está cadastrado.
      if (typeof body.user === 'string' && body.user.length <= 254) {
        const r = await db.createReset(body.user.trim())
        if (r) {
          const base = opt.publicUrl ?? process.env.PUBLIC_URL ?? `http://${req.headers.host ?? 'localhost'}`
          mailer.send(r.email, `${GAME_NAME}: troca de senha`,
            `Olá, ${r.username}.\n\nPara criar uma senha nova, abra este link (vale por 30 minutos):\n${base}/?reset=${r.token}\n\nSe você não pediu a troca, ignore este e-mail.`)
            .catch((e) => console.error('erro ao enviar e-mail', e))
        }
      }
      return json(res, 200, { ok: true })
    }
    if (path === 'reset') {
      if (typeof body.token !== 'string' || !validPass(body.pass)) return json(res, 400, { error: 'Senha: de 8 a 72 caracteres.' })
      const account = await db.resetPassword(body.token, body.pass)
      if (account === null) return json(res, 400, { error: 'Link inválido ou vencido. Peça a troca de novo.' })
      const s = world.sessions.get(account)
      if (s) { s.send({ t: 'kicked', text: 'A senha foi trocada. Entre de novo.' }); await world.disconnect(s); s.conn.close() }
      return json(res, 200, { ok: true })
    }
    if (path === 'logout') { if (typeof body.token === 'string') await db.logout(body.token); return json(res, 200, { ok: true }) }
    return json(res, 404, { error: 'Não encontrado.' })
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      api(req, res, url.pathname.slice(5)).catch((e) => { console.error('erro na API', e); if (!res.headersSent) json(res, 500, { error: 'Erro no servidor.' }) })
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end() }
    // Arquivos estáticos do cliente já compilado (npm run build).
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\]|\.\.)+/, '')
    let file = join(DIST, rel)
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html')
    if (!existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Cliente não compilado. Rode: npm run build') }
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', // o link de troca de senha não vaza por Referer
      'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
    })
    if (req.method === 'HEAD') return res.end()
    createReadStream(file).pipe(res)
  })

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 })
  wss.on('connection', (ws: WebSocket) => {
    let session: Session | null = null
    let authing = false
    const authTimer = setTimeout(() => { if (!session) ws.close() }, 10_000)
    ws.on('message', (raw) => {
      let m: ClientMsg
      try { m = JSON.parse(raw.toString()) } catch { return }
      if (!m || typeof m !== 'object' || typeof m.t !== 'string') return
      if (session) { void world.handle(session, m); return }
      if (authing) return
      if (m.t !== 'auth' || typeof m.token !== 'string') return ws.close()
      authing = true
      db.accountByToken(m.token).then(async (account) => {
        if (!account) { ws.send(JSON.stringify({ t: 'kicked', text: 'Sessão expirada. Entre de novo.' })); return ws.close() }
        clearTimeout(authTimer)
        const s = await world.connect(account, { send: (d) => { if (ws.readyState === ws.OPEN) ws.send(d) }, close: () => ws.close() })
        if (ws.readyState !== ws.OPEN) return world.disconnect(s)
        session = s
      }).catch((e) => { console.error('erro na autenticação', e); ws.close() })
    })
    ws.on('close', () => { clearTimeout(authTimer); if (session) void world.disconnect(session) })
    ws.on('error', () => ws.close())
  })

  let last = Date.now()
  const loop = setInterval(() => {
    const now = Date.now(), dt = Math.min(0.25, (now - last) / 1000); last = now
    try { world.tick(dt) } catch (e) { console.error('erro no tick', e) }
  }, TICK_MS)
  const second = setInterval(() => world.second(), 1000)
  const saver = setInterval(() => { void world.saveAll() }, 30_000)
  const cleaner = setInterval(() => { world.cleanup().catch((e) => console.error('erro na limpeza', e)) }, 3600_000)

  const stop = async () => {
    clearInterval(loop); clearInterval(second); clearInterval(saver); clearInterval(cleaner)
    // Salva e encerra as sessões antes de fechar o banco: o evento de fechamento do socket chega depois.
    for (const sess of [...world.sessions.values()]) await world.disconnect(sess)
    for (const c of wss.clients) c.terminate()
    wss.close()
    await new Promise<void>((done) => server.close(() => done()))
    await db.close()
  }
  const port = await new Promise<number>((ready) => server.listen(opt.port ?? PORT, () => ready((server.address() as { port: number }).port)))
  return { port, stop, world, db, payments }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().then(({ port, stop }) => {
    console.log(`Servidor do jogo em http://localhost:${port} (${/^postgres/.test(process.env.DATABASE_URL ?? '') ? 'PostgreSQL remoto' : 'Postgres embutido'})`)
    for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { stop().then(() => process.exit(0)) })
  })
}
