// Persistência em SQLite (node:sqlite, sem dependência nativa). Para produção com muitos jogadores,
// troque esta camada por PostgreSQL mantendo as mesmas funções.
import { createRequire } from 'node:module'
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Character } from '../../shared/content.ts'

// Carregado por require: alguns empacotadores ainda não resolvem o módulo embutido node:sqlite.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
const SESSION_DAYS = 30
const sha = (s: string) => createHash('sha256').update(s).digest('hex')

export class Db {
  private db: DatabaseSyncType
  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
    this.db = new DatabaseSync(file)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        pass_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS characters (
        account_id INTEGER PRIMARY KEY REFERENCES accounts(id),
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        cls TEXT NOT NULL,
        level INTEGER NOT NULL,
        exp INTEGER NOT NULL,
        rank INTEGER NOT NULL,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_char_rank ON characters(level DESC, exp DESC);
    `)
  }

  private hash(pass: string, salt = randomBytes(16).toString('hex')): string {
    return `${salt}:${scryptSync(pass, salt, 64).toString('hex')}`
  }
  private verify(pass: string, stored: string): boolean {
    const [salt, hex] = stored.split(':')
    const a = Buffer.from(hex, 'hex'), b = scryptSync(pass, salt, 64)
    return a.length === b.length && timingSafeEqual(a, b)
  }
  private newSession(accountId: number): string {
    const token = randomBytes(32).toString('hex')
    this.db.prepare('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)')
      .run(sha(token), accountId, Date.now() + SESSION_DAYS * 86400_000)
    return token
  }

  /** Devolve o token da sessão ou null se o usuário já existe. */
  register(username: string, pass: string): string | null {
    if (this.db.prepare('SELECT 1 FROM accounts WHERE username = ?').get(username)) return null
    const r = this.db.prepare('INSERT INTO accounts (username, pass_hash, created_at) VALUES (?, ?, ?)').run(username, this.hash(pass), Date.now())
    return this.newSession(Number(r.lastInsertRowid))
  }
  login(username: string, pass: string): string | null {
    const row = this.db.prepare('SELECT id, pass_hash FROM accounts WHERE username = ?').get(username) as { id: number; pass_hash: string } | undefined
    // Mesmo custo com ou sem conta, para não revelar quais usuários existem.
    const ok = this.verify(pass, row?.pass_hash ?? this.dummy)
    return row && ok ? this.newSession(row.id) : null
  }
  private dummy = this.hash('x')

  accountByToken(token: string): number | null {
    const row = this.db.prepare('SELECT account_id, expires_at FROM sessions WHERE token_hash = ?').get(sha(token)) as { account_id: number; expires_at: number } | undefined
    if (!row || row.expires_at < Date.now()) return null
    return row.account_id
  }
  logout(token: string) { this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token)) }

  loadCharacter(accountId: number): Character | null {
    const row = this.db.prepare('SELECT data FROM characters WHERE account_id = ?').get(accountId) as { data: string } | undefined
    return row ? (JSON.parse(row.data) as Character) : null
  }
  nameTaken(name: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM characters WHERE name = ?').get(name)
  }
  saveCharacter(accountId: number, c: Character) {
    this.db.prepare(`
      INSERT INTO characters (account_id, name, cls, level, exp, rank, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET level = excluded.level, exp = excluded.exp, rank = excluded.rank, data = excluded.data, updated_at = excluded.updated_at
    `).run(accountId, c.name, c.cls, c.level, c.exp, c.rank, JSON.stringify(c), Date.now())
  }
  ranking(limit = 20): { name: string; cls: string; level: number; rank: number }[] {
    return this.db.prepare('SELECT name, cls, level, rank FROM characters ORDER BY level DESC, exp DESC LIMIT ?').all(limit) as never
  }
  close() { this.db.close() }
}
