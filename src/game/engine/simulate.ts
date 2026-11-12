import { BALANCE } from '../data/balance';
import type { EventSink, GameEvent, GameState, Rarity } from '../types';
import { step } from './combat';

export interface ProgressReport {
  elapsedMs: number;
  /** true quando a ausência excedeu o teto e foi truncada. */
  capped: boolean;
  kills: number;
  bossKills: number;
  deaths: number;
  xp: number;
  gold: number;
  levelsGained: number;
  itemsKept: number;
  itemsAutoSold: number;
  bestRarity: Rarity | null;
  essence: number;
  echoesBound: number;
  zonesUnlocked: string[];
}

const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/** Cria um agregador de eventos que resume um período de simulação. */
function createReportCollector(report: ProgressReport): EventSink {
  return (event: GameEvent) => {
    switch (event.type) {
      case 'kill':
        report.kills += 1;
        if (event.boss) report.bossKills += 1;
        report.xp += event.xp;
        report.gold += event.gold;
        break;
      case 'death':
        report.deaths += 1;
        break;
      case 'levelUp':
        report.levelsGained += 1;
        break;
      case 'loot':
        if (event.autoSoldFor !== null) {
          report.itemsAutoSold += 1;
          report.gold += event.autoSoldFor;
        } else {
          report.itemsKept += 1;
        }
        if (
          report.bestRarity === null ||
          RARITY_ORDER.indexOf(event.item.rarity) > RARITY_ORDER.indexOf(report.bestRarity)
        ) {
          report.bestRarity = event.item.rarity;
        }
        break;
      case 'essence':
        report.essence += event.amount;
        break;
      case 'echo':
        report.echoesBound += 1;
        break;
      case 'zoneUnlocked':
        report.zonesUnlocked.push(event.zoneId);
        break;
      default:
        break;
    }
  };
}

/**
 * Simula um intervalo de tempo arbitrário em ticks fixos, usando o mesmo
 * `step` do tempo real. Aplica o teto de ausência e ignora relógio
 * retrocedido (elapsed negativo/NaN), protegendo contra manipulação trivial
 * de data do sistema.
 *
 * Custo: O(elapsed / tickMs). O teto de 8h equivale a 288k ticks, executados
 * em dezenas de milissegundos (coberto por teste de performance).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function simulateElapsed(state: GameState, elapsedMs: number, extraSink?: EventSink): ProgressReport {
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const cappedElapsed = Math.min(safeElapsed, BALANCE.maxOfflineMs);
  const report: ProgressReport = {
    elapsedMs: cappedElapsed,
    capped: safeElapsed > BALANCE.maxOfflineMs,
    kills: 0,
    bossKills: 0,
    deaths: 0,
    xp: 0,
    gold: 0,
    levelsGained: 0,
    itemsKept: 0,
    itemsAutoSold: 0,
    bestRarity: null,
    essence: 0,
    echoesBound: 0,
    zonesUnlocked: [],
  };
  const collect = createReportCollector(report);
  const sink: EventSink = extraSink
    ? (event) => {
        collect(event);
        extraSink(event);
      }
    : collect;

  const ticks = Math.floor(cappedElapsed / BALANCE.tickMs);
  for (let i = 0; i < ticks; i++) step(state, BALANCE.tickMs, sink);
  return report;
}
