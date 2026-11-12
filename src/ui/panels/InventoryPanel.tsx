import { useState } from 'react';
import { BALANCE } from '../../game/data/balance';
import { enhanceItem, equipItem, sellAllUpTo, sellItem, unequipItem, updateSettings } from '../../game/engine/actions';
import type { EnhanceResult } from '../../game/engine/actions';
import { getEnhanceChance, getEnhanceCost, getItemStats, getMaxEnhance, getSellValue } from '../../game/engine/formulas';
import { EQUIP_SLOTS, RARITIES } from '../../game/types';
import type { ItemInstance, Rarity } from '../../game/types';
import { Sprite } from '../Sprite';
import { RARITY_LABEL, SLOT_LABEL, formatNumber, formatPercent, itemAssetId, itemName } from '../format';
import { useGameStore } from '../useGame';

/** Linha "Ataque +12 (+3)" comparando o item com o equipado no mesmo slot. */
function StatLine({ label, value, baseline }: { label: string; value: number; baseline: number | null }) {
  if (value === 0 && (baseline === null || baseline === 0)) return null;
  const diff = baseline === null ? 0 : value - baseline;
  return (
    <li>
      {label} +{formatNumber(value)}
      {diff !== 0 && <span className={diff > 0 ? 'text-good' : 'text-bad'}> ({diff > 0 ? '+' : ''}{formatNumber(diff)})</span>}
    </li>
  );
}

