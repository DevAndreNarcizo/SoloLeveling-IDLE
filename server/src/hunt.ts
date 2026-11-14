// Simulação de uma instância: caçada (solo ou em grupo), teste de promoção ou duelo de arena.
// Não conhece sockets: recebe personagens, avança no tempo e devolve entidades, efeitos e mensagens.
import {
  ARENA, AUTO_EXTRACT_LEVEL, BOOST_EXP, BOSS_EVERY_KILLS, CLASSES, CORPSE_SECONDS, ECHO_LIMIT, ECHO_RESPAWN_SECONDS, ECHO_TIERS,
  ELITE_CHANCE, FRAGMENT_DROP, HUNT_MAP, KIND_MULT, MAX_LEVEL, MONSTERS, PARTY_SHARE, POINTS_PER_LEVEL, POTION_COOLDOWN, POTION_HEAL,
  POTION_THRESHOLD, SHARD_DROP, SKILLS, addExp, bagSize, derive, echoStats, hitDamage, itemName, monsterStats, rankOf, rollItem, sellPrice,
  talentBonus, type BuffKind, type Character, type Derived, type Echo, type MobKind, type SkillDef, type TalentBonus,
} from '../../shared/content.ts'
import type { Ent, Fx, HuntStats } from '../../shared/protocol.ts'

export interface HuntOptions {
  mode: 'hunt' | 'promotion' | 'duel'
  monster: string; boss: string
  minLevel: number; maxLevel: number
  seconds?: number // limite do teste de promoção e do duelo
  rng?: () => number
  now?: () => number
}
export interface MemberInit { c: Character; key: number; expBonus?: number }
export interface LogLine { text: string; tone?: 'good' | 'bad' | 'loot' }
const MOB_TEAM = 99
interface Actor {
  id: number; team: number; k: 'p' | 'm' | 'e'
  x: number; y: number; hp: number; mhp: number; atk: number; def: number
  range: number; atkPerSec: number; cd: number; speed: number; mult: number
  sprite: string; name?: string; kind?: MobKind; level?: number
  target?: Actor; aggro?: boolean
  echo?: Echo; respawn?: number; proj?: string; owner?: Member
}
export interface Member {
  key: number; c: Character; d: Derived; tb: TalentBonus; actor: Actor; echoes: Actor[]
  potionCd: number; potionsUsed: number; skillCd: number[]; buffs: Record<BuffKind, number>; shield: number
  exp: number; gold: number; expBonus: number; respawn?: number; deaths: number
  dirty: boolean; logs: LogLine[]
}
interface Corpse { id: number; x: number; y: number; species: string; kind: MobKind; ttl: number; tried: boolean }

const AGGRO_RADIUS = 170
// Os mapas têm paredes nas bordas: monstros nascem dentro da área livre e ninguém anda por cima das paredes.
const EDGE_X = 230, EDGE_Y = 200
const WALL_X = 160, WALL_Y = 140
// Mapa de 1920×1280: mais monstros para manter a densidade da caçada.
const MOB_COUNT = 12
// O chefe do teste de promoção é mais fraco que o chefe da fenda: a luta é solo e sem ecos.
const PROMO_HP = 0.5
const PROMO_ATK = 0.62
const PARTY_RESPAWN = 8
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

export class Hunt {
  readonly w = HUNT_MAP.w
  readonly h = HUNT_MAP.h
  members: Member[] = []
  mobs: Actor[] = []
  corpses: Corpse[] = []
  fx: Fx[] = []
  kills = 0; seconds = 0; toBoss = BOSS_EVERY_KILLS; timeLeft?: number
  ended: null | 'died' | 'won' | 'timeout' = null
  /** No duelo: índice do membro vencedor (ou -1 em empate). */
  winner = -1
  private nextId = 1
  private rng: () => number
  private now: () => number
  private respawns: number[] = []
  private bossAlive = false

