import {
  ARMOR_DEFENSE_BY_TIER,
  ARMOR_HP_BY_TIER,
  BALANCE,
  RARITY_SELL_MULTIPLIER,
  RARITY_STAT_MULTIPLIER,
  WEAPON_ATTACK_BY_TIER,
} from '../data/balance';
import { CLASSES } from '../data/classes';
import { MONSTERS, ZONES, getZone } from '../data/zones';
import type { GameState, ItemInstance, Rank } from '../types';

export interface ItemStats {
  attack: number;
  defense: number;
  hp: number;
}

export interface HeroStats {
  maxHp: number;
  attackPower: number;
  /** Dano de um golpe não crítico antes da defesa do alvo. */
  hitDamage: number;
  defense: number;
  critChance: number;
  critMultiplier: number;
  attackIntervalMs: number;
  echoPower: number;
}

/** Lê uma tabela indexada por tier (1-based) com clamp defensivo. */
function byTier(table: readonly number[], tier: number): number {
  const index = Math.min(Math.max(Math.trunc(tier), 1), table.length) - 1;
  return table[index] as number;
}

/**
 * XP necessário para avançar do nível informado ao seguinte.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function xpToNextLevel(level: number): number {
  return Math.round(40 * Math.pow(level, 1.8));
}

/**
 * Deriva os atributos de um equipamento a partir de slot, tier, raridade e
 * aprimoramento. Fonte única de verdade: nada disso é persistido no save.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function getItemStats(item: ItemInstance): ItemStats {
  const multiplier = RARITY_STAT_MULTIPLIER[item.rarity] * (1 + BALANCE.enhanceBonusPerLevel * item.enhance);
  const weaponAttack = byTier(WEAPON_ATTACK_BY_TIER, item.tier);
  const armorDefense = byTier(ARMOR_DEFENSE_BY_TIER, item.tier);
  const armorHp = byTier(ARMOR_HP_BY_TIER, item.tier);
  switch (item.slot) {
    case 'weapon':
      return { attack: Math.round(weaponAttack * multiplier), defense: 0, hp: 0 };
    case 'armor':
      return { attack: 0, defense: Math.round(armorDefense * multiplier), hp: Math.round(armorHp * multiplier) };
    case 'accessory':
      return {
        attack: Math.round(weaponAttack * BALANCE.accessoryAttackFactor * multiplier),
        defense: 0,
        hp: Math.round(armorHp * BALANCE.accessoryHpFactor * multiplier),
      };
  }
}

export function getSellValue(item: ItemInstance): number {
  return Math.round(10 * item.tier * item.tier * RARITY_SELL_MULTIPLIER[item.rarity] * (1 + 0.5 * item.enhance));
}

export function getMaxEnhance(): number {
  return BALANCE.enhanceChances.length;
}

export function getEnhanceCost(item: ItemInstance): number {
  return Math.round(30 * item.tier * item.tier * Math.pow(1.45, item.enhance));
}

/** Chance (0..1) de sucesso do próximo aprimoramento; 0 se já estiver no teto. */
export function getEnhanceChance(item: ItemInstance): number {
  return BALANCE.enhanceChances[item.enhance] ?? 0;
}

/** Poder de ataque concedido por um eco no tier informado. */
export function getEchoPower(monsterId: string, tier: number): number {
  const monster = MONSTERS[monsterId];
  if (!monster) return 0;
  const multipliers = BALANCE.echoTierMultipliers;
  const index = Math.min(Math.max(Math.trunc(tier), 1), multipliers.length) - 1;
  return Math.round(monster.echoPower * (multipliers[index] as number));
}

export function getEchoFusionCost(monsterId: string, currentTier: number): number {
  const monster = MONSTERS[monsterId];
  const zoneTier = monster ? getZone(monster.zoneId).tier : 1;
  return BALANCE.echoFusionBaseCost * currentTier * zoneTier;
}

/**
 * Calcula os atributos derivados do caçador (HP, ataque, defesa, crítico,
 * velocidade) combinando classe, atributos, equipamento e ecos ativos.
 * Função pura, chamada a cada tick do motor e pela UI.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function computeHeroStats(state: GameState): HeroStats {
  const { hunter } = state;
  const classDef = CLASSES[hunter.classId];
  let gearAttack = 0;
  let gearDefense = 0;
  let gearHp = 0;
  for (const item of Object.values(state.equipment)) {
    if (!item) continue;
    const stats = getItemStats(item);
    gearAttack += stats.attack;
    gearDefense += stats.defense;
    gearHp += stats.hp;
  }

  let echoPower = 0;
  for (const monsterId of state.activeEchoIds) {
    const entry = state.echoes[monsterId];
    if (entry) echoPower += getEchoPower(monsterId, entry.tier);
  }

  const { agi, vit } = hunter.attributes;
  const primary = hunter.attributes[classDef.primary];
  const attackPower = classDef.baseDamage + primary * classDef.primaryScaling + gearAttack + echoPower;
  const speedBonus = Math.min(agi * BALANCE.attackSpeedPerAgi, BALANCE.maxAttackSpeedBonus);
  const isBlade = hunter.classId === 'blade';
  const critChance = Math.min(
    BALANCE.baseCritChance + agi * BALANCE.critChancePerAgi + (isBlade ? BALANCE.bladeBonusCrit : 0),
    BALANCE.maxCritChance,
  );

  return {
    maxHp: Math.round(
      classDef.baseHp + classDef.hpPerLevel * (hunter.level - 1) + vit * BALANCE.hpPerVit + gearHp,
    ),
    attackPower,
    // O dano por golpe usa o intervalo-base da classe: assim a AGI aumenta o DPS real.
    hitDamage: (attackPower * classDef.attackIntervalMs) / BALANCE.referenceIntervalMs,
    defense: vit + gearDefense,
    critChance,
    critMultiplier: isBlade ? BALANCE.bladeCritMultiplier : BALANCE.critMultiplier,
    attackIntervalMs: classDef.attackIntervalMs / (1 + speedBonus),
    echoPower,
  };
}

/** Fator multiplicativo de dano após mitigação pela defesa (0..1]. */
export function damageReduction(defense: number): number {
  return BALANCE.defenseConstant / (BALANCE.defenseConstant + Math.max(defense, 0));
}

/** Rank do caçador: equivale ao rank da fenda mais alta liberada. */
export function getHunterRank(state: GameState): Rank {
  const zone = ZONES.find((z) => z.tier === state.highestUnlockedTier) ?? ZONES[0];
  return zone ? zone.rank : 'E';
}
