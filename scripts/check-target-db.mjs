import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  const lines = fs.readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    process.env[match[1]] = process.env[match[1]] || match[2].trim().replace(/^"|"$/g, "");
  }
}

function quoteIdentifier(identifier) {
  const parts = identifier.split(".");
  if (!parts.every((part) => /^[A-Z_][A-Z0-9_]*$/i.test(part))) {
    throw new Error(`Identifiant SQL non autorise : ${identifier}`);
  }
  return parts.map((part) => part.toUpperCase()).join(".");
}

loadEnv();

const targetDb = (process.env.TARGET_DB || "postgres").toLowerCase();
const table = quoteIdentifier(process.env.TARGET_TABLE || process.env.DB2_TARGET_TABLE || "CRCON");
const keyColumn = quoteIdentifier(process.env.TARGET_KEY_COLUMN || process.env.DB2_CONTRACT_COLUMN || "NODOSS");
const sampleKey = process.argv[2] || process.env.SAMPLE_NODOSS || "1045810";

if (targetDb === "postgres") {
  const { Client } = require("pg");
  const connectionString = process.env.TARGET_DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("TARGET_DATABASE_URL n'est pas configure.");
    process.exit(1);
  }

  try {
    const client = new Client({ connectionString });
    await client.connect();
    const count = await client.query(`SELECT COUNT(*) AS total FROM ${table}`);
    const row = await client.query(`SELECT * FROM ${table} WHERE ${keyColumn} = $1 LIMIT 1`, [sampleKey]);
    await client.end();
    console.log("Connexion Postgres OK");
    console.log(`Table cible : ${table}`);
    console.log(`Colonne identifiant : ${keyColumn}`);
    console.log("Nombre de lignes :", count.rows[0]?.total);
    console.log(`Ligne exemple ${keyColumn}=${sampleKey}:`);
    console.log(JSON.stringify(row.rows[0] || null, null, 2));
  } catch (error) {
    console.error("Connexion/requete Postgres echouee");
    console.error(error instanceof Error ? error.message || error.toString() : JSON.stringify(error));
    process.exit(1);
  }
} else if (targetDb === "bridge") {
  const bridgeUrl = (process.env.BRIDGE_URL || "http://127.0.0.1:8001").replace(/\/$/, "");
  try {
    const healthResponse = await fetch(`${bridgeUrl}/health`);
    const health = await healthResponse.json();
    if (!healthResponse.ok || health.ok !== true) {
      throw new Error(health.error || health.detail || `Bridge HTTP ${healthResponse.status}`);
    }

    const rowsResponse = await fetch(`${bridgeUrl}/rows?limit=1`);
    const rows = await rowsResponse.json();
    if (!rowsResponse.ok || rows.ok !== true) {
      throw new Error(rows.error || rows.detail || `Bridge HTTP ${rowsResponse.status}`);
    }

    console.log("Connexion bridge ODBC OK");
    console.log(`URL bridge : ${bridgeUrl}`);
    console.log(`Table cible : ${health.table || table}`);
    console.log(`Colonne identifiant : ${health.keyColumn || keyColumn}`);
    console.log("Nombre de lignes :", health.total);
    console.log("Premiere ligne :");
    console.log(JSON.stringify(rows.rows?.[0] || null, null, 2));
  } catch (error) {
    console.error("Connexion/requete bridge ODBC echouee");
    console.error(error instanceof Error ? error.message || error.toString() : JSON.stringify(error));
    process.exit(1);
  }
} else {
  const ibmdb = require("ibm_db");
  const connectionString = process.env.DB2_CONNECTION_STRING;
  if (!connectionString) {
    console.error("DB2_CONNECTION_STRING n'est pas configure.");
    process.exit(1);
  }

  const query = (conn, sql, params = []) =>
    new Promise((resolve, reject) => {
      conn.query(sql, params, (error, rows) => (error ? reject(error) : resolve(rows)));
    });

  try {
    const conn = await new Promise((resolve, reject) => {
      ibmdb.open(connectionString, (error, connection) => (error ? reject(error) : resolve(connection)));
    });
    const count = await query(conn, `SELECT COUNT(*) AS TOTAL FROM ${table}`);
    const row = await query(conn, `SELECT * FROM ${table} WHERE ${keyColumn} = ? FETCH FIRST 1 ROW ONLY`, [sampleKey]);
    await new Promise((resolve) => conn.close(() => resolve()));
    console.log("Connexion DB2 OK");
    console.log(`Table cible : ${table}`);
    console.log(`Colonne identifiant : ${keyColumn}`);
    console.log("Nombre de lignes :", count[0]?.TOTAL ?? count[0]?.total);
    console.log(`Ligne exemple ${keyColumn}=${sampleKey}:`);
    console.log(JSON.stringify(row[0] || null, null, 2));
  } catch (error) {
    console.error("Connexion/requete DB2 echouee");
    console.error(error instanceof Error ? error.message || error.toString() : JSON.stringify(error));
    process.exit(1);
  }
}
