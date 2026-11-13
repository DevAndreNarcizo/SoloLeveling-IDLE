// Conteúdo e regras do jogo. Fonte única usada pelo servidor (autoridade) e pelo cliente (exibição).
// Universo original: nomes, criaturas e números próprios deste projeto.

export const GAME_NAME = 'Umbral Idle' // título de trabalho: troque aqui e em client/index.html

// ---------- Atributos ----------
export const ATTRS = ['for', 'agi', 'vit', 'int', 'per'] as const
export type Attr = (typeof ATTRS)[number]
export const ATTR_NAMES: Record<Attr, string> = {
  for: 'Força', agi: 'Agilidade', vit: 'Vitalidade', int: 'Intelecto', per: 'Percepção',
}
export const ATTR_HELP: Record<Attr, string> = {
  for: 'Dano de Lâmina, Vulto e Atirador.',
  agi: 'Velocidade de ataque e de movimento.',
  vit: 'Vida máxima e defesa.',
  int: 'Dano do Arcanista.',
  per: 'Chance de crítico.',
}
export const POINTS_PER_LEVEL = 4
export const MAX_LEVEL = 60

// ---------- Classes ----------
export type ClassId = 'lamina' | 'vulto' | 'arcanista' | 'atirador'
export interface ClassDef {
  id: ClassId; name: string; desc: string
  primary: Attr; dmgMult: number; atkPerSec: number; range: number
  hpBase: number; hpPerLevel: number
  start: Record<Attr, number>
  projectile: 'none' | 'bolt' | 'arrow'
}
export const CLASSES: Record<ClassId, ClassDef> = {
  lamina: {
    id: 'lamina', name: 'Lâmina', desc: 'Corpo a corpo resistente. Golpes pesados.',
    primary: 'for', dmgMult: 1.15, atkPerSec: 1.0, range: 46, hpBase: 240, hpPerLevel: 34,
    start: { for: 14, agi: 8, vit: 14, int: 4, per: 8 }, projectile: 'none',
  },
  vulto: {
    id: 'vulto', name: 'Vulto', desc: 'Corpo a corpo veloz. Muitos golpes e muitos críticos.',
    primary: 'for', dmgMult: 0.78, atkPerSec: 1.5, range: 42, hpBase: 190, hpPerLevel: 27,
    start: { for: 12, agi: 14, vit: 8, int: 4, per: 10 }, projectile: 'none',
  },
  arcanista: {
    id: 'arcanista', name: 'Arcanista', desc: 'Dano mágico à distância. Frágil de perto.',
    primary: 'int', dmgMult: 1.25, atkPerSec: 0.85, range: 210, hpBase: 160, hpPerLevel: 22,
    start: { for: 4, agi: 8, vit: 8, int: 18, per: 10 }, projectile: 'bolt',
  },
  atirador: {
    id: 'atirador', name: 'Atirador', desc: 'Dano físico à distância. Preciso e constante.',
    primary: 'for', dmgMult: 0.92, atkPerSec: 1.15, range: 230, hpBase: 175, hpPerLevel: 25,
    start: { for: 13, agi: 10, vit: 8, int: 4, per: 13 }, projectile: 'arrow',
  },
}
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[]

// ---------- Ranks de caçador ----------
export interface RankDef { id: string; name: string; levelCap: number; echoSlots: number; maxEchoTier: number }
export const RANKS: RankDef[] = [
  { id: 'E', name: 'Rank E', levelCap: 15, echoSlots: 1, maxEchoTier: 1 },
  { id: 'D', name: 'Rank D', levelCap: 30, echoSlots: 2, maxEchoTier: 2 },
  { id: 'C', name: 'Rank C', levelCap: 45, echoSlots: 3, maxEchoTier: 3 },
  { id: 'B', name: 'Rank B', levelCap: MAX_LEVEL, echoSlots: 4, maxEchoTier: 4 },
]
/** Teste de promoção para sair do rank de índice i: luta solo, sem ecos, com tempo. */
export const PROMOTIONS: { boss: string; level: number; seconds: number }[] = [
  { boss: 'capataz-oco', level: 16, seconds: 180 },
  { boss: 'rei-galhado', level: 31, seconds: 180 },
  { boss: 'guardiao-do-selo', level: 46, seconds: 180 },
]