  constructor(inits: MemberInit[] | Character, public opt: HuntOptions) {
    this.rng = opt.rng ?? Math.random
    this.now = opt.now ?? Date.now
    const list: MemberInit[] = Array.isArray(inits) ? inits : [{ c: inits, key: 0 }]
    list.forEach((init, i) => this.addMember(init, i, list.length))
    if (opt.mode === 'hunt') for (let i = 0; i < MOB_COUNT + 5 * (list.length - 1); i++) this.spawnMob()
    else if (opt.mode === 'promotion') { this.timeLeft = opt.seconds; this.spawnMob('chefe', this.w / 2 + 260, this.h / 2) }
    else this.timeLeft = opt.seconds
  }

  // Atalhos usados por testes e pelo modo solo.
  get c() { return this.members[0].c }
  get hunter() { return this.members[0].actor }
  get echoes() { return this.members[0].echoes }
  get stats(): HuntStats { return this.statsFor(this.members[0]) }
  get mobLevel(): number {
    if (this.opt.mode !== 'hunt') return this.opt.minLevel
    const top = Math.max(...this.members.map((m) => m.c.level))
    return Math.min(this.opt.maxLevel, Math.max(this.opt.minLevel, top))
  }
  statsFor(m: Member): HuntStats { return { kills: this.kills, exp: m.exp, gold: m.gold, seconds: this.seconds, toBoss: this.toBoss, ...(this.timeLeft !== undefined ? { timeLeft: this.timeLeft } : {}) } }

  private addMember(init: MemberInit, index: number, count: number) {
    const c = init.c, d = derive(c), cls = CLASSES[c.cls], duel = this.opt.mode === 'duel'
    const hp = duel ? d.maxHp * ARENA.hpMult : d.maxHp
    const x = duel ? this.w / 2 + (index ? 220 : -220) : this.w / 2 + (index - (count - 1) / 2) * 50
    const actor: Actor = {
      id: this.nextId++, team: duel ? index : 0, k: 'p', x, y: this.h / 2, hp, mhp: hp, atk: d.atk, def: d.def, range: d.range,
      atkPerSec: d.atkPerSec, cd: duel ? 1 : 0, speed: d.speed, mult: cls.dmgMult, sprite: c.cls, name: c.name, proj: cls.projectile === 'none' ? undefined : cls.projectile,
    }
    const m: Member = {
      key: init.key, c, d, tb: talentBonus(c), actor, echoes: [], potionCd: 0, potionsUsed: 0, skillCd: SKILLS[c.cls].map(() => 2 + index),
      buffs: { guard: 0, haste: 0, shield: 0, focus: 0 }, shield: 0, exp: 0, gold: 0, expBonus: init.expBonus ?? 0, deaths: 0, dirty: true, logs: [],
    }
    actor.owner = m
    this.members.push(m)
    if (this.opt.mode === 'hunt') {
      const slots = count > 1 ? 1 : rankOf(c).echoSlots
      const team = c.team.map((id) => c.echoes.find((e) => e.id === id)).filter((e): e is Echo => !!e).slice(0, slots)
      team.forEach((echo, i) => {
        const s = echoStats(echo, c.level)
        const ehp = Math.round(s.maxHp * (1 + m.tb.echoHpPct))
        m.echoes.push({
          id: this.nextId++, team: 0, k: 'e', x: actor.x - 40 - i * 26, y: actor.y + 30 + index * 10, hp: ehp, mhp: ehp, atk: Math.round(s.atk * (1 + m.tb.echoAtkPct)),
          def: s.def, range: 46, atkPerSec: 1, cd: 0, speed: 140, mult: 1, sprite: MONSTERS[echo.species] ? echo.species : this.opt.monster, name: ECHO_TIERS[echo.tier].name, echo, owner: m,
        })
      })
    }
  }

