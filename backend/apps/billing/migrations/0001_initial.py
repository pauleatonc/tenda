import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("organisations", "0005_organisation_bank_accounts"),
    ]

    operations = [
        migrations.CreateModel(
            name="Plan",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "public_id",
                    models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
                ),
                (
                    "code",
                    models.CharField(
                        choices=[
                            ("free", "Gratis"),
                            ("starter", "Starter"),
                            ("growth", "Growth"),
                            ("pro", "Pro"),
                        ],
                        max_length=32,
                        unique=True,
                    ),
                ),
                ("name", models.CharField(max_length=80)),
                ("price_clp", models.PositiveIntegerField(default=0)),
                (
                    "product_limit",
                    models.PositiveIntegerField(
                        blank=True,
                        help_text="Null means unlimited non-archived products.",
                        null=True,
                    ),
                ),
                ("ai_assisted_enabled", models.BooleanField(default=False)),
                ("mp_preapproval_plan_id", models.CharField(blank=True, max_length=120)),
                ("is_active", models.BooleanField(default=True)),
                ("position", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ("position", "price_clp"),
            },
        ),
        migrations.CreateModel(
            name="OrganisationSubscription",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "public_id",
                    models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("active", "Active"),
                            ("past_due", "Past due"),
                            ("paused", "Paused"),
                            ("canceled", "Canceled"),
                        ],
                        default="pending",
                        max_length=16,
                    ),
                ),
                (
                    "mp_preapproval_id",
                    models.CharField(blank=True, db_index=True, max_length=120),
                ),
                ("init_point", models.URLField(blank=True, max_length=500)),
                ("payer_email", models.EmailField(blank=True, max_length=254)),
                ("current_period_end", models.DateTimeField(blank=True, null=True)),
                ("cancel_at_period_end", models.BooleanField(default=False)),
                ("past_due_since", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organisation",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="subscription",
                        to="organisations.organisation",
                    ),
                ),
                (
                    "plan",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="subscriptions",
                        to="billing.plan",
                    ),
                ),
            ],
            options={
                "ordering": ("-updated_at",),
            },
        ),
        migrations.CreateModel(
            name="BillingWebhookEvent",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "public_id",
                    models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
                ),
                ("provider", models.CharField(default="mercado_pago", max_length=40)),
                ("provider_event_id", models.CharField(max_length=160)),
                ("event_type", models.CharField(max_length=120)),
                ("raw_body", models.TextField()),
                ("safe_headers", models.JSONField(default=dict)),
                ("normalized_payload", models.JSONField(default=dict)),
                ("signature_valid", models.BooleanField(default=False)),
                ("provider_resource_id", models.CharField(blank=True, max_length=160)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("received", "Received"),
                            ("processing", "Processing"),
                            ("processed", "Processed"),
                            ("ignored", "Ignored"),
                            ("failed", "Failed"),
                        ],
                        default="received",
                        max_length=16,
                    ),
                ),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("last_error", models.CharField(blank=True, max_length=240)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organisation",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="organisations.organisation",
                    ),
                ),
            ],
            options={
                "ordering": ("-created_at",),
            },
        ),
        migrations.AddConstraint(
            model_name="billingwebhookevent",
            constraint=models.UniqueConstraint(
                fields=("provider", "provider_event_id"),
                name="billing_webhook_unique_event",
            ),
        ),
    ]
