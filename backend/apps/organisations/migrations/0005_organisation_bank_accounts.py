# Generated manually for multi-account bank details.

from __future__ import annotations

import uuid

from django.db import migrations, models
import django.db.models.deletion


def forwards_copy_legacy_bank_details(apps, schema_editor):
    Organisation = apps.get_model("organisations", "Organisation")
    OrganisationBankAccount = apps.get_model("organisations", "OrganisationBankAccount")
    for organisation in Organisation.objects.all().iterator():
        if not (
            organisation.bank_name
            and organisation.bank_account_type
            and organisation.bank_account_number
            and organisation.bank_holder_tax_id
            and organisation.bank_confirmation_email
        ):
            continue
        OrganisationBankAccount.objects.create(
            public_id=uuid.uuid4(),
            organisation=organisation,
            label="Cuenta principal",
            bank_name=organisation.bank_name,
            bank_account_type=organisation.bank_account_type,
            bank_account_number=organisation.bank_account_number,
            bank_holder_tax_id=organisation.bank_holder_tax_id,
            bank_confirmation_email=organisation.bank_confirmation_email,
            position=0,
        )


def backwards_noop(apps, schema_editor):
    return None


class Migration(migrations.Migration):

    dependencies = [
        ("organisations", "0004_organisation_bank_details"),
    ]

    operations = [
        migrations.CreateModel(
            name="OrganisationBankAccount",
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
                ("public_id", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("label", models.CharField(blank=True, max_length=80)),
                ("bank_name", models.CharField(max_length=80)),
                ("bank_account_type", models.CharField(max_length=32)),
                ("bank_account_number", models.CharField(max_length=32)),
                ("bank_holder_tax_id", models.CharField(max_length=16)),
                ("bank_confirmation_email", models.EmailField(max_length=254)),
                ("position", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organisation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="bank_accounts",
                        to="organisations.organisation",
                    ),
                ),
            ],
            options={
                "ordering": ("position", "created_at"),
            },
        ),
        migrations.AddConstraint(
            model_name="organisationbankaccount",
            constraint=models.UniqueConstraint(
                fields=("organisation", "position"),
                name="org_bank_account_unique_position",
            ),
        ),
        migrations.AddIndex(
            model_name="organisationbankaccount",
            index=models.Index(
                fields=("organisation", "position"),
                name="org_bank_account_org_pos_idx",
            ),
        ),
        migrations.RunPython(forwards_copy_legacy_bank_details, backwards_noop),
    ]
