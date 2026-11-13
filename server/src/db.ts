// Persistência em PostgreSQL. Em produção usa DATABASE_URL (Supabase ou qualquer Postgres).
// Sem DATABASE_URL, usa o PGlite (Postgres embutido) em disco ou em memória: bom para desenvolver e testar.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import type { Character } from '../../shared/content.ts'

const scrypt = promisify(scryptCb) as (pass: string, salt: string, len: number) => Promise<Buffer>
const MIGRATIONS = resolve(fileURLToPath(import.meta.url), '../../migrations')
const SESSION_DAYS = 30
const RESET_MINUTES = 30
export const sha = (s: string) => createHash('sha256').update(s).digest('hex')

export type Q = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>
export interface Sql { q: Q; exec(text: string): Promise<void>; tx<T>(fn: (q: Q) => Promise<T>): Promise<T>; close(): Promise<void> }

/** Abre a conexão. `target`: URL postgres://, caminho de pasta para o PGlite ou ':memory:'. */
export async function openSql(target: string): Promise<Sql> {
  if (/^postgres(ql)?:\/\//.test(target)) {
    const pg = (await import('pg')).default
    pg.types.setTypeParser(20, Number) // bigint como número (ids e ouro cabem em 2^53)
    // O Supabase exige TLS. Com DATABASE_CA (arquivo .crt do projeto) o certificado é verificado;
    // sem ele a conexão continua cifrada, mas sem verificar o servidor.
    const ca = process.env.DATABASE_CA
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(target)
    const pool = new pg.Pool({ connectionString: target, max: 10, ssl: local ? undefined : ca ? { ca: readFileSync(ca, 'utf8') } : { rejectUnauthorized: false } })
    pool.on('error', (e) => console.error('erro no pool do banco', e.message))
    return {
      q: async (text, params) => (await pool.query(text, params as unknown[])).rows,
      exec: async (text) => { await pool.query(text) },
      tx: async (fn) => {
        const c = await pool.connect()
        try {
          await c.query('begin')
          const out = await fn(async (text, params) => (await c.query(text, params as unknown[])).rows)
          await c.query('commit'); return out
        } catch (e) { await c.query('rollback').catch(() => {}); throw e } finally { c.release() }
      },
      close: () => pool.end(),
    }
  }
  const { PGlite } = await import('@electric-sql/pglite')
  if (target !== ':memory:') mkdirSync(dirname(target), { recursive: true })
  const db = new PGlite(target === ':memory:' ? undefined : target, { parsers: { 20: Number } } as never)
  await db.waitReady
  // O PGlite usa uma única conexão: as transações precisam ser enfileiradas.
  let chain: Promise<unknown> = Promise.resolve()
  return {
    q: async (text, params) => (await db.query(text, params as unknown[])).rows as never,
    exec: async (text) => { await db.exec(text) },
    tx: (fn) => {
      const run = chain.then(() => db.transaction(async (t) => fn(async (text, params) => (await t.query(text, params as unknown[])).rows as never)))
      chain = run.catch(() => {})
      return run as never
    },
    close: () => db.close(),
  }
}

export interface Account { id: number; username: string; role: string; mutedUntil: number; banned: boolean; crystals: number; email: string | null }
export interface LoadedChar { c: Character; rating: number; guildId: number | null; guildRole: string | null }

export class Db {
  constructor(public sql: Sql) {}
  get q() { return this.sql.q }

  static async open(target: string): Promise<Db> {
    const db = new Db(await openSql(target))
    await db.migrate()
    return db
  }

