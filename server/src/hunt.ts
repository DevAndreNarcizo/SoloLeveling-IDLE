// Simulação de uma caçada (instância privada) ou de um teste de promoção.
// Não conhece sockets: recebe o personagem, avança no tempo e devolve entidades, efeitos e mensagens.
import {
  AUTO_EXTRACT_LEVEL, BOSS_EVERY_KILLS, CLASSES, CORPSE_SECONDS, ECHO_LIMIT, ECHO_RESPAWN_SECONDS, ECHO_TIERS,
  ELITE_CHANCE, FRAGMENT_DROP, HUNT_MAP, INVENTORY_SIZE, KIND_MULT, MONSTERS, POTION_COOLDOWN, POTION_HEAL,
  POTION_THRESHOLD, SHARD_DROP, addExp, derive, echoStats, hitDamage, itemName, monsterStats, rankOf, rollItem, sellPrice,
  type Character, type Derived, type Echo, type MobKind,
} from '../../shared/content.ts'
import type { Ent, Fx, HuntStats } from '../../shared/protocol.ts'

export interface HuntOptions {
  mode: 'hunt' | 'promotion'
  monster: string; boss: string
  minLevel: number; maxLevel: number
  seconds?: number // limite do teste de promoção
  rng?: () => number
}
export interface LogLine { text: string; tone?: 'good' | 'bad' | 'loot' }
type Side = 'ally' | 'mob'
interface Actor {
  id: number; side: Side; k: 'p' | 'm' | 'e'
  x: number; y: number; hp: number; mhp: number; atk: number; def: number
  range: number; atkPerSec: number; cd: number; speed: number; mult: number
  sprite: string; name?: string; kind?: MobKind; level?: number
  target?: Actor; aggro?: boolean; homeX?: number; homeY?: number
  echo?: Echo; respawn?: number; proj?: string
}
interface Corpse { id: number; x: number; y: number; species: string; kind: MobKind; ttl: number; tried: boolean }

const MOB_COUNT = 9
const AGGRO_RADIUS = 170
// O chefe do teste de promoção é mais fraco que o chefe da fenda: a luta é solo e sem ecos.
const PROMO_HP = 0.5
const PROMO_ATK = 0.62
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

export class Hunt {
  readonly w = HUNT_MAP.w
  readonly h = HUNT_MAP.h
  hunter: Actor
  mobs: Actor[] = []
  echoes: Actor[] = []
  corpses: Corpse[] = []
  fx: Fx[] = []
  logs: LogLine[] = []
  stats: HuntStats = { kills: 0, exp: 0, gold: 0, seconds: 0, toBoss: BOSS_EVERY_KILLS }
  ended: null | 'died' | 'won' | 'timeout' = null
  dirty = true // o personagem mudou e precisa ser reenviado ao cliente
  private nextId = 1
  private d: Derived
  private rng: () => number
  private potionCd = 0
  private respawns: number[] = []
  private bossAlive = false

  constructor(public c: Character, public opt: HuntOptions) {
    this.rng = opt.rng ?? Math.random
    this.d = derive(c)
    const cls = CLASSES[c.cls]
    this.hunter = {
      id: this.nextId++, side: 'ally', k: 'p', x: this.w / 2, y: this.h / 2, hp: this.d.maxHp, mhp: this.d.maxHp,
      atk: this.d.atk, def: this.d.def, range: this.d.range, atkPerSec: this.d.atkPerSec, cd: 0, speed: this.d.speed,
      mult: cls.dmgMult, sprite: c.cls, name: c.name, proj: cls.projectile === 'none' ? undefined : cls.projectile,
    }
    if (opt.mode === 'hunt') {
      this.spawnEchoes()
      for (let i = 0; i < MOB_COUNT; i++) this.spawnMob()
    } else {
      this.stats.timeLeft = opt.seconds
      this.spawnMob('chefe', this.w / 2 + 260, this.h / 2)
    }
  }

  get mobLevel(): number {
    if (this.opt.mode === 'promotion') return this.opt.minLevel
    return Math.min(this.opt.maxLevel, Math.max(this.opt.minLevel, this.c.level))
  }

