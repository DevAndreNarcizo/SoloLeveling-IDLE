import type { ClassDef, ClassId } from '../types';

/**
 * Catálogo de classes jogáveis. Arquétipos genéricos de RPG com nomes
 * próprios do projeto; cada classe possui exatamente uma passiva,
 * implementada em `engine/combat.ts` e parametrizada em `balance.ts`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const CLASSES: Readonly<Record<ClassId, ClassDef>> = {
  guardian: {
    id: 'guardian',
    name: 'Guardião',
    description: 'Linha de frente blindada. Golpes pesados e muita resistência.',
    passiveDescription: 'Baluarte: recebe 15% menos dano.',
    assetId: 'hunter_guardian',
    weaponAssetId: 'item_weapon_guardian',
    weaponName: 'Espada Larga',
    primary: 'str',
    primaryScaling: 4.2,
    baseHp: 130,
    hpPerLevel: 12,
    baseDamage: 12,
    attackIntervalMs: 1500,
  },
  blade: {
    id: 'blade',
    name: 'Lâmina',
    description: 'Duelista veloz que vive de acertos críticos.',
    passiveDescription: 'Ponto Vital: +10% de chance de crítico e críticos causam 200%.',
    assetId: 'hunter_blade',
    weaponAssetId: 'item_weapon_blade',
    weaponName: 'Adagas Gêmeas',
    primary: 'agi',
    primaryScaling: 3,
    baseHp: 90,
    hpPerLevel: 8,
    baseDamage: 7,
    attackIntervalMs: 900,
  },
  arcanist: {
    id: 'arcanist',
    name: 'Arcanista',
    description: 'Conjurador lento e devastador que atravessa armaduras.',
    passiveDescription: 'Perfuração Arcana: ignora 50% da defesa inimiga.',
    assetId: 'hunter_arcanist',
    weaponAssetId: 'item_weapon_arcanist',
    weaponName: 'Cajado Rúnico',
    primary: 'int',
    primaryScaling: 3,
    baseHp: 85,
    hpPerLevel: 7,
    baseDamage: 18,
    attackIntervalMs: 1900,
  },
  marksman: {
    id: 'marksman',
    name: 'Atirador',
    description: 'Arqueiro de precisão com disparos em sequência.',
    passiveDescription: 'Tiro Duplo: 20% de chance de um segundo disparo com 60% do dano.',
    assetId: 'hunter_marksman',
    weaponAssetId: 'item_weapon_marksman',
    weaponName: 'Arco Longo',
    primary: 'agi',
    primaryScaling: 3,
    baseHp: 90,
    hpPerLevel: 8,
    baseDamage: 9,
    attackIntervalMs: 1200,
  },
  cleric: {
    id: 'cleric',
    name: 'Clérigo',
    description: 'Combatente sagrado que se sustenta durante a luta.',
    passiveDescription: 'Bênção: cada ataque cura 1% do HP máximo.',
    assetId: 'hunter_cleric',
    weaponAssetId: 'item_weapon_cleric',
    weaponName: 'Maça Consagrada',
    primary: 'int',
    primaryScaling: 4,
    baseHp: 105,
    hpPerLevel: 10,
    baseDamage: 10,
    attackIntervalMs: 1500,
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

export function isClassId(value: unknown): value is ClassId {
  return typeof value === 'string' && value in CLASSES;
}
