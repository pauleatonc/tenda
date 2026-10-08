"""Create a verified owner for Playwright and Maestro smokes."""

from __future__ import annotations

import json
from typing import Any

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.billing.services import record_plan_intent
from apps.organisations.models import Membership, Organisation, OrganisationBankAccount
from apps.organisations.services import create_organisation_for_owner
from apps.users.models import AuthRateLimitBucket, User

DEFAULT_EMAIL = "e2e.owner@tenda.test"
DEFAULT_PASSWORD = "Correct-Horse-Battery-42"


def _ensure_deposit_account(organisation: Organisation) -> None:
    """Bank-transfer e2e journeys need a complete deposit destination."""

    if organisation.bank_accounts.exists():
        return
    OrganisationBankAccount.objects.create(
        organisation=organisation,
        label="Cuenta E2E",
        bank_name="BancoEstado",
        bank_account_type="cuenta_vista",
        bank_account_number="12345678",
        bank_holder_tax_id="11.111.111-1",
        bank_confirmation_email="depositos.e2e@tenda.test",
        position=0,
    )


class Command(BaseCommand):
    help = (
        "Provision a verified owner used by web Playwright and mobile Maestro. "
        "Also clears durable auth rate-limit buckets so repeated local runs can log in."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--email", default=DEFAULT_EMAIL)
        parser.add_argument("--password", default=DEFAULT_PASSWORD)
        parser.add_argument(
            "--json",
            action="store_true",
            help="Print credentials as JSON for automation.",
        )

    def handle(self, *_args: object, **options: object) -> None:
        email = User.objects.normalize_email(str(options["email"])).strip().lower()
        password = str(options["password"])
        AuthRateLimitBucket.objects.all().delete()
        user = User.objects.filter(email=email).first()
        created = user is None
        if user is None:
            user = User.objects.create_user(
                email=email,
                password=password,
                email_verified_at=timezone.now(),
            )
            user.profile.full_name = "Owner E2E"
            user.profile.save(update_fields=["full_name", "updated_at"])
            provision = create_organisation_for_owner(owner=user, name="Negocio E2E")
            record_plan_intent(organisation=provision.organisation, plan_code="free")
            organisation = provision.organisation
        else:
            user.set_password(password)
            if user.email_verified_at is None:
                user.email_verified_at = timezone.now()
            user.is_active = True
            user.save(
                update_fields=[
                    "password",
                    "email_verified_at",
                    "is_active",
                    "updated_at",
                ]
            )
            membership = Membership.objects.filter(user=user).select_related("organisation").first()
            if membership is None:
                provision = create_organisation_for_owner(owner=user, name="Negocio E2E")
                record_plan_intent(organisation=provision.organisation, plan_code="free")
                organisation = provision.organisation
            else:
                record_plan_intent(organisation=membership.organisation, plan_code="free")
                organisation = membership.organisation

        _ensure_deposit_account(organisation)

        payload = {
            "email": user.email,
            "created": created,
            "verified": user.is_email_verified,
        }
        if options["json"]:
            self.stdout.write(json.dumps(payload))
            return
        self.stdout.write(self.style.SUCCESS(f"E2E owner ready: {user.email}"))