  private spawnEchoes() {
    const slots = rankOf(this.c).echoSlots
    const team = this.c.team.map((id) => this.c.echoes.find((e) => e.id === id)).filter((e): e is Echo => !!e).slice(0, slots)
    team.forEach((echo, i) => {
      const s = echoStats(echo, this.c.level)
      this.echoes.push({
        id: this.nextId++, side: 'ally', k: 'e', x: this.hunter.x - 40 - i * 26, y: this.hunter.y + 30, hp: s.maxHp, mhp: s.maxHp,
        atk: s.atk, def: s.def, range: 46, atkPerSec: 1, cd: 0, speed: 140, mult: 1,
        sprite: MONSTERS[echo.species] ? echo.species : this.opt.monster, name: ECHO_TIERS[echo.tier].name, echo,
      })
    })
  }

  private spawnMob(kind?: MobKind, x?: number, y?: number) {
    const k: MobKind = kind ?? (this.rng() < ELITE_CHANCE ? 'elite' : 'comum')
    const species = k === 'chefe' ? this.opt.boss : this.opt.monster
    const def = MONSTERS[species]
    const s = monsterStats(this.mobLevel, k)
    if (this.opt.mode === 'promotion') { s.maxHp = Math.round(s.maxHp * PROMO_HP); s.atk = Math.round(s.atk * PROMO_ATK) }
    let px = x, py = y
    for (let tries = 0; px === undefined || py === undefined; tries++) {
      const cx = 80 + this.rng() * (this.w - 160), cy = 80 + this.rng() * (this.h - 160)
      if (tries > 20 || dist({ x: cx, y: cy }, this.hunter) > 260) { px = cx; py = cy }
    }
    this.mobs.push({
      id: this.nextId++, side: 'mob', k: 'm', x: px, y: py, homeX: px, homeY: py, hp: s.maxHp, mhp: s.maxHp, atk: s.atk, def: s.def,
      range: def.ranged ? 170 : 44, atkPerSec: 0.8, cd: this.rng(), speed: def.speed, mult: 1,
      sprite: species, name: def.name, kind: k, level: this.mobLevel, proj: def.ranged ? 'bolt' : undefined,
    })
    if (k === 'chefe') this.bossAlive = true
  }

  private refreshHunter() {
    this.d = derive(this.c)
    const ratio = this.hunter.hp / this.hunter.mhp
    Object.assign(this.hunter, { mhp: this.d.maxHp, hp: Math.round(this.d.maxHp * ratio), atk: this.d.atk, def: this.d.def, atkPerSec: this.d.atkPerSec, speed: this.d.speed })
  }
  /** Chame depois de equipar, distribuir pontos etc. durante a caçada. */
  characterChanged() { this.refreshHunter(); this.dirty = true }

  private moveToward(a: Actor, tx: number, ty: number, dt: number) {
    const d = Math.hypot(tx - a.x, ty - a.y)
    if (d < 1) return
    const step = Math.min(d, a.speed * dt)
    a.x = Math.min(this.w - 20, Math.max(20, a.x + ((tx - a.x) / d) * step))
    a.y = Math.min(this.h - 20, Math.max(20, a.y + ((ty - a.y) / d) * step))
  }

  private nearest(from: Actor, list: Actor[]): Actor | undefined {
    let best: Actor | undefined, bd = Infinity
    for (const o of list) { if (o.hp <= 0) continue; const d = dist(from, o); if (d < bd) { bd = d; best = o } }
    return best
  }

  private act(a: Actor, target: Actor | undefined, dt: number) {
    a.cd = Math.max(0, a.cd - dt)
    if (!target || target.hp <= 0) return
    if (dist(a, target) > a.range) { this.moveToward(a, target.x, target.y, dt); return }
    if (a.cd > 0) return
    a.cd = 1 / a.atkPerSec
    const crit = a === this.hunter && this.rng() < this.d.crit
    const dmg = Math.round(hitDamage(a.atk, a.mult, target.def, this.rng()) * (crit ? this.d.critMult : 1))
    target.hp = Math.max(0, target.hp - dmg)
    if (target.side === 'mob') target.aggro = true
    this.fx.push({ f: 'hit', from: a.id, to: target.id, dmg, ...(crit ? { crit } : {}), ...(a.proj ? { proj: a.proj } : {}) })
    if (target.hp <= 0) this.onDeath(target)
  }

