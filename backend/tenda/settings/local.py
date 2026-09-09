"""Local settings with safe defaults for a checkout."""

import sys

from .base import *

DEBUG = True
ALLOWED_HOSTS = env_list(
    "DJANGO_ALLOWED_HOSTS",
    "localhost,127.0.0.1,backend",
)
TURNSTILE_FAKE_MODE = env_bool("TURNSTILE_FAKE_MODE", True)
OUTBOX_EAGER = True

# Bytes live under MEDIA_ROOT so API and Celery share the compose volume.
# `fake` is in-memory and only valid inside pytest. R2 requires a complete
# OBJECT_STORAGE_PROVIDER=r2 plus endpoint/keys/bucket in the environment.
if "pytest" in sys.modules:
    OBJECT_STORAGE_PROVIDER = "fake"
else:
    configured = os.getenv("OBJECT_STORAGE_PROVIDER", "local").strip().lower() or "local"
    r2_ready = all(
        (
            os.getenv("R2_ENDPOINT_URL", "").strip(),
            os.getenv("R2_ACCESS_KEY_ID", "").strip(),
            os.getenv("R2_SECRET_ACCESS_KEY", "").strip(),
            os.getenv("R2_BUCKET_NAME", os.getenv("R2_BUCKET", "")).strip(),
        )
    )
    OBJECT_STORAGE_PROVIDER = "r2" if configured == "r2" and r2_ready else "local"
