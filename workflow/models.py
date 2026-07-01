from django.conf import settings
from django.db import models


class RequestStatus(models.TextChoices):
    PENDING = "pending", "En attente"
    APPROVED = "approved", "Approuvee"
    REJECTED = "rejected", "Rejetee"
    FAILED = "failed", "Echouee"
    CANCELLED = "cancelled", "Annulee"


class FieldMapping(models.Model):
    class DataType(models.TextChoices):
        TEXT = "text", "Texte"
        NUMBER = "number", "Nombre"
        DATE = "date", "Date"
        ENUM = "enum", "Liste"

    label = models.CharField(max_length=180)
    db_column = models.CharField(max_length=80)
    data_type = models.CharField(max_length=20, choices=DataType.choices, default=DataType.TEXT)
    is_required = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    validation_rule = models.CharField(max_length=250, blank=True)
    help_text = models.CharField(max_length=250, blank=True)
    admin_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["label"]
        indexes = [models.Index(fields=["db_column"])]

    def save(self, *args, **kwargs):
        self.db_column = self.db_column.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.label} -> {self.db_column}"


class ModificationRequest(models.Model):
    contract_number = models.CharField(max_length=80)
    status = models.CharField(max_length=20, choices=RequestStatus.choices, default=RequestStatus.PENDING)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="requested_modifications",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_modifications",
    )
    comment = models.TextField(blank=True)
    failure_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self) -> str:
        return f"#{self.id} {self.contract_number} {self.status}"


class ModificationRequestItem(models.Model):
    request = models.ForeignKey(ModificationRequest, on_delete=models.CASCADE, related_name="items")
    field_mapping = models.ForeignKey(FieldMapping, on_delete=models.SET_NULL, null=True, blank=True)
    label_snapshot = models.CharField(max_length=180)
    db_column_snapshot = models.CharField(max_length=80)
    new_value = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.label_snapshot}={self.new_value}"


class AuditLog(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=80)
    request = models.ForeignKey(ModificationRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    details = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["action", "created_at"])]

    def __str__(self) -> str:
        return self.action
