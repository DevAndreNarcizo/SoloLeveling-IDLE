import { BALANCE } from '../../game/data/balance';
import { CLASSES } from '../../game/data/classes';
import { allocateAttribute, getRespecCost, respecAttributes } from '../../game/engine/actions';
import { computeHeroStats } from '../../game/engine/formulas';
import { ATTRIBUTE_KEYS } from '../../game/types';
import { Sprite } from '../Sprite';
import { ATTRIBUTE_INFO, formatNumber, formatPercent } from '../format';
import { useGameStore } from '../useGame';

/**
 * Ficha do caçador: atributos derivados, distribuição de pontos e
 * estatísticas vitalícias.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function HunterPanel() {
  const store = useGameStore();
  const state = store.state;
  if (!state) return null;

  const { hunter } = state;
  const classDef = CLASSES[hunter.classId];
  const stats = computeHeroStats(state);
  const respecCost = getRespecCost(state);
  const hasSpentPoints = ATTRIBUTE_KEYS.some((key) => hunter.attributes[key] > BALANCE.startingAttribute);
  const dps = (stats.hitDamage * (1 + stats.critChance * (stats.critMultiplier - 1)) * 1000) / stats.attackIntervalMs;

  return (
    <div className="stack">
      <div className="card">
        <h3>{classDef.name}</h3>
        <p className="muted">{classDef.passiveDescription}</p>
        <table className="stat-table">
          <tbody>
            <tr><th scope="row">Poder de ataque</th><td>{formatNumber(stats.attackPower)}</td></tr>
            <tr><th scope="row">Dano por segundo (aprox.)</th><td>{formatNumber(dps)}</td></tr>
            <tr><th scope="row">Intervalo de ataque</th><td>{(stats.attackIntervalMs / 1000).toFixed(2)}s</td></tr>
            <tr><th scope="row">Chance de crítico</th><td>{formatPercent(stats.critChance, 1)} (x{stats.critMultiplier.toFixed(1)})</td></tr>
            <tr><th scope="row">HP máximo</th><td>{formatNumber(stats.maxHp)}</td></tr>
            <tr><th scope="row">Defesa</th><td>{formatNumber(stats.defense)}</td></tr>
            <tr><th scope="row">Poder dos ecos</th><td>+{formatNumber(stats.echoPower)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card__title">
          <h3>Atributos</h3>
          <span className={hunter.attributePoints > 0 ? 'text-good' : 'muted'}>
            {hunter.attributePoints} ponto(s) disponível(is)
          </span>
        </div>
        <ul className="attr-list">
          {ATTRIBUTE_KEYS.map((key) => {
            const info = ATTRIBUTE_INFO[key];
            return (
              <li key={key} className="attr">
                <Sprite assetId={info.icon} className="sprite--icon" />
                <div className="attr__text">
                  <strong>
                    {info.label}
                    {classDef.primary === key ? ' ★' : ''}
                  </strong>
                  <small className="muted">{info.hint}</small>
                </div>
                <span className="attr__value">{hunter.attributes[key]}</span>
                <button className="btn btn--small" disabled={hunter.attributePoints < 1} aria-label={`Adicionar 1 ponto em ${info.label}`} onClick={() => store.act((s) => allocateAttribute(s, key, 1))}>
                  +1
                </button>
                <button
                  className="btn btn--small"
                  disabled={hunter.attributePoints < 2}
                  aria-label={`Adicionar todos os pontos em ${info.label}`}
                  onClick={() => store.act((s) => allocateAttribute(s, key, s.hunter.attributePoints))}
                >
                  Tudo
                </button>
              </li>
            );
          })}
        </ul>
        <button
          className="btn"
          disabled={!hasSpentPoints || state.gold < respecCost}
          onClick={() => store.act(respecAttributes)}
        >
          Redistribuir atributos ({formatNumber(respecCost)} ouro)
        </button>
      </div>

      <div className="card">
        <h3>Histórico</h3>
        <table className="stat-table">
          <tbody>
            <tr><th scope="row">Monstros abatidos</th><td>{formatNumber(state.stats.kills)}</td></tr>
            <tr><th scope="row">Guardiões derrotados</th><td>{formatNumber(state.stats.bossKills)}</td></tr>
            <tr><th scope="row">Derrotas</th><td>{formatNumber(state.stats.deaths)}</td></tr>
            <tr><th scope="row">Ouro acumulado</th><td>{formatNumber(state.stats.goldEarned)}</td></tr>
            <tr><th scope="row">Itens encontrados</th><td>{formatNumber(state.stats.itemsFound)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
