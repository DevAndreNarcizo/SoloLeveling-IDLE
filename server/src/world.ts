// Mundo: sessões conectadas, a cidade compartilhada, as instâncias e os sistemas sociais e de economia.
// Toda regra é validada aqui; o cliente só envia intenções.
import {
  ARENA, ATTRS, AUTO_EXTRACT_LEVEL, BAG_EXPANSIONS, CITY_MAP, CITY_NAME, CLASSES, ECHO_FUSE_COUNT, ECHO_TIERS, ENCHANT_CHANCE, GUILD, HUNT_MAP,
  MARKET, MAX_ENCHANT, MONSTERS, PARTY_MAX, PREMIUM, PROMOTIONS, RANKS, REST, SHOP, SLOTS, TALENT_BY_ID, TALENT_MAX, TALENT_TIER_POINTS,
  addExp, bagSize, derive, echoFuseCost, enchantCost, findBand, guildFundsFor, itemName, newCharacter, pathPoints, rankOf, sellPrice,
  talentPoints, talentResetCost, type Character, type ClassId, type Echo, type Item,
} from '../../shared/content.ts'
import type { ChatChannel, ClientMsg, Ent, Fx, GuildView, InviteKind, MarketRow, PartyView, RoomInfo, ServerMsg, TradeView } from '../../shared/protocol.ts'
import type { Account, Db, Q } from './db.ts'
import { Hunt, type MemberInit } from './hunt.ts'
import { FloodGuard, filterChat } from './moderation.ts'
import type { Payments } from './payments.ts'

export interface Conn { send(data: string): void; close(): void }
const NAME_RE = /^[\p{L}\p{N}_]{3,16}$/u
const GUILD_NAME_RE = /^[\p{L}\p{N} ]{3,20}$/u
const TAG_RE = /^[\p{L}\p{N}]{2,4}$/u
const CITY_SPEED = 190
const CITY_EDGE_X = 300, CITY_EDGE_TOP = 300, CITY_EDGE_BOTTOM = 245
const CITY_MAX_PLAYERS_IN_SNAPSHOT = 60
const INVITE_MS = 60_000

interface Party { leader: number; members: number[] }
interface Trade { a: number; b: number; offer: Record<number, { items: string[]; gold: number; ok: boolean }> }
interface GuildRow { id: number; name: string; tag: string; leader_id: number; level: number; funds: number; notice: string }

export class Session {
  char: Character | null = null
  hunt: Hunt | null = null
  x = CITY_MAP.w / 2; y = CITY_MAP.h / 2 + 80
  dx = 0; dy = 0
  entId: number
  lastChat = 0
  budget = 40 // mensagens permitidas (repostas a cada segundo)
  closed = false
  rating = ARENA.startRating
  guildId: number | null = null
  guildRole: string | null = null
  party: Party | null = null
  trade: Trade | null = null
  invites = new Map<string, number>() // "tipo:conta" -> validade
  flood = new FloodGuard()
  queue: Promise<void> = Promise.resolve()
  constructor(public account: Account, public conn: Conn, id: number) { this.entId = id }
  get accountId() { return this.account.id }
  send(m: ServerMsg) { if (!this.closed) this.conn.send(JSON.stringify(m)) }
}

export class World {
  sessions = new Map<number, Session>() // por conta
  private byName = new Map<string, Session>()
  private guilds = new Map<number, GuildRow>()
  private recentChat: { from: string; text: string; channel: string; at: number }[] = []
  private nextEnt = 1_000_000
  private lock: Promise<unknown> = Promise.resolve()
  payments: Payments | null = null
  constructor(private db: Db, private rng: () => number = Math.random, private now: () => number = Date.now) {}

  /** Operações de economia entre jogadores rodam uma por vez, para nunca duplicar item ou ouro. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.lock.then(fn, fn)
    this.lock = run.catch(() => {})
    return run
  }
  private find(name: unknown): Session | undefined { return typeof name === 'string' ? this.byName.get(name.toLowerCase()) : undefined }

  // ---------- Conexão ----------
  async connect(account: Account, conn: Conn): Promise<Session> {
    const old = this.sessions.get(account.id)
    if (old) { old.send({ t: 'kicked', text: 'Sua conta entrou em outro lugar.' }); await this.disconnect(old); old.conn.close() }
    const s = new Session(account, conn, this.nextEnt++)
    this.sessions.set(account.id, s)
    const loaded = await this.db.loadCharacter(account.id)
    if (!loaded) s.send({ t: 'needChar' })
    else {
      s.char = loaded.c; s.rating = loaded.rating; s.guildId = loaded.guildId; s.guildRole = loaded.guildRole
      await this.enterWorld(s)
    }
    return s
  }
  async disconnect(s: Session) {
    if (s.closed) return
    s.closed = true
    if (this.sessions.get(s.accountId) === s) this.sessions.delete(s.accountId)
    if (s.char) {
      if (this.byName.get(s.char.name.toLowerCase()) === s) this.byName.delete(s.char.name.toLowerCase())
      this.cancelTrade(s, 'O outro caçador saiu do jogo.')
      const h = s.hunt
      if (h?.opt.mode === 'hunt' && h.members.length === 1 && !h.ended && h.seconds >= REST.minHuntSeconds) {
        const min = h.seconds / 60, st = h.statsFor(h.members[0])
        s.char.rest = { expPerMin: st.exp / min, goldPerMin: st.gold / min, since: this.now() }
      }
      if (h?.opt.mode === 'duel' && !h.ended) { h.ended = 'won'; h.winner = h.members.findIndex((m) => m.key !== s.accountId); await this.finishHunt(h) }
      else if (h && h.members.length > 1) this.dropFromHunt(s, h)
      s.hunt = null
      this.leaveParty(s, true)
      await this.db.saveCharacter(s.accountId, s.char).catch((e) => console.error('erro ao salvar', e))
    }
  }

  private async enterWorld(s: Session) {
    const c = s.char!
    this.byName.set(c.name.toLowerCase(), s)
    if (c.rest) {
      const minutes = Math.min(REST.maxHours * 60, (this.now() - c.rest.since) / 60000)
      if (minutes >= 1) {
        const exp = Math.round(c.rest.expPerMin * minutes * REST.rate), gold = Math.round(c.rest.goldPerMin * minutes * REST.rate)
        addExp(c, exp); c.gold += gold
        s.send({ t: 'rest', minutes: Math.round(minutes), exp, gold })
      }
      delete c.rest
    }
    await this.deliverPending(s)
    this.sendChar(s); this.sendAcct(s)
    if (s.guildId) await this.sendGuild(s)
    this.toCity(s)
  }
  /** Entrega ouro e itens que chegaram enquanto o jogador estava fora (vendas no mercado). */
  private async deliverPending(s: Session) {
    const c = s.char!
    const rows = await this.db.sql.tx(async (q) => {
      const r = await q<{ id: number; gold: number; item: Item | null; note: string }>('delete from pending_credits where account_id = $1 returning id, gold, item, note', [s.accountId])
      for (const p of r) { c.gold += Number(p.gold); if (p.item) c.items.push(typeof p.item === 'string' ? JSON.parse(p.item) : p.item) }
      if (r.length) await this.db.saveCharacter(s.accountId, c, q)
      return r
    })
    for (const p of rows) this.log(s, p.note, 'loot')
  }
  private sendChar(s: Session) { if (s.char) s.send({ t: 'char', c: s.char, d: derive(s.char) }) }
  private sendAcct(s: Session) { s.send({ t: 'acct', a: { crystals: s.account.crystals, role: s.account.role, rating: s.rating, hasEmail: !!s.account.email, payments: !!this.payments?.enabled } }) }
  private log(s: Session, text: string, tone?: 'good' | 'bad' | 'loot') { s.send({ t: 'log', text, tone }) }
  private err(s: Session, text: string) { s.send({ t: 'err', text }) }
  /** Avisa o jogador que seus cristais mudaram (compra confirmada). */
  crystalsChanged(accountId: number, balance: number, text: string) {
    const s = this.sessions.get(accountId)
    if (!s) return
    s.account.crystals = balance; this.sendAcct(s); this.log(s, text, 'good')
  }