  private spawnMob(kind?: MobKind, x?: number, y?: number) {
    const k: MobKind = kind ?? (this.rng() < ELITE_CHANCE ? 'elite' : 'comum')
    const species = k === 'chefe' ? this.opt.boss : this.opt.monster
    const def = MONSTERS[species]
    const s = monsterStats(this.mobLevel, k)
    if (this.opt.mode === 'promotion') { s.maxHp = Math.round(s.maxHp * PROMO_HP); s.atk = Math.round(s.atk * PROMO_ATK) }
    if (k === 'chefe' && this.members.length > 1) s.maxHp = Math.round(s.maxHp * (1 + 0.6 * (this.members.length - 1)))
    let px = x, py = y
    for (let tries = 0; px === undefined || py === undefined; tries++) {
      const cx = EDGE_X + this.rng() * (this.w - 2 * EDGE_X), cy = EDGE_Y + this.rng() * (this.h - 2 * EDGE_Y)
      if (tries > 20 || this.members.every((m) => dist({ x: cx, y: cy }, m.actor) > 260)) { px = cx; py = cy }
    }
    this.mobs.push({
      id: this.nextId++, team: MOB_TEAM, k: 'm', x: px, y: py, hp: s.maxHp, mhp: s.maxHp, atk: s.atk, def: s.def,
      range: def.ranged ? 170 : 44, atkPerSec: 0.8, cd: this.rng(), speed: def.speed, mult: 1,
      sprite: species, name: def.name, kind: k, level: this.mobLevel, proj: def.ranged ? 'bolt' : undefined,
    })
    if (k === 'chefe') this.bossAlive = true
  }

  /** Chame depois de equipar, distribuir pontos ou talentos durante a instância. */
  characterChanged(key = this.members[0].key) {
    const m = this.members.find((x) => x.key === key)
    if (!m) return
    this.refresh(m); m.dirty = true
  }
  private refresh(m: Member) {
    m.d = derive(m.c); m.tb = talentBonus(m.c)
    const a = m.actor, ratio = a.hp / a.mhp, mhp = this.opt.mode === 'duel' ? m.d.maxHp * ARENA.hpMult : m.d.maxHp
    Object.assign(a, { mhp, hp: Math.round(mhp * ratio), atk: m.d.atk, def: m.d.def, atkPerSec: m.d.atkPerSec, speed: m.d.speed })
  }

  private moveToward(a: Actor, tx: number, ty: number, dt: number) {
    const d = Math.hypot(tx - a.x, ty - a.y)
    if (d < 1) return
    const step = Math.min(d, a.speed * dt)
    a.x = Math.min(this.w - WALL_X, Math.max(WALL_X, a.x + ((tx - a.x) / d) * step))
    a.y = Math.min(this.h - WALL_Y, Math.max(WALL_Y, a.y + ((ty - a.y) / d) * step))
  }
  private nearest(from: { x: number; y: number }, list: Actor[]): Actor | undefined {
    let best: Actor | undefined, bd = Infinity
    for (const o of list) { if (o.hp <= 0) continue; const d = dist(from, o); if (d < bd) { bd = d; best = o } }
    return best
  }
  private living(): Actor[] {
    const out: Actor[] = []
    for (const m of this.members) { if (m.actor.hp > 0) out.push(m.actor); for (const e of m.echoes) if (e.hp > 0) out.push(e) }
    return out
  }

  /** Aplica dano considerando postura, tenacidade e escudo do alvo. Devolve o dano efetivo na vida. */
  private damage(from: Actor, target: Actor, raw: number, crit: boolean, skill = false) {
    let dmg = raw
    const tm = target.k === 'p' ? target.owner : undefined
    if (tm) {
      dmg *= 1 - tm.tb.guardPct
      if (tm.buffs.guard > 0) dmg *= 0.6
      if (tm.shield > 0) { const absorbed = Math.min(tm.shield, dmg); tm.shield -= absorbed; dmg -= absorbed }
    }
    dmg = Math.max(dmg > 0 ? 1 : 0, Math.round(dmg))
    target.hp = Math.max(0, target.hp - dmg)
    if (target.team === MOB_TEAM) target.aggro = true
    this.fx.push({ f: 'hit', from: from.id, to: target.id, dmg, ...(crit ? { crit } : {}), ...(from.proj ? { proj: from.proj } : {}), ...(skill ? { skill } : {}) })
    if (target.hp <= 0) this.onDeath(target, from)
  }

