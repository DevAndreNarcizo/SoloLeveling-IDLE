import type { EquipSlot, Rarity } from '../types';

/**
 * Constantes de balanceamento. Ponto único de ajuste: nenhuma fórmula do
 * motor deve conter números mágicos fora deste arquivo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const BALANCE = {
  tickMs: 100,
  maxLevel: 100,
  attributePointsPerLevel: 3,
  startingAttribute: 5,
  startingEssence: 5,

  // --- Combate ---
  /** Intervalo de referência que normaliza o dano por golpe entre classes. */
  referenceIntervalMs: 1300,
  respawnDelayMs: 700,
  recoveryDelayMs: 5000,
  /** Fração do HP máximo regenerada por segundo fora do estado "recuperando". */
  hpRegenPerSecond: 0.01,
  killsPerBoss: 25,
  /** Tempo máximo para derrotar um guardião; ao expirar o caçador é expulso. */
  bossTimeLimitMs: 60_000,
  baseCritChance: 0.05,
  critChancePerAgi: 0.0005,
  maxCritChance: 0.5,
  critMultiplier: 1.5,
  attackSpeedPerAgi: 0.001,
  maxAttackSpeedBonus: 0.5,
  hpPerVit: 10,
  /** Redução de dano = K / (K + defesa). */
  defenseConstant: 100,

  // --- Passivas de classe ---
  guardianDamageTaken: 0.85,
  bladeCritMultiplier: 2.0,
  bladeBonusCrit: 0.1,
  arcanistDefenseIgnore: 0.5,
  marksmanDoubleShotChance: 0.2,
  marksmanDoubleShotDamage: 0.6,
  clericHealPerAttack: 0.01,

  // --- Guardiões (chefes) ---
  bossHpMultiplier: 12,
  bossAttackMultiplier: 1.6,
  bossXpMultiplier: 12,
  bossGoldMultiplier: 15,
  bossEchoMultiplier: 2,

  // --- Loot ---
  inventorySize: 30,
  dropChanceNormal: 0.1,
  dropChanceBoss: 1,
  essenceChanceNormal: 0.04,
  essencePerBoss: 2,
  enhanceBonusPerLevel: 0.06,
  /** Chance de sucesso ao aprimorar de +i para +i+1; o tamanho define o teto. */
  enhanceChances: [1, 1, 1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2],
  accessoryAttackFactor: 0.4,
  accessoryHpFactor: 0.5,
  respecCostPerLevel: 50,

  // --- Ecos ---
  echoSlots: 3,
  echoMaxTier: 5,
  echoCopiesPerFusion: 3,
  echoBindChanceNormal: 0.1,
  echoBindChanceBoss: 0.35,
  echoTierMultipliers: [1, 1.3, 1.7, 2.2, 2.8],
  echoFusionBaseCost: 200,

  // --- Offline ---
  maxOfflineMs: 8 * 60 * 60 * 1000,
  /** Ausências menores que isto não geram relatório. */
  offlineReportThresholdMs: 60 * 1000,
} as const;

/** Valores-base de equipamento por tier (índice 0 = tier 1). */
export const WEAPON_ATTACK_BY_TIER = [8, 20, 40, 65, 95, 130] as const;
export const ARMOR_DEFENSE_BY_TIER = [8, 20, 36, 56, 80, 108] as const;
export const ARMOR_HP_BY_TIER = [40, 100, 180, 280, 400, 540] as const;

export const RARITY_STAT_MULTIPLIER: Readonly<Record<Rarity, number>> = {
  common: 1,
  uncommon: 1.25,
  rare: 1.6,
  epic: 2.1,
  legendary: 2.8,
};

export const RARITY_SELL_MULTIPLIER: Readonly<Record<Rarity, number>> = {
  common: 1,
  uncommon: 2,
  rare: 4,
  epic: 8,
  legendary: 16,
};

export const RARITY_WEIGHTS_NORMAL: Readonly<Record<Rarity, number>> = {
  common: 600,
  uncommon: 260,
  rare: 110,
  epic: 27,
  legendary: 3,
};

export const RARITY_WEIGHTS_BOSS: Readonly<Record<Rarity, number>> = {
  common: 300,
  uncommon: 350,
  rare: 250,
  epic: 85,
  legendary: 15,
};

export const SLOT_WEIGHTS: Readonly<Record<EquipSlot, number>> = {
  weapon: 40,
  armor: 35,
  accessory: 25,
};
