import { BALANCE } from '../data/balance';
import { findZone } from '../data/zones';
import { chance } from '../rng';
import { ATTRIBUTE_KEYS, EQUIP_SLOTS, RARITIES } from '../types';
import type { AttributeKey, EquipSlot, GameState, ItemInstance, Rarity, SettingsState } from '../types';
import { grantGold, isBossReady } from './combat';
import {
  computeHeroStats,
  getEchoFusionCost,
  getEnhanceChance,
  getEnhanceCost,
  getMaxEnhance,
  getSellValue,
} from './formulas';

/**
 * Ações do jogador. Todas validam pré-condições e retornam `false` (ou um
 * resultado explícito) sem alterar o estado quando inválidas — a UI nunca é
 * a única barreira contra estados inconsistentes.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */

/** Garante que o HP atual nunca exceda o máximo após mudanças de atributos/itens. */
function clampHp(state: GameState): void {
  state.hunter.hp = Math.min(state.hunter.hp, computeHeroStats(state).maxHp);
}

export function allocateAttribute(state: GameState, key: AttributeKey, amount = 1): boolean {
  if (!ATTRIBUTE_KEYS.includes(key) || !Number.isInteger(amount) || amount <= 0) return false;
  if (state.hunter.attributePoints < amount) return false;
  state.hunter.attributePoints -= amount;
  state.hunter.attributes[key] += amount;
  return true;
}

export function getRespecCost(state: GameState): number {
  return state.hunter.level * BALANCE.respecCostPerLevel;
}

/** Devolve todos os pontos de atributo distribuídos em troca de ouro. */
export function respecAttributes(state: GameState): boolean {
  const cost = getRespecCost(state);
  const spent = ATTRIBUTE_KEYS.reduce(
    (sum, key) => sum + (state.hunter.attributes[key] - BALANCE.startingAttribute),
    0,
  );
  if (spent <= 0 || state.gold < cost) return false;
  state.gold -= cost;
  for (const key of ATTRIBUTE_KEYS) state.hunter.attributes[key] = BALANCE.startingAttribute;
  state.hunter.attributePoints += spent;
  clampHp(state);
  return true;
}

export function equipItem(state: GameState, uid: number): boolean {
  const index = state.inventory.findIndex((item) => item.uid === uid);
  const item = state.inventory[index];
  if (!item) return false;
  const previous = state.equipment[item.slot];
  // Troca na mesma posição: o tamanho do inventário nunca cresce nesta operação.
  if (previous) state.inventory[index] = previous;
  else state.inventory.splice(index, 1);
  state.equipment[item.slot] = item;
  clampHp(state);
  return true;
}

export function unequipItem(state: GameState, slot: EquipSlot): boolean {
  const item = state.equipment[slot];
  if (!item || state.inventory.length >= BALANCE.inventorySize) return false;
  state.equipment[slot] = null;
  state.inventory.push(item);
  clampHp(state);
  return true;
}

export function sellItem(state: GameState, uid: number): boolean {
  const index = state.inventory.findIndex((item) => item.uid === uid);
  const item = state.inventory[index];
  if (!item) return false;
  state.inventory.splice(index, 1);
  grantGold(state, getSellValue(item));
  return true;
}

/** Vende todos os itens do inventário com raridade até `maxRarity`. Retorna o ouro obtido. */
export function sellAllUpTo(state: GameState, maxRarity: Rarity): number {
  const limit = RARITIES.indexOf(maxRarity);
  if (limit < 0) return 0;
  let total = 0;
  state.inventory = state.inventory.filter((item) => {
    if (RARITIES.indexOf(item.rarity) > limit) return true;
    total += getSellValue(item);
    return false;
  });
  if (total > 0) grantGold(state, total);
  return total;
}

function findOwnedItem(state: GameState, uid: number): ItemInstance | undefined {
  const inInventory = state.inventory.find((item) => item.uid === uid);
  if (inInventory) return inInventory;
  for (const slot of EQUIP_SLOTS) {
    const equipped = state.equipment[slot];
    if (equipped && equipped.uid === uid) return equipped;
  }
  return undefined;
}

export type EnhanceResult = 'success' | 'failed' | 'invalid';

/**
 * Tenta aprimorar um item (inventário ou equipado). O ouro é consumido em
 * qualquer tentativa válida; a falha não rebaixa o item.
 */
export function enhanceItem(state: GameState, uid: number): EnhanceResult {
  const item = findOwnedItem(state, uid);
  if (!item || item.enhance >= getMaxEnhance()) return 'invalid';
  const cost = getEnhanceCost(item);
  if (state.gold < cost) return 'invalid';
  state.gold -= cost;
  if (!chance(state, getEnhanceChance(item))) return 'failed';
  item.enhance += 1;
  return 'success';
}

export function changeZone(state: GameState, zoneId: string): boolean {
  const zone = findZone(zoneId);
  if (!zone || zone.tier > state.highestUnlockedTier || zone.id === state.combat.zoneId) return false;
  state.combat.zoneId = zone.id;
  state.combat.enemy = null;
  state.combat.bossTimerMs = 0;
  state.combat.killsTowardBoss = 0;
  state.bossRequested = false;
  // Durante a recuperação apenas troca o destino; o timer de derrota é preservado.
  if (state.combat.phase !== 'recovering') {
    state.combat.phase = 'respawning';
    state.combat.phaseTimerMs = BALANCE.respawnDelayMs;
  }
  return true;
}

/** Solicita o guardião manualmente (usado quando autoBoss está desligado). */
export function requestBoss(state: GameState): boolean {
  if (!isBossReady(state) || state.bossRequested) return false;
  state.bossRequested = true;
  return true;
}

export function toggleEcho(state: GameState, monsterId: string): boolean {
  if (!state.echoes[monsterId]) return false;
  const index = state.activeEchoIds.indexOf(monsterId);
  if (index >= 0) {
    state.activeEchoIds.splice(index, 1);
    return true;
  }
  if (state.activeEchoIds.length >= BALANCE.echoSlots) return false;
  state.activeEchoIds.push(monsterId);
  return true;
}

/** Funde cópias excedentes de um eco para elevar seu tier. */
export function fuseEcho(state: GameState, monsterId: string): boolean {
  const entry = state.echoes[monsterId];
  if (!entry || entry.tier >= BALANCE.echoMaxTier || entry.copies < BALANCE.echoCopiesPerFusion) return false;
  const cost = getEchoFusionCost(monsterId, entry.tier);
  if (state.gold < cost) return false;
  state.gold -= cost;
  entry.copies -= BALANCE.echoCopiesPerFusion;
  entry.tier += 1;
  return true;
}

export function updateSettings(state: GameState, patch: Partial<SettingsState>): boolean {
  if (patch.autoBoss !== undefined) state.settings.autoBoss = patch.autoBoss === true;
  if (patch.autoBind !== undefined) state.settings.autoBind = patch.autoBind === true;
  if (patch.autoSellMaxRarity !== undefined) {
    const value = patch.autoSellMaxRarity;
    state.settings.autoSellMaxRarity = value !== null && RARITIES.includes(value) ? value : null;
  }
  return true;
}