  private toCity(s: Session) {
    s.hunt = null; s.dx = 0; s.dy = 0
    s.x = CITY_MAP.w / 2 + (this.rng() - 0.5) * 120; s.y = CITY_MAP.h / 2 + 60 + (this.rng() - 0.5) * 80
    const room: RoomInfo = { kind: 'city', w: CITY_MAP.w, h: CITY_MAP.h, map: 'cidade', title: CITY_NAME }
    s.send({ t: 'room', room, you: s.entId })
  }

  // ---------- Mensagens ----------
  /** Enfileira a mensagem: cada jogador é atendido em ordem, uma mensagem por vez. */
  handle(s: Session, m: ClientMsg): Promise<void> {
    if (s.closed || --s.budget < 0) return Promise.resolve()
    s.queue = s.queue.then(() => this.dispatch(s, m)).catch((e) => console.error('erro ao tratar mensagem', m?.t, e))
    return s.queue
  }
  private async dispatch(s: Session, m: ClientMsg): Promise<void> {
    if (s.closed) return
    if (m.t === 'createChar') return this.createChar(s, m.name, m.cls)
    const c = s.char
    if (!c) return
    switch (m.t) {
      case 'move': {
        const dx = Number(m.dx), dy = Number(m.dy)
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
        const len = Math.hypot(dx, dy)
        s.dx = len > 1 ? dx / len : dx; s.dy = len > 1 ? dy / len : dy
        return
      }
      case 'chat': return this.chat(s, m.text, m.channel ?? 'global', m.to)
      case 'report': return this.report(s, m.name, m.reason)
      case 'enterHunt': return this.enterHunt(s, m.rift, m.band)
      case 'promotion': return this.startPromotion(s)
      case 'leave': return this.leaveHunt(s)
      case 'extract': s.hunt?.extract(false, s.accountId); return
      case 'setAuto':
        if (c.level < AUTO_EXTRACT_LEVEL) return this.err(s, `A evocação automática libera no nível ${AUTO_EXTRACT_LEVEL}.`)
        c.autoExtract = !!m.extract; return this.changed(s)
      case 'attr': {
        const n = Math.floor(Number(m.n))
        if (!ATTRS.includes(m.attr) || !(n >= 1) || n > c.points) return
        c.attrs[m.attr] += n; c.points -= n; return this.changed(s)
      }
      case 'talent': {
        const t = TALENT_BY_ID[m.id]
        if (!t) return
        const cur = c.talents?.[t.id] ?? 0
        if (talentPoints(c).free < 1) return this.err(s, 'Sem pontos de talento.')
        if (cur >= TALENT_MAX) return this.err(s, 'Talento no nível máximo.')
        if (pathPoints(c, t.path) < t.tier * TALENT_TIER_POINTS) return this.err(s, `Exige ${t.tier * TALENT_TIER_POINTS} pontos nesta senda.`)
        c.talents = { ...c.talents, [t.id]: cur + 1 }; return this.changed(s)
      }
      case 'talentReset': {
        if (!talentPoints(c).spent) return
        const cost = talentResetCost(c)
        if (c.gold < cost) return this.err(s, 'Ouro insuficiente.')
        c.gold -= cost; c.talents = {}; return this.changed(s)
      }
      case 'equip': {
        if (s.trade) return this.err(s, 'Conclua ou cancele a troca antes.')
        const i = c.items.findIndex((it) => it.id === m.id)
        if (i < 0) return
        const it = c.items[i]
        if (it.cls && it.cls !== c.cls) return this.err(s, `Esta arma é de ${CLASSES[it.cls].name}.`)
        if (it.level > c.level) return this.err(s, `Exige nível ${it.level}.`)
        const prev = c.equipped[it.slot]
        c.items.splice(i, 1); if (prev) c.items.push(prev)
        c.equipped[it.slot] = it; return this.changed(s)
      }
      case 'unequip': {
        const it = SLOTS.includes(m.slot) ? c.equipped[m.slot] : undefined
        if (!it) return
        c.items.push(it); delete c.equipped[m.slot]; return this.changed(s)
      }
      case 'sell': {
        if (s.trade) return this.err(s, 'Conclua ou cancele a troca antes.')
        const i = c.items.findIndex((it) => it.id === m.id)
        if (i < 0) return
        c.gold += sellPrice(c.items[i]); c.items.splice(i, 1); return this.changed(s)
      }
      case 'sellCommons': {
        if (s.trade) return this.err(s, 'Conclua ou cancele a troca antes.')
        let gold = 0
        c.items = c.items.filter((it) => { if (it.rarity === 'comum' && it.enchant === 0) { gold += sellPrice(it); return false } return true })
        c.gold += gold; if (gold) this.log(s, `Peças comuns vendidas por ${gold} de ouro.`, 'loot'); return this.changed(s)
      }
      case 'enchant': return this.enchant(s, m.id)
      case 'buy': {
        const def = SHOP[m.what], n = Math.floor(Number(m.n))
        if (!def || !(n >= 1) || n > 999) return
        if (s.hunt) return this.err(s, 'A loja só atende na cidade.')
        if (c.gold < def.price * n) return this.err(s, 'Ouro insuficiente.')
        c.gold -= def.price * n; c[m.what] += n; return this.changed(s)
      }
      case 'team': {
        if (!Array.isArray(m.ids)) return
        const ids = [...new Set(m.ids.map(String))].filter((id) => c.echoes.some((e) => e.id === id)).slice(0, rankOf(c).echoSlots)
        c.team = ids
        if (s.hunt) this.log(s, 'O novo time entra em campo na próxima caçada.')
        return this.changed(s)
      }
      case 'fuse': return this.fuse(s, String(m.species), Math.floor(Number(m.tier)))
      case 'release': {
        const i = c.echoes.findIndex((e) => e.id === m.id)
        if (i < 0) return
        c.echoes.splice(i, 1); c.team = c.team.filter((id) => id !== m.id); return this.changed(s)
      }
      case 'ranking': {
        const rows = m.arena ? await this.db.arenaRanking() : await this.db.ranking()
        return s.send({ t: 'ranking', arena: !!m.arena, rows: rows.map((r) => ({ name: r.name, cls: r.cls as ClassId, level: r.level, rank: RANKS[r.rank]?.id ?? 'E', ...('rating' in r ? { rating: (r as { rating: number }).rating } : {}) })) })
      }
      case 'invite': return this.invite(s, m.kind, m.name)
      case 'accept': return this.accept(s, m.kind, m.from)
      case 'partyLeave': return this.leaveParty(s)
      case 'partyKick': {
        const o = this.find(m.name)
        if (!s.party || s.party.leader !== s.accountId || !o || o === s || o.party !== s.party) return
        this.leaveParty(o); this.log(o, 'Você foi removido do grupo.', 'bad'); return
      }
      case 'tradeOffer': return this.tradeOffer(s, m.items, m.gold)
      case 'tradeConfirm': return this.tradeConfirm(s)
      case 'tradeCancel': return this.cancelTrade(s, 'A troca foi cancelada.')
      case 'guildCreate': return this.guildCreate(s, m.name, m.tag)
      case 'guildLeave': return this.guildLeave(s)
      case 'guildKick': return this.guildKick(s, m.name)
      case 'guildRole': return this.guildSetRole(s, m.name, !!m.officer)
      case 'guildDonate': return this.guildDonate(s, m.gold)
      case 'guildNotice': return this.guildNotice(s, m.text)
      case 'guildInfo': return this.sendGuild(s)
      case 'marketList': return this.marketList(s, m.slot, !!m.mine)
      case 'marketSell': return this.marketSell(s, m.id, m.price)
      case 'marketBuy': return this.marketBuy(s, m.id)
      case 'marketCancel': return this.marketCancel(s, m.id)
      case 'premium': return this.premium(s, m.what, m.cls)
      case 'buyPack': return this.buyPack(s, m.pack)
    }
  }
  private changed(s: Session) { s.hunt?.characterChanged(s.accountId); this.sendChar(s) }

