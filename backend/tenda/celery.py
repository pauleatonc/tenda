"""Celery application for non-domain bootstrap tasks."""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tenda.settings.local")

app = Celery("tenda")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
