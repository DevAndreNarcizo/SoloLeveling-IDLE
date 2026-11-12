/**
 * Tipos centrais do domínio do jogo. Este módulo não possui dependências
 * de UI/browser: todo o diretório `src/game` é TypeScript puro para que o
 * motor possa ser executado em testes e, futuramente, em um servidor
 * autoritativo sem alterações.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */

export type ClassId = 'guardian' | 'blade' | 'arcanist' | 'marksman' | 'cleric';
export type AttributeKey = 'str' | 'agi' | 'int' | 'vit';
export type Attributes = Record<AttributeKey, number>;
export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type EquipSlot = 'weapon' | 'armor' | 'accessory';
export type CombatPhase = 'fighting' | 'respawning' | 'recovering';

export const ATTRIBUTE_KEYS: readonly AttributeKey[] = ['str', 'agi', 'int', 'vit'];
export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'armor', 'accessory'];

export interface ClassDef {
  id: ClassId;
  name: string;
  description: string;
  passiveDescription: string;
  assetId: string;
  weaponAssetId: string;
  weaponName: string;
  /** Atributo que escala o poder de ataque da classe. */
  primary: AttributeKey;
  /** Poder de ataque concedido por ponto do atributo primário. */
  primaryScaling: number;
  baseHp: number;
  hpPerLevel: number;
  baseDamage: number;
  attackIntervalMs: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  assetId: string;
  zoneId: string;
  isBoss: boolean;
  hp: number;
  attack: number;
  defense: number;
  attackIntervalMs: number;
  xp: number;
  gold: number;
  /** Poder de ataque concedido ao caçador quando o eco está ativo (tier 1). */
  echoPower: number;
}

export interface ZoneDef {
  id: string;
  /** Posição na progressão (1..6). Também define o tier dos itens dropados. */
  tier: number;
  rank: Rank;
  name: string;
  description: string;
  backgroundAssetId: string;
  recommendedLevel: number;
  monsterIds: readonly string[];
  bossId: string;
}

/**
 * Instância de equipamento. Os atributos NÃO são persistidos: são derivados
 * de (slot, tier, raridade, aprimoramento) para que ajustes de balanceamento
 * se apliquem retroativamente e o save permaneça pequeno.
 */
export interface ItemInstance {
  uid: number;
  slot: EquipSlot;
  tier: number;
  rarity: Rarity;
  enhance: number;
}

export interface EchoEntry {
  /** Tier atual do eco (1..ECHO_MAX_TIER). */
  tier: number;
  /** Cópias excedentes acumuladas, consumidas na fusão. */
  copies: number;
}

export interface HunterState {
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  attributePoints: number;
  attributes: Attributes;
  hp: number;
}

export interface EnemyState {
  monsterId: string;
  hp: number;
}

export interface CombatState {
  zoneId: string;
  phase: CombatPhase;
  phaseTimerMs: number;
  enemy: EnemyState | null;
  heroAttackTimerMs: number;
  enemyAttackTimerMs: number;
  killsTowardBoss: number;
  /** Tempo restante (ms) para derrotar o guardião atual; 0 fora de lutas de chefe. */
  bossTimerMs: number;
}

export interface SettingsState {
  /** Enfrenta o guardião automaticamente ao completar a contagem de abates. */
  autoBoss: boolean;
  /** Consome essência para tentar vincular ecos a cada abate. */
  autoBind: boolean;
  /** Itens com raridade até este valor são vendidos ao dropar (null = nunca). */
  autoSellMaxRarity: Rarity | null;
}

export interface LifetimeStats {
  kills: number;
  bossKills: number;
  deaths: number;
  goldEarned: number;
  itemsFound: number;
}

export interface GameState {
  version: number;
  /** Estado interno do PRNG (uint32). Persistido para manter determinismo. */
  rng: number;
  nextItemUid: number;
  hunter: HunterState;
  gold: number;
  essence: number;
  inventory: ItemInstance[];
  equipment: Record<EquipSlot, ItemInstance | null>;
  echoes: Record<string, EchoEntry>;
  activeEchoIds: string[];
  combat: CombatState;
  /** Maior tier de fenda liberado (1..6). */
  highestUnlockedTier: number;
  bossKillsByZone: Record<string, number>;
  /** Flag de uso único: o jogador solicitou o guardião com autoBoss desligado. */
  bossRequested: boolean;
  settings: SettingsState;
  stats: LifetimeStats;
  /** Epoch (ms) do último instante simulado; base do progresso offline. */
  lastSeenAt: number;
}

/** Eventos emitidos pelo motor; consumidos pela UI e pelo relatório offline. */
export type GameEvent =
  | { type: 'hit'; source: 'hero' | 'enemy'; amount: number; crit: boolean }
  | { type: 'heal'; amount: number }
  | { type: 'kill'; monsterId: string; boss: boolean; xp: number; gold: number }
  | { type: 'levelUp'; level: number }
  | { type: 'loot'; item: ItemInstance; autoSoldFor: number | null }
  | { type: 'essence'; amount: number }
  | { type: 'echo'; monsterId: string; isNew: boolean }
  | { type: 'death'; monsterId: string; reason: 'slain' | 'timeout' }
  | { type: 'zoneUnlocked'; zoneId: string };

export type EventSink = (event: GameEvent) => void;
