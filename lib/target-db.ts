type TargetDbResult = {
  ok: boolean;
  rowsAffected?: number;
  error?: string;
  sql?: string;
};

type TargetRowsResult = {
  ok: boolean;
  rows: Record<string, unknown>[];
  columns: string[];
  error?: string;
};

type IbmDbModule = {
  open: (connectionString: string, callback: (error: Error | null, conn: any) => void) => void;
};

function targetDb() {
  return (process.env.TARGET_DB || "postgres").toLowerCase();
}

function quoteIdentifier(identifier: string) {
  const parts = identifier.split(".");
  if (!parts.every((part) => /^[A-Z_][A-Z0-9_]*$/i.test(part))) {
    throw new Error(`Identifiant SQL non autorise : ${identifier}`);
  }
  return parts.map((part) => part.toUpperCase()).join(".");
}

function targetTable() {
  return quoteIdentifier(process.env.TARGET_TABLE || process.env.DB2_TARGET_TABLE || "CRCON");
}

function targetKeyColumn() {
  return quoteIdentifier(process.env.TARGET_KEY_COLUMN || process.env.DB2_CONTRACT_COLUMN || "NODOSS");
}

export function getTargetInfo() {
  return {
    db: targetDb(),
    table: targetTable(),
    keyColumn: targetKeyColumn()
  };
}

export function buildTargetUpdatePreview(input: { updates: { dbColumn: string }[] }) {
  const db = targetDb();
  if (db === "bridge") return buildBridgeSql(input);
  if (db === "db2") return buildDb2Sql(input);
  return buildPostgresSql(input);
}

export function buildFilledTargetUpdatePreview(input: {
  contractNumber: string;
  updates: { dbColumn: string; value: string }[];
}) {
  const db = targetDb();
  if (db === "bridge") return buildFilledBridgeSql(input);
  if (db === "db2") return buildFilledDb2Sql(input);
  return buildFilledPostgresSql(input);
}

export async function updateTargetContract(input: {
  contractNumber: string;
  updates: { dbColumn: string; value: string }[];
}): Promise<TargetDbResult> {
  const db = targetDb();
  if (db === "db2") return updateDb2(input);
  if (db === "bridge") return updateBridge(input);
  return updatePostgres(input);
}

export async function readTargetRows(limit = 50): Promise<TargetRowsResult> {
  const db = targetDb();
  if (db === "db2") return readDb2Rows(limit);
  if (db === "bridge") return readBridgeRows(limit);
  return readPostgresRows(limit);
}

function buildDb2Sql(input: { updates: { dbColumn: string }[] }) {
  const assignments = input.updates.map((item) => `${quoteIdentifier(item.dbColumn)} = ?`).join(", ");
  return `UPDATE ${targetTable()}
SET ${assignments}, UPDATED_AT = CURRENT TIMESTAMP
WHERE ${targetKeyColumn()} = ?`;
}

function buildFilledDb2Sql(input: { contractNumber: string; updates: { dbColumn: string; value: string }[] }) {
  const assignments = input.updates
    .map((item) => `${quoteIdentifier(item.dbColumn)} = ${sqlLiteral(item.value)}`)
    .join(", ");
  return `UPDATE ${targetTable()}
SET ${assignments}, UPDATED_AT = CURRENT TIMESTAMP
WHERE ${targetKeyColumn()} = ${sqlLiteral(input.contractNumber)}`;
}

function buildBridgeSql(input: { updates: { dbColumn: string }[] }) {
  const assignments = input.updates.map((item) => `${quoteIdentifier(item.dbColumn)} = ?`).join(", ");
  return `UPDATE ${targetTable()}
SET ${assignments}
WHERE ${targetKeyColumn()} = ?`;
}

function buildFilledBridgeSql(input: { contractNumber: string; updates: { dbColumn: string; value: string }[] }) {
  const assignments = input.updates
    .map((item) => `${quoteIdentifier(item.dbColumn)} = ${sqlLiteral(item.value)}`)
    .join(", ");
  return `UPDATE ${targetTable()}
SET ${assignments}
WHERE ${targetKeyColumn()} = ${sqlLiteral(input.contractNumber)}`;
}

