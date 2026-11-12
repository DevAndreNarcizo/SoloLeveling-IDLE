import { useState } from 'react';
import { CLASSES, CLASS_IDS } from '../game/data/classes';
import { MAX_NAME_LENGTH } from '../game/engine/state';
import type { ClassId } from '../game/types';
import { Sprite } from './Sprite';
import { ATTRIBUTE_INFO } from './format';
import { useGameStore } from './useGame';

/**
 * Tela de criação do caçador: nome e classe. É também o ponto de recuperação
 * quando um save é rejeitado ou apagado.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function ClassSelect() {
  const store = useGameStore();
  const [name, setName] = useState('');
  const [classId, setClassId] = useState<ClassId>('guardian');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState(false);
  const selected = CLASSES[classId];

  return (
    <div className="create">
      <div className="create__hero">
        <Sprite assetId="ui_logo" className="create__logo" />
        <h1>Caçador de Fendas</h1>
        <p>Idle RPG 2D — entre nas fendas, derrote os guardiões e comande um esquadrão de ecos.</p>
      </div>

      {store.corruptedSave && (
        <div className="banner banner--bad" role="alert">
          Seu save anterior estava ilegível e não pôde ser carregado. Uma cópia foi preservada no navegador para recuperação manual.
        </div>
      )}

      <form
        className="create__form"
        onSubmit={(event) => {
          event.preventDefault();
          store.newGame(name, classId);
        }}
      >
        <label className="field">
          <span>Nome do caçador</span>
          <input
            value={name}
            maxLength={MAX_NAME_LENGTH}
            placeholder="Caçador"
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
        </label>

        <div className="class-grid" role="radiogroup" aria-label="Classe">
          {CLASS_IDS.map((id) => (
            <button
              type="button"
              key={id}
              role="radio"
              aria-checked={classId === id}
              className={`class-card ${classId === id ? 'class-card--active' : ''}`}
              onClick={() => setClassId(id)}
            >
              <Sprite assetId={CLASSES[id].assetId} className="class-card__sprite" />
              <strong>{CLASSES[id].name}</strong>
            </button>
          ))}
        </div>

        <div className="class-detail">
          <h2>{selected.name}</h2>
          <p>{selected.description}</p>
          <p className="muted">{selected.passiveDescription}</p>
          <p className="muted">
            Atributo principal: {ATTRIBUTE_INFO[selected.primary].label} · Arma: {selected.weaponName} · Ataque a cada{' '}
            {(selected.attackIntervalMs / 1000).toFixed(1)}s
          </p>
        </div>

        <button type="submit" className="btn btn--primary btn--large">
          Entrar na fenda
        </button>
      </form>

      <details className="create__import">
        <summary>Já tenho um save exportado</summary>
        <textarea
          value={importText}
          rows={3}
          placeholder="Cole aqui o código do save"
          onChange={(event) => {
            setImportText(event.target.value);
            setImportError(false);
          }}
        />
        {importError && <p className="text-bad">Código inválido.</p>}
        <button className="btn" disabled={importText.trim() === ''} onClick={() => setImportError(!store.importSave(importText))}>
          Importar
        </button>
      </details>

      <footer className="disclaimer">
        Projeto original e independente. Todos os nomes, personagens e artes são próprios.
      </footer>
    </div>
  );
}