  /** Aplica, em ordem, os arquivos de server/migrations ainda não aplicados. */
  async migrate() {
    await this.sql.exec('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())')
    await this.sql.exec('alter table schema_migrations enable row level security')
    const done = new Set((await this.q<{ name: string }>('select name from schema_migrations')).map((r) => r.name))
    if (!existsSync(MIGRATIONS)) return
    for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort()) {
      if (done.has(f)) continue
      await this.sql.exec(readFileSync(join(MIGRATIONS, f), 'utf8'))
      await this.q('insert into schema_migrations (name) values ($1) on conflict do nothing', [f])
    }
  }

  // ---------- Senhas e sessões ----------
  private async hash(pass: string, salt = randomBytes(16).toString('hex')) { return `${salt}:${(await scrypt(pass, salt, 64)).toString('hex')}` }
  private async verify(pass: string, stored: string) {
    const [salt, hex] = stored.split(':')
    const a = Buffer.from(hex, 'hex'), b = await scrypt(pass, salt, 64)
    return a.length === b.length && timingSafeEqual(a, b)
  }
  private dummy = this.hash('x')
  private async newSession(accountId: number, q: Q = this.q) {
    const token = randomBytes(32).toString('hex')
    await q('insert into sessions (token_hash, account_id, expires_at) values ($1, $2, $3)', [sha(token), accountId, new Date(Date.now() + SESSION_DAYS * 86400_000)])
    return token
  }

  async register(username: string, pass: string, email: string | null): Promise<{ token: string } | { error: string }> {
    const hash = await this.hash(pass)
    try {
      const rows = await this.q<{ id: number }>(
        'insert into accounts (username, username_lower, email, email_lower, pass_hash) values ($1, $2, $3, $4, $5) returning id',
        [username, username.toLowerCase(), email, email?.toLowerCase() ?? null, hash])
      return { token: await this.newSession(rows[0].id) }
    } catch (e) {
      const msg = String((e as { constraint?: string; message?: string }).constraint ?? (e as Error).message)
      if (msg.includes('email')) return { error: 'Esse e-mail já está em uso.' }
      if (msg.includes('username')) return { error: 'Esse usuário já existe.' }
      throw e
    }
  }
  async login(username: string, pass: string): Promise<{ token: string } | { error: string }> {
    const row = (await this.q<{ id: number; pass_hash: string; banned: boolean }>('select id, pass_hash, banned from accounts where username_lower = $1', [username.toLowerCase()]))[0]
    // Mesmo custo com ou sem conta, para não revelar quais usuários existem.
    const ok = await this.verify(pass, row?.pass_hash ?? (await this.dummy))
    if (!row || !ok) return { error: 'Usuário ou senha incorretos.' }
    if (row.banned) return { error: 'Esta conta foi suspensa.' }
    return { token: await this.newSession(row.id) }
  }
  async accountByToken(token: string): Promise<Account | null> {
    const r = (await this.q<{ id: number; username: string; role: string; muted_until: Date | null; banned: boolean; crystals: number; email: string | null }>(
      `select a.id, a.username, a.role, a.muted_until, a.banned, a.crystals, a.email from sessions s join accounts a on a.id = s.account_id
       where s.token_hash = $1 and s.expires_at > now()`, [sha(token)]))[0]
    if (!r || r.banned) return null
    return { id: r.id, username: r.username, role: r.role, mutedUntil: r.muted_until ? new Date(r.muted_until).getTime() : 0, banned: r.banned, crystals: r.crystals, email: r.email }
  }
  async logout(token: string) { await this.q('delete from sessions where token_hash = $1', [sha(token)]) }

  /** Cria um pedido de troca de senha. Devolve o token e o e-mail de destino, ou null se não houver conta com e-mail. */
  async createReset(userOrEmail: string): Promise<{ token: string; email: string; username: string } | null> {
    const key = userOrEmail.toLowerCase()
    const row = (await this.q<{ id: number; email: string | null; username: string }>('select id, email, username from accounts where (username_lower = $1 or email_lower = $1) and not banned', [key]))[0]
    if (!row?.email) return null
    const token = randomBytes(32).toString('hex')
    await this.q('delete from password_resets where account_id = $1', [row.id])
    await this.q('insert into password_resets (token_hash, account_id, expires_at) values ($1, $2, $3)', [sha(token), row.id, new Date(Date.now() + RESET_MINUTES * 60_000)])
    return { token, email: row.email, username: row.username }
  }
  /** Troca a senha com um token válido e encerra todas as sessões da conta. Devolve a conta, ou null. */
  async resetPassword(token: string, pass: string): Promise<number | null> {
    const hash = await this.hash(pass)
    return this.sql.tx(async (q) => {
      const row = (await q<{ account_id: number }>('update password_resets set used = true where token_hash = $1 and not used and expires_at > now() returning account_id', [sha(token)]))[0]
      if (!row) return null
      await q('update accounts set pass_hash = $1 where id = $2', [hash, row.account_id])
      await q('delete from sessions where account_id = $1', [row.account_id])
      return row.account_id
    })
  }

  // ---------- Personagens ----------
  async loadCharacter(accountId: number): Promise<LoadedChar | null> {
    const r = (await this.q<{ data: Character; rating: number; guild_id: number | null; guild_role: string | null }>('select data, rating, guild_id, guild_role from characters where account_id = $1', [accountId]))[0]
    return r ? { c: typeof r.data === 'string' ? JSON.parse(r.data) : r.data, rating: r.rating, guildId: r.guild_id, guildRole: r.guild_role } : null
  }
  async nameTaken(name: string) { return (await this.q('select 1 from characters where name_lower = $1', [name.toLowerCase()])).length > 0 }
  async saveCharacter(accountId: number, c: Character, q: Q = this.q) {
    await q(`insert into characters (account_id, name, name_lower, cls, level, exp, rank, data, updated_at) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now())
      on conflict (account_id) do update set level = excluded.level, exp = excluded.exp, rank = excluded.rank, data = excluded.data, updated_at = now()`,
      [accountId, c.name, c.name.toLowerCase(), c.cls, c.level, c.exp, c.rank, JSON.stringify(c)])
  }
  async accountIdByName(name: string): Promise<number | null> {
    return (await this.q<{ account_id: number }>('select account_id from characters where name_lower = $1', [name.toLowerCase()]))[0]?.account_id ?? null
  }
  ranking(limit = 20) { return this.q<{ name: string; cls: string; level: number; rank: number }>('select name, cls, level, rank from characters order by level desc, exp desc limit $1', [limit]) }
  arenaRanking(limit = 20) { return this.q<{ name: string; cls: string; level: number; rank: number; rating: number }>('select name, cls, level, rank, rating from characters order by rating desc, level desc limit $1', [limit]) }

  /** Soma (ou debita) cristais com registro no extrato. Devolve o novo saldo, ou null se faltar saldo. */
  async addCrystals(accountId: number, delta: number, reason: string, ref: string | null, q: Q = this.q): Promise<number | null> {
    const r = (await q<{ crystals: number }>('update accounts set crystals = crystals + $2 where id = $1 and crystals + $2 >= 0 returning crystals', [accountId, delta]))[0]
    if (!r) return null
    await q('insert into crystal_ledger (account_id, delta, reason, ref) values ($1, $2, $3, $4)', [accountId, delta, reason, ref])
    return r.crystals
  }
  close() { return this.sql.close() }
}
