"""Local settings with safe defaults for a checkout."""

import sys

from .base import *

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "backend"]
TURNSTILE_FAKE_MODE = env_bool("TURNSTILE_FAKE_MODE", True)
OUTBOX_EAGER = True
if "pytest" in sys.modules:
    OBJECT_STORAGE_PROVIDER = os.getenv("OBJECT_STORAGE_PROVIDER", "fake")
elif os.getenv("OBJECT_STORAGE_PROVIDER", "local") in {"", "fake", "local"}:
    OBJECT_STORAGE_PROVIDER = "local"
