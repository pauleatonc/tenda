"""Local settings with safe defaults for a checkout."""

from .base import *

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "backend"]
TURNSTILE_FAKE_MODE = True
OUTBOX_EAGER = True
