from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
import os
import sqlite3
import tempfile
from pathlib import Path

from workflow.models import FieldMapping, ModificationRequest, RequestStatus, TargetTable
from workflow.services import RequestValidationError, approve_request, create_modification_request


class RequestCreationTests(TestCase):
    def setUp(self):
        self.agent = User.objects.create_user("agent", password="agent123")
        self.target_table = TargetTable.objects.create(name="CRDEM", db_table="ASSALAFDTA.CRDEM", key_column="NODOSS")
        self.mapping = FieldMapping.objects.create(
            target_table=self.target_table,
            label="Code envoi",
            db_column="CDENVO",
            data_type=FieldMapping.DataType.TEXT,
            is_active=True,
        )

    def test_agent_request_stores_mapping_snapshots_and_audit_log(self):
        request = create_modification_request(
            actor=self.agent,
            target_table_id=self.target_table.id,
            contract_number="1045810",
            rows=[{"mapping_id": self.mapping.id, "new_value": "2"}],
            comment="urgent",
        )

        self.assertEqual(request.status, RequestStatus.PENDING)
        self.assertEqual(request.items.get().label_snapshot, "Code envoi")
        self.assertEqual(request.items.get().db_column_snapshot, "CDENVO")
        self.assertEqual(request.audit_logs.get().action, "request_created")

    def test_duplicate_fields_are_rejected(self):
        with self.assertRaises(RequestValidationError):
            create_modification_request(
                actor=self.agent,
                target_table_id=self.target_table.id,
                contract_number="1045810",
                rows=[
                    {"mapping_id": self.mapping.id, "new_value": "2"},
                    {"mapping_id": self.mapping.id, "new_value": "3"},
                ],
            )

    def test_admin_approval_updates_local_target_without_bridge(self):
        admin = User.objects.create_user("admin", password="admin123", is_staff=True)
        request = create_modification_request(
            actor=self.agent,
            target_table_id=self.target_table.id,
            contract_number="1045810",
            rows=[{"mapping_id": self.mapping.id, "new_value": "5"}],
        )
        self.target_table.db_table = "CRCON"
        self.target_table.save()
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "target.sqlite3"
            with sqlite3.connect(db_path) as conn:
                conn.execute("CREATE TABLE CRCON (NODOSS TEXT PRIMARY KEY, CDENVO TEXT)")
                conn.execute("INSERT INTO CRCON (NODOSS, CDENVO) VALUES ('1045810', '1')")
                conn.commit()

            old_target_db = os.environ.get("TARGET_DB")
            old_target_path = os.environ.get("TARGET_SQLITE_PATH")
            old_target_table = os.environ.get("TARGET_TABLE")
            old_target_key = os.environ.get("TARGET_KEY_COLUMN")
            os.environ["TARGET_DB"] = "sqlite"
            os.environ["TARGET_SQLITE_PATH"] = str(db_path)
            os.environ["TARGET_TABLE"] = "CRCON"
            os.environ["TARGET_KEY_COLUMN"] = "NODOSS"
            try:
                approved, result = approve_request(actor=admin, request_id=request.id)
            finally:
                if old_target_db is None:
                    os.environ.pop("TARGET_DB", None)
                else:
                    os.environ["TARGET_DB"] = old_target_db
                if old_target_path is None:
                    os.environ.pop("TARGET_SQLITE_PATH", None)
                else:
                    os.environ["TARGET_SQLITE_PATH"] = old_target_path
                if old_target_table is None:
                    os.environ.pop("TARGET_TABLE", None)
                else:
                    os.environ["TARGET_TABLE"] = old_target_table
                if old_target_key is None:
                    os.environ.pop("TARGET_KEY_COLUMN", None)
                else:
                    os.environ["TARGET_KEY_COLUMN"] = old_target_key

            self.assertTrue(result.ok)
            self.assertEqual(approved.status, RequestStatus.APPROVED)
            with sqlite3.connect(db_path) as conn:
                value = conn.execute("SELECT CDENVO FROM CRCON WHERE NODOSS = '1045810'").fetchone()[0]
            self.assertEqual(value, "5")

    def test_request_uses_mappings_from_selected_target_table(self):
        crcon = TargetTable.objects.create(name="CRCON", db_table="CRCON", key_column="NODOSS")
        crcon_mapping = FieldMapping.objects.create(
            target_table=crcon,
            label="Montant credit",
            db_column="MTCRED",
            data_type=FieldMapping.DataType.NUMBER,
            is_active=True,
        )

        request = create_modification_request(
            actor=self.agent,
            target_table_id=crcon.id,
            contract_number="1045810",
            rows=[{"mapping_id": crcon_mapping.id, "new_value": "1000"}],
        )

        self.assertEqual(request.target_table, crcon)
        self.assertEqual(request.items.get().db_column_snapshot, "MTCRED")


class SecurityAndRoutingTests(TestCase):
    def test_agent_pages_require_login(self):
        response = self.client.get(reverse("agent_requests"))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("login"), response["Location"])

    def test_admin_pages_reject_agent_users(self):
        agent = User.objects.create_user("agent", password="agent123")
        self.client.force_login(agent)
        response = self.client.get(reverse("admin_requests"))
        self.assertEqual(response.status_code, 403)
