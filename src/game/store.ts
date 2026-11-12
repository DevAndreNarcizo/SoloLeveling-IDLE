import { BALANCE } from './data/balance';
import { getMonster, getZone } from './data/zones';
import { step } from './engine/combat';
import { simulateElapsed } from './engine/simulate';
import type { ProgressReport } from './engine/simulate';
import { createNewGame } from './engine/state';
import { clearSave, exportSave, importSave, loadGame, saveGame } from './persistence/save';
import type { KeyValueStorage } from './persistence/save';
import type { ClassId, GameEvent, GameState } from './types';

export type StoreStatus = 'loading' | 'ready' | 'blocked';
export type LogTone = 'info' | 'good' | 'bad' | 'epic';

export interface LogEntry {
  id: number;
  tone: LogTone;
  text: string;
}

/** Efeito visual efêmero de dano/cura exibido no palco de combate. */
export interface HitFx {
  id: number;
  target: 'hero' | 'enemy';
  amount: number;
  kind: 'hit' | 'crit' | 'heal';
}

const MAX_LOG_ENTRIES = 40;
const MAX_HIT_FX = 8;
const AUTOSAVE_INTERVAL_MS = 10_000;

const RARITY_LABEL = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
} as const;

/**
 * Orquestrador da sessão de jogo: mantém o GameState, converte tempo real
 * em ticks do motor, agrega eventos para a UI e cuida da persistência.
 *
 * Relógio e armazenamento são injetados, portanto a classe é testável sem
 * browser. A UI assina mudanças via `subscribe`/`getVersion`
 * (compatível com `useSyncExternalStore`).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class GameStore {
  status: StoreStatus = 'loading';
  state: GameState | null = null;
  log: LogEntry[] = [];
  hits: HitFx[] = [];
  offlineReport: ProgressReport | null = null;
  /** true quando um save existente foi rejeitado na carga (backup preservado). */
  corruptedSave = false;
  /** false quando a última tentativa de gravação falhou (quota/modo privado). */
  lastSaveOk = true;

  private version = 0;
  private readonly listeners = new Set<() => void>();
  private lastTickAt = 0;
  private carryMs = 0;
  private lastSaveAt = 0;
  private nextFxId = 1;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly now: () => number = () => Date.now(),
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  private notify(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  /** Marca a sessão como bloqueada (jogo já aberto em outra aba). */
  block(): void {
    this.status = 'blocked';
    this.notify();
  }

  /** Carrega o save e aplica o progresso offline acumulado. */
  boot(): void {
    const now = this.now();
    const { state, corrupted } = loadGame(this.storage, now);
    this.corruptedSave = corrupted;
    this.state = state;
    if (state) this.applyAbsence(state, now - state.lastSeenAt, now);
    this.lastTickAt = now;
    this.lastSaveAt = now;
    this.status = 'ready';
    this.notify();
  }

  newGame(name: string, classId: ClassId): void {
    const now = this.now();
    // Seed derivada do relógio: única fonte de entropia fora do motor.
    this.state = createNewGame(name, classId, (now ^ (now / 0x100000000)) >>> 0, now);
    this.log = [];
    this.hits = [];
    this.offlineReport = null;
    this.corruptedSave = false;
    this.lastTickAt = now;
    this.carryMs = 0;
    this.pushLog('info', `${this.state.hunter.name} atravessa a primeira fenda.`);
    this.save();
    this.notify();
  }

  /**
   * Avança a simulação até o instante atual. Chamado por um timer; como se
   * baseia no tempo decorrido real, continua correto quando o browser
   * estrangula timers de abas em segundo plano.
   */
  advance(): void {
    const state = this.state;
    if (!state || this.status !== 'ready') return;
    const now = this.now();
    const elapsed = now - this.lastTickAt;
    this.lastTickAt = now;
    if (!(elapsed > 0)) return;

    if (elapsed >= BALANCE.offlineReportThresholdMs) {
      // Aba suspensa/computador em repouso: tratado como ausência, sem efeitos visuais.
      this.applyAbsence(state, elapsed, now);
    } else {
      this.carryMs += elapsed;
      const ticks = Math.floor(this.carryMs / BALANCE.tickMs);
      this.carryMs -= ticks * BALANCE.tickMs;
      for (let i = 0; i < ticks; i++) step(state, BALANCE.tickMs, this.handleLiveEvent);
      state.lastSeenAt = now;
    }
    if (now - this.lastSaveAt >= AUTOSAVE_INTERVAL_MS) this.save();
    this.notify();
  }

  /** Simula um período de ausência e acumula o relatório exibido ao jogador. */
  private applyAbsence(state: GameState, elapsedMs: number, now: number): void {
    const report = simulateElapsed(state, elapsedMs);
    state.lastSeenAt = now;
    if (report.elapsedMs >= BALANCE.offlineReportThresholdMs) {
      this.offlineReport = this.offlineReport ? mergeReports(this.offlineReport, report) : report;
    }
    this.hits = [];
  }

  /** Executa uma ação do jogador sobre o estado e notifica a UI. */
  act<T>(action: (state: GameState) => T): T | undefined {
    if (!this.state) return undefined;
    const result = action(this.state);
    this.notify();
    return result;
  }

  dismissOfflineReport(): void {
    this.offlineReport = null;
    this.notify();
  }

  save(): boolean {
    if (!this.state || this.status !== 'ready') return false;
    this.lastSaveAt = this.now();
    this.lastSaveOk = saveGame(this.storage, this.state);
    return this.lastSaveOk;
  }

  exportSave(): string | null {
    return this.state ? exportSave(this.state) : null;
  }

  /** Substitui o jogo atual por um save exportado. Retorna false se inválido. */
  importSave(encoded: string): boolean {
    const now = this.now();
    const imported = importSave(encoded, now);
    if (!imported) return false;
    // Importação não concede progresso offline retroativo.
    imported.lastSeenAt = now;
    this.state = imported;
    this.log = [];
    this.hits = [];
    this.offlineReport = null;
    this.lastTickAt = now;
    this.carryMs = 0;
    this.save();
    this.notify();
    return true;
  }

  reset(): void {
    clearSave(this.storage);
    this.state = null;
    this.log = [];
    this.hits = [];
    this.offlineReport = null;
    this.notify();
  }

  private pushLog(tone: LogTone, text: string): void {
    this.log = [{ id: this.nextFxId++, tone, text }, ...this.log].slice(0, MAX_LOG_ENTRIES);
  }

  private pushHit(target: HitFx['target'], amount: number, kind: HitFx['kind']): void {
    this.hits = [...this.hits, { id: this.nextFxId++, target, amount, kind }].slice(-MAX_HIT_FX);
  }

  /** Traduz eventos do motor em feedback de UI (log e números flutuantes). */
  private handleLiveEvent = (event: GameEvent): void => {
    switch (event.type) {
      case 'hit':
        this.pushHit(event.source === 'hero' ? 'enemy' : 'hero', event.amount, event.crit ? 'crit' : 'hit');
        break;
      case 'heal':
        this.pushHit('hero', event.amount, 'heal');
        break;
      case 'kill':
        if (event.boss) {
          this.pushLog('epic', `Guardião derrotado: ${getMonster(event.monsterId).name}! +${event.xp} XP, +${event.gold} ouro.`);
        }
        break;
      case 'levelUp':
        this.pushLog('good', `Nível ${event.level} alcançado! +${BALANCE.attributePointsPerLevel} pontos de atributo.`);
        break;
      case 'loot':
        if (event.autoSoldFor !== null) {
          // Vendas automáticas de itens comuns não poluem o registro.
          if (event.item.rarity !== 'common') {
            this.pushLog('info', `Item ${RARITY_LABEL[event.item.rarity]} vendido automaticamente por ${event.autoSoldFor} ouro.`);
          }
        } else {
          const tone: LogTone = event.item.rarity === 'epic' || event.item.rarity === 'legendary' ? 'epic' : 'info';
          this.pushLog(tone, `Equipamento encontrado: ${RARITY_LABEL[event.item.rarity]} (tier ${event.item.tier}).`);
        }
        break;
      case 'essence':
        break;
      case 'echo':
        this.pushLog(
          'epic',
          event.isNew
            ? `Novo eco vinculado: ${getMonster(event.monsterId).name}!`
            : `Cópia de eco obtida: ${getMonster(event.monsterId).name}.`,
        );
        break;
      case 'death':
        this.pushLog(
          'bad',
          event.reason === 'timeout'
            ? `Tempo esgotado contra ${getMonster(event.monsterId).name}. O caçador foi expulso da fenda.`
            : `Derrotado por ${getMonster(event.monsterId).name}. Recuperando...`,
        );
        break;
      case 'zoneUnlocked':
        this.pushLog('epic', `Nova fenda liberada: ${getZone(event.zoneId).name}!`);
        break;
    }
  };
}

/** Soma dois relatórios de ausência consecutivos ainda não vistos pelo jogador. */
function mergeReports(a: ProgressReport, b: ProgressReport): ProgressReport {
  const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
  const best =
    a.bestRarity === null
      ? b.bestRarity
      : b.bestRarity === null
        ? a.bestRarity
        : rarityOrder.indexOf(a.bestRarity) >= rarityOrder.indexOf(b.bestRarity)
          ? a.bestRarity
          : b.bestRarity;
  return {
    elapsedMs: a.elapsedMs + b.elapsedMs,
    capped: a.capped || b.capped,
    kills: a.kills + b.kills,
    bossKills: a.bossKills + b.bossKills,
    deaths: a.deaths + b.deaths,
    xp: a.xp + b.xp,
    gold: a.gold + b.gold,
    levelsGained: a.levelsGained + b.levelsGained,
    itemsKept: a.itemsKept + b.itemsKept,
    itemsAutoSold: a.itemsAutoSold + b.itemsAutoSold,
    bestRarity: best,
    essence: a.essence + b.essence,
    echoesBound: a.echoesBound + b.echoesBound,
    zonesUnlocked: [...a.zonesUnlocked, ...b.zonesUnlocked],
  };
}