  private onDeath(a: Actor) {
    this.fx.push({ f: 'die', id: a.id })
    if (a === this.hunter) { this.ended = 'died'; return }
    if (a.k === 'e') { a.respawn = ECHO_RESPAWN_SECONDS; return }
    const kind = a.kind!
    if (this.opt.mode === 'promotion') { this.ended = 'won'; return }
    const s = monsterStats(a.level!, kind)
    const c = this.c
    c.kills++; c.gold += s.gold
    this.stats.kills++; this.stats.exp += s.exp; this.stats.gold += s.gold
    const capped = c.level >= rankOf(c).levelCap
    const ups = addExp(c, s.exp)
    if (ups > 0) {
      this.refreshHunter(); this.hunter.hp = this.hunter.mhp
      this.fx.push({ f: 'level', id: this.hunter.id })
      this.logs.push({ text: `Nível ${c.level}! +${ups * 4} pontos de atributo.`, tone: 'good' })
    } else if (capped && c.level < 60 && c.exp >= 1 && this.stats.kills % 25 === 1) {
      this.logs.push({ text: 'Limite de nível do rank atingido. Faça o teste de promoção na ficha do caçador.', tone: 'bad' })
    }
    const km = KIND_MULT[kind]
    if (this.rng() < km.drop) {
      const item = rollItem(a.level!, this.rng, `i${c.nextId++}`, kind === 'chefe' && this.rng() < 0.5 ? 'raro' : undefined)
      if (c.items.length >= INVENTORY_SIZE) {
        const price = sellPrice(item); c.gold += price
        this.logs.push({ text: `Mochila cheia: ${itemName(item)} vendido por ${price} de ouro.`, tone: 'bad' })
      } else {
        c.items.push(item)
        this.logs.push({ text: `Drop: ${itemName(item)} (nv ${item.level}).`, tone: 'loot' })
      }
    }
    if (this.rng() < SHARD_DROP * (kind === 'comum' ? 1 : 4)) { c.lasca++; this.logs.push({ text: 'Drop: Lasca de Fenda.', tone: 'loot' }) }
    if (this.rng() < FRAGMENT_DROP) c.fragmento++
    this.corpses.push({ id: this.nextId++, x: a.x, y: a.y, species: a.sprite, kind, ttl: CORPSE_SECONDS, tried: false })
    if (kind === 'chefe') {
      this.bossAlive = false
      this.logs.push({ text: `${a.name} derrotado!`, tone: 'good' })
    } else if (--this.stats.toBoss <= 0 && !this.bossAlive) {
      this.stats.toBoss = BOSS_EVERY_KILLS
      this.spawnMob('chefe')
      this.logs.push({ text: `O chefe ${MONSTERS[this.opt.boss].name} surgiu na fenda!`, tone: 'bad' })
    }
    if (kind !== 'chefe') this.respawns.push(3 + this.rng() * 3)
    this.dirty = true
  }

  /** Tenta evocar um eco do corpo mais próximo ainda não tentado. */
  extract(auto = false): boolean {
    if (this.opt.mode !== 'hunt' || this.ended) return false
    const c = this.c
    const body = this.corpses.filter((b) => !b.tried).sort((a, b) => dist(a, this.hunter) - dist(b, this.hunter))[0]
    if (!body) { if (!auto) this.logs.push({ text: 'Nenhum resquício por perto para evocar.', tone: 'bad' }); return false }
    if (c.fragmento < 1) { if (!auto) this.logs.push({ text: 'Sem Fragmentos de Eco. Compre com o Mercador.', tone: 'bad' }); return false }
    if (c.echoes.length >= ECHO_LIMIT) { if (!auto) this.logs.push({ text: 'Exército cheio. Funda ou liberte ecos.', tone: 'bad' }); return false }
    c.fragmento--; body.tried = true
    const ok = this.rng() < KIND_MULT[body.kind].extract
    this.fx.push({ f: 'extract', x: body.x, y: body.y, ok })
    if (ok) {
      const echo: Echo = { id: `e${c.nextId++}`, species: body.species, tier: 0, kind: body.kind }
      c.echoes.push(echo)
      if (c.team.length < rankOf(c).echoSlots) c.team.push(echo.id)
      body.ttl = 0
      this.logs.push({ text: `Eco evocado: ${MONSTERS[body.species].name}!`, tone: 'good' })
    } else if (!auto) this.logs.push({ text: 'A evocação falhou.', tone: 'bad' })
    this.dirty = true
    return ok
  }

