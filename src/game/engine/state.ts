import { BALANCE } from '../data/balance';
import { ZONES } from '../data/zones';
import type { ClassId, GameState } from '../types';
import { computeHeroStats } from './formulas';

export const SAVE_VERSION = 1;
export const MAX_NAME_LENGTH = 16;

/** Normaliza o nome do caçador (trim, colapso de espaços, limite de tamanho). */
export function sanitizeHunterName(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return cleaned.length > 0 ? cleaned : 'Caçador';
}

/**
 * Cria o estado inicial de um novo jogo. `seed` e `now` são injetados para
 * manter a função pura e os testes determinísticos.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createNewGame(name: string, classId: ClassId, seed: number, now: number): GameState {
  const firstZone = ZONES[0];
  if (!firstZone) throw new Error('Nenhuma zona configurada');
  const start = BALANCE.startingAttribute;
  const state: GameState = {
    version: SAVE_VERSION,
    rng: seed >>> 0,
    nextItemUid: 1,
    hunter: {
      name: sanitizeHunterName(name),
      classId,
      level: 1,
      xp: 0,
      attributePoints: 0,
      attributes: { str: start, agi: start, int: start, vit: start },
      hp: 0,
    },
    gold: 0,
    essence: BALANCE.startingEssence,
    inventory: [],
    equipment: { weapon: null, armor: null, accessory: null },
    echoes: {},
    activeEchoIds: [],
    combat: {
      zoneId: firstZone.id,
      phase: 'respawning',
      phaseTimerMs: BALANCE.respawnDelayMs,
      enemy: null,
      heroAttackTimerMs: 0,
      enemyAttackTimerMs: 0,
      killsTowardBoss: 0,
      bossTimerMs: 0,
    },
    highestUnlockedTier: 1,
    bossKillsByZone: {},
    bossRequested: false,
    settings: { autoBoss: true, autoBind: true, autoSellMaxRarity: null },
    stats: { kills: 0, bossKills: 0, deaths: 0, goldEarned: 0, itemsFound: 0 },
    lastSeenAt: now,
  };
  state.hunter.hp = computeHeroStats(state).maxHp;
  return state;
}