  private castSkill(m: Member, target: Actor, enemies: Actor[], fighting: boolean): boolean {
    const a = m.actor, defs = SKILLS[m.c.cls]
    for (let i = defs.length - 1; i >= 0; i--) {
      const s: SkillDef = defs[i]
      if (m.c.level < s.level || m.skillCd[i] > 0) continue
      if (s.kind === 'buff') {
        if (!fighting) continue
        const b = s.buff!
        if ((b === 'guard' || b === 'shield') && a.hp / a.mhp > 0.75) continue
        m.buffs[b] = s.seconds ?? 6
        if (b === 'shield') m.shield = Math.round(a.mhp * 0.25)
      } else {
        if (dist(a, target) > a.range) continue
        const mult = a.mult * (s.mult ?? 1) * (1 + m.tb.skillPct)
        const hits = s.kind === 'aoe' ? enemies.filter((e) => e.hp > 0 && dist(e, target) <= (s.radius ?? 90)) : [target]
        // Em área: vale contra dois ou mais, ou como golpe forte num alvo ainda inteiro.
        if (s.kind === 'aoe' && hits.length < 2 && target.hp < target.mhp * 0.5) continue
        for (const t of hits) {
          const crit = this.rng() < m.d.crit + (m.buffs.focus > 0 ? 0.3 : 0)
          this.damage(a, t, hitDamage(a.atk, mult, t.def, this.rng()) * (crit ? m.d.critMult : 1), crit, true)
          if (this.ended) break
        }
      }
      m.skillCd[i] = s.cd
      this.fx.push({ f: 'skill', id: a.id, name: s.name, ...(s.kind === 'aoe' ? { x: Math.round(target.x), y: Math.round(target.y), r: s.radius } : {}) })
      return true
    }
    return false
  }

  private act(a: Actor, target: Actor | undefined, dt: number, enemies: Actor[] = [], fighting = false) {
    a.cd = Math.max(0, a.cd - dt)
    if (!target || target.hp <= 0) return
    const m = a.k === 'p' ? a.owner : undefined
    if (dist(a, target) > a.range) { this.moveToward(a, target.x, target.y, dt); if (!m) return }
    if (a.cd > 0) return
    if (m && this.castSkill(m, target, enemies, fighting)) { a.cd = 0.6; return }
    if (dist(a, target) > a.range) return
    a.cd = 1 / (a.atkPerSec * (m && m.buffs.haste > 0 ? 1.6 : 1))
    const crit = !!m && this.rng() < m.d.crit + (m.buffs.focus > 0 ? 0.3 : 0)
    this.damage(a, target, hitDamage(a.atk, a.mult, target.def, this.rng()) * (crit ? m!.d.critMult : 1), crit)
  }

