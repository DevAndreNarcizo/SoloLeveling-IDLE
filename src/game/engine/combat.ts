import { BALANCE, RARITY_WEIGHTS_BOSS, RARITY_WEIGHTS_NORMAL, SLOT_WEIGHTS } from '../data/balance';
import { MAX_TIER, MONSTERS, ZONES, findZone } from '../data/zones';
import { chance, pick, pickWeighted } from '../rng';
import { RARITIES } from '../types';
import type { EventSink, GameState, ItemInstance, MonsterDef, ZoneDef } from '../types';
import { computeHeroStats, damageReduction, getSellValue, xpToNextLevel } from './formulas';
import type { HeroStats } from './formulas';

const NOOP_SINK: EventSink = () => {};

/**
 * Concede XP e processa subidas de nível em cadeia. Ao subir de nível o
 * caçador recebe pontos de atributo e tem o HP restaurado.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function grantXp(state: GameState, amount: number, emit: EventSink = NOOP_SINK): void {
  const { hunter } = state;
  if (hunter.level >= BALANCE.maxLevel) {
    hunter.xp = 0;
    return;
  }
  hunter.xp += amount;
  let leveled = false;
  while (hunter.level < BALANCE.maxLevel && hunter.xp >= xpToNextLevel(hunter.level)) {
    hunter.xp -= xpToNextLevel(hunter.level);
    hunter.level += 1;
    hunter.attributePoints += BALANCE.attributePointsPerLevel;
    leveled = true;
    emit({ type: 'levelUp', level: hunter.level });
  }
  if (hunter.level >= BALANCE.maxLevel) hunter.xp = 0;
  if (leveled) hunter.hp = computeHeroStats(state).maxHp;
}

/** Credita ouro e mantém a estatística vitalícia consistente. */
export function grantGold(state: GameState, amount: number): void {
  state.gold += amount;
  state.stats.goldEarned += amount;
}

/**
 * Gera um equipamento para o tier da zona e o encaminha: venda automática
 * (configuração do jogador ou inventário cheio) ou inventário.
 */
function rollLoot(state: GameState, zone: ZoneDef, boss: boolean, emit: EventSink): void {
  if (!chance(state, boss ? BALANCE.dropChanceBoss : BALANCE.dropChanceNormal)) return;
  const item: ItemInstance = {
    uid: state.nextItemUid++,
    slot: pickWeighted(state, SLOT_WEIGHTS),
    tier: zone.tier,
    rarity: pickWeighted(state, boss ? RARITY_WEIGHTS_BOSS : RARITY_WEIGHTS_NORMAL),
    enhance: 0,
  };
  state.stats.itemsFound += 1;

  const autoSellLimit = state.settings.autoSellMaxRarity;
  const matchesAutoSell =
    autoSellLimit !== null && RARITIES.indexOf(item.rarity) <= RARITIES.indexOf(autoSellLimit);
  if (matchesAutoSell || state.inventory.length >= BALANCE.inventorySize) {
    const value = getSellValue(item);
    grantGold(state, value);
    emit({ type: 'loot', item, autoSoldFor: value });
    return;
  }
  state.inventory.push(item);
  emit({ type: 'loot', item, autoSoldFor: null });
}

/**
 * Tenta vincular o eco do monstro abatido consumindo 1 essência. Não gasta
 * essência com espécies que já atingiram o tier máximo.
 */
function tryBindEcho(state: GameState, monster: MonsterDef, emit: EventSink): void {
  if (!state.settings.autoBind || state.essence <= 0) return;
  const entry = state.echoes[monster.id];
  if (entry && entry.tier >= BALANCE.echoMaxTier) return;

  state.essence -= 1;
  if (!chance(state, monster.isBoss ? BALANCE.echoBindChanceBoss : BALANCE.echoBindChanceNormal)) return;

  if (entry) {
    entry.copies += 1;
    emit({ type: 'echo', monsterId: monster.id, isNew: false });
    return;
  }
  state.echoes[monster.id] = { tier: 1, copies: 0 };
  // Conveniência: ecos novos entram no esquadrão enquanto houver vaga.
  if (state.activeEchoIds.length < BALANCE.echoSlots) state.activeEchoIds.push(monster.id);
  emit({ type: 'echo', monsterId: monster.id, isNew: true });
}

