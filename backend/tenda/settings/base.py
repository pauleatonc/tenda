"""Configuración común para todos los ambientes de Tenda."""

from __future__ import annotations

import os
from pathlib import Path

import sentry_sdk
from corsheaders.defaults import default_headers

from tenda.observability import scrub_sentry_event

BASE_DIR = Path(__file__).resolve().parents[2]


def env_bool(name: str, default: bool = False) -> bool:
    """Parse a boolean environment variable with strict, predictable values."""
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    """Parse a comma-separated environment variable."""
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "local-insecure-tenda-key")
DEBUG = False
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "django_celery_beat",
    "graphene_django",
    "apps.users.apps.UsersConfig",
    "apps.organisations.apps.OrganisationsConfig",
    "apps.configuration.apps.ConfigurationConfig",
    "apps.audit.apps.AuditConfig",
    "apps.media_assets.apps.MediaAssetsConfig",
    "apps.notifications.apps.NotificationsConfig",
    "apps.inventory.apps.InventoryConfig",
    "apps.sales.apps.SalesConfig",
    "apps.shipping.apps.ShippingConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "tenda.security.SecurityHeadersMiddleware",
    "apps.users.middleware.CorrelationIdMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "apps.users.middleware.MobileJsonCsrfBypassMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "tenda.admin_security.AdminSecurityMiddleware",
    "apps.users.middleware.BearerAuthenticationMiddleware",
    "apps.users.middleware.TenantContextMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "tenda.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "tenda.wsgi.application"
ASGI_APPLICATION = "tenda.asgi.application"

if os.getenv("POSTGRES_HOST"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", "tenda"),
            "USER": os.getenv("POSTGRES_USER", "tenda"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
            "HOST": os.environ["POSTGRES_HOST"],
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": int(os.getenv("POSTGRES_CONN_MAX_AGE", "60")),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
]

LANGUAGE_CODE = "es-cl"
TIME_ZONE = "America/Santiago"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", str(BASE_DIR / "media")))
MEDIA_URL = "media/"
# Local/fake PUT reads request.body. Django's default is 2.5 MB; purposes go up to 25 MB.
DATA_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = DATA_UPLOAD_MAX_MEMORY_SIZE
# Longest-edge sizes for display images (contain, no upscale), aligned with
# common e-commerce breakpoints: nav/cart chip, product card, PDP/zoom.
IMAGE_VARIANT_MAX_EDGE = {
    "thumbnail": int(os.getenv("IMAGE_VARIANT_THUMBNAIL_EDGE", "256")),
    "medium": int(os.getenv("IMAGE_VARIANT_MEDIUM_EDGE", "800")),
    "large": int(os.getenv("IMAGE_VARIANT_LARGE_EDGE", "1600")),
}
IMAGE_VARIANT_FORMAT = "WEBP"
IMAGE_VARIANT_CONTENT_TYPE = "image/webp"
IMAGE_VARIANT_QUALITY = int(os.getenv("IMAGE_VARIANT_QUALITY", "82"))
IMAGE_VARIANT_NAMES = ("thumbnail", "medium", "large")
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "users.User"

GRAPHENE = {
    "SCHEMA": "tenda.schema.schema",
    "MIDDLEWARE": [],
}
GRAPHQL_MAX_DEPTH = int(os.getenv("GRAPHQL_MAX_DEPTH", "12"))
GRAPHQL_MAX_FIELDS = int(os.getenv("GRAPHQL_MAX_FIELDS", "250"))

REDIS_URL = os.getenv("REDIS_URL", "")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL.replace("/0", "/1"),
            "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
            "KEY_PREFIX": os.getenv("CACHE_KEY_PREFIX", "tenda"),
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "tenda-local",
        }
    }
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL or "memory://")
CELERY_RESULT_BACKEND = None
CELERY_TASK_IGNORE_RESULT = True
CELERY_TASK_TRACK_STARTED = True
CELERY_TIMEZONE = TIME_ZONE
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
CELERY_TASK_ROUTES = {
    "apps.notifications.tasks.dispatch_outbox": {"queue": "default"},
    "apps.notifications.tasks.deliver_notification": {"queue": "email"},
    "apps.inventory.tasks.analyse_inventory_import": {"queue": "imports"},
    "apps.inventory.tasks.process_inventory_import": {"queue": "imports"},
    "apps.inventory.tasks.process_inventory_export": {"queue": "imports"},
    "apps.sales.tasks.expire_orders": {"queue": "payments"},
    "apps.sales.tasks.process_payment_webhook": {"queue": "payments"},
    "apps.sales.tasks.retry_reconciliation": {"queue": "payments"},
    "apps.shipping.tasks.process_due_follow_ups": {"queue": "default"},
}
CELERY_BEAT_SCHEDULE = {
    "dispatch-outbox": {
        "task": "apps.notifications.tasks.dispatch_outbox",
        "schedule": 10.0,
    },
    "expire-sales-reservations": {
        "task": "apps.sales.tasks.expire_orders",
        "schedule": 60.0,
    },
    "retry-payment-reconciliation": {
        "task": "apps.sales.tasks.retry_reconciliation",
        "schedule": 300.0,
    },
    "process-shipping-follow-ups": {
        "task": "apps.shipping.tasks.process_due_follow_ups",
        "schedule": 60.0,
    },
}
OUTBOX_EAGER = env_bool("OUTBOX_EAGER", False)
OUTBOX_ENCRYPTION_KEY = os.getenv("OUTBOX_ENCRYPTION_KEY", "")
CREDENTIAL_ENCRYPTION_KEY = os.getenv(
    "CREDENTIAL_ENCRYPTION_KEY",
    os.getenv("PAYMENT_CREDENTIAL_ENCRYPTION_KEY", ""),
)

CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", os.getenv("WEB_ORIGIN", ""))
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = (
    *default_headers,
    "x-correlation-id",
    "x-tenda-client",
    "x-device-name",
    "x-organisation-id",
    "x-inventory-id",
)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", False)
SESSION_COOKIE_NAME = "tenda_session"
SESSION_COOKIE_AGE = int(os.getenv("SESSION_COOKIE_AGE_SECONDS", "1209600"))
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", False)
CSRF_COOKIE_NAME = "tenda_csrf"
CSRF_FAILURE_VIEW = "apps.users.api.csrf_failure"

AUTH_EMAIL_TOKEN_TTL_SECONDS = int(os.getenv("AUTH_EMAIL_TOKEN_TTL_SECONDS", "86400"))
AUTH_PASSWORD_RESET_TTL_SECONDS = int(os.getenv("AUTH_PASSWORD_RESET_TTL_SECONDS", "3600"))
AUTH_MOBILE_TOKEN_TTL_SECONDS = int(os.getenv("AUTH_MOBILE_TOKEN_TTL_SECONDS", "2592000"))
AUTH_RATE_LIMITS = {
    "login": (8, 300, 300),
    "register": (5, 900, 900),
    "verify_email": (10, 300, 300),
    "resend_verification": (4, 900, 900),
    "password_reset_request": (4, 900, 900),
    "password_reset_confirm": (8, 900, 900),
    "oidc_start": (10, 300, 300),
    "oidc_callback": (10, 300, 300),
    "admin_login": (5, 900, 900),
    "public_shipment_read": (30, 300, 300),
    "public_shipment_confirm": (8, 300, 300),
    "public_shipment_ticket": (8, 300, 300),
}

ADMIN_URL_PATH = f"{os.getenv('DJANGO_ADMIN_PATH', 'admin').strip('/')}/"
ADMIN_ALLOWED_NETWORKS = env_list("DJANGO_ADMIN_ALLOWED_NETWORKS")
ADMIN_TRUST_X_FORWARDED_FOR = env_bool("DJANGO_ADMIN_TRUST_X_FORWARDED_FOR", False)
WEB_ORIGIN = os.getenv("WEB_ORIGIN", "http://localhost:5173").rstrip("/")
PUBLIC_ORIGIN = os.getenv("PUBLIC_ORIGIN", WEB_ORIGIN).rstrip("/")
PUBLIC_API_URL = os.getenv("PUBLIC_API_URL", "http://localhost:8000").rstrip("/")
SALES_RESERVATION_TTL_SECONDS = int(os.getenv("SALES_RESERVATION_TTL_SECONDS", str(8 * 60 * 60)))
SHIPPING_PUBLIC_TOKEN_TTL_DAYS = int(os.getenv("SHIPPING_PUBLIC_TOKEN_TTL_DAYS", "90"))
GOOGLE_OIDC_CLIENT_ID = os.getenv("GOOGLE_OIDC_CLIENT_ID", "").strip()
GOOGLE_OIDC_CLIENT_SECRET = os.getenv("GOOGLE_OIDC_CLIENT_SECRET", "").strip()
GOOGLE_OIDC_CALLBACK_URL = os.getenv(
    "GOOGLE_OIDC_CALLBACK_URL",
    "http://localhost:8000/api/v1/auth/social/google/callback",
)
_google_oidc_mode = os.getenv("GOOGLE_OIDC_PROVIDER", "").strip().lower()
if _google_oidc_mode:
    GOOGLE_OIDC_PROVIDER = _google_oidc_mode