  private onDeath(a: Actor, killer: Actor) {
    this.fx.push({ f: 'die', id: a.id })
    if (a.k === 'e') { a.respawn = ECHO_RESPAWN_SECONDS; return }
    if (a.k === 'p') {
      if (this.opt.mode === 'duel') { this.ended = 'won'; this.winner = this.members.findIndex((m) => m.actor === killer || m.echoes.includes(killer)); return }
      if (this.opt.mode !== 'hunt') { this.ended = 'died'; return }
      // Na fenda comum a caçada nunca para: o caçador volta em alguns segundos.
      a.owner!.respawn = PARTY_RESPAWN; a.owner!.deaths++
      a.owner!.logs.push({ text: `Você caiu. Volta à luta em ${PARTY_RESPAWN}s.`, tone: 'bad' })
      if (this.members.every((m) => m.actor.hp <= 0)) {
        // Todos caíram: o chefe se retira e os monstros voltam a descansar.
        if (this.bossAlive) { this.mobs = this.mobs.filter((mob) => mob.kind !== 'chefe'); this.bossAlive = false; this.toBoss = BOSS_EVERY_KILLS
          for (const m of this.members) m.logs.push({ text: 'O chefe se retirou. Fortaleça o caçador antes do próximo.', tone: 'bad' }) }
        for (const mob of this.mobs) { mob.aggro = false; mob.hp = mob.mhp }
      }
      return
    }
    const kind = a.kind!
    if (this.opt.mode === 'promotion') { this.ended = 'won'; return }
    const s = monsterStats(a.level!, kind), km = KIND_MULT[kind], party = this.members.length > 1
    this.kills++
    for (const m of this.members) {
      const c = m.c
      const boost = c.expBoostUntil && c.expBoostUntil > this.now() ? BOOST_EXP : 0
      const exp = Math.round(s.exp * (party ? PARTY_SHARE : 1) * (1 + m.tb.expPct + m.expBonus + boost))
      const gold = Math.round(s.gold * (party ? PARTY_SHARE : 1))
      c.kills++; c.gold += gold; m.exp += exp; m.gold += gold
      const capped = c.level >= rankOf(c).levelCap
      const ups = addExp(c, exp)
      if (ups > 0) {
        this.refresh(m); m.actor.hp = m.actor.mhp
        this.fx.push({ f: 'level', id: m.actor.id })
        m.logs.push({ text: `Nível ${c.level}! +${ups * POINTS_PER_LEVEL} pontos de atributo e +${ups} de talento.`, tone: 'good' })
      } else if (capped && c.level < MAX_LEVEL && this.kills % 25 === 1) {
        m.logs.push({ text: 'Limite de nível do rank atingido. Faça o teste de promoção na ficha do caçador.', tone: 'bad' })
      }
      if (this.rng() < km.drop * (party && kind !== 'chefe' ? 0.8 : 1)) {
        const item = rollItem(a.level!, this.rng, `i${c.nextId++}`, kind === 'chefe' && this.rng() < 0.5 ? 'raro' : undefined)
        if (c.items.length >= bagSize(c)) {
          const price = sellPrice(item); c.gold += price
          m.logs.push({ text: `Mochila cheia: ${itemName(item)} vendido por ${price} de ouro.`, tone: 'bad' })
        } else {
          c.items.push(item)
          m.logs.push({ text: `Drop: ${itemName(item)} (nv ${item.level}).`, tone: 'loot' })
        }
      }
      if (this.rng() < SHARD_DROP * (kind === 'comum' ? 1 : 4)) { c.lasca++; m.logs.push({ text: 'Drop: Lasca de Fenda.', tone: 'loot' }) }
      if (this.rng() < FRAGMENT_DROP) c.fragmento++
      if (kind === 'chefe') m.logs.push({ text: `${a.name} derrotado!`, tone: 'good' })
      m.dirty = true
    }
    this.corpses.push({ id: this.nextId++, x: a.x, y: a.y, species: a.sprite, kind, ttl: CORPSE_SECONDS, tried: false })
    if (kind === 'chefe') this.bossAlive = false
    else if (--this.toBoss <= 0 && !this.bossAlive) {
      this.toBoss = BOSS_EVERY_KILLS
      this.spawnMob('chefe')
      for (const m of this.members) m.logs.push({ text: `O chefe ${MONSTERS[this.opt.boss].name} surgiu na fenda!`, tone: 'bad' })
    }
    if (kind !== 'chefe') this.respawns.push(3 + this.rng() * 3)
  }

