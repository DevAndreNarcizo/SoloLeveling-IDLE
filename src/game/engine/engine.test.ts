import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { CLASS_IDS } from '../data/classes';
import { MONSTERS, ZONES, getZone } from '../data/zones';
import { nextFloat, pickWeighted } from '../rng';
import type { GameEvent, GameState, ItemInstance } from '../types';
import {
  allocateAttribute,
  changeZone,
  enhanceItem,
  equipItem,
  fuseEcho,
  requestBoss,
  respecAttributes,
  sellAllUpTo,
  sellItem,
  toggleEcho,
  unequipItem,
  updateSettings,
} from './actions';
import { grantXp, step } from './combat';
import { computeHeroStats, getEnhanceCost, getItemStats, getMaxEnhance, getSellValue, xpToNextLevel } from './formulas';
import { simulateElapsed } from './simulate';
import { createNewGame } from './state';

const newGame = (classId: (typeof CLASS_IDS)[number] = 'guardian', seed = 42): GameState =>
  createNewGame('Teste', classId, seed, 0);

const item = (overrides: Partial<ItemInstance> = {}): ItemInstance => ({
  uid: 9000,
  slot: 'weapon',
  tier: 1,
  rarity: 'common',
  enhance: 0,
  ...overrides,
});

/** Torna o caçador forte o bastante para vencer qualquer luta rapidamente. */
function overpower(state: GameState): void {
  state.hunter.attributes = { str: 5000, agi: 5000, int: 5000, vit: 5000 };
  state.hunter.hp = computeHeroStats(state).maxHp;
}

function runUntil(state: GameState, predicate: (events: GameEvent[]) => boolean, maxTicks = 200_000): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    step(state, BALANCE.tickMs, (event) => events.push(event));
    if (predicate(events)) return events;
  }
  throw new Error('Condição não atingida dentro do limite de ticks');
}

