import { useState } from 'react';
import { CLASSES } from '../game/data/classes';
import { getHunterRank, xpToNextLevel } from '../game/engine/formulas';
import { BALANCE } from '../game/data/balance';
import { Bar } from './Bar';
import { BattleStage } from './BattleStage';
import { ClassSelect } from './ClassSelect';
import { OfflineModal } from './OfflineModal';
import { Sprite } from './Sprite';
import { formatNumber } from './format';
import { EchoPanel } from './panels/EchoPanel';
import { HunterPanel } from './panels/HunterPanel';
import { InventoryPanel } from './panels/InventoryPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { ZonePanel } from './panels/ZonePanel';
import { useGameStore } from './useGame';

const TABS = [
  { id: 'hunter', label: 'Caçador' },
  { id: 'inventory', label: 'Inventário' },
  { id: 'echoes', label: 'Ecos' },
  { id: 'zones', label: 'Fendas' },
  { id: 'settings', label: 'Ajustes' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Raiz da interface: decide entre carregamento, bloqueio por aba duplicada,
 * criação de personagem e o layout principal do jogo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function App() {
  const store = useGameStore();
  const [tab, setTab] = useState<TabId>('hunter');
  const state = store.state;

  if (store.status === 'loading') return <div className="fullscreen-note">Abrindo a fenda...</div>;
  if (store.status === 'blocked') {
    return (
      <div className="fullscreen-note">
        <h1>Jogo aberto em outra aba</h1>
        <p>Para proteger seu progresso, apenas uma aba pode jogar por vez. Feche a outra aba e recarregue esta página.</p>
      </div>
    );
  }
  if (!state) return <ClassSelect />;

  const { hunter } = state;
  const classDef = CLASSES[hunter.classId];
  const atMaxLevel = hunter.level >= BALANCE.maxLevel;
  const xpNeeded = xpToNextLevel(hunter.level);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__identity">
          <span className={`rank-badge rank-badge--${getHunterRank(state)}`}>{getHunterRank(state)}</span>
          <div>
            <strong>{hunter.name}</strong>
            <small>
              {classDef.name} · Nível {hunter.level}
            </small>
          </div>
        </div>
        <div className="topbar__xp">
          <Bar
            value={atMaxLevel ? 1 : hunter.xp}
            max={atMaxLevel ? 1 : xpNeeded}
            tone="xp"
            label={atMaxLevel ? 'Nível máximo' : `XP ${formatNumber(hunter.xp)} / ${formatNumber(xpNeeded)}`}
          />
        </div>
        <div className="topbar__wallet">
          <span className="currency" title="Ouro">
            <Sprite assetId="icon_gold" className="sprite--inline" /> {formatNumber(state.gold)}
          </span>
          <span className="currency" title="Essência">
            <Sprite assetId="icon_essence" className="sprite--inline" /> {formatNumber(state.essence)}
          </span>
        </div>
      </header>

      {!store.lastSaveOk && (
        <div className="banner banner--bad" role="alert">
          Não foi possível salvar o progresso neste navegador (armazenamento cheio ou bloqueado). Exporte seu save em Ajustes.
        </div>
      )}

      <main className="layout">
        <BattleStage />
        <section className="panel">
          <nav className="tabs" role="tablist">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                role="tab"
                aria-selected={tab === entry.id}
                className={`tab ${tab === entry.id ? 'tab--active' : ''}`}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
                {entry.id === 'hunter' && hunter.attributePoints > 0 && <span className="dot" aria-label="pontos disponíveis" />}
              </button>
            ))}
          </nav>
          <div className="panel__body" role="tabpanel">
            {tab === 'hunter' && <HunterPanel />}
            {tab === 'inventory' && <InventoryPanel />}
            {tab === 'echoes' && <EchoPanel />}
            {tab === 'zones' && <ZonePanel />}
            {tab === 'settings' && <SettingsPanel />}
          </div>
        </section>
      </main>

      {store.offlineReport && <OfflineModal />}
    </div>
  );
}
