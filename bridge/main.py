import os
import re
from typing import Any

import pyodbc
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field


load_dotenv(os.getenv("ENV_FILE", ".env"))

DEFAULT_ALLOWED_COLUMNS = {
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
        return DEFAULT_ALLOWED_COLUMNS
    return {quote_identifier(column.strip()) for column in configured.split(",") if column.strip()}


def connection_string() -> str:
    value = os.getenv("ODBC_CONNECTION_STRING", "").strip()
    if not value:
        raise HTTPException(status_code=500, detail="ODBC_CONNECTION_STRING n'est pas configure.")
    return value


def connect() -> pyodbc.Connection:
    try:
        return pyodbc.connect(connection_string(), autocommit=False)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Connexion ODBC echouee : {exc}") from exc


def rows_to_dicts(cursor: pyodbc.Cursor) -> list[dict[str, Any]]:
    columns = [column[0].upper() for column in cursor.description or []]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


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
        if column == key:
            raise HTTPException(status_code=400, detail=f"La colonne {key} ne peut pas etre modifiee.")
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
            conn.rollback()
            return {"ok": False, "rowsAffected": 0, "error": f"Aucune ligne trouvee pour {key}={request.contractNumber}", "sql": sql}

        cursor.execute(sql, [*values, request.contractNumber])
        conn.commit()
        rows_affected = cursor.rowcount if cursor.rowcount and cursor.rowcount > 0 else exists

    return {"ok": rows_affected > 0, "rowsAffected": rows_affected, "sql": sql}
