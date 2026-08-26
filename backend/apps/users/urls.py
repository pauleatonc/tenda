"""Authentication REST routes kept under the versioned API prefix."""

from django.urls import path

from . import api

app_name = "auth"

urlpatterns = [
    path("csrf", api.csrf_token, name="csrf"),
    path("register", api.register_view, name="register"),
    path("login", api.login_view, name="login"),
    path("logout", api.logout_view, name="logout"),
    path("viewer", api.viewer_view, name="viewer"),
    path("context", api.switch_context_view, name="context"),
    path("email/verify", api.verify_email_view, name="verify-email"),
    path(
        "email/verification/request",
        api.resend_verification_view,
        name="resend-verification",
    ),
    path(
        "password/reset/request",
        api.request_password_reset_view,
        name="request-password-reset",
    ),
    path(
        "password/reset/confirm",
        api.confirm_password_reset_view,
        name="confirm-password-reset",
    ),
    path("sessions", api.sessions_view, name="sessions"),
    path("sessions/revoke", api.revoke_session_view, name="revoke-session"),
    path(
        "social/<str:provider>/start",
        api.social_start_view,
        name="social-start",
    ),
    path(
        "social/<str:provider>/callback",
        api.social_callback_view,
        name="social-callback",
    ),
]