  tick(dt: number) {
    if (this.ended) return
    this.stats.seconds += dt
    const h = this.hunter
    if (this.opt.mode === 'promotion') {
      this.stats.timeLeft = Math.max(0, (this.opt.seconds ?? 0) - this.stats.seconds)
      if (this.stats.timeLeft <= 0) { this.ended = 'timeout'; return }
    }
    // Reaparecimento de monstros e ecos
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      if ((this.respawns[i] -= dt) <= 0) { this.respawns.splice(i, 1); this.spawnMob() }
    }
    for (const e of this.echoes) {
      if (e.respawn !== undefined && (e.respawn -= dt) <= 0) { e.respawn = undefined; e.hp = e.mhp; e.x = h.x - 30; e.y = h.y + 20 }
    }
    this.mobs = this.mobs.filter((m) => m.hp > 0)
    const allies = [h, ...this.echoes.filter((e) => e.hp > 0)]

    // Monstros: acordam por proximidade ou ao levar dano
    for (const mob of this.mobs) {
      const near = this.nearest(mob, allies)
      if (!mob.aggro && near && dist(mob, near) < AGGRO_RADIUS) mob.aggro = true
      if (mob.aggro) this.act(mob, near, dt)
      if (this.ended) return
    }
    // Caçador: prioriza quem já está em luta, depois o mais próximo
    const fighting = this.mobs.filter((m) => m.hp > 0 && m.aggro)
    if (!h.target || h.target.hp <= 0) h.target = this.nearest(h, fighting) ?? this.nearest(h, this.mobs)
    this.act(h, h.target, dt)
    // Ecos: ajudam no alvo do caçador ou seguem o caçador
    for (const e of allies) {
      if (e === h) continue
      const t = h.target && h.target.hp > 0 ? h.target : this.nearest(e, fighting)
      if (t) this.act(e, t, dt)
      else if (dist(e, h) > 70) this.moveToward(e, h.x, h.y, dt)
    }
    // Poção automática e regeneração fora de combate
    this.potionCd = Math.max(0, this.potionCd - dt)
    if (h.hp > 0 && h.hp / h.mhp < POTION_THRESHOLD && this.potionCd <= 0 && this.c.pocao > 0) {
      const maxPotions = this.opt.mode === 'promotion' ? 3 : Infinity
      if (this.potionsUsed < maxPotions) {
        this.c.pocao--; this.potionsUsed++; this.potionCd = POTION_COOLDOWN
        const amount = Math.round(h.mhp * POTION_HEAL)
        h.hp = Math.min(h.mhp, h.hp + amount)
        this.fx.push({ f: 'heal', to: h.id, amount }); this.dirty = true
      }
    }
    if (fighting.length === 0) h.hp = Math.min(h.mhp, h.hp + h.mhp * 0.03 * dt)
    // Corpos e evocação automática
    for (const b of this.corpses) b.ttl -= dt
    this.corpses = this.corpses.filter((b) => b.ttl > 0)
    if (this.c.autoExtract && this.c.level >= AUTO_EXTRACT_LEVEL && this.corpses.some((b) => !b.tried)) this.extract(true)
  }
  private potionsUsed = 0

  snapshot(): Ent[] {
    const ents: Ent[] = []
    const h = this.hunter
    ents.push({ id: h.id, k: 'p', x: Math.round(h.x), y: Math.round(h.y), hp: Math.round(h.hp), mhp: h.mhp, s: h.sprite, n: h.name, r: rankOf(this.c).id, me: true })
    for (const e of this.echoes) if (e.hp > 0) ents.push({ id: e.id, k: 'e', x: Math.round(e.x), y: Math.round(e.y), hp: Math.round(e.hp), mhp: e.mhp, s: e.sprite, n: e.name })
    for (const mob of this.mobs) if (mob.hp > 0) ents.push({ id: mob.id, k: 'm', x: Math.round(mob.x), y: Math.round(mob.y), hp: Math.round(mob.hp), mhp: mob.mhp, s: mob.sprite, n: `${mob.name} nv ${mob.level}`, mk: mob.kind })
    for (const b of this.corpses) ents.push({ id: b.id, k: 'c', x: Math.round(b.x), y: Math.round(b.y), hp: b.tried ? 0 : 1, mhp: 1, s: b.species, mk: b.kind })
    return ents
  }
  takeFx(): Fx[] { const f = this.fx; this.fx = []; return f }
  takeLogs(): LogLine[] { const l = this.logs; this.logs = []; return l }
}