// ---------- Monstros ----------
export interface MonsterDef { id: string; name: string; boss?: boolean; ranged?: boolean; speed: number; fallback?: string }
const m = (id: string, name: string, speed = 70, extra: Partial<MonsterDef> = {}): MonsterDef => ({ id, name, speed, ...extra })
export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries([
  m('larva-de-ferrugem', 'Larva de Ferrugem', 55),
  m('larva-mae', 'Larva-Mãe', 45, { boss: true, fallback: 'larva-de-ferrugem' }),
  m('morcego-de-cinza', 'Morcego de Cinza', 95),
  m('asa-ancia', 'Asa Anciã', 85, { boss: true, fallback: 'morcego-de-cinza' }),
  m('catador-oco', 'Catador Oco', 70),
  m('capataz-oco', 'Capataz Oco', 65, { boss: true, fallback: 'catador-oco' }),
  m('lobo-de-nevoa', 'Lobo de Névoa', 105),
  m('alfa-da-nevoa', 'Alfa da Névoa', 100, { boss: true, fallback: 'lobo-de-nevoa' }),
  m('espinheiro-vivo', 'Espinheiro Vivo', 50, { ranged: true }),
  m('raiz-ancia', 'Raiz Anciã', 40, { boss: true, fallback: 'espinheiro-vivo' }),
  m('cervo-espectral', 'Cervo Espectral', 95),
  m('rei-galhado', 'Rei Galhado', 85, { boss: true, fallback: 'cervo-espectral' }),
  m('sentinela-afogada', 'Sentinela Afogada', 65),
  m('capitao-das-mares', 'Capitão das Marés', 65, { boss: true, fallback: 'sentinela-afogada' }),
  m('sacerdote-do-lodo', 'Sacerdote do Lodo', 60, { ranged: true }),
  m('hierofante-do-lodo', 'Hierofante do Lodo', 55, { boss: true, ranged: true, fallback: 'sacerdote-do-lodo' }),
  m('armadura-vazia', 'Armadura Vazia', 60),
  m('guardiao-do-selo', 'Guardião do Selo', 60, { boss: true, fallback: 'armadura-vazia' }),
  m('brasa-errante', 'Brasa Errante', 90, { ranged: true }),
  m('coracao-de-fornalha', 'Coração de Fornalha', 60, { boss: true, ranged: true, fallback: 'brasa-errante' }),
  m('golem-de-escoria', 'Golem de Escória', 50),
  m('colosso-de-escoria', 'Colosso de Escória', 45, { boss: true, fallback: 'golem-de-escoria' }),
  m('serpe-de-cinza', 'Serpe de Cinza', 100),
  m('serpe-matriarca', 'Serpe Matriarca', 90, { boss: true, fallback: 'serpe-de-cinza' }),
].map((d) => [d.id, d]))

export type MobKind = 'comum' | 'elite' | 'chefe'
export const KIND_MULT: Record<MobKind, { hp: number; atk: number; exp: number; gold: number; drop: number; extract: number }> = {
  comum: { hp: 1, atk: 1, exp: 1, gold: 1, drop: 0.07, extract: 0.08 },
  elite: { hp: 4, atk: 1.35, exp: 4, gold: 4, drop: 0.35, extract: 0.16 },
  chefe: { hp: 14, atk: 1.7, exp: 14, gold: 14, drop: 1, extract: 0.3 },
}
export function monsterStats(level: number, kind: MobKind = 'comum') {
  const k = KIND_MULT[kind]
  return {
    maxHp: Math.round((45 + 26 * level + 1.6 * level * level) * k.hp),
    atk: Math.round((7 + 3.4 * level + 0.045 * level * level) * k.atk),
    def: Math.round(3 + 1.6 * level),
    exp: Math.round((14 + 9 * level + 0.9 * level * level) * k.exp),
    gold: Math.round((3 + 1.4 * level) * k.gold),
  }
}