  private async createChar(s: Session, name: unknown, cls: unknown) {
    if (s.char) return
    if (typeof name !== 'string' || !NAME_RE.test(name)) return this.err(s, 'Nome inválido: use de 3 a 16 letras, números ou _.')
    if (typeof cls !== 'string' || !(cls in CLASSES)) return this.err(s, 'Classe inválida.')
    if (filterChat(name).masked) return this.err(s, 'Esse nome não é permitido.')
    if (await this.db.nameTaken(name)) return this.err(s, 'Esse nome já está em uso.')
    const c = newCharacter(name, cls as ClassId)
    try { await this.db.saveCharacter(s.accountId, c) } catch { return this.err(s, 'Esse nome já está em uso.') }
    s.char = c
    await this.enterWorld(s)
  }

  // ---------- Chat e moderação ----------
  private async chat(s: Session, text: unknown, channel: ChatChannel, to?: string): Promise<void> {
    if (typeof text !== 'string') return
    const raw = text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 160)
    if (!raw) return
    if (raw.startsWith('/')) return this.command(s, raw)
    const t = this.now()
    if (s.account.mutedUntil > t) return this.err(s, `Você está silenciado por mais ${Math.ceil((s.account.mutedUntil - t) / 60000)} min.`)
    if (t - s.lastChat < 1500) return this.err(s, 'Aguarde um instante para enviar outra mensagem.')
    s.lastChat = t
    if (s.flood.check(raw, t)) { s.account.mutedUntil = t + 60_000; return this.err(s, 'Mensagens repetidas: você foi silenciado por 1 minuto.') }
    const clean = filterChat(raw).text
    const c = s.char!
    const msg: ServerMsg = { t: 'chat', from: c.name, rank: rankOf(c).id, text: clean, channel, ...(s.guildId ? { tag: this.guilds.get(s.guildId)?.tag } : {}) }
    let targets: Session[] = []
    if (channel === 'whisper') {
      const o = this.find(to)
      if (!o || o === s) return this.err(s, 'Esse caçador não está online.')
      targets = [s, o]; (msg as { to?: string }).to = o.char!.name
    } else if (channel === 'party') {
      if (!s.party) return this.err(s, 'Você não está em um grupo.')
      targets = s.party.members.map((id) => this.sessions.get(id)).filter((x): x is Session => !!x)
    } else if (channel === 'guild') {
      if (!s.guildId) return this.err(s, 'Você não está em uma guilda.')
      targets = [...this.sessions.values()].filter((o) => o.guildId === s.guildId)
    } else targets = [...this.sessions.values()].filter((o) => o.char)
    for (const o of targets) o.send(msg)
    this.recentChat.push({ from: c.name, text: clean, channel, at: t })
    if (this.recentChat.length > 60) this.recentChat.shift()
    // Registro para auditoria de denúncias (apagado depois de 30 dias). Sussurros não são registrados.
    if (channel !== 'whisper') this.db.q('insert into chat_log (account_id, name, channel, text) values ($1, $2, $3, $4)', [s.accountId, c.name, channel, clean]).catch(() => {})
  }
  private async report(s: Session, name: unknown, reason: unknown) {
    if (typeof name !== 'string' || typeof reason !== 'string' || !NAME_RE.test(name)) return
    const context = this.recentChat.filter((m) => m.from.toLowerCase() === name.toLowerCase()).slice(-20)
    await this.db.q('insert into chat_reports (reporter_id, target_name, reason, context) values ($1, $2, $3, $4::jsonb)', [s.accountId, name, reason.slice(0, 200), JSON.stringify(context)])
    this.log(s, `Denúncia contra ${name} registrada. A moderação vai analisar.`, 'good')
  }
  /** Comandos do chat. /w é de todos; os demais exigem papel de moderador ou administrador. */
  private async command(s: Session, raw: string): Promise<void> {
    const [cmd, name, ...rest] = raw.slice(1).split(/\s+/)
    if (cmd === 'w' || cmd === 's') return name && rest.length ? this.chat(s, rest.join(' '), 'whisper', name) : this.err(s, 'Use: /w nome mensagem')
    const staff = s.account.role === 'mod' || s.account.role === 'admin'
    if (!staff || !name) return this.err(s, 'Comando desconhecido.')
    const targetId = await this.db.accountIdByName(name)
    if (!targetId) return this.err(s, 'Caçador não encontrado.')
    const online = this.sessions.get(targetId)
    if (cmd === 'mute') {
      const minutes = Math.min(60 * 24 * 30, Math.max(1, Math.floor(Number(rest[0]) || 10)))
      const until = this.now() + minutes * 60_000
      await this.db.q('update accounts set muted_until = $2 where id = $1', [targetId, new Date(until)])
      if (online) { online.account.mutedUntil = until; this.log(online, `Você foi silenciado por ${minutes} min pela moderação.`, 'bad') }
      return this.log(s, `${name} silenciado por ${minutes} min.`, 'good')
    }
    if (cmd === 'unmute') {
      await this.db.q('update accounts set muted_until = null where id = $1', [targetId])
      if (online) online.account.mutedUntil = 0
      return this.log(s, `${name} pode falar de novo.`, 'good')
    }
    if (cmd === 'kick' || (cmd === 'ban' && s.account.role === 'admin')) {
      if (cmd === 'ban') {
        await this.db.q('update accounts set banned = true where id = $1', [targetId])
        await this.db.q('delete from sessions where account_id = $1', [targetId])
      }
      if (online) { online.send({ t: 'kicked', text: cmd === 'ban' ? 'Esta conta foi suspensa.' : 'Você foi desconectado pela moderação.' }); await this.disconnect(online); online.conn.close() }
      return this.log(s, `${name} ${cmd === 'ban' ? 'suspenso' : 'desconectado'}.`, 'good')
    }
    return this.err(s, 'Comando desconhecido.')
  }

  // ---------- Caçadas, promoção e arena ----------
  private memberInit(s: Session): MemberInit {
    const g = s.guildId ? this.guilds.get(s.guildId) : undefined
    return { c: s.char!, key: s.accountId, expBonus: g ? g.level * GUILD.expPerLevel : 0 }
  }
  private enterHunt(s: Session, riftId: unknown, bandIndex: unknown) {
    const c = s.char!
    const found = typeof riftId === 'string' ? findBand(riftId, Math.floor(Number(bandIndex))) : null
    if (!found) return
    if (s.trade) return this.err(s, 'Conclua ou cancele a troca antes.')
    if (c.level < found.band.min) return this.err(s, `Exige nível ${found.band.min}.`)
    let group = [s]
    if (s.party) {
      if (s.party.leader !== s.accountId) return this.err(s, 'Só o líder do grupo abre a caçada.')
      // Vão junto os membros que estão na cidade e têm o nível da faixa.
      group = s.party.members.map((id) => this.sessions.get(id)).filter((o): o is Session => !!o && !o.hunt && !o.trade && o.char!.level >= found.band.min)
      if (!group.includes(s)) return this.err(s, 'Volte à cidade para abrir a caçada.')
    } else if (s.hunt) { if (s.hunt.members.length > 1) this.dropFromHunt(s, s.hunt) }
    const hunt = new Hunt(group.map((o) => this.memberInit(o)), { mode: 'hunt', monster: found.band.monster, boss: found.band.boss, minLevel: found.band.min, maxLevel: found.band.max, rng: this.rng, now: this.now })
    const room: RoomInfo = { kind: 'hunt', w: HUNT_MAP.w, h: HUNT_MAP.h, map: found.rift.id, title: `${found.rift.name} · nv ${found.band.min}–${found.band.max}${group.length > 1 ? ` · grupo de ${group.length}` : ''}`, rift: found.rift.id, band: Number(bandIndex), level: hunt.mobLevel }
    for (const o of group) { o.hunt = hunt; o.send({ t: 'room', room, you: hunt.memberId(o.accountId) }) }
  }
  private startPromotion(s: Session) {
    const c = s.char!
    const p = PROMOTIONS[c.rank]
    if (!p) return this.err(s, 'Você já está no rank mais alto disponível.')
    if (c.level < rankOf(c).levelCap) return this.err(s, `O teste libera no nível ${rankOf(c).levelCap}.`)
    if (s.hunt || s.trade) return this.err(s, 'Volte à cidade para iniciar o teste.')
    s.hunt = new Hunt([this.memberInit(s)], { mode: 'promotion', monster: p.boss, boss: p.boss, minLevel: p.level, maxLevel: p.level, seconds: p.seconds, rng: this.rng, now: this.now })
    const room: RoomInfo = { kind: 'promotion', w: HUNT_MAP.w, h: HUNT_MAP.h, map: 'arena', title: `Teste de promoção · ${MONSTERS[p.boss].name}`, seconds: p.seconds }
    s.send({ t: 'room', room, you: s.hunt.memberId(s.accountId) })
  }
  private startDuel(a: Session, b: Session) {
    const hunt = new Hunt([this.memberInit(a), this.memberInit(b)], { mode: 'duel', monster: '', boss: '', minLevel: 1, maxLevel: 1, seconds: ARENA.seconds, rng: this.rng, now: this.now })
    const room: RoomInfo = { kind: 'duel', w: HUNT_MAP.w, h: HUNT_MAP.h, map: 'arena', title: `Arena · ${a.char!.name} × ${b.char!.name}`, seconds: ARENA.seconds }
    for (const o of [a, b]) { o.hunt = hunt; o.send({ t: 'room', room, you: hunt.memberId(o.accountId) }) }
  }
  private async leaveHunt(s: Session) {
    const h = s.hunt
    if (!h) return
    if (h.opt.mode === 'duel' && !h.ended) { h.ended = 'won'; h.winner = h.members.findIndex((m) => m.key !== s.accountId); return this.finishHunt(h) }
    if (h.members.length > 1) this.dropFromHunt(s, h)
    this.toCity(s)
  }
  /** Tira um membro de uma caçada em grupo sem encerrar a instância dos outros. */
  private dropFromHunt(s: Session, h: Hunt) {
    const i = h.members.findIndex((m) => m.key === s.accountId)
    if (i >= 0) h.members.splice(i, 1)
    s.hunt = null
  }

  private async finishHunt(h: Hunt) {
    const mode = h.opt.mode
    if (mode === 'duel') {
      const [ma, mb] = h.members
      const a = this.sessions.get(ma.key), b = this.sessions.get(mb.key)
      const ra = a?.rating ?? ARENA.startRating, rb = b?.rating ?? ARENA.startRating
      const score = h.winner === 0 ? 1 : h.winner === 1 ? 0 : 0.5
      const expected = 1 / (1 + 10 ** ((rb - ra) / 400))
      const delta = Math.round(ARENA.k * (score - expected))
      for (const [o, d, won] of [[a, delta, h.winner === 0], [b, -delta, h.winner === 1]] as const) {
        if (!o) continue
        o.rating = Math.max(0, o.rating + d)
        await this.db.q('update characters set rating = $2 where account_id = $1', [o.accountId, o.rating])
        o.send({ t: 'result', win: won, title: h.winner < 0 ? 'Empate na arena' : won ? 'Vitória na arena!' : 'Derrota na arena', text: `Pontuação: ${o.rating} (${d >= 0 ? '+' : ''}${d}).` })
        this.sendAcct(o); this.toCity(o)
      }
      return
    }
    for (const m of [...h.members]) {
      const s = this.sessions.get(m.key)
      if (!s || s.hunt !== h) continue
      const c = s.char!
      if (mode === 'promotion') {
        if (h.ended === 'won') {
          c.rank++
          const ups = addExp(c, 0)
          s.send({ t: 'result', win: true, title: `Promovido a ${rankOf(c).name}!`, text: `Novo limite de nível: ${rankOf(c).levelCap}. Ecos em campo: ${rankOf(c).echoSlots}.${ups ? ` A EXP guardada rendeu ${ups} nível(is).` : ''}` })
        } else s.send({ t: 'result', win: false, title: 'Teste reprovado', text: h.ended === 'timeout' ? 'O tempo acabou. Melhore o equipamento e tente de novo, sem custo.' : 'Você caiu. Melhore o equipamento e tente de novo, sem custo.' })
      } else s.send({ t: 'result', win: false, title: h.members.length > 1 ? 'O grupo caiu na fenda' : 'Você caiu na fenda', text: `Abates: ${h.kills} · EXP: ${m.exp} · Ouro: ${m.gold}. Você voltou para ${CITY_NAME}.` })
      await this.db.saveCharacter(s.accountId, c)
      this.sendChar(s); this.toCity(s)
    }
  }

  private enchant(s: Session, id: unknown) {
    const c = s.char!
    if (s.hunt) return this.err(s, 'A forja só atende na cidade.')
    if (s.trade) return this.err(s, 'Conclua ou cancele a troca antes.')
    const it = c.items.find((i) => i.id === id) ?? SLOTS.map((sl) => c.equipped[sl]).find((i) => i?.id === id)
    if (!it) return
    if (it.enchant >= MAX_ENCHANT) return this.err(s, 'Esta peça já está no aprimoramento máximo.')
    const cost = enchantCost(it)
    if (c.gold < cost.gold || c.lasca < cost.shards) return this.err(s, 'Faltam ouro ou Lascas de Fenda.')
    c.gold -= cost.gold; c.lasca -= cost.shards
    if (this.rng() < ENCHANT_CHANCE[it.enchant]) { it.enchant++; this.log(s, `Aprimoramento bem-sucedido: ${itemName(it)}.`, 'good') }
    else this.log(s, 'O aprimoramento falhou. A peça não foi alterada.', 'bad')
    this.changed(s)
  }
  private fuse(s: Session, species: string, tier: number) {
    const c = s.char!
    if (!(tier >= 0) || tier >= ECHO_TIERS.length - 1) return
    if (tier + 1 > rankOf(c).maxEchoTier) return this.err(s, 'Seu rank de caçador ainda não comanda ecos desse grau.')
    const pool = c.echoes.filter((e) => e.species === species && e.tier === tier)
    if (pool.length < ECHO_FUSE_COUNT) return this.err(s, `São necessários ${ECHO_FUSE_COUNT} ecos iguais do mesmo grau.`)
    const cost = echoFuseCost(tier)
    if (c.gold < cost) return this.err(s, 'Ouro insuficiente.')
    c.gold -= cost
    // Consome primeiro quem está fora do time.
    const used = [...pool].sort((a, b) => Number(c.team.includes(a.id)) - Number(c.team.includes(b.id))).slice(0, ECHO_FUSE_COUNT)
    const usedIds = new Set(used.map((e) => e.id))
    const wasInTeam = c.team.some((id) => usedIds.has(id))
    c.echoes = c.echoes.filter((e) => !usedIds.has(e.id)); c.team = c.team.filter((id) => !usedIds.has(id))
    const kind = used.some((e) => e.kind === 'chefe') ? 'chefe' : used.some((e) => e.kind === 'elite') ? 'elite' : 'comum'
    const echo: Echo = { id: `e${c.nextId++}`, species, tier: tier + 1, kind }
    c.echoes.push(echo)
    if (wasInTeam) c.team.push(echo.id)
    this.log(s, `Fusão concluída: ${MONSTERS[species]?.name ?? species} ${ECHO_TIERS[tier + 1].name}.`, 'good')
    this.changed(s)
  }

  // ---------- Convites: grupo, duelo, troca e guilda ----------
  private invite(s: Session, kind: InviteKind, name: unknown) {
    const o = this.find(name)
    if (!o || !o.char) return this.err(s, 'Esse caçador não está online.')
    if (o === s) return
    const c = s.char!
    let text = ''
    if (kind === 'party') {
      if (s.party && s.party.leader !== s.accountId) return this.err(s, 'Só o líder convida para o grupo.')
      if (s.party && s.party.members.length >= PARTY_MAX) return this.err(s, `O grupo já tem ${PARTY_MAX} caçadores.`)
      if (o.party) return this.err(s, 'Esse caçador já está em um grupo.')
      text = `${c.name} convidou você para um grupo.`
    } else if (kind === 'duel') {
      if (c.level < ARENA.minLevel || o.char.level < ARENA.minLevel) return this.err(s, `A arena exige nível ${ARENA.minLevel} dos dois caçadores.`)
      if (s.hunt || o.hunt) return this.err(s, 'Os dois caçadores precisam estar na cidade.')
      text = `${c.name} desafiou você para um duelo na arena.`
    } else if (kind === 'trade') {
      if (s.hunt || o.hunt) return this.err(s, 'Os dois caçadores precisam estar na cidade.')
      if (s.trade || o.trade) return this.err(s, 'Um dos caçadores já está em uma troca.')
      text = `${c.name} quer trocar com você.`
    } else if (kind === 'guild') {
      if (!s.guildId || s.guildRole === 'membro') return this.err(s, 'Só o líder e os oficiais convidam para a guilda.')
      if (o.guildId) return this.err(s, 'Esse caçador já tem guilda.')
      text = `${c.name} convidou você para a guilda ${this.guilds.get(s.guildId)?.name ?? ''}.`
    } else return
    o.invites.set(`${kind}:${s.accountId}`, this.now() + INVITE_MS)
    o.send({ t: 'invited', kind, from: c.name, text })
    this.log(s, `Convite enviado a ${o.char.name}.`)
  }
  private async accept(s: Session, kind: InviteKind, from: unknown) {
    const o = this.find(from)
    if (!o) return this.err(s, 'Esse caçador não está mais online.')
    const key = `${kind}:${o.accountId}`
    const exp = s.invites.get(key)
    s.invites.delete(key)
    if (!exp || exp < this.now()) return this.err(s, 'O convite expirou.')
    if (kind === 'party') {
      if (s.party) return this.err(s, 'Saia do grupo atual antes.')
      if (!o.party) o.party = { leader: o.accountId, members: [o.accountId] }
      if (o.party.leader !== o.accountId || o.party.members.length >= PARTY_MAX) return this.err(s, 'O grupo não está mais disponível.')
      o.party.members.push(s.accountId); s.party = o.party
      this.sendParty(o.party)
    } else if (kind === 'duel') {
      if (s.hunt || o.hunt || s.trade || o.trade) return this.err(s, 'Os dois caçadores precisam estar livres na cidade.')
      this.startDuel(o, s)
    } else if (kind === 'trade') {
      if (s.hunt || o.hunt || s.trade || o.trade) return this.err(s, 'Os dois caçadores precisam estar livres na cidade.')
      const trade: Trade = { a: o.accountId, b: s.accountId, offer: { [o.accountId]: { items: [], gold: 0, ok: false }, [s.accountId]: { items: [], gold: 0, ok: false } } }
      o.trade = s.trade = trade
      this.sendTrade(trade)
    } else if (kind === 'guild') {
      if (s.guildId || !o.guildId) return this.err(s, 'O convite não é mais válido.')
      const gid = o.guildId
      const count = Number((await this.db.q<{ n: number }>('select count(*)::int as n from characters where guild_id = $1', [gid]))[0].n)
      if (count >= GUILD.maxMembers) return this.err(s, 'A guilda está cheia.')
      await this.db.q("update characters set guild_id = $2, guild_role = 'membro' where account_id = $1", [s.accountId, gid])
      s.guildId = gid; s.guildRole = 'membro'
      await this.broadcastGuild(gid, `${s.char!.name} entrou na guilda.`)
    }
  }

  // ---------- Grupo ----------
  private partyView(p: Party): PartyView {
    const name = (id: number) => this.sessions.get(id)?.char?.name ?? '?'
    return { leader: name(p.leader), members: p.members.map((id) => { const o = this.sessions.get(id); return { name: o?.char?.name ?? '?', cls: o?.char?.cls ?? 'lamina', level: o?.char?.level ?? 0, online: !!o } }) }
  }
  private sendParty(p: Party) { for (const id of p.members) this.sessions.get(id)?.send({ t: 'party', party: this.partyView(p) }) }
  private leaveParty(s: Session, silent = false) {
    const p = s.party
    if (!p) return
    p.members = p.members.filter((id) => id !== s.accountId)
    s.party = null
    if (!silent) s.send({ t: 'party', party: null })
    if (s.hunt && s.hunt.members.length > 1) { this.dropFromHunt(s, s.hunt); if (!silent) this.toCity(s) }
    if (p.members.length <= 1) { // grupo de um não existe
      for (const id of p.members) { const o = this.sessions.get(id); if (o) { o.party = null; o.send({ t: 'party', party: null }) } }
      return
    }
    if (p.leader === s.accountId) p.leader = p.members[0]
    this.sendParty(p)
  }

  // ---------- Troca direta ----------
  private tradeView(t: Trade, me: number): TradeView {
    const side = (id: number) => {
      const o = this.sessions.get(id)!, of = t.offer[id]
      return { name: o.char!.name, items: of.items.map((iid) => o.char!.items.find((i) => i.id === iid)).filter((i): i is Item => !!i), gold: of.gold, ok: of.ok }
    }
    return { mine: side(me), theirs: side(me === t.a ? t.b : t.a) }
  }
  private sendTrade(t: Trade) { for (const id of [t.a, t.b]) this.sessions.get(id)?.send({ t: 'trade', trade: this.tradeView(t, id) }) }
  private cancelTrade(s: Session, text: string) {
    const t = s.trade
    if (!t) return
    for (const id of [t.a, t.b]) { const o = this.sessions.get(id) ?? (id === s.accountId ? s : undefined); if (o) { o.trade = null; o.send({ t: 'trade', trade: null }); if (!o.closed) this.log(o, text, 'bad') } }
  }
  private tradeOffer(s: Session, items: unknown, gold: unknown) {
    const t = s.trade, c = s.char!
    if (!t || !Array.isArray(items)) return
    const ids = [...new Set(items.map(String))].filter((id) => c.items.some((i) => i.id === id)).slice(0, 8)
    const g = Math.floor(Number(gold))
    if (!(g >= 0) || g > c.gold) return this.err(s, 'Ouro insuficiente para essa oferta.')
    t.offer[s.accountId] = { items: ids, gold: g, ok: false }
    // Qualquer mudança desfaz a confirmação dos dois lados.
    t.offer[t.a].ok = false; t.offer[t.b].ok = false
    this.sendTrade(t)
  }
  private tradeConfirm(s: Session) {
    const t = s.trade
    if (!t) return
    t.offer[s.accountId].ok = true
    if (!t.offer[t.a].ok || !t.offer[t.b].ok) return this.sendTrade(t)
    return this.exclusive(async () => {
      const a = this.sessions.get(t.a), b = this.sessions.get(t.b)
      if (!a || !b || a.trade !== t || b.trade !== t) return
      const ca = a.char!, cb = b.char!, oa = t.offer[t.a], ob = t.offer[t.b]
      const ia = oa.items.map((id) => ca.items.find((i) => i.id === id)), ib = ob.items.map((id) => cb.items.find((i) => i.id === id))
      const fail = (text: string) => { this.cancelTrade(a, text) }
      if (ia.some((i) => !i) || ib.some((i) => !i) || ca.gold < oa.gold || cb.gold < ob.gold) return fail('A troca falhou: algum item ou ouro não está mais disponível.')
      if (ca.items.length - ia.length + ib.length > bagSize(ca) || cb.items.length - ib.length + ia.length > bagSize(cb)) return fail('A troca falhou: mochila cheia.')
      const snapA = JSON.stringify(ca), snapB = JSON.stringify(cb)
      const give = (from: Character, to: Character, list: Item[], gold: number) => {
        for (const it of list) { from.items.splice(from.items.indexOf(it), 1); to.items.push({ ...it, id: `i${to.nextId++}` }) }
        from.gold -= gold; to.gold += gold
      }
      give(ca, cb, ia as Item[], oa.gold); give(cb, ca, ib as Item[], ob.gold)
      try {
        await this.db.sql.tx(async (q) => { await this.db.saveCharacter(a.accountId, ca, q); await this.db.saveCharacter(b.accountId, cb, q) })
      } catch (e) {
        Object.assign(ca, JSON.parse(snapA)); Object.assign(cb, JSON.parse(snapB))
        console.error('troca desfeita', e); return fail('A troca falhou. Nada foi alterado.')
      }
      for (const o of [a, b]) { o.trade = null; o.send({ t: 'trade', trade: null }); this.log(o, 'Troca concluída.', 'good'); this.changed(o) }
    })
  }

  // ---------- Guilda ----------
  private async loadGuild(id: number): Promise<GuildRow | undefined> {
    const g = (await this.db.q<GuildRow>('select id, name, tag, leader_id, level, funds, notice from guilds where id = $1', [id]))[0]
    if (g) { g.funds = Number(g.funds); this.guilds.set(id, g) } else this.guilds.delete(id)
    return g
  }
  private async sendGuild(s: Session) {
    if (!s.guildId) return s.send({ t: 'guild', guild: null })
    const g = await this.loadGuild(s.guildId)
    if (!g) { s.guildId = null; s.guildRole = null; return s.send({ t: 'guild', guild: null }) }
    const rows = await this.db.q<{ account_id: number; name: string; cls: string; level: number; guild_role: string }>('select account_id, name, cls, level, guild_role from characters where guild_id = $1 order by level desc', [g.id])
    const view: GuildView = {
      id: g.id, name: g.name, tag: g.tag, level: g.level, funds: g.funds, next: g.level >= GUILD.maxLevel ? null : guildFundsFor(g.level + 1), notice: g.notice, role: s.guildRole ?? 'membro',
      members: rows.map((r) => ({ name: r.name, cls: r.cls as ClassId, level: r.level, role: r.guild_role, online: this.sessions.has(r.account_id) })),
    }
    s.send({ t: 'guild', guild: view })
  }
  private async broadcastGuild(gid: number, text?: string) {
    for (const o of this.sessions.values()) if (o.guildId === gid) { if (text) this.log(o, text, 'good'); await this.sendGuild(o) }
  }
  private async guildCreate(s: Session, name: unknown, tag: unknown) {
    const c = s.char!
    if (s.guildId) return this.err(s, 'Você já está em uma guilda.')
    if (typeof name !== 'string' || !GUILD_NAME_RE.test(name.trim()) || typeof tag !== 'string' || !TAG_RE.test(tag)) return this.err(s, 'Nome de 3 a 20 letras e sigla de 2 a 4 letras.')
    if (filterChat(name).masked || filterChat(tag).masked) return this.err(s, 'Esse nome não é permitido.')
    if (c.level < GUILD.minLevel) return this.err(s, `Criar guilda exige nível ${GUILD.minLevel}.`)
    if (c.gold < GUILD.cost) return this.err(s, `Criar guilda custa ${GUILD.cost} de ouro.`)
    const clean = name.trim()
    return this.exclusive(async () => {
      c.gold -= GUILD.cost
      try {
        const gid = await this.db.sql.tx(async (q) => {
          const id = (await q<{ id: number }>('insert into guilds (name, name_lower, tag, leader_id) values ($1, $2, $3, $4) returning id', [clean, clean.toLowerCase(), tag.toUpperCase(), s.accountId]))[0].id
          await this.db.saveCharacter(s.accountId, c, q)
          await q("update characters set guild_id = $2, guild_role = 'lider' where account_id = $1", [s.accountId, id])
          return id
        })
        s.guildId = gid; s.guildRole = 'lider'
        this.sendChar(s); await this.sendGuild(s); this.log(s, `Guilda ${clean} criada.`, 'good')
      } catch { c.gold += GUILD.cost; this.err(s, 'Já existe uma guilda com esse nome.') }
    })
  }
  private async guildLeave(s: Session) {
    const gid = s.guildId
    if (!gid) return
    return this.exclusive(async () => {
      const members = await this.db.q<{ account_id: number; guild_role: string }>('select account_id, guild_role from characters where guild_id = $1', [gid])
      if (s.guildRole === 'lider' && members.length > 1) return this.err(s, 'Passe a liderança ou remova os membros antes de sair.')
      await this.db.q('update characters set guild_id = null, guild_role = null where account_id = $1', [s.accountId])
      if (members.length <= 1) { await this.db.q('delete from guilds where id = $1', [gid]); this.guilds.delete(gid) }
      s.guildId = null; s.guildRole = null
      s.send({ t: 'guild', guild: null }); this.log(s, 'Você saiu da guilda.')
      await this.broadcastGuild(gid, `${s.char!.name} saiu da guilda.`)
    })
  }
  private async guildTarget(s: Session, name: unknown) {
    if (!s.guildId || typeof name !== 'string') return null
    const r = (await this.db.q<{ account_id: number; guild_role: string; name: string }>('select account_id, guild_role, name from characters where name_lower = $1 and guild_id = $2', [name.toLowerCase(), s.guildId]))[0]
    return r && r.account_id !== s.accountId ? r : null
  }
  private async guildKick(s: Session, name: unknown) {
    const gid = s.guildId, t = await this.guildTarget(s, name)
    if (!gid || !t) return
    if (s.guildRole === 'membro' || t.guild_role === 'lider' || (s.guildRole === 'oficial' && t.guild_role === 'oficial')) return this.err(s, 'Você não tem permissão para isso.')
    await this.db.q('update characters set guild_id = null, guild_role = null where account_id = $1', [t.account_id])
    const o = this.sessions.get(t.account_id)
    if (o) { o.guildId = null; o.guildRole = null; o.send({ t: 'guild', guild: null }); this.log(o, 'Você foi removido da guilda.', 'bad') }
    await this.broadcastGuild(gid, `${t.name} foi removido da guilda.`)
  }
  private async guildSetRole(s: Session, name: unknown, officer: boolean) {
    const gid = s.guildId, t = await this.guildTarget(s, name)
    if (!gid || !t || s.guildRole !== 'lider') return this.err(s, 'Só o líder altera cargos.')
    const role = officer ? 'oficial' : 'membro'
    await this.db.q('update characters set guild_role = $2 where account_id = $1', [t.account_id, role])
    const o = this.sessions.get(t.account_id); if (o) o.guildRole = role
    await this.broadcastGuild(gid, `${t.name} agora é ${role}.`)
  }
  private async guildDonate(s: Session, gold: unknown) {
    const gid = s.guildId, c = s.char!, n = Math.floor(Number(gold))
    if (!gid || !(n >= 1)) return
    if (n > c.gold) return this.err(s, 'Ouro insuficiente.')
    return this.exclusive(async () => {
      c.gold -= n
      try {
        const g = await this.db.sql.tx(async (q) => {
          const row = (await q<{ funds: number; level: number }>('update guilds set funds = funds + $2 where id = $1 returning funds, level', [gid, n]))[0]
          let level = row.level
          while (level < GUILD.maxLevel && Number(row.funds) >= guildFundsFor(level + 1)) level++
          if (level !== row.level) await q('update guilds set level = $2 where id = $1', [gid, level])
          await this.db.saveCharacter(s.accountId, c, q)
          return { level, up: level !== row.level }
        })
        this.sendChar(s)
        await this.broadcastGuild(gid, g.up ? `A guilda subiu para o nível ${g.level}! Bônus de EXP: +${g.level}%.` : `${c.name} doou ${n} de ouro à guilda.`)
      } catch (e) { c.gold += n; console.error('doação desfeita', e); this.err(s, 'A doação falhou. Nada foi alterado.') }
    })
  }
  private async guildNotice(s: Session, text: unknown) {
    if (!s.guildId || s.guildRole === 'membro' || typeof text !== 'string') return
    await this.db.q('update guilds set notice = $2 where id = $1', [s.guildId, filterChat(text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200)).text])
    await this.broadcastGuild(s.guildId)
  }

  // ---------- Mercado ----------
  private async marketList(s: Session, slot: unknown, mine: boolean) {
    const where = mine ? 'seller_id = $1' : SLOTS.includes(slot as never) ? 'slot = $1' : '$1::text is null'
    const param = mine ? s.accountId : SLOTS.includes(slot as never) ? slot : null
    const rows = await this.db.q<{ id: number; seller_id: number; seller_name: string; item: Item; price: number }>(
      `select id, seller_id, seller_name, item, price from market_listings where ${where} order by ${mine ? 'created_at desc' : 'price asc, id asc'} limit ${MARKET.pageSize}`, [param])
    const out: MarketRow[] = rows.map((r) => ({ id: r.id, seller: r.seller_name, item: typeof r.item === 'string' ? JSON.parse(r.item) : r.item, price: Number(r.price), mine: r.seller_id === s.accountId }))
    s.send({ t: 'market', rows: out, mine })
  }
  private async marketSell(s: Session, id: unknown, price: unknown) {
    const c = s.char!, p = Math.floor(Number(price))
    if (s.trade) return this.err(s, 'Conclua ou cancele a troca antes.')
    if (c.level < MARKET.minLevel) return this.err(s, `O mercado libera no nível ${MARKET.minLevel}.`)
    if (!(p >= 1) || p > MARKET.maxPrice) return this.err(s, 'Preço inválido.')
    return this.exclusive(async () => {
      const i = c.items.findIndex((it) => it.id === id)
      if (i < 0) return
      const count = Number((await this.db.q<{ n: number }>('select count(*)::int as n from market_listings where seller_id = $1', [s.accountId]))[0].n)
      if (count >= MARKET.maxListings) return this.err(s, `Limite de ${MARKET.maxListings} anúncios.`)
      const [item] = c.items.splice(i, 1)
      try {
        await this.db.sql.tx(async (q) => {
          await q('insert into market_listings (seller_id, seller_name, item, slot, level, rarity, price) values ($1, $2, $3::jsonb, $4, $5, $6, $7)', [s.accountId, c.name, JSON.stringify(item), item.slot, item.level, item.rarity, p])
          await this.db.saveCharacter(s.accountId, c, q)
        })
        this.changed(s); this.log(s, `${itemName(item)} anunciado por ${p} de ouro.`, 'good'); await this.marketList(s, '', true)
      } catch (e) { c.items.splice(i, 0, item); console.error('anúncio desfeito', e); this.err(s, 'Não foi possível anunciar. Nada foi alterado.') }
    })
  }
  private async marketBuy(s: Session, id: unknown) {
    const c = s.char!, lid = Math.floor(Number(id))
    if (!(lid >= 1)) return
    if (c.level < MARKET.minLevel) return this.err(s, `O mercado libera no nível ${MARKET.minLevel}.`)
    return this.exclusive(async () => {
      if (c.items.length >= bagSize(c)) return this.err(s, 'Mochila cheia.')
      const snap = JSON.stringify(c)
      try {
        const done = await this.db.sql.tx(async (q: Q) => {
          const l = (await q<{ seller_id: number; item: Item; price: number }>('delete from market_listings where id = $1 returning seller_id, item, price', [lid]))[0]
          if (!l) return { error: 'Esse anúncio não existe mais.' }
          const price = Number(l.price), item: Item = typeof l.item === 'string' ? JSON.parse(l.item) : l.item
          if (l.seller_id === s.accountId) throw new Error('proprio')
          if (c.gold < price) throw new Error('ouro')
          c.gold -= price; c.items.push({ ...item, id: `i${c.nextId++}` })
          await this.db.saveCharacter(s.accountId, c, q)
          const net = Math.floor(price * (1 - MARKET.tax))
          await q('insert into pending_credits (account_id, gold, note) values ($1, $2, $3)', [l.seller_id, net, `Mercado: ${itemName(item)} vendido por ${price} de ouro (você recebeu ${net}).`])
          return { item, seller: l.seller_id }
        })
        if ('error' in done) return this.err(s, done.error!)
        this.changed(s); this.log(s, `Compra concluída: ${itemName(done.item)}.`, 'good')
        const seller = this.sessions.get(done.seller)
        if (seller?.char) { await this.deliverPending(seller); this.sendChar(seller) }
        await this.marketList(s, '', false)
      } catch (e) {
        Object.assign(c, JSON.parse(snap))
        const msg = (e as Error).message
        this.err(s, msg === 'ouro' ? 'Ouro insuficiente.' : msg === 'proprio' ? 'Esse anúncio é seu. Use Cancelar.' : 'A compra falhou. Nada foi alterado.')
        if (msg !== 'ouro' && msg !== 'proprio') console.error('compra desfeita', e)
      }
    })
  }
  private async marketCancel(s: Session, id: unknown) {
    const c = s.char!, lid = Math.floor(Number(id))
    if (!(lid >= 1)) return
    return this.exclusive(async () => {
      if (c.items.length >= bagSize(c)) return this.err(s, 'Mochila cheia.')
      const snap = JSON.stringify(c)
      try {
        await this.db.sql.tx(async (q) => {
          const l = (await q<{ item: Item }>('delete from market_listings where id = $1 and seller_id = $2 returning item', [lid, s.accountId]))[0]
          if (!l) throw new Error('sumiu')
          const item: Item = typeof l.item === 'string' ? JSON.parse(l.item) : l.item
          c.items.push({ ...item, id: `i${c.nextId++}` })
          await this.db.saveCharacter(s.accountId, c, q)
        })
        this.changed(s); await this.marketList(s, '', true)
      } catch { Object.assign(c, JSON.parse(snap)); this.err(s, 'Esse anúncio não existe mais.') }
    })
  }

  // ---------- Cristais ----------
  private async premium(s: Session, what: unknown, cls: unknown) {
    const c = s.char!
    const def = PREMIUM[what as keyof typeof PREMIUM]
    if (!def) return
    if (what === 'mochila' && (c.bagExtra ?? 0) >= BAG_EXPANSIONS * 10) return this.err(s, 'A mochila já está no tamanho máximo.')
    if (what === 'talentos' && !talentPoints(c).spent) return this.err(s, 'Você não tem talentos para redefinir.')
    if (what === 'classe') {
      if (typeof cls !== 'string' || !(cls in CLASSES) || cls === c.cls) return this.err(s, 'Escolha outra classe.')
      if (s.hunt || s.trade) return this.err(s, 'Volte à cidade para mudar de classe.')
      if (c.equipped.arma && c.items.length >= bagSize(c)) return this.err(s, 'Libere um espaço na mochila para a arma.')
    }
    return this.exclusive(async () => {
      const balance = await this.db.addCrystals(s.accountId, -def.price, `loja:${String(what)}`, null)
      if (balance === null) return this.err(s, 'Cristais insuficientes.')
      s.account.crystals = balance
      if (what === 'boost') c.expBoostUntil = Math.max(c.expBoostUntil ?? 0, this.now()) + 3600_000
      else if (what === 'mochila') c.bagExtra = (c.bagExtra ?? 0) + 10
      else if (what === 'talentos') c.talents = {}
      else if (what === 'classe') {
        const spent = ATTRS.reduce((n, a) => n + c.attrs[a] - CLASSES[c.cls].start[a], 0)
        if (c.equipped.arma) { c.items.push(c.equipped.arma); delete c.equipped.arma }
        c.cls = cls as ClassId; c.attrs = { ...CLASSES[c.cls].start }; c.points += spent; c.talents = {}
        await this.db.q('update characters set cls = $2 where account_id = $1', [s.accountId, c.cls])
      }
      await this.db.saveCharacter(s.accountId, c)
      this.changed(s); this.sendAcct(s); this.log(s, `${def.name} ativado.`, 'good')
    })
  }
  private async buyPack(s: Session, pack: unknown) {
    if (!this.payments || typeof pack !== 'string') return this.err(s, 'As compras ainda não estão habilitadas.')
    const r = await this.payments.createOrder(s.accountId, pack)
    if ('error' in r) return this.err(s, r.error)
    s.send({ t: 'order', id: r.id, status: r.status, text: r.text })
  }

  // ---------- Laço do jogo ----------
  tick(dt: number) {
    const city: Session[] = []
    const hunts = new Set<Hunt>()
    for (const s of this.sessions.values()) {
      if (!s.char) continue
      if (s.hunt) { hunts.add(s.hunt); continue }
      // Limites da praça: ninguém anda por cima das casas da borda do mapa.
      s.x = Math.min(CITY_MAP.w - CITY_EDGE_X, Math.max(CITY_EDGE_X, s.x + s.dx * CITY_SPEED * dt))
      s.y = Math.min(CITY_MAP.h - CITY_EDGE_BOTTOM, Math.max(CITY_EDGE_TOP, s.y + s.dy * CITY_SPEED * dt))
      city.push(s)
    }
    for (const h of hunts) {
      const wasEnded = !!h.ended
      h.tick(dt)
      const fx: Fx[] = h.takeFx()
      for (const m of h.members) {
        const s = this.sessions.get(m.key)
        if (!s || s.hunt !== h) continue
        for (const l of h.takeLogs(m.key)) this.log(s, l.text, l.tone)
        if (m.dirty) { m.dirty = false; this.sendChar(s) }
        s.send({ t: 'snap', ents: h.snapshot(m.key), fx, stats: h.statsFor(m), cds: h.cooldowns(m.key) })
      }
      if (h.ended && !wasEnded) this.finishHunt(h).catch((e) => console.error('erro ao encerrar instância', e))
    }
    for (const s of city) {
      const ents: Ent[] = []
      const near = city.length <= CITY_MAX_PLAYERS_IN_SNAPSHOT ? city
        : [...city].sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y)).slice(0, CITY_MAX_PLAYERS_IN_SNAPSHOT)
      for (const o of near) {
        const tag = o.guildId ? this.guilds.get(o.guildId)?.tag : undefined
        ents.push({ id: o.entId, k: 'p', x: Math.round(o.x), y: Math.round(o.y), hp: 1, mhp: 1, s: o.char!.cls, n: o.char!.name, r: rankOf(o.char!).id, ...(tag ? { g: tag } : {}), ...(o === s ? { me: true } : {}) })
      }
      s.send({ t: 'snap', ents, fx: [] })
    }
  }
  /** Uma vez por segundo: repõe o orçamento de mensagens. */
  second() { for (const s of this.sessions.values()) s.budget = 40 }
  async saveAll() { for (const s of [...this.sessions.values()]) if (s.char) await this.db.saveCharacter(s.accountId, s.char).catch((e) => console.error('erro ao salvar', e)) }
  /** Limpeza periódica: registros de chat com mais de 30 dias e sessões e pedidos de senha vencidos. */
  async cleanup() {
    await this.db.q("delete from chat_log where created_at < now() - interval '30 days'")
    await this.db.q('delete from sessions where expires_at < now()')
    await this.db.q('delete from password_resets where expires_at < now()')
  }
}