  /** Tenta evocar um eco do corpo mais próximo ainda não tentado. */
  extract(auto = false, key = this.members[0].key): boolean {
    const m = this.members.find((x) => x.key === key)
    if (!m || this.opt.mode !== 'hunt' || this.ended) return false
    const c = m.c, say = (text: string) => { if (!auto) m.logs.push({ text, tone: 'bad' }) }
    const body = this.corpses.filter((b) => !b.tried).sort((a, b) => dist(a, m.actor) - dist(b, m.actor))[0]
    if (!body) { say('Nenhum resquício por perto para evocar.'); return false }
    if (c.fragmento < 1) { say('Sem Fragmentos de Eco. Compre com o Mercador.'); return false }
    if (c.echoes.length >= ECHO_LIMIT) { say('Exército cheio. Funda ou liberte ecos.'); return false }
    c.fragmento--; body.tried = true
    const ok = this.rng() < KIND_MULT[body.kind].extract * (1 + m.tb.extractPct)
    this.fx.push({ f: 'extract', x: body.x, y: body.y, ok })
    if (ok) {
      const echo: Echo = { id: `e${c.nextId++}`, species: body.species, tier: 0, kind: body.kind }
      c.echoes.push(echo)
      if (c.team.length < rankOf(c).echoSlots) c.team.push(echo.id)
      body.ttl = 0
      m.logs.push({ text: `Eco evocado: ${MONSTERS[body.species].name}!`, tone: 'good' })
    } else say('A evocação falhou.')
    m.dirty = true
    return ok
  }

  tick(dt: number) {
    if (this.ended) return
    this.seconds += dt
    const mode = this.opt.mode
    if (this.timeLeft !== undefined) {
      this.timeLeft = Math.max(0, (this.opt.seconds ?? 0) - this.seconds)
      if (this.timeLeft <= 0) {
        this.ended = 'timeout'
        if (mode === 'duel') { // vence quem tem mais vida proporcional
          const [a, b] = this.members.map((m) => m.actor.hp / m.actor.mhp)
          this.winner = a === b ? -1 : a > b ? 0 : 1
        }
        return
      }
    }
    for (let i = this.respawns.length - 1; i >= 0; i--) if ((this.respawns[i] -= dt) <= 0) { this.respawns.splice(i, 1); this.spawnMob() }
    for (const m of this.members) {
      const h = m.actor
      for (const e of m.echoes) if (e.respawn !== undefined && (e.respawn -= dt) <= 0) { e.respawn = undefined; e.hp = e.mhp; e.x = h.x - 30; e.y = h.y + 20 }
      if (m.respawn !== undefined && (m.respawn -= dt) <= 0) { m.respawn = undefined; h.hp = h.mhp; h.x = this.w / 2; h.y = this.h / 2; h.target = undefined }
      for (let i = 0; i < m.skillCd.length; i++) m.skillCd[i] = Math.max(0, m.skillCd[i] - dt)
      for (const b of Object.keys(m.buffs) as BuffKind[]) { m.buffs[b] = Math.max(0, m.buffs[b] - dt); if (b === 'shield' && m.buffs[b] <= 0) m.shield = 0 }
      m.potionCd = Math.max(0, m.potionCd - dt)
    }
    this.mobs = this.mobs.filter((mob) => mob.hp > 0)
    const allies = this.living()

    // Monstros: acordam por proximidade ou ao levar dano
    for (const mob of this.mobs) {
      const near = this.nearest(mob, allies)
      if (!mob.aggro && near && dist(mob, near) < AGGRO_RADIUS) mob.aggro = true
      if (mob.aggro) this.act(mob, near, dt)
      if (this.ended) return
    }
    const fightingMobs = this.mobs.filter((mob) => mob.hp > 0 && mob.aggro)
    for (const m of this.members) {
      const h = m.actor
      if (h.hp <= 0) continue
      // Inimigos: monstros, ou o outro caçador no duelo
      const foes = mode === 'duel' ? this.members.filter((o) => o !== m && o.actor.hp > 0).map((o) => o.actor) : this.mobs
      const engaged = mode === 'duel' ? foes : fightingMobs
      if (!h.target || h.target.hp <= 0) h.target = this.nearest(h, engaged) ?? this.nearest(h, foes)
      this.act(h, h.target, dt, foes, engaged.length > 0)
      if (this.ended) return
      for (const e of m.echoes) {
        if (e.hp <= 0) continue
        e.cd = Math.max(0, e.cd)
        const t = h.target && h.target.hp > 0 ? h.target : this.nearest(e, engaged)
        if (t) this.act(e, t, dt)
        else if (dist(e, h) > 70) this.moveToward(e, h.x, h.y, dt)
        if (this.ended) return
      }
      // Poção automática (não vale na arena) e regeneração fora de combate
      if (mode !== 'duel' && h.hp > 0 && h.hp / h.mhp < POTION_THRESHOLD && m.potionCd <= 0 && m.c.pocao > 0 && m.potionsUsed < (mode === 'promotion' ? 3 : Infinity)) {
        m.c.pocao--; m.potionsUsed++; m.potionCd = POTION_COOLDOWN
        const amount = Math.round(h.mhp * POTION_HEAL * (1 + m.tb.potionPct))
        h.hp = Math.min(h.mhp, h.hp + amount)
        this.fx.push({ f: 'heal', to: h.id, amount }); m.dirty = true
      }
      if (mode === 'hunt' && fightingMobs.length === 0) h.hp = Math.min(h.mhp, h.hp + h.mhp * 0.03 * dt)
    }
    for (const b of this.corpses) b.ttl -= dt
    this.corpses = this.corpses.filter((b) => b.ttl > 0)
    if (this.corpses.some((b) => !b.tried)) for (const m of this.members) if (m.c.autoExtract && m.c.level >= AUTO_EXTRACT_LEVEL) this.extract(true, m.key)
  }

