import type { MonsterDef, Rank, ZoneDef } from '../types';
import { BALANCE } from './balance';

/**
 * Catálogo de fendas (zonas) e monstros. Os atributos finais de cada
 * monstro são derivados de uma linha-base por zona multiplicada por
 * fatores individuais, o que permite rebalancear uma fenda inteira
 * alterando um único registro.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
interface MonsterSeed {
  id: string;
  name: string;
  hpFactor: number;
  attackFactor: number;
  attackIntervalMs: number;
}

interface ZoneSeed {
  id: string;
  rank: Rank;
  name: string;
  description: string;
  recommendedLevel: number;
  base: { hp: number; attack: number; defense: number; xp: number; gold: number; echoPower: number };
  monsters: readonly [MonsterSeed, MonsterSeed];
  boss: MonsterSeed;
}

const ZONE_SEEDS: readonly ZoneSeed[] = [
  {
    id: 'hollow_tunnels',
    rank: 'E',
    name: 'Túneis Ocos',
    description: 'Galerias de metrô abandonadas, tomadas por pragas mutadas pela fenda.',
    recommendedLevel: 1,
    base: { hp: 55, attack: 7, defense: 0, xp: 10, gold: 3, echoPower: 3 },
    monsters: [
      { id: 'rust_rat', name: 'Rato de Ferrugem', hpFactor: 0.85, attackFactor: 0.9, attackIntervalMs: 1300 },
      { id: 'crystal_grub', name: 'Larva de Cristal', hpFactor: 1.2, attackFactor: 1.1, attackIntervalMs: 1700 },
    ],
    boss: { id: 'plated_alpha', name: 'Alfa Couraçado', hpFactor: 1, attackFactor: 1, attackIntervalMs: 1600 },
  },
  {
    id: 'ashen_marsh',
    rank: 'D',
    name: 'Pântano Cinzento',
    description: 'Brejo coberto de névoa onde luzes falsas atraem os descuidados.',
    recommendedLevel: 5,
    base: { hp: 480, attack: 20, defense: 10, xp: 45, gold: 10, echoPower: 8 },
    monsters: [
      { id: 'lantern_toad', name: 'Sapo-Lanterna', hpFactor: 1.15, attackFactor: 0.9, attackIntervalMs: 1600 },
      { id: 'mire_stalker', name: 'Espreitador do Lodo', hpFactor: 0.9, attackFactor: 1.1, attackIntervalMs: 1300 },
    ],
    boss: { id: 'bog_hydra', name: 'Hidra do Brejo', hpFactor: 1, attackFactor: 1, attackIntervalMs: 1600 },
  },
  {
    id: 'sunken_ruins',
    rank: 'C',
    name: 'Ruínas Afundadas',
    description: 'Templo submerso guardado por construtos que nunca dormem.',
    recommendedLevel: 12,
    base: { hp: 900, attack: 42, defense: 25, xp: 110, gold: 22, echoPower: 16 },
    monsters: [
      { id: 'stone_sentinel', name: 'Sentinela de Pedra', hpFactor: 1.25, attackFactor: 1.05, attackIntervalMs: 1800 },
      { id: 'hollow_archer', name: 'Arqueiro Oco', hpFactor: 0.85, attackFactor: 0.95, attackIntervalMs: 1300 },
    ],
    boss: { id: 'runic_colossus', name: 'Colosso Rúnico', hpFactor: 1, attackFactor: 1, attackIntervalMs: 1700 },
  },
  {
    id: 'shattered_tundra',
    rank: 'B',
    name: 'Tundra Estilhaçada',
    description: 'Planície congelada, partida por fissuras que sopram vento cortante.',
    recommendedLevel: 22,
    base: { hp: 1400, attack: 75, defense: 45, xp: 220, gold: 40, echoPower: 26 },
    monsters: [
      { id: 'rime_wolf', name: 'Lobo de Geada', hpFactor: 0.9, attackFactor: 0.9, attackIntervalMs: 1200 },
      { id: 'frost_shaman', name: 'Xamã do Gelo', hpFactor: 1.15, attackFactor: 1.15, attackIntervalMs: 1800 },
    ],
    boss: { id: 'glacial_wyrm', name: 'Wyrm Glacial', hpFactor: 1, attackFactor: 1, attackIntervalMs: 1600 },
  },
  {
    id: 'cinder_citadel',
    rank: 'A',
    name: 'Cidadela de Cinzas',
    description: 'Fortaleza em brasa onde uma guarnição queimada ainda monta guarda.',
    recommendedLevel: 35,
    base: { hp: 2000, attack: 126, defense: 70, xp: 380, gold: 65, echoPower: 38 },
    monsters: [
      { id: 'ember_knight', name: 'Cavaleiro de Brasa', hpFactor: 1.2, attackFactor: 1.1, attackIntervalMs: 1700 },
      { id: 'soot_imp', name: 'Diabrete de Fuligem', hpFactor: 0.85, attackFactor: 0.9, attackIntervalMs: 1200 },
    ],
    boss: { id: 'pyre_tyrant', name: 'Tirano da Pira', hpFactor: 1, attackFactor: 1, attackIntervalMs: 1600 },
  },
  {
    id: 'void_threshold',
    rank: 'S',
    name: 'Limiar do Vazio',
    description: 'Onde a fenda termina e o céu sem estrelas começa.',
    recommendedLevel: 52,
    base: { hp: 2700, attack: 190, defense: 100, xp: 600, gold: 100, echoPower: 52 },
    monsters: [
      { id: 'star_eater', name: 'Devorador Estelar', hpFactor: 1.15, attackFactor: 1.1, attackIntervalMs: 1700 },
      { id: 'void_watcher', name: 'Vigia do Vazio', hpFactor: 0.9, attackFactor: 0.95, attackIntervalMs: 1300 },
    ],
    boss: { id: 'eclipse_herald', name: 'Arauto do Eclipse', hpFactor: 1, attackFactor: 1, attackIntervalMs: 1500 },
  },
];

/**
 * Materializa um MonsterDef a partir da linha-base da zona. O ataque é
 * proporcional ao intervalo para que monstros lentos e rápidos tenham o
 * mesmo DPS nominal antes do fator individual.
 */
