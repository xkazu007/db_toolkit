import os
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import pyodbc
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


load_dotenv(os.getenv("ENV_FILE", ".env"))
pyodbc.pooling = False

bridge_enabled = os.getenv("ODBC_BRIDGE_ENABLED", "true").strip().lower() not in {"0", "false", "no", "non"}

DEFAULT_ALLOWED_COLUMNS = {
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
}


app = FastAPI(title="DB Toolkit ODBC Bridge")


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"ok": False, "error": f"Erreur bridge ODBC : {exc}", "type": exc.__class__.__name__},
    )


class UpdateItem(BaseModel):
    dbColumn: str = Field(min_length=1)
    value: str


class UpdateRequest(BaseModel):
    contractNumber: str = Field(min_length=1)
    updates: list[UpdateItem] = Field(min_length=1)


def quote_identifier(identifier: str) -> str:
    parts = identifier.split(".")
    if not all(re.match(r"^[A-Z_][A-Z0-9_]*$", part, re.I) for part in parts):
        raise HTTPException(status_code=400, detail=f"Identifiant SQL non autorise : {identifier}")
    return ".".join(part.upper() for part in parts)


def target_table() -> str:
    return quote_identifier(os.getenv("ODBC_TARGET_TABLE", "ASSALAFDTA.CRDEM"))


def key_column() -> str:
    return quote_identifier(os.getenv("ODBC_KEY_COLUMN", "NODOSS"))


def allowed_columns() -> set[str]:
    configured = os.getenv("ODBC_ALLOWED_COLUMNS")
    if not configured:
        return DEFAULT_ALLOWED_COLUMNS | {key_column()}
    return {quote_identifier(column.strip()) for column in configured.split(",") if column.strip()} | {key_column()}


def connection_string() -> str:
    value = os.getenv("ODBC_CONNECTION_STRING", "").strip()
    if not value:
        raise HTTPException(status_code=500, detail="ODBC_CONNECTION_STRING n'est pas configure.")
    return value


def require_enabled() -> None:
    if not bridge_enabled:
        raise HTTPException(status_code=503, detail="Bridge ODBC desactive par l'administrateur.")


def use_autocommit() -> bool:
    value = os.getenv("ODBC_AUTOCOMMIT", "true").strip().lower()
    return value not in {"0", "false", "no", "non"}


def connect() -> pyodbc.Connection:
    require_enabled()
    try:
        return pyodbc.connect(connection_string(), autocommit=use_autocommit())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Connexion ODBC echouee : {exc}") from exc


def json_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def rows_to_dicts(cursor: pyodbc.Cursor) -> list[dict[str, Any]]:
    columns = [column[0].upper() for column in cursor.description or []]
    return [dict(zip(columns, [json_value(value) for value in row])) for row in cursor.fetchall()]


def masked_connection_string() -> str:
    return re.sub(r"(PWD=)[^;]*", r"\1****", connection_string(), flags=re.I)


@app.get("/config")
def config() -> dict[str, Any]:
    return {
        "ok": True,
        "envFile": os.getenv("ENV_FILE", ".env"),
        "cwd": os.getcwd(),
        "connectionString": masked_connection_string(),
        "table": target_table(),
        "keyColumn": key_column(),
        "enabled": bridge_enabled,
        "pooling": pyodbc.pooling,
    }


@app.get("/control/status")
def control_status() -> dict[str, Any]:
    return {"ok": True, "enabled": bridge_enabled, "pooling": pyodbc.pooling}


@app.post("/control/enable")
def control_enable() -> dict[str, Any]:
    global bridge_enabled
    bridge_enabled = True
    return {"ok": True, "enabled": bridge_enabled, "pooling": pyodbc.pooling}


@app.post("/control/disable")
def control_disable() -> dict[str, Any]:
    global bridge_enabled
    bridge_enabled = False
    return {"ok": True, "enabled": bridge_enabled, "pooling": pyodbc.pooling}


@app.get("/health")
def health() -> dict[str, Any]:
    with connect() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT COUNT(*) AS TOTAL FROM {target_table()}")
        total = cursor.fetchone()[0]
    return {"ok": True, "table": target_table(), "keyColumn": key_column(), "total": total}


@app.get("/rows")
def read_rows(limit: int = Query(default=100, ge=1, le=200)) -> dict[str, Any]:
    sql = f"SELECT * FROM {target_table()} ORDER BY {key_column()} FETCH FIRST {limit} ROWS ONLY"
    with connect() as conn:
        cursor = conn.cursor()
        cursor.execute(sql)
        rows = rows_to_dicts(cursor)
    columns = list(rows[0].keys()) if rows else []
    return {"ok": True, "rows": rows, "columns": columns, "sql": sql}


@app.post("/update")
def update_row(request: UpdateRequest) -> dict[str, Any]:
    allowed = allowed_columns()
    key = key_column()
    table = target_table()
    assignments: list[str] = []
    values: list[str] = []
    seen: set[str] = set()

    for item in request.updates:
        column = quote_identifier(item.dbColumn)
        if column in seen:
            raise HTTPException(status_code=400, detail=f"Champ en double : {column}")
        if column not in allowed:
            raise HTTPException(status_code=400, detail=f"Colonne non autorisee : {column}")
        seen.add(column)
        assignments.append(f"{column} = ?")
        values.append(item.value)

    sql = f"UPDATE {table} SET {', '.join(assignments)} WHERE {key} = ?"
    exists_sql = f"SELECT COUNT(*) AS TOTAL FROM {table} WHERE {key} = ?"

    with connect() as conn:
        cursor = conn.cursor()
        cursor.execute(exists_sql, request.contractNumber)
        exists = int(cursor.fetchone()[0])
        if exists == 0:
            return {"ok": False, "rowsAffected": 0, "error": f"Aucune ligne trouvee pour {key}={request.contractNumber}", "sql": sql}

        cursor.execute(sql, [*values, request.contractNumber])
        if not conn.autocommit:
            conn.commit()
        rows_affected = cursor.rowcount if cursor.rowcount and cursor.rowcount > 0 else exists

    return {"ok": rows_affected > 0, "rowsAffected": rows_affected, "sql": sql}
