// Servidor HTTP (contas + arquivos do cliente) e WebSocket (jogo em tempo real).
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, type WebSocket } from 'ws'
import type { ClientMsg } from '../../shared/protocol.ts'
import { Db } from './db.ts'
import { World, type Session } from './world.ts'

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..')
const PORT = Number(process.env.PORT ?? 3000)
const DIST = join(ROOT, 'client/dist')
const TICK_MS = 100
const USER_RE = /^[a-zA-Z0-9_]{3,16}$/
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
}

export function startServer(port = PORT, dbFile = process.env.DB_FILE ?? join(ROOT, 'data/umbral.db')) {
  const db = new Db(dbFile)
  const world = new World(db)

  // Limite de tentativas de login/cadastro por IP (janela de 1 minuto).
  const attempts = new Map<string, { n: number; reset: number }>()
  const limited = (ip: string) => {
    const now = Date.now(), a = attempts.get(ip)
    if (!a || a.reset < now) { attempts.set(ip, { n: 1, reset: now + 60_000 }); return false }
    return ++a.n > 12
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

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    if (req.method === 'POST' && (url.pathname === '/api/register' || url.pathname === '/api/login')) {
      const ip = req.socket.remoteAddress ?? '?'
      if (limited(ip)) return json(res, 429, { error: 'Muitas tentativas. Aguarde um minuto.' })
      let body: Record<string, unknown>
      try { body = await readBody(req) } catch { return json(res, 400, { error: 'Requisição inválida.' }) }
      const user = body.user, pass = body.pass
      if (typeof user !== 'string' || !USER_RE.test(user)) return json(res, 400, { error: 'Usuário: 3 a 16 letras, números ou _.' })
      if (typeof pass !== 'string' || pass.length < 8 || pass.length > 72) return json(res, 400, { error: 'Senha: de 8 a 72 caracteres.' })
      if (url.pathname === '/api/register') {
        const token = db.register(user, pass)
        return token ? json(res, 200, { token }) : json(res, 409, { error: 'Esse usuário já existe.' })
      }
      const token = db.login(user, pass)
      return token ? json(res, 200, { token }) : json(res, 401, { error: 'Usuário ou senha incorretos.' })
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      try { const b = await readBody(req); if (typeof b.token === 'string') db.logout(b.token) } catch { /* nada a fazer */ }
      return json(res, 200, { ok: true })
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end() }
    // Arquivos estáticos do cliente já compilado (npm run build).
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\]|\.\.)+/, '')
    let file = join(DIST, rel)
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html')
    if (!existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Cliente não compilado. Rode: npm run build') }
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
    })
    if (req.method === 'HEAD') return res.end()
    createReadStream(file).pipe(res)
  })

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 })
  wss.on('connection', (ws: WebSocket) => {
    let session: Session | null = null
    const authTimer = setTimeout(() => { if (!session) ws.close() }, 10_000)
    ws.on('message', (raw) => {
      let m: ClientMsg
      try { m = JSON.parse(raw.toString()) } catch { return }
      if (!m || typeof m !== 'object' || typeof m.t !== 'string') return
      if (!session) {
        if (m.t !== 'auth' || typeof m.token !== 'string') return ws.close()
        const account = db.accountByToken(m.token)
        if (account === null) { ws.send(JSON.stringify({ t: 'kicked', text: 'Sessão expirada. Entre de novo.' })); return ws.close() }
        clearTimeout(authTimer)
        session = world.connect(account, { send: (d) => { if (ws.readyState === ws.OPEN) ws.send(d) }, close: () => ws.close() })
        return
      }
      try { world.handle(session, m) } catch (e) { console.error('erro ao tratar mensagem', m.t, e) }
    })
    ws.on('close', () => { clearTimeout(authTimer); if (session) world.disconnect(session) })
    ws.on('error', () => ws.close())
  })

  let last = Date.now()
  const loop = setInterval(() => {
    const now = Date.now(), dt = Math.min(0.25, (now - last) / 1000); last = now
    try { world.tick(dt) } catch (e) { console.error('erro no tick', e) }
  }, TICK_MS)
  const second = setInterval(() => world.second(), 1000)
  const saver = setInterval(() => world.saveAll(), 30_000)

  const stop = () => new Promise<void>((done) => {
    clearInterval(loop); clearInterval(second); clearInterval(saver)
    // Salva e encerra as sessões antes de fechar o banco: o evento de fechamento do socket chega depois.
    for (const sess of [...world.sessions.values()]) world.disconnect(sess)
    for (const c of wss.clients) c.terminate()
    wss.close(); server.close(() => { db.close(); done() })
  })
  return new Promise<{ port: number; stop: () => Promise<void>; world: World }>((ready) => {
    server.listen(port, () => {
      const p = (server.address() as { port: number }).port
      ready({ port: p, stop, world })
    })
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().then(({ port, stop }) => {
    console.log(`Servidor do jogo em http://localhost:${port}`)
    for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { stop().then(() => process.exit(0)) })
  })
}
