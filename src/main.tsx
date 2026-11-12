import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameStore } from './game/store';
import type { KeyValueStorage } from './game/persistence/save';
import { App } from './ui/App';
import { GameStoreContext } from './ui/useGame';
import './styles.css';

const LOOP_INTERVAL_MS = 100;
const TAB_LOCK_NAME = 'cacador-de-fendas:sessao';

/**
 * Devolve o localStorage quando utilizável; caso contrário (modo privado,
 * storage bloqueado) um armazenamento em memória, para que o jogo funcione
 * mesmo sem persistência — a UI sinaliza a falha de gravação.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function resolveStorage(): KeyValueStorage {
  try {
    const probe = '__cdf_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
      removeItem: (key) => void memory.delete(key),
    };
  }
}

/**
 * Garante uma única aba ativa por navegador via Web Locks API. Duas abas
 * simulando e gravando o mesmo save se sobrescreveriam (perda de progresso).
 * O lock é mantido até a aba fechar. Sem suporte à API, segue sem bloqueio.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function acquireTabLock(): Promise<boolean> {
  if (!('locks' in navigator)) return Promise.resolve(true);
  return new Promise((resolve) => {
    navigator.locks
      .request(TAB_LOCK_NAME, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(false);
          return undefined;
        }
        resolve(true);
        // Promise que nunca resolve: retém o lock durante toda a vida da aba.
        return new Promise<void>(() => {});
      })
      .catch(() => resolve(true));
  });
}

const store = new GameStore(resolveStorage());

void acquireTabLock().then((acquired) => {
  if (!acquired) {
    store.block();
    return;
  }
  store.boot();
  window.setInterval(() => store.advance(), LOOP_INTERVAL_MS);
  // Persistência nos pontos em que a aba pode ser descartada sem aviso.
  const flush = () => {
    store.advance();
    store.save();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else store.advance();
  });
  window.addEventListener('pagehide', flush);
});

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado');
createRoot(container).render(
  <StrictMode>
    <GameStoreContext.Provider value={store}>
      <App />
    </GameStoreContext.Provider>
  </StrictMode>,
);
