import { getZone } from '../game/data/zones';
import { RARITY_LABEL, formatDuration, formatNumber } from './format';
import { useGameStore } from './useGame';

/**
 * Resumo do que o caçador conquistou durante a ausência do jogador.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function OfflineModal() {
  const store = useGameStore();
  const report = store.offlineReport;
  if (!report) return null;

  const rows: [string, string][] = [
    ['Monstros abatidos', formatNumber(report.kills)],
    ['Guardiões derrotados', formatNumber(report.bossKills)],
    ['Experiência', `+${formatNumber(report.xp)}`],
    ['Ouro', `+${formatNumber(report.gold)}`],
    ['Níveis ganhos', formatNumber(report.levelsGained)],
    ['Itens guardados', formatNumber(report.itemsKept)],
    ['Itens vendidos automaticamente', formatNumber(report.itemsAutoSold)],
    ['Melhor raridade encontrada', report.bestRarity ? RARITY_LABEL[report.bestRarity] : '—'],
    ['Essência', `+${formatNumber(report.essence)}`],
    ['Ecos vinculados', formatNumber(report.echoesBound)],
    ['Derrotas', formatNumber(report.deaths)],
  ];

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="offline-title">
        <h2 id="offline-title">Enquanto você esteve fora</h2>
        <p className="muted">
          Seu caçador lutou por {formatDuration(report.elapsedMs)}
          {report.capped ? ' (limite máximo de ausência atingido)' : ''}.
        </p>
        <table className="stat-table">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {report.zonesUnlocked.length > 0 && (
          <p className="text-epic">Novas fendas: {report.zonesUnlocked.map((id) => getZone(id).name).join(', ')}</p>
        )}
        <button className="btn btn--primary btn--large" autoFocus onClick={() => store.dismissOfflineReport()}>
          Continuar
        </button>
      </div>
    </div>
  );
}