function buildPostgresSql(input: { updates: { dbColumn: string }[] }) {
  const assignments = input.updates
    .map((item, index) => `${quoteIdentifier(item.dbColumn)} = $${index + 1}`)
    .join(", ");
  return `UPDATE ${targetTable()}
SET ${assignments}, UPDATED_AT = CURRENT_TIMESTAMP
WHERE ${targetKeyColumn()} = $${input.updates.length + 1}`;
}

function buildFilledPostgresSql(input: { contractNumber: string; updates: { dbColumn: string; value: string }[] }) {
  const assignments = input.updates
    .map((item) => `${quoteIdentifier(item.dbColumn)} = ${sqlLiteral(item.value)}`)
    .join(", ");
  return `UPDATE ${targetTable()}
SET ${assignments}, UPDATED_AT = CURRENT_TIMESTAMP
WHERE ${targetKeyColumn()} = ${sqlLiteral(input.contractNumber)}`;
}

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function updatePostgres(input: {
  contractNumber: string;
  updates: { dbColumn: string; value: string }[];
}): Promise<TargetDbResult> {
  const connectionString = process.env.TARGET_DATABASE_URL || process.env.POSTGRES_URL;
  const sql = buildPostgresSql({ updates: input.updates });
  const params = [...input.updates.map((item) => item.value), input.contractNumber];

  if (!connectionString) {
    return { ok: false, error: "TARGET_DATABASE_URL n'est pas configure.", sql };
  }

  try {
    const { Client } = await import("pg");
    const client = new Client({ connectionString });
    await client.connect();
    const result = await client.query(sql, params);
    await client.end();
    const rowsAffected = result.rowCount ?? 0;
    return {
      ok: rowsAffected > 0,
      rowsAffected,
      error: rowsAffected === 0 ? "Postgres a mis a jour 0 ligne." : undefined,
      sql
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur Postgres inconnue.", sql };
  }
}

async function readPostgresRows(limit: number): Promise<TargetRowsResult> {
  const connectionString = process.env.TARGET_DATABASE_URL || process.env.POSTGRES_URL;
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const sql = `SELECT * FROM ${targetTable()} ORDER BY ${targetKeyColumn()} LIMIT ${safeLimit}`;

  if (!connectionString) {
    return { ok: false, rows: [], columns: [], error: "TARGET_DATABASE_URL n'est pas configure." };
  }

  try {
    const { Client } = await import("pg");
    const client = new Client({ connectionString });
    await client.connect();
    const result = await client.query(sql);
    await client.end();
    const rows = result.rows.map((row) => normalizeRow(row));
    return { ok: true, rows, columns: collectColumns(rows) };
  } catch (error) {
    return {
      ok: false,
      rows: [],
      columns: [],
      error: error instanceof Error ? error.message : "Lecture Postgres impossible."
    };
  }
}

async function updateDb2(input: {
  contractNumber: string;
  updates: { dbColumn: string; value: string }[];
}): Promise<TargetDbResult> {
  const connectionString = process.env.DB2_CONNECTION_STRING;
  const sql = buildDb2Sql({ updates: input.updates });
  const params = [...input.updates.map((item) => item.value), input.contractNumber];

  if (!connectionString) {
    return { ok: false, error: "DB2_CONNECTION_STRING n'est pas configure.", sql };
  }

  try {
    const ibmdbModule = await import("ibm_db");
    const ibmdb = (ibmdbModule.default ?? ibmdbModule) as unknown as IbmDbModule;
    const connection = await new Promise<any>((resolve, reject) => {
      ibmdb.open(connectionString, (error: Error | null, conn: any) => {
        if (error) reject(error);
        else resolve(conn);
      });
    });

    try {
      const rowsAffected = await new Promise<number>((resolve, reject) => {
        connection.query(sql, params, (error: Error | null, _rows: unknown, info: { rowsAffected?: number }) => {
          if (error) reject(error);
          else resolve(info?.rowsAffected ?? 0);
        });
      });

      await new Promise<void>((resolve) => connection.close(() => resolve()));
      return {
        ok: rowsAffected > 0,
        rowsAffected,
        error: rowsAffected === 0 ? "DB2 a mis a jour 0 ligne." : undefined,
        sql
      };
    } catch (error) {
      await new Promise<void>((resolve) => connection.close(() => resolve()));
      throw error;
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur DB2 inconnue.", sql };
  }
}

async function readDb2Rows(limit: number): Promise<TargetRowsResult> {
  const connectionString = process.env.DB2_CONNECTION_STRING;
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const sql = `SELECT * FROM ${targetTable()} ORDER BY ${targetKeyColumn()} FETCH FIRST ${safeLimit} ROWS ONLY`;

  if (!connectionString) {
    return { ok: false, rows: [], columns: [], error: "DB2_CONNECTION_STRING n'est pas configure." };
  }

  try {
    const ibmdbModule = await import("ibm_db");
    const ibmdb = (ibmdbModule.default ?? ibmdbModule) as unknown as IbmDbModule;
    const connection = await new Promise<any>((resolve, reject) => {
      ibmdb.open(connectionString, (error: Error | null, conn: any) => {
        if (error) reject(error);
        else resolve(conn);
      });
    });

    try {
      const dbRows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
        connection.query(sql, (error: Error | null, rows: Record<string, unknown>[]) => {
          if (error) reject(error);
          else resolve(rows);
        });
      });

      await new Promise<void>((resolve) => connection.close(() => resolve()));
      const rows = dbRows.map((row) => normalizeRow(row));
      return { ok: true, rows, columns: collectColumns(rows) };
    } catch (error) {
      await new Promise<void>((resolve) => connection.close(() => resolve()));
      throw error;
    }
  } catch (error) {
    return {
      ok: false,
      rows: [],
      columns: [],
      error: error instanceof Error ? error.message : "Lecture DB2 impossible."
    };
  }
}

