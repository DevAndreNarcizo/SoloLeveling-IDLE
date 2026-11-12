import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { computeHeroStats } from '../engine/formulas';
import { simulateElapsed } from '../engine/simulate';
import { createNewGame } from '../engine/state';
import { GameStore } from '../store';
import type { GameState } from '../types';
import {
  CORRUPT_BACKUP_KEY,
  SAVE_KEY,
  deserializeState,
  exportSave,
  importSave,
  loadGame,
  sanitizeState,
  saveGame,
  serializeState,
} from './save';
import type { KeyValueStorage } from './save';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** Estado avançado e realista, obtido jogando de fato. */
function playedState(): GameState {
  const state = createNewGame('Ayla Çã', 'marksman', 77, 1000);
  state.essence = 500;
  simulateElapsed(state, 30 * 60 * 1000);
  state.hunter.attributes.agi += state.hunter.attributePoints;
  state.hunter.attributePoints = 0;
  state.lastSeenAt = 5000;
  return state;
}

const tamper = (state: GameState, mutate: (raw: Record<string, any>) => void): GameState | null => {
  const raw = JSON.parse(serializeState(state)) as Record<string, any>;
  mutate(raw);
  return sanitizeState(raw, 10_000);
};

describe('persistência', () => {
  it('faz roundtrip preservando o progresso (o combate em andamento é reiniciado)', () => {
    const state = playedState();
    const restored = deserializeState(serializeState(state), 10_000);
    expect(restored).not.toBeNull();
    expect(restored?.hunter).toEqual({ ...state.hunter, hp: Math.max(1, state.hunter.hp) });
    expect(restored?.inventory).toEqual(state.inventory);
    expect(restored?.equipment).toEqual(state.equipment);
    expect(restored?.echoes).toEqual(state.echoes);
    expect(restored?.gold).toBe(state.gold);
    expect(restored?.stats).toEqual(state.stats);
    expect(restored?.rng).toBe(state.rng);
    expect(restored?.combat.enemy).toBeNull();
    expect(restored?.combat.phase).toBe('respawning');
  });

  it('rejeita conteúdo ilegível, de outra versão ou sem classe válida', () => {
    expect(deserializeState('{não é json', 0)).toBeNull();
    expect(deserializeState('null', 0)).toBeNull();
    expect(deserializeState('[]', 0)).toBeNull();
    expect(tamper(playedState(), (raw) => (raw.version = 999))).toBeNull();
    expect(tamper(playedState(), (raw) => (raw.hunter.classId = 'hacker'))).toBeNull();
    expect(tamper(playedState(), (raw) => delete raw.hunter)).toBeNull();
  });

  it('saneia valores adulterados e reimpõe invariantes', () => {
    const state = playedState();
    const result = tamper(state, (raw) => {
      raw.gold = -50;
      raw.essence = 'muito';
      raw.hunter.level = 5000;
      raw.hunter.attributes.str = 999_999;
      raw.hunter.hp = 1e12;
      raw.highestUnlockedTier = 99;
      raw.combat.zoneId = 'zona_fantasma';
      raw.combat.killsTowardBoss = 1e6;
      raw.lastSeenAt = 99_999_999;
      raw.activeEchoIds = ['nao_existe', 'nao_existe', 42];
      raw.echoes.__proto_fake__ = { tier: 9, copies: 9 };
      raw.settings.autoSellMaxRarity = 'mythic';
      raw.inventory.push({ uid: 1.5, slot: 'weapon', tier: 1, rarity: 'common', enhance: 0 });
      raw.inventory.push({ uid: 5_000_000, slot: 'weapon', tier: 44, rarity: 'common', enhance: 0 });
      raw.inventory.push({ uid: 6_000_000, slot: 'armor', tier: 2, rarity: 'rare', enhance: 9999 });
    }) as GameState;

    expect(result.gold).toBe(0);
    expect(result.essence).toBe(0);
    expect(result.hunter.level).toBe(BALANCE.maxLevel);
    const spent = Object.values(result.hunter.attributes).reduce((sum, v) => sum + v - BALANCE.startingAttribute, 0);
    expect(spent + result.hunter.attributePoints).toBe((BALANCE.maxLevel - 1) * BALANCE.attributePointsPerLevel);
    expect(result.hunter.hp).toBe(computeHeroStats(result).maxHp);
    expect(result.highestUnlockedTier).toBe(6);
    expect(result.combat.zoneId).toBe('hollow_tunnels');
    expect(result.combat.killsTowardBoss).toBe(BALANCE.killsPerBoss);
    expect(result.lastSeenAt).toBe(10_000);
    expect(result.activeEchoIds).toEqual([]);
    expect(Object.keys(result.echoes)).not.toContain('__proto_fake__');
    expect(result.settings.autoSellMaxRarity).toBeNull();
    expect(result.inventory.some((i) => i.uid === 1.5 || i.uid === 5_000_000)).toBe(false);
    const enhanced = result.inventory.find((i) => i.uid === 6_000_000);
    if (enhanced) expect(enhanced.enhance).toBe(BALANCE.enhanceChances.length);
    expect(result.nextItemUid).toBeGreaterThan(Math.max(0, ...result.inventory.map((i) => i.uid)));
  });

  it('descarta itens com uid duplicado e em slot incompatível', () => {
    const state = createNewGame('A', 'guardian', 1, 0);
    const result = tamper(state, (raw) => {
      raw.inventory = [
        { uid: 1, slot: 'weapon', tier: 1, rarity: 'common', enhance: 0 },
        { uid: 1, slot: 'armor', tier: 1, rarity: 'common', enhance: 0 },
      ];
      raw.equipment.weapon = { uid: 2, slot: 'armor', tier: 1, rarity: 'common', enhance: 0 };
      raw.zona = 'campo desconhecido é ignorado';
    }) as GameState;
    expect(result.inventory).toHaveLength(1);
    expect(result.equipment.weapon).toBeNull();
    expect(result.nextItemUid).toBeGreaterThanOrEqual(3);
  });

  it('preserva um backup quando o save armazenado está corrompido', () => {
    const storage = memoryStorage({ [SAVE_KEY]: '{"version":1,"hunter":' });
    const result = loadGame(storage, 0);
    expect(result).toEqual({ state: null, corrupted: true });
    expect(storage.data.get(CORRUPT_BACKUP_KEY)).toBe('{"version":1,"hunter":');
    expect(loadGame(memoryStorage(), 0)).toEqual({ state: null, corrupted: false });
  });

  it('reporta falha de gravação sem lançar exceção', () => {
    const failing: KeyValueStorage = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('bloqueado'); },
    };
    expect(saveGame(failing, playedState())).toBe(false);
    expect(loadGame(failing, 0)).toEqual({ state: null, corrupted: false });
  });

  it('exporta e importa (inclusive nomes com acentos) e rejeita código inválido', () => {
    const state = playedState();
    const imported = importSave(`  ${exportSave(state)}\n`, 10_000);
    expect(imported?.hunter.name).toBe('Ayla Çã');
    expect(imported?.gold).toBe(state.gold);
    expect(importSave('isto não é base64!!', 0)).toBeNull();
    expect(importSave(btoa('{"version":1}'), 0)).toBeNull();
    expect(importSave('', 0)).toBeNull();
  });
});

