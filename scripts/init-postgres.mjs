import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  const lines = fs.readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    process.env[match[1]] = process.env[match[1]] || match[2].trim().replace(/^"|"$/g, "");
  }
}

loadEnv();

const connectionString = process.env.TARGET_DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("TARGET_DATABASE_URL n'est pas configure.");
  process.exit(1);
}

try {
  const sql = fs.readFileSync("postgres/init.sql", "utf8");
  const client = new Client({ connectionString });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("Table Postgres CRCON initialisee.");
} catch (error) {
  console.error("Initialisation Postgres echouee");
  console.error(error instanceof Error ? error.message || error.toString() : JSON.stringify(error));
  process.exit(1);
}
