"use client";

import { useState } from "react";

type Mapping = {
  id: number;
  label: string;
  helpText: string | null;
};

export function ModificationRows({ mappings }: { mappings: Mapping[] }) {
  const [rows, setRows] = useState([0]);
  const [emptyRows, setEmptyRows] = useState<Record<number, boolean>>({});

  return (
    <section className="panel grid">
      <div className="section-head">
        <h2>Modifications</h2>
        <button
          className="icon-button"
          type="button"
          aria-label="Ajouter une modification"
          title="Ajouter une modification"
          onClick={() => setRows((current) => [...current, Date.now()])}
        >
          +
        </button>
      </div>

      {rows.map((rowId, index) => (
        <div className="mod-row" key={rowId}>
          <label>
            Champ {index + 1}
            <select name="mappingId" required={index === 0} defaultValue="">
              <option value="">Choisir un champ</option>
              {mappings.map((mapping) => (
                <option key={mapping.id} value={mapping.id}>
                  {mapping.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nouvelle valeur
            <input name="newValue" disabled={emptyRows[rowId] === true} required={emptyRows[rowId] !== true} />
          </label>
          <label className="check-label">
            <input
              name="emptyField"
              type="checkbox"
              value={String(index)}
              checked={emptyRows[rowId] === true}
              onChange={(event) =>
                setEmptyRows((current) => ({
                  ...current,
                  [rowId]: event.target.checked
                }))
              }
            />
            Vider ce champ
          </label>
          {index > 0 ? (
            <button
              className="icon-button secondary"
              type="button"
              aria-label={`Retirer le champ ${index + 1}`}
              title="Retirer le champ"
              onClick={() => {
                setRows((current) => current.filter((id) => id !== rowId));
                setEmptyRows((current) => {
                  const next = { ...current };
                  delete next[rowId];
                  return next;
                });
              }}
            >
              -
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
      ))}

      <p className="hint">Une modification est obligatoire. Cochez Vider ce champ pour envoyer une valeur vide. Les doublons sont refuses.</p>
    </section>
  );
}