// ---------- Fendas (dungeons) ----------
export interface BandDef { min: number; max: number; monster: string; boss: string }
export interface RiftDef { id: string; name: string; desc: string; minLevel: number; bands: BandDef[] }
export const RIFTS: RiftDef[] = [
  { id: 'minas-ocas', name: 'Minas Ocas', desc: 'Galerias abandonadas onde a primeira fenda se abriu.', minLevel: 1, bands: [
    { min: 1, max: 5, monster: 'larva-de-ferrugem', boss: 'larva-mae' },
    { min: 6, max: 10, monster: 'morcego-de-cinza', boss: 'asa-ancia' },
    { min: 11, max: 15, monster: 'catador-oco', boss: 'capataz-oco' },
  ] },
  { id: 'bosque-cinzento', name: 'Bosque Cinzento', desc: 'Floresta coberta de névoa que não se dissipa.', minLevel: 16, bands: [
    { min: 16, max: 20, monster: 'lobo-de-nevoa', boss: 'alfa-da-nevoa' },
    { min: 21, max: 25, monster: 'espinheiro-vivo', boss: 'raiz-ancia' },
    { min: 26, max: 30, monster: 'cervo-espectral', boss: 'rei-galhado' },
  ] },
  { id: 'cidadela-afundada', name: 'Cidadela Afundada', desc: 'Fortaleza engolida pela maré, ainda guardada.', minLevel: 31, bands: [
    { min: 31, max: 35, monster: 'sentinela-afogada', boss: 'capitao-das-mares' },
    { min: 36, max: 40, monster: 'sacerdote-do-lodo', boss: 'hierofante-do-lodo' },
    { min: 41, max: 45, monster: 'armadura-vazia', boss: 'guardiao-do-selo' },
  ] },
  { id: 'forja-extinta', name: 'Forja Extinta', desc: 'Fundição colossal cujas brasas voltaram a andar.', minLevel: 46, bands: [
    { min: 46, max: 50, monster: 'brasa-errante', boss: 'coracao-de-fornalha' },
    { min: 51, max: 55, monster: 'golem-de-escoria', boss: 'colosso-de-escoria' },
    { min: 56, max: 60, monster: 'serpe-de-cinza', boss: 'serpe-matriarca' },
  ] },
]
export const BOSS_EVERY_KILLS = 40
export const ELITE_CHANCE = 0.06
export const HUNT_MAP = { w: 1600, h: 1100 }
export const CITY_MAP = { w: 1400, h: 1000 }
export const CITY_NAME = 'Vértice'

export interface NpcDef { id: string; name: string; role: string; panel: string; x: number; y: number }
export const NPCS: NpcDef[] = [
  { id: 'guardia-das-fendas', name: 'Ísis, Guardiã das Fendas', role: 'Abre as caçadas', panel: 'fendas', x: 700, y: 260 },
  { id: 'mercador', name: 'Tobias, o Mercador', role: 'Vende consumíveis', panel: 'loja', x: 380, y: 520 },
  { id: 'ferreira', name: 'Dária, a Ferreira', role: 'Aprimora equipamentos', panel: 'forja', x: 1020, y: 520 },
  { id: 'arquivista', name: 'Noé, o Arquivista', role: 'Mostra o ranking', panel: 'ranking', x: 700, y: 760 },
]

// ---------- Progressão ----------
export function expToNext(level: number): number {
  return Math.round(90 + 55 * level + 22 * Math.pow(level, 2.35))
}

// ---------- Itens ----------
export const SLOTS = ['arma', 'elmo', 'armadura', 'luvas', 'botas', 'anel'] as const
export type Slot = (typeof SLOTS)[number]
export const SLOT_NAMES: Record<Slot, string> = { arma: 'Arma', elmo: 'Elmo', armadura: 'Armadura', luvas: 'Luvas', botas: 'Botas', anel: 'Anel' }
export const WEAPON_NAMES: Record<ClassId, string> = { lamina: 'Espada', vulto: 'Adagas', arcanista: 'Cajado', atirador: 'Arco' }
export const RARITIES = ['comum', 'incomum', 'raro', 'epico', 'lendario'] as const
export type Rarity = (typeof RARITIES)[number]
export const RARITY_INFO: Record<Rarity, { name: string; mult: number; weight: number; lines: number; color: string }> = {
  comum: { name: 'Comum', mult: 1, weight: 700, lines: 0, color: '#b9b6c9' },
  incomum: { name: 'Incomum', mult: 1.25, weight: 220, lines: 1, color: '#5fd38a' },
  raro: { name: 'Raro', mult: 1.6, weight: 65, lines: 2, color: '#4ea8ff' },
  epico: { name: 'Épico', mult: 2.1, weight: 13, lines: 3, color: '#b06bff' },
  lendario: { name: 'Lendário', mult: 2.8, weight: 2, lines: 4, color: '#ffb347' },
}
export interface Item {
  id: string; slot: Slot; cls?: ClassId; level: number; rarity: Rarity; enchant: number
  atk?: number; def?: number; hp?: number; attrs?: Partial<Record<Attr, number>>
}
export const INVENTORY_SIZE = 40
export const MAX_ENCHANT = 10
export const ENCHANT_BONUS = 0.06
/** Chance de sucesso para ir de +n a +n+1. Falhar gasta os materiais, mas nunca rebaixa a peça. */
export const ENCHANT_CHANCE = [1, 1, 1, 1, 0.8, 0.65, 0.5, 0.4, 0.3, 0.2]
export function enchantCost(item: Item) {
  const n = item.enchant
  return { gold: Math.round((20 + item.level * 6) * (1 + n) * RARITY_INFO[item.rarity].mult), shards: 1 + Math.floor(n / 3) }
}
export function itemName(item: Item): string {
  const base = item.slot === 'arma' && item.cls ? WEAPON_NAMES[item.cls] : SLOT_NAMES[item.slot]
  return `${base} ${RARITY_INFO[item.rarity].name}${item.enchant ? ` +${item.enchant}` : ''}`
}
export function itemStat(item: Item, key: 'atk' | 'def' | 'hp'): number {
  return Math.round((item[key] ?? 0) * (1 + ENCHANT_BONUS * item.enchant))
}
export function sellPrice(item: Item): number {
  return Math.round((4 + item.level * 2) * RARITY_INFO[item.rarity].mult * (1 + 0.3 * item.enchant))
}

