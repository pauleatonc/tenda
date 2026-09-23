"""Collapse the shipment lifecycle to register-and-notify.

Public tracking, buyer confirmation, tickets, cadences, return cases and the
timeline are removed. Existing rows are mapped onto the three remaining
statuses before the choices are narrowed.
"""

from django.db import migrations, models

STATUS_MAP = {
    "preparing": "pending",
    "delivery_check": "dispatched",
    "issue": "dispatched",
    "returned": "dispatched",
    "cancelled": "dispatched",
    "closed": "delivered",
}


def collapse_statuses(apps, schema_editor):
    del schema_editor
    shipment = apps.get_model("shipping", "Shipment")
    for previous, target in STATUS_MAP.items():
        shipment.objects.filter(status=previous).update(status=target)


class Migration(migrations.Migration):
    dependencies = [
        ("shipping", "0006_shipment_region_commune"),
    ]

    operations = [
        migrations.RunPython(collapse_statuses, migrations.RunPython.noop),
        migrations.DeleteModel(name="TicketMessage"),
        migrations.DeleteModel(name="FollowUpSchedule"),
        migrations.DeleteModel(name="ReturnCase"),
        migrations.DeleteModel(name="Ticket"),
        migrations.DeleteModel(name="DeliveryConfirmation"),
        migrations.DeleteModel(name="ShipmentEvent"),
        migrations.RemoveField(model_name="shipment", name="public_token_hash"),
        migrations.RemoveField(model_name="shipment", name="public_token_ciphertext"),
        migrations.RemoveField(model_name="shipment", name="public_token_expires_at"),
        migrations.RemoveField(model_name="shipment", name="closed_at"),
        migrations.AddField(
            model_name="shipment",
            name="dispatch_note",
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AlterField(
            model_name="shipment",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pendiente"),
                    ("dispatched", "Despachado"),
                    ("delivered", "Entregado"),
                ],
                default="pending",
                max_length=24,
            ),
        ),
    ]
