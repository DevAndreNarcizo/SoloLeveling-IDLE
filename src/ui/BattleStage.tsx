import { getAssetUrl } from '../assets/resolve';
import { BALANCE } from '../game/data/balance';
import { CLASSES } from '../game/data/classes';
import { MONSTERS, getZone } from '../game/data/zones';
import { requestBoss } from '../game/engine/actions';
import { isBossReady } from '../game/engine/combat';
import { computeHeroStats } from '../game/engine/formulas';
import type { HitFx } from '../game/store';
import { Bar } from './Bar';
import { Sprite } from './Sprite';
import { formatNumber } from './format';
import { useGameStore } from './useGame';

/** Números flutuantes de dano/cura; a animação CSS roda uma vez por id. */
function HitNumbers({ hits, target }: { hits: readonly HitFx[]; target: HitFx['target'] }) {
  return (
    <div className="hits" aria-hidden="true">
      {hits
        .filter((hit) => hit.target === target)
        .map((hit) => (
          <span key={hit.id} className={`hit hit--${hit.kind}`} style={{ ['--hit-x' as string]: `${(hit.id % 5) * 12 - 24}px` }}>
            {hit.kind === 'heal' ? '+' : '-'}
            {formatNumber(hit.amount)}
            {hit.kind === 'crit' ? '!' : ''}
          </span>
        ))}
    </div>
  );
}

/**
 * Palco de combate: cenário da fenda, caçador, inimigo atual, esquadrão de
 * ecos, progresso até o guardião e registro de eventos.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function BattleStage() {
  const store = useGameStore();
  const state = store.state;
  if (!state) return null;

  const { hunter, combat } = state;
  const zone = getZone(combat.zoneId);
  const stats = computeHeroStats(state);
  const monster = combat.enemy ? MONSTERS[combat.enemy.monsterId] : undefined;
  const backgroundUrl = getAssetUrl(zone.backgroundAssetId);
  const bossReady = isBossReady(state);
  const fightingBoss = monster?.isBoss === true;

  return (
    <section className="stage-column">
      <div
        className={`stage stage--tier-${zone.tier}`}
        style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : undefined}
      >
        <div className="stage__header">
          <span className={`rank-badge rank-badge--${zone.rank}`}>{zone.rank}</span>
          <strong>{zone.name}</strong>
          <div className="stage__boss">
            {fightingBoss ? (
              <Bar value={combat.bossTimerMs} max={BALANCE.bossTimeLimitMs} tone="boss" label={`Guardião — ${Math.ceil(combat.bossTimerMs / 1000)}s`} />
            ) : (
              <Bar value={combat.killsTowardBoss} max={BALANCE.killsPerBoss} tone="boss" label={`Guardião ${combat.killsTowardBoss}/${BALANCE.killsPerBoss}`} />
            )}
          </div>
          {bossReady && !fightingBoss && !state.settings.autoBoss && (
            <button className="btn btn--primary" disabled={state.bossRequested} onClick={() => store.act(requestBoss)}>
              {state.bossRequested ? 'Guardião a caminho' : 'Desafiar guardião'}
            </button>
          )}
        </div>

        <div className="arena">
          <div className={`combatant combatant--hero ${combat.phase === 'recovering' ? 'combatant--down' : ''}`}>
            <HitNumbers hits={store.hits} target="hero" />
            <Sprite assetId={CLASSES[hunter.classId].assetId} className="combatant__sprite" />
            <div className="combatant__plate">
              <span>{hunter.name}</span>
              <Bar value={hunter.hp} max={stats.maxHp} tone="hp" label={`${formatNumber(Math.max(hunter.hp, 0))} / ${formatNumber(stats.maxHp)}`} />
            </div>
          </div>

          <div className="combatant combatant--enemy">
            {combat.enemy && monster ? (
              <>
                <HitNumbers hits={store.hits} target="enemy" />
                <Sprite assetId={monster.assetId} className={`combatant__sprite ${monster.isBoss ? 'combatant__sprite--boss' : ''}`} />
                <div className="combatant__plate">
                  <span>
                    {monster.isBoss ? '★ ' : ''}
                    {monster.name}
                  </span>
                  <Bar value={combat.enemy.hp} max={monster.hp} tone="enemy" label={`${formatNumber(Math.max(combat.enemy.hp, 0))} / ${formatNumber(monster.hp)}`} />
                </div>
              </>
            ) : (
              <div className="combatant__waiting">
                {combat.phase === 'recovering'
                  ? `Recuperando... ${Math.ceil(combat.phaseTimerMs / 1000)}s`
                  : 'Procurando inimigo...'}
              </div>
            )}
          </div>
        </div>

        {state.activeEchoIds.length > 0 && (
          <div className="squad" aria-label="Esquadrão de ecos">
            {state.activeEchoIds.map((id) => {
              const echo = MONSTERS[id];
              return echo ? <Sprite key={id} assetId={echo.assetId} echo className="squad__sprite" /> : null;
            })}
          </div>
        )}
      </div>

      <ul className="log" aria-live="polite">
        {store.log.length === 0 && <li className="muted">Os acontecimentos da fenda aparecem aqui.</li>}
        {store.log.map((entry) => (
          <li key={entry.id} className={`log__entry log__entry--${entry.tone}`}>
            {entry.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