/** Gera uma peça. `rng` devolve [0,1). */
export function rollItem(level: number, rng: () => number, id: string, forceRarity?: Rarity): Item {
  let rarity: Rarity = forceRarity ?? 'comum'
  if (!forceRarity) {
    const total = RARITIES.reduce((s, r) => s + RARITY_INFO[r].weight, 0)
    let roll = rng() * total
    for (const r of RARITIES) { roll -= RARITY_INFO[r].weight; if (roll < 0) { rarity = r; break } }
  }
  const slot = SLOTS[Math.floor(rng() * SLOTS.length)]
  const info = RARITY_INFO[rarity]
  const item: Item = { id, slot, level, rarity, enchant: 0 }
  const vary = () => 0.9 + rng() * 0.2
  if (slot === 'arma') {
    item.cls = CLASS_IDS[Math.floor(rng() * CLASS_IDS.length)]
    item.atk = Math.round((6 + level * 2.6) * info.mult * vary())
  } else if (slot === 'anel') {
    item.atk = Math.round((2 + level * 0.8) * info.mult * vary())
    item.hp = Math.round((10 + level * 5) * info.mult * vary())
  } else {
    const w = slot === 'armadura' ? 1.4 : 1
    item.def = Math.round((3 + level * 1.1) * w * info.mult * vary())
    item.hp = Math.round((8 + level * 4) * w * info.mult * vary())
  }
  if (info.lines > 0) {
    item.attrs = {}
    for (let i = 0; i < info.lines; i++) {
      const a = ATTRS[Math.floor(rng() * ATTRS.length)]
      item.attrs[a] = (item.attrs[a] ?? 0) + Math.max(1, Math.round((1 + level * 0.25) * vary()))
    }
  }
  return item
}

// ---------- Ecos (exército) ----------
export const ECHO_TIERS = [
  { name: 'Tênue', mult: 1.0 },
  { name: 'Firme', mult: 1.3 },
  { name: 'Vívido', mult: 1.7 },
  { name: 'Radiante', mult: 2.2 },
  { name: 'Soberano', mult: 3.0 },
]
export const ECHO_FUSE_COUNT = 3
export const ECHO_LIMIT = 60
export const CORPSE_SECONDS = 10
export const ECHO_RESPAWN_SECONDS = 20
export const AUTO_EXTRACT_LEVEL = 10
export function echoFuseCost(tier: number): number { return 150 * Math.pow(4, tier) }
export interface Echo { id: string; species: string; tier: number; kind: MobKind }
export function echoStats(echo: Echo, hunterLevel: number) {
  const base = monsterStats(hunterLevel, 'comum')
  const mult = ECHO_TIERS[echo.tier].mult * (echo.kind === 'chefe' ? 1.5 : echo.kind === 'elite' ? 1.2 : 1)
  return { maxHp: Math.round(base.maxHp * 2.2 * mult), atk: Math.round(base.atk * 0.55 * mult), def: base.def }
}

