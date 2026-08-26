"""Production settings. Required values must be supplied by the environment."""

import os

from django.core.exceptions import ImproperlyConfigured

from .base import *

DEBUG = False

if SECRET_KEY == "local-insecure-tenda-key":
    raise ImproperlyConfigured("DJANGO_SECRET_KEY is required in production")
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS is required in production")
for setting_name in (
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "WEB_ORIGIN",
    "OUTBOX_ENCRYPTION_KEY",
    "CREDENTIAL_ENCRYPTION_KEY",
):
    if not os.getenv(setting_name, "").strip():
        raise ImproperlyConfigured(f"{setting_name} is required in production")
if not WEB_ORIGIN.startswith("https://"):
    raise ImproperlyConfigured("WEB_ORIGIN must use HTTPS in production")
if not ADMIN_ALLOWED_NETWORKS:
    raise ImproperlyConfigured("DJANGO_ADMIN_ALLOWED_NETWORKS is required in production")
if not ADMIN_TRUST_X_FORWARDED_FOR:
    raise ImproperlyConfigured(
        "DJANGO_ADMIN_TRUST_X_FORWARDED_FOR must be enabled behind production Nginx"
    )
if not ADMIN_URL_PATH.startswith("control-"):
    raise ImproperlyConfigured(
        "DJANGO_ADMIN_PATH must use a private control-* prefix in production"
    )

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_SECURE_HSTS_SECONDS", "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
TENDA_ENV = "production"
