from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.contrib.auth.views import LoginView, LogoutView
from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.views.decorators.http import require_POST

from workflow.models import AuditLog, FieldMapping, ModificationRequest, RequestStatus
from workflow.services import RequestValidationError, approve_many, approve_request, create_audit_log, create_modification_request, reject_request
from workflow.target_db import build_filled_update_preview


class AppLoginView(LoginView):
    template_name = "workflow/login.html"

    def get_success_url(self):
        if self.request.user.is_staff:
            return reverse_lazy("admin_requests")
        return reverse_lazy("agent_requests")


class AppLogoutView(LogoutView):
    next_page = reverse_lazy("login")


def is_admin(user: User) -> bool:
    return user.is_authenticated and user.is_staff


def admin_required(view_func):
    @login_required
    def wrapped(request, *args, **kwargs):
        if not is_admin(request.user):
            raise PermissionDenied("Acces administrateur requis.")
        return view_func(request, *args, **kwargs)

    return wrapped


def home(request):
    if not request.user.is_authenticated:
        return redirect("login")
    if request.user.is_staff:
        return redirect("admin_requests")
    return redirect("agent_requests")


@login_required
def agent_requests(request):
    if request.user.is_staff:
        return redirect("admin_requests")
    requests = ModificationRequest.objects.filter(requested_by=request.user).prefetch_related("items")
    return render(request, "workflow/agent_requests.html", {"requests": requests})


@login_required
def new_agent_request(request):
    if request.user.is_staff:
        return redirect("admin_requests")
    mappings = FieldMapping.objects.filter(is_active=True)
    if request.method == "POST":
        rows = []
        for index in range(8):
            mapping_id = request.POST.get(f"mapping_{index}")
            if mapping_id:
                rows.append(
                    {
                        "mapping_id": mapping_id,
                        "new_value": request.POST.get(f"value_{index}", ""),
                        "empty": request.POST.get(f"empty_{index}") == "on",
                    }
                )
        try:
            create_modification_request(
                actor=request.user,
                contract_number=request.POST.get("contract_number", ""),
                comment=request.POST.get("comment", ""),
                rows=rows,
            )
        except RequestValidationError as exc:
            messages.error(request, str(exc))
        else:
            messages.success(request, "Demande creee.")
            return redirect("agent_requests")
    return render(request, "workflow/new_agent_request.html", {"mappings": mappings, "row_range": range(8)})


@admin_required
def admin_requests(request):
    status = request.GET.get("status", RequestStatus.PENDING)
    requests = ModificationRequest.objects.select_related("requested_by").prefetch_related("items")
    if status != "all":
        requests = requests.filter(status=status)
    return render(
        request,
        "workflow/admin_requests.html",
        {"requests": requests, "status": status, "statuses": list(RequestStatus.choices) + [("all", "Toutes")]},
    )


@admin_required
def admin_request_detail(request, request_id: int):
    modification_request = get_object_or_404(
        ModificationRequest.objects.select_related("requested_by", "approved_by").prefetch_related("items"),
        id=request_id,
    )
    updates = [{"db_column": item.db_column_snapshot, "value": item.new_value} for item in modification_request.items.all()]
    sql_preview = build_filled_update_preview(modification_request.contract_number, updates)
    return render(
        request,
        "workflow/admin_request_detail.html",
        {"modification_request": modification_request, "sql_preview": sql_preview},
    )


@admin_required
@require_POST
def approve_request_view(request, request_id: int):
    try:
        modification_request, result = approve_request(actor=request.user, request_id=request_id)
    except RequestValidationError as exc:
        messages.error(request, str(exc))
    else:
        if result.ok:
            messages.success(request, f"Demande #{modification_request.id} approuvee.")
        else:
            messages.error(request, f"Demande #{modification_request.id} echouee : {result.error}")
    return redirect("admin_request_detail", request_id=request_id)


@admin_required
@require_POST
def reject_request_view(request, request_id: int):
    try:
        reject_request(actor=request.user, request_id=request_id)
    except RequestValidationError as exc:
        messages.error(request, str(exc))
    else:
        messages.success(request, "Demande rejetee.")
    return redirect("admin_request_detail", request_id=request_id)


@admin_required
@require_POST
def approve_selected_view(request):
    request_ids = [int(value) for value in request.POST.getlist("request_id") if value.isdigit()]
    summary = approve_many(actor=request.user, request_ids=request_ids)
    messages.success(request, f"Approbation terminee : {summary['approved']} approuvees, {summary['failed']} echouees.")
    return redirect("admin_requests")


@admin_required
@require_POST
def approve_all_view(request):
    request_ids = list(ModificationRequest.objects.filter(status=RequestStatus.PENDING).values_list("id", flat=True))
    summary = approve_many(actor=request.user, request_ids=request_ids)
    messages.success(request, f"Approbation totale : {summary['approved']} approuvees, {summary['failed']} echouees.")
    return redirect("admin_requests")


@admin_required
def mappings_view(request):
    if request.method == "POST":
        mapping_id = request.POST.get("id")
        payload = {
            "label": request.POST.get("label", "").strip(),
            "db_column": request.POST.get("db_column", "").strip().upper(),
            "data_type": request.POST.get("data_type", FieldMapping.DataType.TEXT),
            "is_required": request.POST.get("is_required") == "on",
            "is_active": request.POST.get("is_active") == "on",
            "validation_rule": request.POST.get("validation_rule", "").strip(),
            "help_text": request.POST.get("help_text", "").strip(),
            "admin_note": request.POST.get("admin_note", "").strip(),
        }
        if not payload["label"] or not payload["db_column"]:
            messages.error(request, "Libelle et colonne obligatoires.")
        else:
            if mapping_id:
                mapping = get_object_or_404(FieldMapping, id=mapping_id)
                for key, value in payload.items():
                    setattr(mapping, key, value)
                mapping.save()
                action = "mapping_edited"
            else:
                mapping = FieldMapping.objects.create(**payload)
                action = "mapping_created"
            create_audit_log(actor=request.user, action=action, details={"id": mapping.id, "db_column": mapping.db_column})
            messages.success(request, "Champ enregistre.")
            return redirect("mappings")
    return render(
        request,
        "workflow/mappings.html",
        {"mappings": FieldMapping.objects.all(), "data_types": FieldMapping.DataType.choices},
    )


@admin_required
def users_view(request):
    if request.method == "POST":
        form = UserCreationForm(request.POST)
        role = request.POST.get("role", "agent")
        if form.is_valid():
            user = form.save(commit=False)
            user.is_staff = role == "admin"
            user.save()
            create_audit_log(actor=request.user, action="user_created", details={"id": user.id, "username": user.username})
            messages.success(request, "Utilisateur cree.")
            return redirect("users")
    else:
        form = UserCreationForm()
    return render(request, "workflow/users.html", {"users": User.objects.order_by("username"), "form": form})


@admin_required
@require_POST
def toggle_user_view(request, user_id: int):
    if user_id == request.user.id:
        raise PermissionDenied("Vous ne pouvez pas desactiver votre propre compte.")
    user = get_object_or_404(User, id=user_id)
    user.is_active = not user.is_active
    user.save(update_fields=["is_active"])
    create_audit_log(actor=request.user, action="user_edited", details={"id": user.id, "is_active": user.is_active})
    return redirect("users")


@admin_required
def audit_view(request):
    action = request.GET.get("action", "all")
    logs = AuditLog.objects.select_related("actor", "request")
    if action != "all":
        logs = logs.filter(action=action)
    return render(request, "workflow/audit.html", {"logs": logs[:200], "action": action})
