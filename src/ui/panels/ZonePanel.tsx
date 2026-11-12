import { BALANCE } from '../../game/data/balance';
import { MONSTERS, ZONES } from '../../game/data/zones';
import { changeZone, updateSettings } from '../../game/engine/actions';
import { formatNumber } from '../format';
import { useGameStore } from '../useGame';

/**
 * Seleção de fendas. Cada fenda é liberada ao derrotar o guardião da anterior.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function ZonePanel() {
  const store = useGameStore();
  const state = store.state;
  if (!state) return null;

  return (
    <div className="stack">
      <div className="card">
        <h3>Fendas</h3>
        <p className="muted">
          A cada {BALANCE.killsPerBoss} abates o guardião da fenda aparece. Derrote-o em até {BALANCE.bossTimeLimitMs / 1000}s para liberar a próxima fenda.
          Ser derrotado ou trocar de fenda zera a contagem.
        </p>
        <label className="toggle">
          <input type="checkbox" checked={state.settings.autoBoss} onChange={(event) => store.act((s) => updateSettings(s, { autoBoss: event.target.checked }))} />
          <span>Enfrentar o guardião automaticamente</span>
        </label>
      </div>

      {ZONES.map((zone) => {
        const unlocked = zone.tier <= state.highestUnlockedTier;
        const current = zone.id === state.combat.zoneId;
        const boss = MONSTERS[zone.bossId];
        return (
          <div key={zone.id} className={`card zone ${current ? 'zone--current' : ''} ${unlocked ? '' : 'zone--locked'}`}>
            <div className="card__title">
              <h3>
                <span className={`rank-badge rank-badge--${zone.rank}`}>{zone.rank}</span> {unlocked ? zone.name : '???'}
              </h3>
              <span className="muted">Nível recomendado {zone.recommendedLevel}+</span>
            </div>
            {unlocked ? (
              <>
                <p className="muted">{zone.description}</p>
                <p className="muted">
                  Guardião: {boss?.name ?? '—'} · derrotado {formatNumber(state.bossKillsByZone[zone.id] ?? 0)}x
                </p>
                <button className={`btn ${current ? '' : 'btn--primary'}`} disabled={current} onClick={() => store.act((s) => changeZone(s, zone.id))}>
                  {current ? 'Você está aqui' : 'Entrar'}
                </button>
              </>
            ) : (
              <p className="muted">Derrote o guardião da fenda anterior para liberar.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
