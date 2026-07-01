from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from workflow.models import AuditLog, FieldMapping, ModificationRequest, ModificationRequestItem, RequestStatus
from workflow.target_db import TargetResult, update_target_contract


class RequestValidationError(ValueError):
    pass


def create_audit_log(*, actor: User | None, action: str, request: ModificationRequest | None = None, details: dict | None = None) -> None:
    AuditLog.objects.create(actor=actor, action=action, request=request, details=details)


@transaction.atomic
def create_modification_request(
    *,
    actor: User,
    contract_number: str,
    rows: list[dict],
    comment: str | None = None,
) -> ModificationRequest:
    contract_number = contract_number.strip()
    cleaned_rows = [
        {"mapping_id": int(row["mapping_id"]), "new_value": str(row.get("new_value", "")).strip(), "empty": bool(row.get("empty"))}
        for row in rows
        if row.get("mapping_id")
    ]
    mapping_ids = [row["mapping_id"] for row in cleaned_rows]

    if not contract_number:
        raise RequestValidationError("Le num contrat est obligatoire.")
    if not cleaned_rows:
        raise RequestValidationError("Ajoutez au moins une modification.")
    if len(set(mapping_ids)) != len(mapping_ids):
        raise RequestValidationError("Les champs en double ne sont pas autorises.")
    if any(not row["empty"] and row["new_value"] == "" for row in cleaned_rows):
        raise RequestValidationError("Chaque modification doit avoir une valeur.")

    mappings = FieldMapping.objects.filter(id__in=mapping_ids).filter(is_active=True)
    mappings_by_id = {mapping.id: mapping for mapping in mappings}
    if len(mappings_by_id) != len(cleaned_rows):
        raise RequestValidationError("Un champ selectionne n'est pas actif.")

    request = ModificationRequest.objects.create(
        contract_number=contract_number,
        requested_by=actor,
        comment=(comment or "").strip(),
    )
    for row in cleaned_rows:
        mapping = mappings_by_id[row["mapping_id"]]
        ModificationRequestItem.objects.create(
            request=request,
            field_mapping=mapping,
            label_snapshot=mapping.label,
            db_column_snapshot=mapping.db_column,
            new_value="" if row["empty"] else row["new_value"],
        )

    create_audit_log(
        actor=actor,
        action="request_created",
        request=request,
        details={"contract_number": request.contract_number, "item_count": len(cleaned_rows)},
    )
    return request


@transaction.atomic
def reject_request(*, actor: User, request_id: int) -> ModificationRequest:
    request = ModificationRequest.objects.select_for_update().get(id=request_id)
    if request.status != RequestStatus.PENDING:
        raise RequestValidationError("Seules les demandes en attente peuvent etre rejetees.")
    request.status = RequestStatus.REJECTED
    request.rejected_at = timezone.now()
    request.approved_by = actor
    request.save(update_fields=["status", "rejected_at", "approved_by"])
    create_audit_log(actor=actor, action="request_rejected", request=request, details={"contract_number": request.contract_number})
    return request


@transaction.atomic
def approve_request(*, actor: User, request_id: int) -> tuple[ModificationRequest, TargetResult]:
    request = ModificationRequest.objects.select_for_update().prefetch_related("items").get(id=request_id)
    if request.status not in {RequestStatus.PENDING, RequestStatus.FAILED}:
        raise RequestValidationError("Cette demande ne peut pas etre approuvee.")

    items = list(request.items.all())
    allowed_columns = set(
        FieldMapping.objects.filter(db_column__in=[item.db_column_snapshot for item in items], is_active=True).values_list("db_column", flat=True)
    )
    updates = [{"db_column": item.db_column_snapshot, "value": item.new_value} for item in items]

    if any(update["db_column"] not in allowed_columns for update in updates):
        return mark_failed(actor=actor, request=request, reason="La demande contient une colonne qui n'est plus autorisee.")

    result = update_target_contract(request.contract_number, updates)
    if not result.ok:
        return mark_failed(actor=actor, request=request, reason=result.error or "La mise a jour a echoue.", result=result)

    request.status = RequestStatus.APPROVED
    request.approved_at = timezone.now()
    request.approved_by = actor
    request.failure_reason = ""
    request.save(update_fields=["status", "approved_at", "approved_by", "failure_reason"])
    create_audit_log(
        actor=actor,
        action="request_approved",
        request=request,
        details={"rows_affected": result.rows_affected, "sql": result.sql},
    )
    return request, result


def mark_failed(
    *,
    actor: User,
    request: ModificationRequest,
    reason: str,
    result: TargetResult | None = None,
) -> tuple[ModificationRequest, TargetResult]:
    request.status = RequestStatus.FAILED
    request.approved_by = actor
    request.failure_reason = reason
    request.save(update_fields=["status", "approved_by", "failure_reason"])
    create_audit_log(actor=actor, action="request_failed", request=request, details={"reason": reason})
    return request, result or TargetResult(ok=False, error=reason)


def approve_many(*, actor: User, request_ids: list[int]) -> dict[str, int]:
    summary = {"approved": 0, "failed": 0}
    for request_id in request_ids:
        request, _result = approve_request(actor=actor, request_id=request_id)
        if request.status == RequestStatus.APPROVED:
            summary["approved"] += 1
        else:
            summary["failed"] += 1
    return summary