function bridgeUrl() {
  return (process.env.BRIDGE_URL || "http://127.0.0.1:8001").replace(/\/$/, "");
}

async function updateBridge(input: {
  contractNumber: string;
  updates: { dbColumn: string; value: string }[];
}): Promise<TargetDbResult> {
  const sql = buildBridgeSql({ updates: input.updates });

  try {
    const response = await fetch(`${bridgeUrl()}/update`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store"
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      rowsAffected?: number;
      error?: string;
      detail?: string;
      sql?: string;
    };
    const error = payload.error || payload.detail;

    return {
      ok: response.ok && payload.ok === true,
      rowsAffected: payload.rowsAffected,
      error: response.ok ? error : error || `Bridge ODBC HTTP ${response.status}`,
      sql: payload.sql || sql
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Bridge ODBC injoignable.", sql };
  }
}

async function readBridgeRows(limit: number): Promise<TargetRowsResult> {
  const safeLimit = Math.max(1, Math.min(limit, 200));

  try {
    const response = await fetch(`${bridgeUrl()}/rows?limit=${safeLimit}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      rows?: Record<string, unknown>[];
      columns?: string[];
      error?: string;
      detail?: string;
    };

    if (!response.ok || payload.ok !== true) {
      return {
        ok: false,
        rows: [],
        columns: [],
        error: payload.error || payload.detail || `Bridge ODBC HTTP ${response.status}`
      };
    }

    const rows = (payload.rows || []).map((row) => normalizeRow(row));
    return { ok: true, rows, columns: payload.columns || collectColumns(rows) };
  } catch (error) {
    return {
      ok: false,
      rows: [],
      columns: [],
      error: error instanceof Error ? error.message : "Bridge ODBC injoignable."
    };
  }
}

function normalizeRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toUpperCase(), value]));
}

function collectColumns(rows: Record<string, unknown>[]) {
  const preferred = [
    "NODOSS",
    "CDENVO",
    "NOCPA1",
    "NOCPA2",
    "NOCPA3",
    "NOCPA4",
    "NOCPA5",
    "CDAGEN",
    "NMTITU",
    "CINALP",
    "CINNUM",
    "CDMATR",
    "IMPUTA",
    "MTCRED",
    "MNTTOT",
    "TXTEG",
    "MTMENS",
    "NBMOIS",
    "DTECHD",
    "DTECHF",
    "UPDATED_AT"
  ];
  const found = new Set(rows.flatMap((row) => Object.keys(row)));
  return preferred.filter((column) => found.has(column)).concat([...found].filter((column) => !preferred.includes(column)));
}