/** Coloca o combate em espera pelo próximo inimigo. */
function beginRespawn(state: GameState): void {
  state.combat.enemy = null;
  state.combat.bossTimerMs = 0;
  state.combat.phase = 'respawning';
  state.combat.phaseTimerMs = BALANCE.respawnDelayMs;
}

/** Aplica todas as consequências de um abate: recompensas, progresso e loot. */
function handleKill(state: GameState, monster: MonsterDef, zone: ZoneDef, emit: EventSink): void {
  state.stats.kills += 1;
  grantGold(state, monster.gold);
  emit({ type: 'kill', monsterId: monster.id, boss: monster.isBoss, xp: monster.xp, gold: monster.gold });
  grantXp(state, monster.xp, emit);

  if (monster.isBoss) {
    state.stats.bossKills += 1;
    state.bossKillsByZone[zone.id] = (state.bossKillsByZone[zone.id] ?? 0) + 1;
    state.combat.killsTowardBoss = 0;
    state.bossRequested = false;
    state.essence += BALANCE.essencePerBoss;
    emit({ type: 'essence', amount: BALANCE.essencePerBoss });
    if (zone.tier === state.highestUnlockedTier && zone.tier < MAX_TIER) {
      state.highestUnlockedTier = zone.tier + 1;
      const unlocked = ZONES.find((z) => z.tier === state.highestUnlockedTier);
      if (unlocked) emit({ type: 'zoneUnlocked', zoneId: unlocked.id });
    }
  } else {
    state.combat.killsTowardBoss = Math.min(state.combat.killsTowardBoss + 1, BALANCE.killsPerBoss);
    if (chance(state, BALANCE.essenceChanceNormal)) {
      state.essence += 1;
      emit({ type: 'essence', amount: 1 });
    }
  }

  rollLoot(state, zone, monster.isBoss, emit);
  tryBindEcho(state, monster, emit);
  beginRespawn(state);
}

/**
 * Derrota do caçador (abatido ou expulso pelo limite de tempo do guardião):
 * perde o progresso até o guardião e entra em recuperação.
 */
function handleDeath(
  state: GameState,
  monster: MonsterDef,
  reason: 'slain' | 'timeout',
  emit: EventSink,
): void {
  state.stats.deaths += 1;
  state.hunter.hp = 0;
  state.combat.enemy = null;
  state.combat.bossTimerMs = 0;
  state.combat.killsTowardBoss = 0;
  state.bossRequested = false;
  state.combat.phase = 'recovering';
  state.combat.phaseTimerMs = BALANCE.recoveryDelayMs;
  emit({ type: 'death', monsterId: monster.id, reason });
}

/** Indica se o próximo inimigo a surgir deve ser o guardião da fenda. */
export function isBossReady(state: GameState): boolean {
  return state.combat.killsTowardBoss >= BALANCE.killsPerBoss;
}

function spawnEnemy(state: GameState, zone: ZoneDef, stats: HeroStats): void {
  const wantsBoss = isBossReady(state) && (state.settings.autoBoss || state.bossRequested);
  const monsterId = wantsBoss ? zone.bossId : pick(state, zone.monsterIds);
  const monster = MONSTERS[monsterId];
  if (!monster) throw new Error(`Monstro desconhecido: ${monsterId}`);
  state.combat.enemy = { monsterId, hp: monster.hp };
  state.combat.phase = 'fighting';
  state.combat.phaseTimerMs = 0;
  state.combat.bossTimerMs = monster.isBoss ? BALANCE.bossTimeLimitMs : 0;
  state.combat.heroAttackTimerMs = stats.attackIntervalMs;
  state.combat.enemyAttackTimerMs = monster.attackIntervalMs;
}