/**
 * Inventário, equipamento e forja (aprimoramento). A seleção guarda apenas o
 * uid: o item é sempre relido do estado para nunca operar sobre dado obsoleto.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function InventoryPanel() {
  const store = useGameStore();
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [forgeResult, setForgeResult] = useState<{ uid: number; result: EnhanceResult } | null>(null);
  const [bulkRarity, setBulkRarity] = useState<Rarity>('common');
  const state = store.state;
  if (!state) return null;

  const classId = state.hunter.classId;
  const equipped = EQUIP_SLOTS.map((slot) => state.equipment[slot]);
  const selected: ItemInstance | undefined =
    state.inventory.find((item) => item.uid === selectedUid) ??
    equipped.find((item): item is ItemInstance => item !== null && item.uid === selectedUid);
  const selectedIsEquipped = selected !== undefined && state.equipment[selected.slot]?.uid === selected.uid;
  const baselineItem = selected && !selectedIsEquipped ? state.equipment[selected.slot] : null;
  const baseline = baselineItem ? getItemStats(baselineItem) : null;
  const inventoryFull = state.inventory.length >= BALANCE.inventorySize;

  const renderSlot = (item: ItemInstance, extraClass = '') => (
    <button
      key={item.uid}
      className={`item item--${item.rarity} ${selectedUid === item.uid ? 'item--selected' : ''} ${extraClass}`}
      title={`${itemName(item, classId)} — ${RARITY_LABEL[item.rarity]}`}
      onClick={() => {
        setSelectedUid(item.uid);
        setForgeResult(null);
      }}
    >
      <Sprite assetId={itemAssetId(item, classId)} className="item__sprite" />
      {item.enhance > 0 && <span className="item__enhance">+{item.enhance}</span>}
    </button>
  );

  return (
    <div className="stack">
      <div className="card">
        <h3>Equipado</h3>
        <div className="equip-row">
          {EQUIP_SLOTS.map((slot) => {
            const item = state.equipment[slot];
            return (
              <div key={slot} className="equip-slot">
                <small className="muted">{SLOT_LABEL[slot]}</small>
                {item ? renderSlot(item) : <div className="item item--empty" aria-label={`${SLOT_LABEL[slot]} vazio`} />}
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className={`card item-detail item-detail--${selected.rarity}`}>
          <div className="card__title">
            <h3>{itemName(selected, classId)}</h3>
            <span className={`rarity rarity--${selected.rarity}`}>{RARITY_LABEL[selected.rarity]}</span>
          </div>
          <ul className="plain-list">
            <StatLine label="Ataque" value={getItemStats(selected).attack} baseline={baseline ? baseline.attack : null} />
            <StatLine label="Defesa" value={getItemStats(selected).defense} baseline={baseline ? baseline.defense : null} />
            <StatLine label="HP" value={getItemStats(selected).hp} baseline={baseline ? baseline.hp : null} />
          </ul>
          <div className="button-row">
            {selectedIsEquipped ? (
              <button className="btn" disabled={inventoryFull} title={inventoryFull ? 'Inventário cheio' : undefined} onClick={() => store.act((s) => unequipItem(s, selected.slot))}>
                Desequipar
              </button>
            ) : (
              <>
                <button className="btn btn--primary" onClick={() => store.act((s) => equipItem(s, selected.uid))}>
                  Equipar
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    store.act((s) => sellItem(s, selected.uid));
                    setSelectedUid(null);
                  }}
                >
                  Vender ({formatNumber(getSellValue(selected))})
                </button>
              </>
            )}
          </div>
          <div className="forge">
            <strong>Forja</strong>
            {selected.enhance >= getMaxEnhance() ? (
              <p className="muted">Aprimoramento máximo atingido.</p>
            ) : (
              <>
                <p className="muted">
                  +{selected.enhance} → +{selected.enhance + 1} · Chance {formatPercent(getEnhanceChance(selected))} · Cada nível soma{' '}
                  {formatPercent(BALANCE.enhanceBonusPerLevel)} aos atributos. Falhar consome o ouro, mas não rebaixa o item.
                </p>
                <button
                  className="btn"
                  disabled={state.gold < getEnhanceCost(selected)}
                  onClick={() => {
                    const result = store.act((s) => enhanceItem(s, selected.uid));
                    if (result) setForgeResult({ uid: selected.uid, result });
                  }}
                >
                  Aprimorar ({formatNumber(getEnhanceCost(selected))} ouro)
                </button>
              </>
            )}
            {forgeResult && forgeResult.uid === selected.uid && forgeResult.result !== 'invalid' && (
              <p className={forgeResult.result === 'success' ? 'text-good' : 'text-bad'} role="status">
                {forgeResult.result === 'success' ? 'Aprimoramento bem-sucedido!' : 'O aprimoramento falhou.'}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card__title">
          <h3>Inventário</h3>
          <span className={inventoryFull ? 'text-bad' : 'muted'}>
            {state.inventory.length}/{BALANCE.inventorySize}
          </span>
        </div>
        {state.inventory.length === 0 ? (
          <p className="muted">Nenhum item. Monstros têm {formatPercent(BALANCE.dropChanceNormal)} de chance de drop; guardiões sempre deixam equipamento.</p>
        ) : (
          <div className="item-grid">{state.inventory.map((item) => renderSlot(item))}</div>
        )}
        {inventoryFull && <p className="text-bad">Inventário cheio: novos itens serão vendidos automaticamente.</p>}

        <div className="button-row">
          <label className="field field--inline">
            <span>Vender tudo até</span>
            <select value={bulkRarity} onChange={(event) => setBulkRarity(event.target.value as Rarity)}>
              {RARITIES.map((rarity) => (
                <option key={rarity} value={rarity}>{RARITY_LABEL[rarity]}</option>
              ))}
            </select>
          </label>
          <button className="btn" disabled={state.inventory.length === 0} onClick={() => store.act((s) => sellAllUpTo(s, bulkRarity))}>
            Vender
          </button>
        </div>
        <label className="field field--inline">
          <span>Venda automática ao dropar</span>
          <select
            value={state.settings.autoSellMaxRarity ?? ''}
            onChange={(event) =>
              store.act((s) => updateSettings(s, { autoSellMaxRarity: event.target.value === '' ? null : (event.target.value as Rarity) }))
            }
          >
            <option value="">Desligada</option>
            {RARITIES.slice(0, 4).map((rarity) => (
              <option key={rarity} value={rarity}>Até {RARITY_LABEL[rarity]}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