  snapshot(key = this.members[0].key): Ent[] {
    const ents: Ent[] = []
    for (const m of this.members) {
      const h = m.actor
      if (h.hp > 0 || m.respawn === undefined) ents.push({ id: h.id, k: 'p', x: Math.round(h.x), y: Math.round(h.y), hp: Math.round(h.hp), mhp: h.mhp, s: h.sprite, n: h.name, r: rankOf(m.c).id, ...(m.key === key ? { me: true } : {}), ...(m.shield > 0 ? { sh: true } : {}) })
      for (const e of m.echoes) if (e.hp > 0) ents.push({ id: e.id, k: 'e', x: Math.round(e.x), y: Math.round(e.y), hp: Math.round(e.hp), mhp: e.mhp, s: e.sprite, n: e.name })
    }
    for (const mob of this.mobs) if (mob.hp > 0) ents.push({ id: mob.id, k: 'm', x: Math.round(mob.x), y: Math.round(mob.y), hp: Math.round(mob.hp), mhp: mob.mhp, s: mob.sprite, n: `${mob.name} nv ${mob.level}`, mk: mob.kind })
    for (const b of this.corpses) ents.push({ id: b.id, k: 'c', x: Math.round(b.x), y: Math.round(b.y), hp: b.tried ? 0 : 1, mhp: 1, s: b.species, mk: b.kind })
    return ents
  }
  /** Recargas das habilidades do membro, em segundos (para a barra do cliente). */
  cooldowns(key = this.members[0].key): number[] { return (this.members.find((m) => m.key === key)?.skillCd ?? []).map((n) => Math.ceil(n)) }
  takeFx(): Fx[] { const f = this.fx; this.fx = []; return f }
  takeLogs(key = this.members[0].key): LogLine[] { const m = this.members.find((x) => x.key === key); if (!m) return []; const l = m.logs; m.logs = []; return l }
  memberId(key: number) { return this.members.find((m) => m.key === key)?.actor.id ?? 0 }
}