/** Resolve um golpe do caçador (crítico, defesa, passivas) e devolve o dano causado. */
function resolveHeroStrike(
  state: GameState,
  stats: HeroStats,
  monster: MonsterDef,
  damageFactor: number,
  emit: EventSink,
): number {
  const crit = chance(state, stats.critChance);
  const defenseFactor = state.hunter.classId === 'arcanist' ? 1 - BALANCE.arcanistDefenseIgnore : 1;
  const raw = stats.hitDamage * damageFactor * (crit ? stats.critMultiplier : 1);
  const amount = Math.max(1, Math.round(raw * damageReduction(monster.defense * defenseFactor)));
  emit({ type: 'hit', source: 'hero', amount, crit });
  return amount;
}

/**
 * Avança a simulação em `dtMs`. É o único ponto que evolui o combate e é
 * usado igualmente pelo loop em tempo real e pelo progresso offline — o que
 * garante que ambos os caminhos produzam exatamente as mesmas regras.
 *
 * Muta `state` in-place (decisão de performance: o offline executa centenas
 * de milhares de ticks) e reporta ocorrências via `emit`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function step(state: GameState, dtMs: number, emit: EventSink = NOOP_SINK): void {
  const { hunter, combat } = state;
  // Save com zona removida do catálogo: retorna à primeira fenda sem quebrar o loop.
  let zone = findZone(combat.zoneId);
  if (!zone) {
    zone = ZONES[0] as ZoneDef;
    combat.zoneId = zone.id;
    beginRespawn(state);
  }
  const stats = computeHeroStats(state);

  if (combat.phase === 'recovering') {
    combat.phaseTimerMs -= dtMs;
    if (combat.phaseTimerMs <= 0) {
      hunter.hp = stats.maxHp;
      beginRespawn(state);
    }
    return;
  }

  // Regeneração passiva; o min também corrige HP acima do teto após trocar equipamento.
  hunter.hp = Math.min(stats.maxHp, hunter.hp + (stats.maxHp * BALANCE.hpRegenPerSecond * dtMs) / 1000);

  if (combat.phase === 'respawning') {
    combat.phaseTimerMs -= dtMs;
    if (combat.phaseTimerMs <= 0) spawnEnemy(state, zone, stats);
    return;
  }

  const enemy = combat.enemy;
  const monster = enemy ? MONSTERS[enemy.monsterId] : undefined;
  if (!enemy || !monster) {
    beginRespawn(state);
    return;
  }

  combat.heroAttackTimerMs -= dtMs;
  // while: suporta dt maior que o intervalo de ataque sem perder golpes.
  while (combat.heroAttackTimerMs <= 0 && enemy.hp > 0) {
    combat.heroAttackTimerMs += stats.attackIntervalMs;
    enemy.hp -= resolveHeroStrike(state, stats, monster, 1, emit);
    if (hunter.classId === 'marksman' && enemy.hp > 0 && chance(state, BALANCE.marksmanDoubleShotChance)) {
      enemy.hp -= resolveHeroStrike(state, stats, monster, BALANCE.marksmanDoubleShotDamage, emit);
    }
    if (hunter.classId === 'cleric') {
      const heal = Math.round(stats.maxHp * BALANCE.clericHealPerAttack);
      hunter.hp = Math.min(stats.maxHp, hunter.hp + heal);
      emit({ type: 'heal', amount: heal });
    }
  }
  if (enemy.hp <= 0) {
    handleKill(state, monster, zone, emit);
    return;
  }

  // Checagem de DPS: o guardião precisa cair dentro do limite de tempo.
  if (monster.isBoss) {
    combat.bossTimerMs -= dtMs;
    if (combat.bossTimerMs <= 0) {
      handleDeath(state, monster, 'timeout', emit);
      return;
    }
  }

  combat.enemyAttackTimerMs -= dtMs;
  const classFactor = hunter.classId === 'guardian' ? BALANCE.guardianDamageTaken : 1;
  while (combat.enemyAttackTimerMs <= 0 && hunter.hp > 0) {
    combat.enemyAttackTimerMs += monster.attackIntervalMs;
    const amount = Math.max(1, Math.round(monster.attack * damageReduction(stats.defense) * classFactor));
    hunter.hp -= amount;
    emit({ type: 'hit', source: 'enemy', amount, crit: false });
  }
  if (hunter.hp <= 0) handleDeath(state, monster, 'slain', emit);
}
