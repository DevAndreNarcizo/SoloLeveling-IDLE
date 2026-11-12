import { createContext, useContext, useSyncExternalStore } from 'react';
import type { GameStore } from '../game/store';

export const GameStoreContext = createContext<GameStore | null>(null);

/**
 * Assina o GameStore e re-renderiza o componente a cada nova versão do
 * estado. O motor muta o estado in-place; a "versão" é o snapshot imutável
 * que o React compara.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function useGameStore(): GameStore {
  const store = useContext(GameStoreContext);
  if (!store) throw new Error('GameStoreContext ausente');
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}
