import os
import sqlite3
from pathlib import Path

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create a local SQLite target table for approval testing."

    def handle(self, *args, **options):
        db_path = Path(os.environ.get("TARGET_SQLITE_PATH", "target.sqlite3"))
        table = os.environ.get("TARGET_SQLITE_TABLE", "CRCON")
        with sqlite3.connect(db_path) as conn:
            conn.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {table} (
                  NODOSS TEXT PRIMARY KEY,
                  CDENVO TEXT,
                  NOCPA1 TEXT,
                  NOCPA2 TEXT,
                  NOCPA3 TEXT,
                  NOCPA4 TEXT,
                  NOCPA5 TEXT,
                  CDAGEN TEXT,
                  NMTITU TEXT,
                  CINALP TEXT,
                  CINNUM TEXT,
                  CDMATR TEXT,
                  IMPUTA TEXT,
                  MTCRED TEXT,
                  MNTTOT TEXT,
                  TXTEG TEXT,
                  MTMENS TEXT,
                  NBMOIS TEXT,
                  DTECHD TEXT,
                  DTECHF TEXT
                )
                """
            )
            conn.execute(
                f"""
                INSERT OR IGNORE INTO {table} (NODOSS, CDENVO, NOCPA1)
                VALUES ('1045810', '1', '')
                """
            )
            conn.commit()
        self.stdout.write(self.style.SUCCESS(f"Target SQLite DB ready at {db_path} with sample NODOSS=1045810."))