// ---------- Loja e consumíveis ----------
export const SHOP = {
  pocao: { name: 'Poção de Vida', price: 12, desc: 'Cura 35% da vida. Uso automático abaixo de 35%.' },
  fragmento: { name: 'Fragmento de Eco', price: 30, desc: 'Gasto em cada tentativa de evocar um eco.' },
} as const
export type ShopId = keyof typeof SHOP
export const POTION_HEAL = 0.35
export const POTION_THRESHOLD = 0.35
export const POTION_COOLDOWN = 8
export const START_KIT = { gold: 100, pocao: 30, fragmento: 40, lasca: 3 }
export const SHARD_DROP = 0.035
export const FRAGMENT_DROP = 0.05

// ---------- Descanso (progresso offline) ----------
export const REST = { minHuntSeconds: 180, maxHours: 8, rate: 0.4 }

// ---------- Personagem ----------
export interface Character {
  name: string; cls: ClassId; level: number; exp: number; rank: number
  attrs: Record<Attr, number>; points: number
  gold: number; pocao: number; fragmento: number; lasca: number
  items: Item[]; equipped: Partial<Record<Slot, Item>>
  echoes: Echo[]; team: string[]; autoExtract: boolean
  kills: number; nextId: number
  rest?: { expPerMin: number; goldPerMin: number; since: number }
}
export function newCharacter(name: string, cls: ClassId): Character {
  return {
    name, cls, level: 1, exp: 0, rank: 0, attrs: { ...CLASSES[cls].start }, points: 0,
    gold: START_KIT.gold, pocao: START_KIT.pocao, fragmento: START_KIT.fragmento, lasca: START_KIT.lasca,
    items: [], equipped: {}, echoes: [], team: [], autoExtract: false, kills: 0, nextId: 1,
  }
}
export interface Derived {
  maxHp: number; atk: number; def: number; crit: number; critMult: number
  atkPerSec: number; speed: number; range: number; power: number
  attrs: Record<Attr, number>
}
export function derive(c: Character): Derived {
  const cls = CLASSES[c.cls]
  const attrs = { ...c.attrs }
  let gearAtk = 0, gearDef = 0, gearHp = 0
  for (const slot of SLOTS) {
    const it = c.equipped[slot]
    if (!it) continue
    gearAtk += itemStat(it, 'atk'); gearDef += itemStat(it, 'def'); gearHp += itemStat(it, 'hp')
    for (const a of ATTRS) attrs[a] += it.attrs?.[a] ?? 0
  }
  const maxHp = Math.round((cls.hpBase + cls.hpPerLevel * c.level) * (1 + attrs.vit / 200) + gearHp)
  const atk = Math.round(attrs[cls.primary] * 1.6 + c.level * 2 + gearAtk)
  const def = Math.round(attrs.vit * 0.7 + gearDef)
  const crit = Math.min(0.5, 0.05 + attrs.per * 0.0015)
  const atkPerSec = cls.atkPerSec * (1 + Math.min(attrs.agi, 400) / 800)
  const speed = 120 + Math.min(attrs.agi, 300) * 0.15
  const power = Math.round(atk * cls.dmgMult * atkPerSec * (1 + crit * 0.6) * 3 + maxHp * 0.25 + def * 2)
  return { maxHp, atk, def, crit, critMult: 1.6, atkPerSec, speed, range: cls.range, power, attrs }
}
/** Dano de um golpe já com a defesa do alvo. `roll` em [0,1). */
export function hitDamage(atk: number, mult: number, targetDef: number, roll: number): number {
  return Math.max(1, Math.round(atk * mult * (100 / (100 + targetDef)) * (0.9 + roll * 0.2)))
}
export function rankOf(c: Character): RankDef { return RANKS[c.rank] }

/** Soma EXP respeitando o limite de nível do rank. Devolve quantos níveis subiu. */
export function addExp(c: Character, amount: number): number {
  const cap = rankOf(c).levelCap
  let ups = 0
  c.exp += Math.max(0, Math.round(amount))
  while (c.level < cap && c.exp >= expToNext(c.level)) {
    c.exp -= expToNext(c.level); c.level++; c.points += POINTS_PER_LEVEL; ups++
  }
  if (c.level >= MAX_LEVEL) c.exp = 0
  return ups
}
export function findBand(riftId: string, bandIndex: number): { rift: RiftDef; band: BandDef } | null {
  const rift = RIFTS.find((r) => r.id === riftId)
  const band = rift?.bands[bandIndex]
  return rift && band ? { rift, band } : null
}