elif GOOGLE_OIDC_CLIENT_ID and GOOGLE_OIDC_CLIENT_SECRET:
    GOOGLE_OIDC_PROVIDER = "google"
else:
    GOOGLE_OIDC_PROVIDER = "fake"
LINKEDIN_OIDC_ENABLED = env_bool("LINKEDIN_OIDC_ENABLED", False)
LINKEDIN_OIDC_CALLBACK_URL = os.getenv(
    "LINKEDIN_OIDC_CALLBACK_URL",
    "http://localhost:8000/api/v1/auth/social/linkedin/callback",
)
TURNSTILE_SECRET_KEY = os.getenv("TURNSTILE_SECRET_KEY", "")
TURNSTILE_FAKE_MODE = env_bool("TURNSTILE_FAKE_MODE", False)
EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "fake")
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "")
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "Tenda")
OBJECT_STORAGE_PROVIDER = os.getenv("OBJECT_STORAGE_PROVIDER", "fake")
R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL", "")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", os.getenv("R2_BUCKET", ""))
_r2_prefix = os.getenv("R2_PREFIX", "").strip().strip("/")
_r2_env_prefixes = {
    "local": "local",
    "dev": "dev",
    "development": "dev",
    "prod": "prod",
    "production": "prod",
}
R2_PREFIX = _r2_prefix or _r2_env_prefixes.get(
    os.getenv("TENDA_ENV", "local").strip().lower(),
    "local",
)
PAYMENT_PROVIDER = os.getenv("PAYMENT_PROVIDER", "fake")
MERCADO_PAGO_ACCESS_TOKEN = os.getenv("MERCADO_PAGO_ACCESS_TOKEN", "")
MERCADO_PAGO_ENVIRONMENT = os.getenv(
    "MERCADO_PAGO_ENVIRONMENT",
    os.getenv("MERCADOPAGO_ENVIRONMENT", "sandbox"),
)
MERCADO_PAGO_CLIENT_ID = os.getenv(
    "MERCADO_PAGO_CLIENT_ID",
    os.getenv("MERCADOPAGO_CLIENT_ID", ""),
)
MERCADO_PAGO_CLIENT_SECRET = os.getenv(
    "MERCADO_PAGO_CLIENT_SECRET",
    os.getenv("MERCADOPAGO_CLIENT_SECRET", ""),
)
MERCADO_PAGO_OAUTH_CALLBACK_URL = os.getenv(
    "MERCADO_PAGO_OAUTH_CALLBACK_URL",
    os.getenv(
        "MERCADOPAGO_OAUTH_CALLBACK_URL",
        "http://localhost:8000/api/v1/integrations/mercado-pago/callback",
    ),
)
MERCADO_PAGO_WEBHOOK_SECRET = os.getenv(
    "MERCADO_PAGO_WEBHOOK_SECRET",
    os.getenv("MERCADOPAGO_WEBHOOK_SECRET", ""),
)
MERCADO_PAGO_WEBHOOK_URL = os.getenv(
    "MERCADO_PAGO_WEBHOOK_URL",
    "http://localhost:8000/api/v1/webhooks/mercado-pago",
)
PAYMENT_OAUTH_STATE_TTL_SECONDS = int(os.getenv("PAYMENT_OAUTH_STATE_TTL_SECONDS", "600"))
MERCADO_PAGO_COMMISSION_MODE = os.getenv(
    "MERCADO_PAGO_COMMISSION_MODE",
    os.getenv("MERCADOPAGO_COMMISSION_MODE", "disabled"),
)
MERCADO_PAGO_COMMISSION_RATE = os.getenv(
    "MERCADO_PAGO_COMMISSION_RATE",
    os.getenv("MERCADOPAGO_COMMISSION_RATE", "0"),
)
MERCADO_PAGO_COMMISSION_MINIMUM = os.getenv(
    "MERCADO_PAGO_COMMISSION_MINIMUM",
    os.getenv("MERCADOPAGO_COMMISSION_MINIMUM", "0"),
)
TENDA_ENV = os.getenv("TENDA_ENV", "local")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"()": "tenda.observability.RedactingJsonFormatter"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.server": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}
SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=TENDA_ENV,
        send_default_pii=False,
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.05")),
        before_send=scrub_sentry_event,
    )
AGENT_FEATURE_STATUS = os.getenv("AGENT_FEATURE_STATUS", "coming_soon")
if AGENT_FEATURE_STATUS not in {"disabled", "coming_soon"}:
    raise ValueError("AGENT_FEATURE_STATUS only supports 'disabled' or 'coming_soon' in the MVP")
