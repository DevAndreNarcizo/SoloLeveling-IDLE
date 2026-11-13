// Mundo: sessões conectadas, a cidade compartilhada e as instâncias de caçada.
// Toda regra é validada aqui; o cliente só envia intenções.
import {
  ATTRS, AUTO_EXTRACT_LEVEL, CITY_MAP, CITY_NAME, CLASSES, ECHO_FUSE_COUNT, ECHO_TIERS, ENCHANT_CHANCE, HUNT_MAP, MAX_ENCHANT,
  MONSTERS, PROMOTIONS, RANKS, REST, SHOP, SLOTS, addExp, derive, echoFuseCost, enchantCost, findBand, itemName, newCharacter,
  rankOf, sellPrice, type Character, type ClassId, type Echo,
} from '../../shared/content.ts'
import type { ClientMsg, Ent, Fx, RoomInfo, ServerMsg } from '../../shared/protocol.ts'
import type { Db } from './db.ts'
import { Hunt } from './hunt.ts'

export interface Conn { send(data: string): void; close(): void }
const NAME_RE = /^[\p{L}\p{N}_]{3,16}$/u
const CITY_SPEED = 190
const CITY_MAX_PLAYERS_IN_SNAPSHOT = 60

export class Session {
  char: Character | null = null
  hunt: Hunt | null = null
  x = CITY_MAP.w / 2; y = CITY_MAP.h / 2 + 80
  dx = 0; dy = 0
  entId: number
  lastChat = 0
  budget = 40 // mensagens permitidas (repostas a cada segundo)
  dirty = false
  closed = false
  constructor(public accountId: number, public conn: Conn, id: number) { this.entId = id }
  send(m: ServerMsg) { if (!this.closed) this.conn.send(JSON.stringify(m)) }
}

export class World {
  sessions = new Map<number, Session>() // por conta
  private nextEnt = 1_000_000
  private cityFx: Fx[] = []
  constructor(private db: Db, private rng: () => number = Math.random, private now: () => number = Date.now) {}

  // ---------- Conexão ----------
  connect(accountId: number, conn: Conn): Session {
    const old = this.sessions.get(accountId)
    if (old) { old.send({ t: 'kicked', text: 'Sua conta entrou em outro lugar.' }); this.disconnect(old); old.conn.close() }
    const s = new Session(accountId, conn, this.nextEnt++)
    this.sessions.set(accountId, s)
    s.char = this.db.loadCharacter(accountId)
    if (!s.char) s.send({ t: 'needChar' })
    else this.enterWorld(s)
    return s
  }
  disconnect(s: Session) {
    if (s.closed) return
    if (s.char) {
      if (s.hunt?.opt.mode === 'hunt' && !s.hunt.ended && s.hunt.stats.seconds >= REST.minHuntSeconds) {
        const min = s.hunt.stats.seconds / 60
        s.char.rest = { expPerMin: s.hunt.stats.exp / min, goldPerMin: s.hunt.stats.gold / min, since: this.now() }
      }
      this.db.saveCharacter(s.accountId, s.char)
    }
    s.closed = true; s.hunt = null
    if (this.sessions.get(s.accountId) === s) this.sessions.delete(s.accountId)
  }

  private enterWorld(s: Session) {
    const c = s.char!
    if (c.rest) {
      const minutes = Math.min(REST.maxHours * 60, (this.now() - c.rest.since) / 60000)
      if (minutes >= 1) {
        const exp = Math.round(c.rest.expPerMin * minutes * REST.rate), gold = Math.round(c.rest.goldPerMin * minutes * REST.rate)
        addExp(c, exp); c.gold += gold
        s.send({ t: 'rest', minutes: Math.round(minutes), exp, gold })
      }
      delete c.rest
    }
    this.sendChar(s)
    this.toCity(s)
  }
  private sendChar(s: Session) { if (s.char) { s.send({ t: 'char', c: s.char, d: derive(s.char) }); s.dirty = false } }
  private log(s: Session, text: string, tone?: 'good' | 'bad' | 'loot') { s.send({ t: 'log', text, tone }) }
  private err(s: Session, text: string) { s.send({ t: 'err', text }) }