describe('GameStore', () => {
  it('cria, salva e recarrega aplicando o progresso offline com relatório', () => {
    const storage = memoryStorage();
    let now = 1_000_000;
    const first = new GameStore(storage, () => now);
    first.boot();
    expect(first.state).toBeNull();
    first.newGame('  Kai   Rhen  ', 'blade');
    expect(first.state?.hunter.name).toBe('Kai Rhen');
    expect(storage.data.has(SAVE_KEY)).toBe(true);

    now += 2 * 60 * 60 * 1000;
    const second = new GameStore(storage, () => now);
    second.boot();
    expect(second.status).toBe('ready');
    expect(second.offlineReport?.elapsedMs).toBe(2 * 60 * 60 * 1000);
    expect(second.state?.stats.kills).toBe(second.offlineReport?.kills);
    expect(second.state?.lastSeenAt).toBe(now);
  });

  it('avança em tempo real pelo relógio e não regride com relógio atrasado', () => {
    let now = 5_000_000;
    const store = new GameStore(memoryStorage(), () => now);
    store.boot();
    store.newGame('Teste', 'guardian');
    let notifications = 0;
    store.subscribe(() => notifications++);

    now += 30_000;
    store.advance();
    const kills = store.state?.stats.kills ?? 0;
    expect(kills).toBeGreaterThan(0);
    expect(store.offlineReport).toBeNull();
    expect(notifications).toBe(1);

    now -= 60_000;
    store.advance();
    expect(store.state?.stats.kills).toBe(kills);

    now += 10 * 60 * 1000;
    store.advance();
    expect(store.offlineReport).not.toBeNull();
    store.dismissOfflineReport();
    expect(store.offlineReport).toBeNull();
  });

  it('importação inválida não altera o jogo e reset apaga o save', () => {
    const storage = memoryStorage();
    const store = new GameStore(storage, () => 1000);
    store.boot();
    store.newGame('Teste', 'cleric');
    const code = store.exportSave() as string;
    expect(store.importSave('lixo')).toBe(false);
    expect(store.state?.hunter.classId).toBe('cleric');
    expect(store.importSave(code)).toBe(true);
    store.reset();
    expect(store.state).toBeNull();
    expect(storage.data.has(SAVE_KEY)).toBe(false);
  });

  it('sinaliza save corrompido na inicialização', () => {
    const store = new GameStore(memoryStorage({ [SAVE_KEY]: 'x' }), () => 0);
    store.boot();
    expect(store.corruptedSave).toBe(true);
    expect(store.state).toBeNull();
  });
});
