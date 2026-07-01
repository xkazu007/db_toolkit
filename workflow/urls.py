from django.urls import path

from workflow import views


urlpatterns = [
    path("", views.home, name="home"),
    path("login/", views.AppLoginView.as_view(), name="login"),
    path("logout/", views.AppLogoutView.as_view(), name="logout"),
    path("agent/requests/", views.agent_requests, name="agent_requests"),
    path("agent/requests/new/", views.new_agent_request, name="new_agent_request"),
    path("admin/requests/", views.admin_requests, name="admin_requests"),
    path("admin/requests/<int:request_id>/", views.admin_request_detail, name="admin_request_detail"),
    path("admin/requests/<int:request_id>/approve/", views.approve_request_view, name="approve_request"),
    path("admin/requests/<int:request_id>/reject/", views.reject_request_view, name="reject_request"),
    path("admin/requests/approve-selected/", views.approve_selected_view, name="approve_selected"),
    path("admin/requests/approve-all/", views.approve_all_view, name="approve_all"),
    path("admin/mappings/", views.mappings_view, name="mappings"),
    path("admin/users/", views.users_view, name="users"),
    path("admin/users/<int:user_id>/toggle/", views.toggle_user_view, name="toggle_user"),
    path("admin/audit/", views.audit_view, name="audit"),
]