  private toCity(s: Session) {
    s.hunt = null; s.dx = 0; s.dy = 0
    s.x = CITY_MAP.w / 2 + (this.rng() - 0.5) * 120; s.y = CITY_MAP.h / 2 + 60 + (this.rng() - 0.5) * 80
    const room: RoomInfo = { kind: 'city', w: CITY_MAP.w, h: CITY_MAP.h, map: 'cidade', title: CITY_NAME }
    s.send({ t: 'room', room, you: s.entId })
  }

  // ---------- Mensagens ----------
  handle(s: Session, m: ClientMsg) {
    if (s.closed || --s.budget < 0) return
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
      case 'chat': return this.chat(s, m.text)
      case 'enterHunt': return this.enterHunt(s, m.rift, m.band)
      case 'promotion': return this.startPromotion(s)
      case 'leave': if (s.hunt) this.toCity(s); return
      case 'extract': s.hunt?.extract(); return
      case 'setAuto':
        if (c.level < AUTO_EXTRACT_LEVEL) return this.err(s, `A evocação automática libera no nível ${AUTO_EXTRACT_LEVEL}.`)
        c.autoExtract = !!m.extract; return this.changed(s)
      case 'attr': {
        const n = Math.floor(Number(m.n))
        if (!ATTRS.includes(m.attr) || !(n >= 1) || n > c.points) return
        c.attrs[m.attr] += n; c.points -= n; return this.changed(s)
      }
      case 'equip': {
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
        const i = c.items.findIndex((it) => it.id === m.id)
        if (i < 0) return
        c.gold += sellPrice(c.items[i]); c.items.splice(i, 1); return this.changed(s)
      }
      case 'sellCommons': {
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
      case 'ranking':
        return s.send({ t: 'ranking', rows: this.db.ranking().map((r) => ({ name: r.name, cls: r.cls as ClassId, level: r.level, rank: RANKS[r.rank]?.id ?? 'E' })) })
    }
  }
  private changed(s: Session) { s.hunt?.characterChanged(); this.sendChar(s) }

  private createChar(s: Session, name: unknown, cls: unknown) {
    if (s.char) return
    if (typeof name !== 'string' || !NAME_RE.test(name)) return this.err(s, 'Nome inválido: use de 3 a 16 letras, números ou _.')
    if (typeof cls !== 'string' || !(cls in CLASSES)) return this.err(s, 'Classe inválida.')
    if (this.db.nameTaken(name)) return this.err(s, 'Esse nome já está em uso.')
    s.char = newCharacter(name, cls as ClassId)
    this.db.saveCharacter(s.accountId, s.char)
    this.enterWorld(s)
  }