function buildMonster(zone: ZoneSeed, seed: MonsterSeed, isBoss: boolean): MonsterDef {
  const speedNormalization = seed.attackIntervalMs / 1500;
  const bossHp = isBoss ? BALANCE.bossHpMultiplier : 1;
  const bossAttack = isBoss ? BALANCE.bossAttackMultiplier : 1;
  return {
    id: seed.id,
    name: seed.name,
    assetId: `monster_${seed.id}`,
    zoneId: zone.id,
    isBoss,
    hp: Math.round(zone.base.hp * seed.hpFactor * bossHp),
    attack: Math.round(zone.base.attack * seed.attackFactor * speedNormalization * bossAttack),
    defense: zone.base.defense,
    attackIntervalMs: seed.attackIntervalMs,
    xp: Math.round(zone.base.xp * seed.hpFactor * (isBoss ? BALANCE.bossXpMultiplier : 1)),
    gold: Math.round(zone.base.gold * seed.hpFactor * (isBoss ? BALANCE.bossGoldMultiplier : 1)),
    echoPower: Math.round(zone.base.echoPower * (isBoss ? BALANCE.bossEchoMultiplier : 1)),
  };
}

const monsterMap: Record<string, MonsterDef> = {};
const zoneList: ZoneDef[] = [];

ZONE_SEEDS.forEach((seed, index) => {
  for (const monster of seed.monsters) monsterMap[monster.id] = buildMonster(seed, monster, false);
  monsterMap[seed.boss.id] = buildMonster(seed, seed.boss, true);
  zoneList.push({
    id: seed.id,
    tier: index + 1,
    rank: seed.rank,
    name: seed.name,
    description: seed.description,
    backgroundAssetId: `bg_${seed.id}`,
    recommendedLevel: seed.recommendedLevel,
    monsterIds: seed.monsters.map((m) => m.id),
    bossId: seed.boss.id,
  });
});

export const ZONES: readonly ZoneDef[] = zoneList;
export const MONSTERS: Readonly<Record<string, MonsterDef>> = monsterMap;
export const MAX_TIER = ZONES.length;

export function getZone(zoneId: string): ZoneDef {
  const zone = ZONES.find((z) => z.id === zoneId);
  if (!zone) throw new Error(`Zona desconhecida: ${zoneId}`);
  return zone;
}

export function findZone(zoneId: string): ZoneDef | undefined {
  return ZONES.find((z) => z.id === zoneId);
}

export function getMonster(monsterId: string): MonsterDef {
  const monster = MONSTERS[monsterId];
  if (!monster) throw new Error(`Monstro desconhecido: ${monsterId}`);
  return monster;
}
