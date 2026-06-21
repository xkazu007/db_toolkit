import { getTargetInfo, readTargetRows } from "@/lib/target-db";

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) return value.toLocaleString("fr-FR");
  const text = String(value).trim();
  if (!text || /^[|]+$/.test(text)) return "-";
  return text.replaceAll("|", "").trim() || "-";
}

function displayColumn(column: string) {
  if (column === "NODOSS") return "Num contrat";
  return column;
}

function dbLabel(db: string) {
  if (db === "db2") return "DB2";
  if (db === "bridge") return "Bridge ODBC";
  return "Postgres";
}

export default async function AdminDatabasePage() {
  const info = getTargetInfo();
  const result = await readTargetRows(100);

  return (
    <>
      <div className="topbar">
        <div>
          <p className="eyebrow">Base cible</p>
          <h1>Table {info.table}</h1>
        </div>
      </div>

      <section className="panel grid two">
        <div>
          <p className="eyebrow">Connexion</p>
          <strong>{dbLabel(info.db)}</strong>
        </div>
        <div>
          <p className="eyebrow">Identifiant ligne</p>
          <strong>{displayColumn(info.keyColumn)} ({info.keyColumn})</strong>
        </div>
      </section>

      {!result.ok ? <p className="error">{result.error || "Lecture de la table impossible."}</p> : null}

      {result.ok ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {result.columns.map((column) => (
                  <th key={column}>{displayColumn(column)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={String(row.NODOSS || index)}>
                  {result.columns.map((column) => (
                    <td key={column}>{displayValue(row[column])}</td>
                  ))}
                </tr>
              ))}
              {result.rows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(result.columns.length, 1)}>Aucune ligne trouvee.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
