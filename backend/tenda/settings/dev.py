"""Shared development settings."""

from .base import *

DEBUG = env_bool("DJANGO_DEBUG", True)
TURNSTILE_FAKE_MODE = env_bool("TURNSTILE_FAKE_MODE", False)
OUTBOX_EAGER = env_bool("OUTBOX_EAGER", False)
ALLOWED_HOSTS = env_list(
    "DJANGO_ALLOWED_HOSTS",
    "localhost,127.0.0.1,backend",
)
