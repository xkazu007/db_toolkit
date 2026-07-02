from dataclasses import dataclass
import os
import re
import sqlite3
from pathlib import Path


IDENTIFIER_RE = re.compile(r"^[A-Z_][A-Z0-9_]*$", re.I)


@dataclass(frozen=True)
class TargetResult:
    ok: bool
    rows_affected: int = 0
    error: str = ""
    sql: str = ""


def quote_identifier(identifier: str) -> str:
    parts = identifier.split(".")
    if not all(IDENTIFIER_RE.match(part or "") for part in parts):
        raise ValueError(f"Identifiant SQL non autorise : {identifier}")
    return ".".join(part.upper() for part in parts)


def target_db() -> str:
    configured = os.environ.get("DJANGO_TARGET_DB", os.environ.get("TARGET_DB", "sqlite")).lower()
    return "sqlite" if configured == "bridge" else configured


def target_table() -> str:
    if target_db() == "sqlite":
        return quote_identifier(os.environ.get("TARGET_SQLITE_TABLE", "CRCON"))
    return quote_identifier(os.environ.get("TARGET_TABLE", os.environ.get("DB2_TARGET_TABLE", "CRCON")))


def target_key_column() -> str:
    if target_db() == "sqlite":
        return quote_identifier(os.environ.get("TARGET_SQLITE_KEY_COLUMN", "NODOSS"))
    return quote_identifier(os.environ.get("TARGET_KEY_COLUMN", os.environ.get("DB2_CONTRACT_COLUMN", "NODOSS")))


def build_update_sql(updates: list[dict[str, str]], placeholder: str = "?", table: str | None = None, key_column: str | None = None) -> str:
    assignments = ", ".join(f"{quote_identifier(item['db_column'])} = {placeholder}" for item in updates)
    return f"UPDATE {quote_identifier(table) if table else target_table()} SET {assignments} WHERE {quote_identifier(key_column) if key_column else target_key_column()} = {placeholder}"


def build_filled_update_preview(contract_number: str, updates: list[dict[str, str]], table: str | None = None, key_column: str | None = None) -> str:
    assignments = ", ".join(f"{quote_identifier(item['db_column'])} = {sql_literal(item['value'])}" for item in updates)
    return f"UPDATE {quote_identifier(table) if table else target_table()} SET {assignments} WHERE {quote_identifier(key_column) if key_column else target_key_column()} = {sql_literal(contract_number)}"


def update_target_contract(contract_number: str, updates: list[dict[str, str]], table: str | None = None, key_column: str | None = None) -> TargetResult:
    db = target_db()
    if db == "postgres":
        return update_postgres(contract_number, updates, table, key_column)
    if db in {"odbc", "db2", "ibmi"}:
        return update_odbc(contract_number, updates, table, key_column)
    return update_sqlite(contract_number, updates, table, key_column)


def update_sqlite(contract_number: str, updates: list[dict[str, str]], table: str | None = None, key_column: str | None = None) -> TargetResult:
    db_path = Path(os.environ.get("TARGET_SQLITE_PATH", "target.sqlite3"))
    sql = build_update_sql(updates, table=table, key_column=key_column)
    params = [item["value"] for item in updates] + [contract_number]
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.execute(sql, params)
            conn.commit()
        rows = cursor.rowcount or 0
        return TargetResult(ok=rows > 0, rows_affected=rows, error="" if rows > 0 else "SQLite a mis a jour 0 ligne.", sql=sql)
    except Exception as exc:
        return TargetResult(ok=False, error=str(exc), sql=sql)


def update_postgres(contract_number: str, updates: list[dict[str, str]], table: str | None = None, key_column: str | None = None) -> TargetResult:
    import psycopg

    sql = build_update_sql(updates, "%s", table=table, key_column=key_column)
    params = [item["value"] for item in updates] + [contract_number]
    dsn = os.environ.get("TARGET_DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not dsn:
        return TargetResult(ok=False, error="TARGET_DATABASE_URL n'est pas configure.", sql=sql)
    try:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql, params)
                rows = cursor.rowcount or 0
        return TargetResult(ok=rows > 0, rows_affected=rows, error="" if rows > 0 else "Postgres a mis a jour 0 ligne.", sql=sql)
    except Exception as exc:
        return TargetResult(ok=False, error=str(exc), sql=sql)


def update_odbc(contract_number: str, updates: list[dict[str, str]], table: str | None = None, key_column: str | None = None) -> TargetResult:
    import pyodbc

    sql = build_update_sql(updates, table=table, key_column=key_column)
    params = [item["value"] for item in updates] + [contract_number]
    connection_string = os.environ.get("ODBC_CONNECTION_STRING") or os.environ.get("DB2_CONNECTION_STRING")
    autocommit = os.environ.get("ODBC_AUTOCOMMIT", "true").lower() in {"1", "true", "yes", "on"}
    if not connection_string:
        return TargetResult(ok=False, error="ODBC_CONNECTION_STRING n'est pas configure.", sql=sql)
    try:
        with pyodbc.connect(connection_string, autocommit=autocommit) as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.rowcount if cursor.rowcount != -1 else 0
            if not autocommit:
                conn.commit()
        return TargetResult(ok=rows > 0, rows_affected=rows, error="" if rows > 0 else "ODBC a mis a jour 0 ligne.", sql=sql)
    except Exception as exc:
        return TargetResult(ok=False, error=str(exc), sql=sql)


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"
