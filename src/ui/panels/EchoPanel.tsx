import { BALANCE } from '../../game/data/balance';
import { MONSTERS, ZONES } from '../../game/data/zones';
import { fuseEcho, toggleEcho, updateSettings } from '../../game/engine/actions';
import { getEchoFusionCost, getEchoPower } from '../../game/engine/formulas';
import { Sprite } from '../Sprite';
import { formatNumber, formatPercent } from '../format';
import { useGameStore } from '../useGame';

/**
 * Coleção de ecos: vínculo automático, esquadrão ativo e fusão de cópias.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function EchoPanel() {
  const store = useGameStore();
  const state = store.state;
  if (!state) return null;
  const squadFull = state.activeEchoIds.length >= BALANCE.echoSlots;

  return (
    <div className="stack">
      <div className="card">
        <div className="card__title">
          <h3>Ecos</h3>
          <span className="muted">
            Esquadrão {state.activeEchoIds.length}/{BALANCE.echoSlots}
          </span>
        </div>
        <p className="muted">
          Ao abater um monstro, 1 essência é consumida para tentar vincular seu eco ({formatPercent(BALANCE.echoBindChanceNormal)} monstros,{' '}
          {formatPercent(BALANCE.echoBindChanceBoss)} guardiões). Ecos ativos somam poder de ataque. {BALANCE.echoCopiesPerFusion} cópias + ouro elevam o tier
          (máx. {BALANCE.echoMaxTier}).
        </p>
        <label className="toggle">
          <input type="checkbox" checked={state.settings.autoBind} onChange={(event) => store.act((s) => updateSettings(s, { autoBind: event.target.checked }))} />
          <span>Vincular ecos automaticamente (essência: {formatNumber(state.essence)})</span>
        </label>
      </div>

      {ZONES.filter((zone) => zone.tier <= state.highestUnlockedTier).map((zone) => (
        <div key={zone.id} className="card">
          <h3>
            <span className={`rank-badge rank-badge--${zone.rank}`}>{zone.rank}</span> {zone.name}
          </h3>
          <ul className="echo-list">
            {[...zone.monsterIds, zone.bossId].map((monsterId) => {
              const monster = MONSTERS[monsterId];
              if (!monster) return null;
              const entry = state.echoes[monsterId];
              if (!entry) {
                return (
                  <li key={monsterId} className="echo echo--locked">
                    <Sprite assetId={monster.assetId} echo className="echo__sprite" />
                    <div className="echo__text">
                      <strong>{monster.name}</strong>
                      <small className="muted">Eco ainda não vinculado</small>
                    </div>
                  </li>
                );
              }
              const active = state.activeEchoIds.includes(monsterId);
              const atMaxTier = entry.tier >= BALANCE.echoMaxTier;
              const fusionCost = getEchoFusionCost(monsterId, entry.tier);
              const canFuse = !atMaxTier && entry.copies >= BALANCE.echoCopiesPerFusion && state.gold >= fusionCost;
              return (
                <li key={monsterId} className={`echo ${active ? 'echo--active' : ''}`}>
                  <Sprite assetId={monster.assetId} echo className="echo__sprite" />
                  <div className="echo__text">
                    <strong>
                      {monster.name} <span className="stars" aria-label={`Tier ${entry.tier}`}>{'★'.repeat(entry.tier)}{'☆'.repeat(BALANCE.echoMaxTier - entry.tier)}</span>
                    </strong>
                    <small className="muted">
                      +{formatNumber(getEchoPower(monsterId, entry.tier))} de poder
                      {atMaxTier ? ' · tier máximo' : ` · cópias ${entry.copies}/${BALANCE.echoCopiesPerFusion}`}
                    </small>
                  </div>
                  <div className="echo__actions">
                    <button className={`btn btn--small ${active ? 'btn--primary' : ''}`} disabled={!active && squadFull} onClick={() => store.act((s) => toggleEcho(s, monsterId))}>
                      {active ? 'Ativo' : 'Ativar'}
                    </button>
                    {!atMaxTier && (
                      <button className="btn btn--small" disabled={!canFuse} onClick={() => store.act((s) => fuseEcho(s, monsterId))}>
                        Fundir ({formatNumber(fusionCost)})
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