describe('rng', () => {
  it('é determinístico e permanece em [0, 1)', () => {
    const a = { rng: 7 };
    const b = { rng: 7 };
    for (let i = 0; i < 1000; i++) {
      const value = nextFloat(a);
      expect(value).toBe(nextFloat(b));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('nunca sorteia entradas com peso zero', () => {
    const holder = { rng: 1 };
    for (let i = 0; i < 500; i++) expect(pickWeighted(holder, { a: 0, b: 1, c: 0 })).toBe('b');
  });
});

describe('dados', () => {
  it('toda zona referencia monstros existentes e exatamente um guardião', () => {
    expect(ZONES.map((z) => z.tier)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const zone of ZONES) {
      expect(MONSTERS[zone.bossId]?.isBoss).toBe(true);
      for (const id of zone.monsterIds) expect(MONSTERS[id]?.isBoss).toBe(false);
    }
  });

  it('as tabelas de balanceamento são coerentes entre si', () => {
    expect(BALANCE.echoTierMultipliers).toHaveLength(BALANCE.echoMaxTier);
    expect(getMaxEnhance()).toBe(BALANCE.enhanceChances.length);
    for (let level = 1; level < BALANCE.maxLevel; level++) {
      expect(xpToNextLevel(level + 1)).toBeGreaterThan(xpToNextLevel(level));
    }
  });
});

describe('fórmulas', () => {
  it('raridade, tier e aprimoramento sempre aumentam os atributos do item', () => {
    expect(getItemStats(item({ rarity: 'rare' })).attack).toBeGreaterThan(getItemStats(item()).attack);
    expect(getItemStats(item({ tier: 2 })).attack).toBeGreaterThan(getItemStats(item()).attack);
    expect(getItemStats(item({ enhance: 5 })).attack).toBeGreaterThan(getItemStats(item()).attack);
    expect(getItemStats(item({ slot: 'armor' }))).toMatchObject({ attack: 0 });
  });

  it('equipamento e atributos refletem nos atributos derivados', () => {
    const state = newGame('blade');
    const before = computeHeroStats(state);
    state.equipment.weapon = item();
    state.equipment.armor = item({ uid: 9001, slot: 'armor' });
    state.hunter.attributes.agi += 10;
    const after = computeHeroStats(state);
    expect(after.attackPower).toBeGreaterThan(before.attackPower);
    expect(after.maxHp).toBeGreaterThan(before.maxHp);
    expect(after.defense).toBeGreaterThan(before.defense);
    expect(after.attackIntervalMs).toBeLessThan(before.attackIntervalMs);
    expect(after.critChance).toBeLessThanOrEqual(BALANCE.maxCritChance);
  });
});

describe('combate', () => {
  it('é determinístico para a mesma seed', () => {
    const a = newGame('marksman', 99);
    const b = newGame('marksman', 99);
    for (let i = 0; i < 20_000; i++) {
      step(a, BALANCE.tickMs);
      step(b, BALANCE.tickMs);
    }
    expect(a).toEqual(b);
    expect(a.stats.kills).toBeGreaterThan(0);
  });

  it('abater um monstro concede XP e ouro', () => {
    const state = newGame();
    const events = runUntil(state, (list) => list.some((e) => e.type === 'kill'));
    const kill = events.find((e) => e.type === 'kill');
    expect(kill).toBeDefined();
    expect(state.stats.kills).toBe(1);
    expect(state.gold).toBeGreaterThan(0);
    expect(state.hunter.xp + (state.hunter.level - 1)).toBeGreaterThan(0);
  });

  it('o guardião surge após a contagem de abates e libera a próxima fenda', () => {
    const state = newGame();
    overpower(state);
    const events = runUntil(state, (list) => list.some((e) => e.type === 'zoneUnlocked'));
    const kills = events.filter((e) => e.type === 'kill');
    expect(kills.filter((e) => e.type === 'kill' && !e.boss)).toHaveLength(BALANCE.killsPerBoss);
    expect(kills.at(-1)).toMatchObject({ boss: true, monsterId: getZone('hollow_tunnels').bossId });
    expect(state.highestUnlockedTier).toBe(2);
    expect(state.combat.killsTowardBoss).toBe(0);
    expect(state.bossKillsByZone.hollow_tunnels).toBe(1);
  });

  it('com autoBoss desligado o guardião só aparece quando solicitado', () => {
    const state = newGame();
    overpower(state);
    updateSettings(state, { autoBoss: false });
    expect(requestBoss(state)).toBe(false);
    for (let i = 0; i < 20_000; i++) step(state, BALANCE.tickMs);
    expect(state.stats.bossKills).toBe(0);
    expect(state.combat.killsTowardBoss).toBe(BALANCE.killsPerBoss);
    expect(requestBoss(state)).toBe(true);
    runUntil(state, (list) => list.some((e) => e.type === 'kill' && e.boss));
    expect(state.bossRequested).toBe(false);
  });

  it('a derrota zera o progresso até o guardião e o caçador se recupera', () => {
    const state = newGame();
    state.combat.killsTowardBoss = 10;
    state.hunter.hp = 1;
    state.combat.phase = 'fighting';
    state.combat.enemy = { monsterId: 'rust_rat', hp: 1e9 };
    state.combat.heroAttackTimerMs = 1e9;
    state.combat.enemyAttackTimerMs = 0;
    const events: GameEvent[] = [];
    step(state, BALANCE.tickMs, (e) => events.push(e));
    expect(events).toContainEqual({ type: 'death', monsterId: 'rust_rat', reason: 'slain' });
    expect(state.combat.phase).toBe('recovering');
    expect(state.combat.killsTowardBoss).toBe(0);
    for (let i = 0; i <= BALANCE.recoveryDelayMs / BALANCE.tickMs; i++) step(state, BALANCE.tickMs);
    expect(state.combat.phase).not.toBe('recovering');
    expect(state.hunter.hp).toBe(computeHeroStats(state).maxHp);
  });

  it('o guardião expulsa o caçador quando o tempo limite expira', () => {
    const state = newGame();
    state.hunter.attributes.vit = 100_000;
    state.hunter.hp = computeHeroStats(state).maxHp;
    // Guardião com HP inalcançável: a única saída possível é o limite de tempo.
    state.combat.phase = 'fighting';
    state.combat.enemy = { monsterId: getZone('hollow_tunnels').bossId, hp: 1e12 };
    state.combat.bossTimerMs = BALANCE.bossTimeLimitMs;
    const events = runUntil(state, (list) => list.at(-1)?.type === 'death');
    expect(events.at(-1)).toMatchObject({ type: 'death', reason: 'timeout' });
    expect(state.stats.deaths).toBe(1);
    expect(state.combat.phase).toBe('recovering');
    expect(state.highestUnlockedTier).toBe(1);
  });

  it('respeita o nível máximo e concede pontos por nível', () => {
    const state = newGame();
    grantXp(state, Number.MAX_SAFE_INTEGER);
    expect(state.hunter.level).toBe(BALANCE.maxLevel);
    expect(state.hunter.xp).toBe(0);
    expect(state.hunter.attributePoints).toBe((BALANCE.maxLevel - 1) * BALANCE.attributePointsPerLevel);
  });

  it.each(CLASS_IDS)('mantém as invariantes do estado em sessão longa (%s)', (classId) => {
    const state = newGame(classId, 2024);
    updateSettings(state, { autoSellMaxRarity: 'common' });
    for (let i = 0; i < 150_000; i++) {
      step(state, BALANCE.tickMs);
      if (i % 500 !== 0) continue;
      const stats = computeHeroStats(state);
      expect(Number.isFinite(state.hunter.hp)).toBe(true);
      expect(state.hunter.hp).toBeLessThanOrEqual(stats.maxHp);
      expect(state.hunter.hp).toBeGreaterThanOrEqual(0);
      expect(state.inventory.length).toBeLessThanOrEqual(BALANCE.inventorySize);
      expect(state.gold).toBeGreaterThanOrEqual(0);
      expect(state.essence).toBeGreaterThanOrEqual(0);
      expect(state.activeEchoIds.length).toBeLessThanOrEqual(BALANCE.echoSlots);
      expect(state.combat.killsTowardBoss).toBeLessThanOrEqual(BALANCE.killsPerBoss);
      allocateAttribute(state, 'vit', state.hunter.attributePoints);
    }
    expect(state.stats.kills).toBeGreaterThan(100);
    expect(new Set(state.inventory.map((i) => i.uid)).size).toBe(state.inventory.length);
    expect(state.inventory.every((i) => i.rarity !== 'common')).toBe(true);
  });

  it('inventário cheio converte novos drops em ouro', () => {
    const state = newGame();
    overpower(state);
    state.inventory = Array.from({ length: BALANCE.inventorySize }, (_, i) => item({ uid: 100 + i }));
    state.nextItemUid = 1000;
    const events = runUntil(state, (list) => list.some((e) => e.type === 'loot'));
    const loot = events.find((e) => e.type === 'loot');
    expect(loot).toMatchObject({ type: 'loot' });
    expect(loot && loot.type === 'loot' && loot.autoSoldFor).toBeGreaterThan(0);
    expect(state.inventory).toHaveLength(BALANCE.inventorySize);
  });

  it('vínculo de ecos consome essência e nunca excede o esquadrão', () => {
    const state = newGame();
    overpower(state);
    state.essence = 5000;
    runUntil(state, () => Object.keys(state.echoes).length >= 3 && Object.values(state.echoes).some((e) => e.copies >= 3));
    expect(state.essence).toBeLessThan(5000);
    expect(state.activeEchoIds.length).toBeLessThanOrEqual(BALANCE.echoSlots);
    const id = Object.entries(state.echoes).find(([, e]) => e.copies >= 3)?.[0] as string;
    state.gold = 0;
    expect(fuseEcho(state, id)).toBe(false);
    state.gold = 1_000_000;
    expect(fuseEcho(state, id)).toBe(true);
    expect(state.echoes[id]?.tier).toBe(2);
  });

  it('não gasta essência com autoBind desligado', () => {
    const state = newGame();
    overpower(state);
    updateSettings(state, { autoBind: false });
    const essence = state.essence;
    for (let i = 0; i < 3000; i++) step(state, BALANCE.tickMs);
    expect(state.essence).toBeGreaterThanOrEqual(essence);
    expect(state.echoes).toEqual({});
  });
});

describe('ações', () => {
  it('distribui e redistribui pontos de atributo com validação', () => {
    const state = newGame();
    expect(allocateAttribute(state, 'str')).toBe(false);
    state.hunter.attributePoints = 5;
    expect(allocateAttribute(state, 'str', 6)).toBe(false);
    expect(allocateAttribute(state, 'str', 1.5)).toBe(false);
    expect(allocateAttribute(state, 'str', 5)).toBe(true);
    expect(state.hunter.attributes.str).toBe(BALANCE.startingAttribute + 5);
    expect(respecAttributes(state)).toBe(false);
    state.gold = 10_000;
    expect(respecAttributes(state)).toBe(true);
    expect(state.hunter.attributes.str).toBe(BALANCE.startingAttribute);
    expect(state.hunter.attributePoints).toBe(5);
    expect(respecAttributes(state)).toBe(false);
  });

  it('equipa trocando com o item anterior e respeita o inventário cheio ao desequipar', () => {
    const state = newGame();
    const first = item({ uid: 1 });
    const second = item({ uid: 2, rarity: 'rare' });
    state.inventory.push(first, second);
    expect(equipItem(state, 1)).toBe(true);
    expect(equipItem(state, 2)).toBe(true);
    expect(state.equipment.weapon).toBe(second);
    expect(state.inventory).toEqual([first]);
    expect(equipItem(state, 777)).toBe(false);
    state.inventory = Array.from({ length: BALANCE.inventorySize }, (_, i) => item({ uid: 100 + i }));
    expect(unequipItem(state, 'weapon')).toBe(false);
    state.inventory.pop();
    expect(unequipItem(state, 'weapon')).toBe(true);
    expect(state.equipment.weapon).toBeNull();
  });

  it('desequipar armadura nunca deixa o HP acima do máximo', () => {
    const state = newGame();
    state.equipment.armor = item({ uid: 5, slot: 'armor', tier: 6, rarity: 'legendary' });
    state.hunter.hp = computeHeroStats(state).maxHp;
    unequipItem(state, 'armor');
    expect(state.hunter.hp).toBe(computeHeroStats(state).maxHp);
  });

  it('vende itens individualmente e em lote', () => {
    const state = newGame();
    const common = item({ uid: 1 });
    const epic = item({ uid: 2, rarity: 'epic' });
    state.inventory.push(common, epic, item({ uid: 3, rarity: 'uncommon' }));
    expect(sellItem(state, 1)).toBe(true);
    expect(state.gold).toBe(getSellValue(common));
    expect(sellItem(state, 1)).toBe(false);
    expect(sellAllUpTo(state, 'uncommon')).toBeGreaterThan(0);
    expect(state.inventory).toEqual([epic]);
  });

  it('aprimora cobrando ouro, sem rebaixar em falhas e respeitando o teto', () => {
    const state = newGame();
    const weapon = item({ uid: 1 });
    state.inventory.push(weapon);
    expect(enhanceItem(state, 1)).toBe('invalid');
    state.gold = getEnhanceCost(weapon);
    expect(enhanceItem(state, 1)).toBe('success');
    expect(state.gold).toBe(0);
    expect(weapon.enhance).toBe(1);

    state.gold = Number.MAX_SAFE_INTEGER;
    let previous = weapon.enhance;
    let failures = 0;
    for (let i = 0; i < 5000 && weapon.enhance < getMaxEnhance(); i++) {
      const result = enhanceItem(state, 1);
      if (result === 'failed') failures += 1;
      expect(weapon.enhance).toBeGreaterThanOrEqual(previous);
      previous = weapon.enhance;
    }
    expect(weapon.enhance).toBe(getMaxEnhance());
    expect(failures).toBeGreaterThan(0);
    expect(enhanceItem(state, 1)).toBe('invalid');
  });

  it('só permite entrar em fendas liberadas', () => {
    const state = newGame();
    expect(changeZone(state, 'ashen_marsh')).toBe(false);
    expect(changeZone(state, 'inexistente')).toBe(false);
    state.highestUnlockedTier = 2;
    state.combat.killsTowardBoss = 7;
    expect(changeZone(state, 'ashen_marsh')).toBe(true);
    expect(state.combat).toMatchObject({ zoneId: 'ashen_marsh', killsTowardBoss: 0, enemy: null });
    expect(changeZone(state, 'ashen_marsh')).toBe(false);
  });

  it('limita o esquadrão de ecos', () => {
    const state = newGame();
    for (const id of ['rust_rat', 'crystal_grub', 'plated_alpha', 'lantern_toad']) state.echoes[id] = { tier: 1, copies: 0 };
    expect(toggleEcho(state, 'rust_rat')).toBe(true);
    expect(toggleEcho(state, 'crystal_grub')).toBe(true);
    expect(toggleEcho(state, 'plated_alpha')).toBe(true);
    expect(toggleEcho(state, 'lantern_toad')).toBe(false);
    expect(toggleEcho(state, 'rust_rat')).toBe(true);
    expect(toggleEcho(state, 'lantern_toad')).toBe(true);
    expect(toggleEcho(state, 'void_watcher')).toBe(false);
  });
});

describe('progresso offline', () => {
  it('ignora tempo negativo ou inválido', () => {
    const state = newGame();
    const snapshot = structuredClone(state);
    expect(simulateElapsed(state, -5000).kills).toBe(0);
    expect(simulateElapsed(state, Number.NaN).elapsedMs).toBe(0);
    expect(state).toEqual(snapshot);
  });

  it('aplica o teto de ausência e o relatório bate com o estado', () => {
    const state = newGame('cleric');
    const report = simulateElapsed(state, BALANCE.maxOfflineMs * 10);
    expect(report.capped).toBe(true);
    expect(report.elapsedMs).toBe(BALANCE.maxOfflineMs);
    expect(report.kills).toBe(state.stats.kills);
    expect(report.gold).toBe(state.stats.goldEarned);
    expect(report.levelsGained).toBe(state.hunter.level - 1);
  });

  it('produz o mesmo resultado que o tempo real equivalente', () => {
    const offline = newGame('arcanist', 5);
    const live = newGame('arcanist', 5);
    simulateElapsed(offline, 600_000);
    for (let i = 0; i < 6000; i++) step(live, BALANCE.tickMs);
    expect(offline).toEqual(live);
  });

  it('simula 8 horas em tempo aceitável', () => {
    const state = newGame('blade');
    const startedAt = performance.now();
    simulateElapsed(state, BALANCE.maxOfflineMs);
    expect(performance.now() - startedAt).toBeLessThan(3000);
  });
});
