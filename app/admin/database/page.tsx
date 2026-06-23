import Link from "next/link";
import { getBridgeStatus } from "@/app/actions/bridge";
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

function visibleColumns(columns: string[]) {
  return columns.filter((column) => !/^PIPE\d*$/i.test(column));
}

function dbLabel(db: string) {
  if (db === "db2") return "DB2";
  if (db === "bridge") return "Bridge ODBC";
  return "Postgres";
}

export default async function AdminDatabasePage({
  searchParams
}: {
  searchParams: Promise<{ load?: string }>;
}) {
  const params = await searchParams;
  const info = getTargetInfo();
  const shouldLoad = params.load === "1";
  const bridgeStatus = info.db === "bridge" ? await getBridgeStatus() : null;
  const result = shouldLoad ? await readTargetRows(100) : null;
  const columns = visibleColumns(result?.columns || []);

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
        {bridgeStatus ? (
          <>
            <div>
              <p className="eyebrow">Bridge IBM</p>
              <strong>{bridgeStatus.ok ? (bridgeStatus.enabled ? "Active" : "Desactive") : "Injoignable"}</strong>
            </div>
            <div>
              <p className="eyebrow">ODBC pooling</p>
              <strong>{bridgeStatus.pooling ? "Actif" : "Desactive"}</strong>
            </div>
          </>
        ) : null}
      </section>

      <section className="panel actions">
        <Link className="button secondary" href="/admin/database?load=1">
          Charger CRDEM
        </Link>
      </section>

      {bridgeStatus && !bridgeStatus.ok ? <p className="error">{bridgeStatus.error}</p> : null}
      {!shouldLoad ? <p className="hint">Aucune requete IBM n'est lancee automatiquement. Cliquez sur Charger CRDEM pour lire la table.</p> : null}
      {result && !result.ok ? <p className="error">{result.error || "Lecture de la table impossible."}</p> : null}

      {result?.ok ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{displayColumn(column)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={String(row.NODOSS || index)}>
                  {columns.map((column) => (
                    <td key={column}>{displayValue(row[column])}</td>
                  ))}
                </tr>
              ))}
              {result.rows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(columns.length, 1)}>Aucune ligne trouvee.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
