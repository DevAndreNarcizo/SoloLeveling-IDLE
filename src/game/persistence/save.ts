import { BALANCE } from '../data/balance';
import { isClassId } from '../data/classes';
import { MAX_TIER, MONSTERS, ZONES, findZone } from '../data/zones';
import { computeHeroStats, getMaxEnhance, xpToNextLevel } from '../engine/formulas';
import { SAVE_VERSION, sanitizeHunterName } from '../engine/state';
import { ATTRIBUTE_KEYS, EQUIP_SLOTS, RARITIES } from '../types';
import type { Attributes, EchoEntry, EquipSlot, GameState, ItemInstance, Rarity } from '../types';

export const SAVE_KEY = 'cacador-de-fendas:save';
export const CORRUPT_BACKUP_KEY = 'cacador-de-fendas:save-corrompido';

/** Abstração mínima de armazenamento (localStorage em produção, fake em testes). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Converte para inteiro dentro de [min, max]; devolve `fallback` se não for numérico finito. */
function toInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function parseItem(value: unknown): ItemInstance | null {
  if (!isRecord(value)) return null;
  const { uid, slot, tier, rarity, enhance } = value;
  if (typeof uid !== 'number' || !Number.isInteger(uid) || uid <= 0) return null;
  if (!EQUIP_SLOTS.includes(slot as EquipSlot) || !RARITIES.includes(rarity as Rarity)) return null;
  if (typeof tier !== 'number' || !Number.isInteger(tier) || tier < 1 || tier > MAX_TIER) return null;
  return {
    uid,
    slot: slot as EquipSlot,
    tier,
    rarity: rarity as Rarity,
    enhance: toInt(enhance, 0, getMaxEnhance(), 0),
  };
}

