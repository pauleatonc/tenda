from django.core.management.base import BaseCommand

from apps.billing.services import ensure_plan_preapproval_ids


class Command(BaseCommand):
    help = "Create or refresh Mercado Pago preapproval_plan IDs for paid Tenda plans."

    def add_arguments(self, parser) -> None:  # type: ignore[no-untyped-def]
        parser.add_argument(
            "--force",
            action="store_true",
            help="Create new preapproval plans even when IDs already exist.",
        )

    def handle(self, *args: object, **options: object) -> None:
        del args
        force = bool(options.get("force"))
        results = ensure_plan_preapproval_ids(force=force)
        if not results:
            self.stdout.write(self.style.WARNING("No paid plans to sync."))
            return
        for row in results:
            self.stdout.write(
                f"{row['code']}: {row['mp_preapproval_plan_id']} ({row['amount_clp']} CLP)"
            )
        self.stdout.write(self.style.SUCCESS(f"Synced {len(results)} plan(s)."))
