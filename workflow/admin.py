from django.contrib import admin

from workflow.models import AuditLog, FieldMapping, ModificationRequest, ModificationRequestItem, TargetTable


class ModificationRequestItemInline(admin.TabularInline):
    model = ModificationRequestItem
    extra = 0
    readonly_fields = ["label_snapshot", "db_column_snapshot", "new_value", "created_at"]


@admin.register(ModificationRequest)
class ModificationRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "contract_number", "status", "requested_by", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["contract_number", "requested_by__username"]
    inlines = [ModificationRequestItemInline]


@admin.register(FieldMapping)
class FieldMappingAdmin(admin.ModelAdmin):
    list_display = ["label", "target_table", "db_column", "data_type", "is_active", "updated_at"]
    list_filter = ["target_table", "is_active", "data_type"]
    search_fields = ["label", "db_column"]


@admin.register(TargetTable)
class TargetTableAdmin(admin.ModelAdmin):
    list_display = ["name", "db_table", "key_column", "is_active", "updated_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "db_table"]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "actor", "action", "request"]
    list_filter = ["action", "created_at"]
    search_fields = ["action", "actor__username", "request__contract_number"]