/**
 * Reconstrói um GameState confiável a partir de dados não confiáveis
 * (localStorage ou importação manual). Estratégia:
 *  - campos essenciais inválidos (classe, estrutura) => rejeita (null);
 *  - demais campos são saneados (clamp, descarte de entradas inválidas);
 *  - invariantes são reimpostas (pontos de atributo x nível, uids únicos,
 *    zona liberada, limite de inventário/esquadrão).
 * O combate em andamento não é restaurado: o caçador volta aguardando o
 * próximo inimigo, o que elimina uma classe inteira de estados inválidos.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function sanitizeState(data: unknown, now: number): GameState | null {
  if (!isRecord(data) || data.version !== SAVE_VERSION) return null;
  const hunterRaw = data.hunter;
  if (!isRecord(hunterRaw) || !isClassId(hunterRaw.classId)) return null;

  const level = toInt(hunterRaw.level, 1, BALANCE.maxLevel, 1);
  const earnedPoints = (level - 1) * BALANCE.attributePointsPerLevel;
  const start = BALANCE.startingAttribute;
  const attributes: Attributes = { str: start, agi: start, int: start, vit: start };
  let attributePoints = toInt(hunterRaw.attributePoints, 0, earnedPoints, 0);
  if (isRecord(hunterRaw.attributes)) {
    for (const key of ATTRIBUTE_KEYS) {
      attributes[key] = toInt(hunterRaw.attributes[key], start, start + earnedPoints, start);
    }
  }
  const spent = ATTRIBUTE_KEYS.reduce((sum, key) => sum + attributes[key] - start, 0);
  // Invariante: pontos gastos + livres == pontos ganhos. Divergência => redistribuição completa.
  if (spent + attributePoints !== earnedPoints) {
    for (const key of ATTRIBUTE_KEYS) attributes[key] = start;
    attributePoints = earnedPoints;
  }

  const seenUids = new Set<number>();
  const acceptItem = (value: unknown): ItemInstance | null => {
    const item = parseItem(value);
    if (!item || seenUids.has(item.uid)) return null;
    seenUids.add(item.uid);
    return item;
  };

  const equipment: Record<EquipSlot, ItemInstance | null> = { weapon: null, armor: null, accessory: null };
  if (isRecord(data.equipment)) {
    for (const slot of EQUIP_SLOTS) {
      const item = acceptItem(data.equipment[slot]);
      // Item em slot incompatível é descartado em vez de equipado incorretamente.
      if (item && item.slot === slot) equipment[slot] = item;
    }
  }
  const inventory: ItemInstance[] = [];
  if (Array.isArray(data.inventory)) {
    for (const raw of data.inventory) {
      if (inventory.length >= BALANCE.inventorySize) break;
      const item = acceptItem(raw);
      if (item) inventory.push(item);
    }
  }
  const maxUid = Math.max(0, ...seenUids);

  const echoes: Record<string, EchoEntry> = {};
  if (isRecord(data.echoes)) {
    for (const [monsterId, raw] of Object.entries(data.echoes)) {
      if (!Object.hasOwn(MONSTERS, monsterId) || !isRecord(raw)) continue;
      echoes[monsterId] = {
        tier: toInt(raw.tier, 1, BALANCE.echoMaxTier, 1),
        copies: toInt(raw.copies, 0, 1_000_000, 0),
      };
    }
  }
  const activeEchoIds: string[] = [];
  if (Array.isArray(data.activeEchoIds)) {
    for (const id of data.activeEchoIds) {
      if (activeEchoIds.length >= BALANCE.echoSlots) break;
      if (typeof id === 'string' && Object.hasOwn(echoes, id) && !activeEchoIds.includes(id)) {
        activeEchoIds.push(id);
      }
    }
  }

  const highestUnlockedTier = toInt(data.highestUnlockedTier, 1, MAX_TIER, 1);
  const combatRaw = isRecord(data.combat) ? data.combat : {};
  const savedZone = typeof combatRaw.zoneId === 'string' ? findZone(combatRaw.zoneId) : undefined;
  const zone = savedZone && savedZone.tier <= highestUnlockedTier ? savedZone : ZONES[0];
  if (!zone) return null;

  const bossKillsByZone: Record<string, number> = {};
  if (isRecord(data.bossKillsByZone)) {
    for (const z of ZONES) {
      const count = toInt(data.bossKillsByZone[z.id], 0, Number.MAX_SAFE_INTEGER, 0);
      if (count > 0) bossKillsByZone[z.id] = count;
    }
  }

  const settingsRaw = isRecord(data.settings) ? data.settings : {};
  const statsRaw = isRecord(data.stats) ? data.stats : {};
  const counter = (value: unknown) => toInt(value, 0, Number.MAX_SAFE_INTEGER, 0);
  const autoSell = settingsRaw.autoSellMaxRarity;

  const state: GameState = {
    version: SAVE_VERSION,
    rng: toInt(data.rng, 0, 0xffffffff, 1) >>> 0,
    nextItemUid: Math.max(toInt(data.nextItemUid, 1, Number.MAX_SAFE_INTEGER, 1), maxUid + 1),
    hunter: {
      name: sanitizeHunterName(typeof hunterRaw.name === 'string' ? hunterRaw.name : ''),
      classId: hunterRaw.classId,
      level,
      xp: 0,
      attributePoints,
      attributes,
      hp: 0,
    },
    gold: counter(data.gold),
    essence: counter(data.essence),
    inventory,
    equipment,
    echoes,
    activeEchoIds,
    combat: {
      zoneId: zone.id,
      phase: 'respawning',
      phaseTimerMs: BALANCE.respawnDelayMs,
      enemy: null,
      heroAttackTimerMs: 0,
      enemyAttackTimerMs: 0,
      killsTowardBoss: toInt(combatRaw.killsTowardBoss, 0, BALANCE.killsPerBoss, 0),
      bossTimerMs: 0,
    },
    highestUnlockedTier,
    bossKillsByZone,
    bossRequested: false,
    settings: {
      autoBoss: settingsRaw.autoBoss !== false,
      autoBind: settingsRaw.autoBind !== false,
      autoSellMaxRarity: RARITIES.includes(autoSell as Rarity) ? (autoSell as Rarity) : null,
    },
    stats: {
      kills: counter(statsRaw.kills),
      bossKills: counter(statsRaw.bossKills),
      deaths: counter(statsRaw.deaths),
      goldEarned: counter(statsRaw.goldEarned),
      itemsFound: counter(statsRaw.itemsFound),
    },
    // Relógio adiantado no save anterior não pode gerar "tempo negativo" nem bônus futuro.
    lastSeenAt: Math.min(toInt(data.lastSeenAt, 0, Number.MAX_SAFE_INTEGER, now), now),
  };

  // XP e HP dependem de valores já saneados, por isso são resolvidos por último.
  const xpCap = level >= BALANCE.maxLevel ? 0 : xpToNextLevel(level) - 1;
  state.hunter.xp = toInt(hunterRaw.xp, 0, Math.max(xpCap, 0), 0);
  const maxHp = computeHeroStats(state).maxHp;
  state.hunter.hp =
    typeof hunterRaw.hp === 'number' && Number.isFinite(hunterRaw.hp)
      ? Math.min(Math.max(hunterRaw.hp, 1), maxHp)
      : maxHp;
  return state;
}

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

/** Interpreta um save serializado; devolve null se ilegível ou inválido. */
export function deserializeState(raw: string, now: number): GameState | null {
  try {
    return sanitizeState(JSON.parse(raw) as unknown, now);
  } catch {
    return null;
  }
}

export interface LoadResult {
  state: GameState | null;
  /** true quando havia um save, mas ele foi rejeitado (cópia preservada no backup). */
  corrupted: boolean;
}

/**
 * Carrega o save do armazenamento. Um save ilegível nunca é sobrescrito
 * silenciosamente: o conteúdo bruto é copiado para uma chave de backup.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function loadGame(storage: KeyValueStorage, now: number): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { state: null, corrupted: false };
  }
  if (raw === null) return { state: null, corrupted: false };
  const state = deserializeState(raw, now);
  if (state) return { state, corrupted: false };
  try {
    storage.setItem(CORRUPT_BACKUP_KEY, raw);
  } catch {
    // Sem espaço para o backup: segue sem interromper o carregamento.
  }
  return { state: null, corrupted: true };
}

/** Persiste o estado. Retorna false se o armazenamento falhar (quota, modo privado). */
export function saveGame(storage: KeyValueStorage, state: GameState): boolean {
  try {
    storage.setItem(SAVE_KEY, serializeState(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: KeyValueStorage): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // Nada a fazer: o próximo save sobrescreve.
  }
}

/** Codifica o save em Base64 (UTF-8 seguro) para backup manual pelo jogador. */
export function exportSave(state: GameState): string {
  const bytes = new TextEncoder().encode(serializeState(state));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Decodifica e valida um save exportado; null se o texto for inválido. */
export function importSave(encoded: string, now: number): GameState | null {
  try {
    const binary = atob(encoded.trim());
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return deserializeState(new TextDecoder('utf-8', { fatal: true }).decode(bytes), now);
  } catch {
    return null;
  }
}