  private chat(s: Session, text: unknown) {
    if (typeof text !== 'string') return
    const clean = text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 160)
    if (!clean) return
    const t = this.now()
    if (t - s.lastChat < 1500) return this.err(s, 'Aguarde um instante para enviar outra mensagem.')
    s.lastChat = t
    const msg: ServerMsg = { t: 'chat', from: s.char!.name, rank: rankOf(s.char!).id, text: clean }
    for (const o of this.sessions.values()) if (o.char) o.send(msg)
  }

  private enterHunt(s: Session, riftId: unknown, bandIndex: unknown) {
    const c = s.char!
    const found = typeof riftId === 'string' ? findBand(riftId, Math.floor(Number(bandIndex))) : null
    if (!found) return
    if (c.level < found.band.min) return this.err(s, `Exige nível ${found.band.min}.`)
    s.hunt = new Hunt(c, { mode: 'hunt', monster: found.band.monster, boss: found.band.boss, minLevel: found.band.min, maxLevel: found.band.max, rng: this.rng })
    const room: RoomInfo = { kind: 'hunt', w: HUNT_MAP.w, h: HUNT_MAP.h, map: found.rift.id, title: `${found.rift.name} · nv ${found.band.min}–${found.band.max}`, rift: found.rift.id, band: Number(bandIndex), level: s.hunt.mobLevel }
    s.send({ t: 'room', room, you: s.hunt.hunter.id })
  }

  private startPromotion(s: Session) {
    const c = s.char!
    const p = PROMOTIONS[c.rank]
    if (!p) return this.err(s, 'Você já está no rank mais alto disponível.')
    if (c.level < rankOf(c).levelCap) return this.err(s, `O teste libera no nível ${rankOf(c).levelCap}.`)
    if (s.hunt) return this.err(s, 'Volte à cidade para iniciar o teste.')
    s.hunt = new Hunt(c, { mode: 'promotion', monster: p.boss, boss: p.boss, minLevel: p.level, maxLevel: p.level, seconds: p.seconds, rng: this.rng })
    const room: RoomInfo = { kind: 'promotion', w: HUNT_MAP.w, h: HUNT_MAP.h, map: 'arena', title: `Teste de promoção · ${MONSTERS[p.boss].name}`, seconds: p.seconds }
    s.send({ t: 'room', room, you: s.hunt.hunter.id })
  }

  private enchant(s: Session, id: unknown) {
    const c = s.char!
    if (s.hunt) return this.err(s, 'A forja só atende na cidade.')
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

  // ---------- Laço do jogo ----------
  tick(dt: number) {
    const city: Session[] = []
    for (const s of this.sessions.values()) {
      if (!s.char) continue
      if (!s.hunt) {
        s.x = Math.min(CITY_MAP.w - 24, Math.max(24, s.x + s.dx * CITY_SPEED * dt))
        s.y = Math.min(CITY_MAP.h - 24, Math.max(24, s.y + s.dy * CITY_SPEED * dt))
        city.push(s)
        continue
      }
      const h = s.hunt
      h.tick(dt)
      for (const l of h.takeLogs()) this.log(s, l.text, l.tone)
      if (h.dirty) { h.dirty = false; this.sendChar(s) }
      s.send({ t: 'snap', ents: h.snapshot(), fx: h.takeFx(), stats: h.stats })
      if (h.ended) this.finishHunt(s, h)
    }
    for (const s of city) {
      const ents: Ent[] = []
      const near = city.length <= CITY_MAX_PLAYERS_IN_SNAPSHOT ? city
        : [...city].sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y)).slice(0, CITY_MAX_PLAYERS_IN_SNAPSHOT)
      for (const o of near) {
        ents.push({ id: o.entId, k: 'p', x: Math.round(o.x), y: Math.round(o.y), hp: 1, mhp: 1, s: o.char!.cls, n: o.char!.name, r: rankOf(o.char!).id, ...(o === s ? { me: true } : {}) })
      }
      s.send({ t: 'snap', ents, fx: this.cityFx })
    }
    this.cityFx = []
  }
  private finishHunt(s: Session, h: Hunt) {
    const c = s.char!
    if (h.opt.mode === 'promotion') {
      if (h.ended === 'won') {
        c.rank++
        const ups = addExp(c, 0)
        s.send({ t: 'result', win: true, title: `Promovido a ${rankOf(c).name}!`, text: `Novo limite de nível: ${rankOf(c).levelCap}. Ecos em campo: ${rankOf(c).echoSlots}.${ups ? ` A EXP guardada rendeu ${ups} nível(is).` : ''}` })
      } else {
        s.send({ t: 'result', win: false, title: 'Teste reprovado', text: h.ended === 'timeout' ? 'O tempo acabou. Melhore o equipamento e tente de novo, sem custo.' : 'Você caiu. Melhore o equipamento e tente de novo, sem custo.' })
      }
    } else {
      s.send({ t: 'result', win: false, title: 'Você caiu na fenda', text: `Abates: ${h.stats.kills} · EXP: ${h.stats.exp} · Ouro: ${h.stats.gold}. Você voltou para ${CITY_NAME}.` })
    }
    this.db.saveCharacter(s.accountId, c)
    this.sendChar(s)
    this.toCity(s)
  }
  /** Uma vez por segundo: repõe o orçamento de mensagens. */
  second() { for (const s of this.sessions.values()) s.budget = 40 }
  saveAll() { for (const s of this.sessions.values()) if (s.char) this.db.saveCharacter(s.accountId, s.char) }
}
