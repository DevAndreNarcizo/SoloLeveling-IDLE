import { useState } from 'react';
import { BALANCE } from '../../game/data/balance';
import { formatDuration } from '../format';
import { useGameStore } from '../useGame';

/**
 * Backup manual do save (exportar/importar) e reinício do jogo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function SettingsPanel() {
  const store = useGameStore();
  const [exported, setExported] = useState('');
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  const copyExport = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setMessage({ tone: 'good', text: 'Código copiado para a área de transferência.' });
    } catch {
      // Sem permissão de clipboard: o código permanece visível para cópia manual.
      setMessage({ tone: 'good', text: 'Código gerado. Copie o texto abaixo.' });
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <h3>Progresso</h3>
        <p className="muted">
          O jogo salva automaticamente neste navegador. Seu caçador continua lutando com o jogo fechado por até{' '}
          {formatDuration(BALANCE.maxOfflineMs)}.
        </p>
        <button
          className="btn"
          onClick={() => {
            const saved = store.save();
            setMessage(saved ? { tone: 'good', text: 'Progresso salvo.' } : { tone: 'bad', text: 'Falha ao salvar neste navegador.' });
          }}
        >
          Salvar agora
        </button>
      </div>

      <div className="card">
        <h3>Exportar save</h3>
        <p className="muted">Gere um código para guardar como backup ou levar seu progresso para outro navegador.</p>
        <button
          className="btn"
          onClick={() => {
            const code = store.exportSave() ?? '';
            setExported(code);
            void copyExport(code);
          }}
        >
          Gerar código
        </button>
        {exported !== '' && <textarea readOnly rows={4} value={exported} onFocus={(event) => event.target.select()} aria-label="Código do save" />}
      </div>

      <div className="card">
        <h3>Importar save</h3>
        <p className="muted">Substitui o progresso atual pelo do código informado.</p>
        <textarea rows={4} value={importText} placeholder="Cole aqui o código do save" onChange={(event) => setImportText(event.target.value)} aria-label="Código para importar" />
        <button
          className="btn"
          disabled={importText.trim() === ''}
          onClick={() => {
            if (!window.confirm('Importar este save substituirá o progresso atual. Continuar?')) return;
            const ok = store.importSave(importText);
            setMessage(ok ? { tone: 'good', text: 'Save importado.' } : { tone: 'bad', text: 'Código inválido: nada foi alterado.' });
            if (ok) setImportText('');
          }}
        >
          Importar
        </button>
      </div>

      {message && (
        <p className={message.tone === 'good' ? 'text-good' : 'text-bad'} role="status">
          {message.text}
        </p>
      )}

      <div className="card card--danger">
        <h3>Recomeçar</h3>
        <p className="muted">Apaga o caçador atual e todo o progresso. Esta ação não pode ser desfeita.</p>
        <button
          className="btn btn--danger"
          onClick={() => {
            if (window.confirm('Apagar todo o progresso e criar um novo caçador?')) store.reset();
          }}
        >
          Apagar progresso
        </button>
      </div>

      <p className="disclaimer">Projeto original e independente. Todos os nomes, personagens e artes são próprios.</p>
    </div>
  );
}
