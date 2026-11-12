import { CLASSES } from '../game/data/classes';
import type { AttributeKey, ClassId, EquipSlot, ItemInstance, Rarity } from '../game/types';

const RANK_BY_TIER = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
const integerFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const compactFormat = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export const RARITY_LABEL: Readonly<Record<Rarity, string>> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
};

export const SLOT_LABEL: Readonly<Record<EquipSlot, string>> = {
  weapon: 'Arma',
  armor: 'Armadura',
  accessory: 'Acessório',
};

export const ATTRIBUTE_INFO: Readonly<Record<AttributeKey, { label: string; icon: string; hint: string }>> = {
  str: { label: 'Força', icon: 'icon_str', hint: 'Poder de ataque do Guardião.' },
  agi: { label: 'Agilidade', icon: 'icon_agi', hint: 'Velocidade de ataque e crítico. Poder de Lâmina e Atirador.' },
  int: { label: 'Inteligência', icon: 'icon_int', hint: 'Poder de ataque de Arcanista e Clérigo.' },
  vit: { label: 'Vitalidade', icon: 'icon_vit', hint: 'HP máximo e defesa.' },
};

/** Inteiros até 99.999 por extenso; acima disso em notação compacta (12,3 mil). */
export function formatNumber(value: number): string {
  const rounded = Math.floor(value);
  return Math.abs(rounded) < 100_000 ? integerFormat.format(rounded) : compactFormat.format(rounded);
}

export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}min`;
  return `${Math.max(minutes, 1)}min`;
}

export function rankOfTier(tier: number): string {
  return RANK_BY_TIER[Math.min(Math.max(tier, 1), RANK_BY_TIER.length) - 1] ?? 'E';
}

/** Nome de exibição do item; armas adotam o tipo da classe do caçador. */
export function itemName(item: ItemInstance, classId: ClassId): string {
  const base =
    item.slot === 'weapon' ? CLASSES[classId].weaponName : item.slot === 'armor' ? 'Armadura' : 'Anel';
  const enhance = item.enhance > 0 ? ` +${item.enhance}` : '';
  return `${base} [${rankOfTier(item.tier)}]${enhance}`;
}

export function itemAssetId(item: ItemInstance, classId: ClassId): string {
  if (item.slot === 'weapon') return CLASSES[classId].weaponAssetId;
  return item.slot === 'armor' ? 'item_armor' : 'item_accessory';
}
