from django.db import migrations

SHIPPING_KEYS = (
    "shipping.delivery_check_hours",
    "shipping.awaiting_reminder_hours",
    "shipping.autoclose_days",
)

DEFAULTS = {
    "shipping.delivery_check_hours": (
        72,
        "Horas tras el despacho antes de pasar el envío a chequeo de entrega.",
    ),
    "shipping.awaiting_reminder_hours": (
        48,
        "Horas de espera al comprador antes de enviar el recordatorio de la consulta.",
    ),
    "shipping.autoclose_days": (
        7,
        "Días tras el recordatorio/escalamiento previo antes de autocerrar la consulta.",
    ),
}


def remove_shipping_parameters(apps, schema_editor):
    del schema_editor
    operational_parameter = apps.get_model("configuration", "OperationalParameter")
    operational_parameter.objects.filter(key__in=SHIPPING_KEYS).delete()


def restore_shipping_parameters(apps, schema_editor):
    del schema_editor
    operational_parameter = apps.get_model("configuration", "OperationalParameter")
    for key, (value, description) in DEFAULTS.items():
        operational_parameter.objects.get_or_create(
            organisation=None,
            key=key,
            defaults={
                "value": value,
                "description": description,
                "sensitive": False,
                "is_active": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("configuration", "0005_sales_reservation_ttl"),
    ]

    operations = [
        migrations.RunPython(remove_shipping_parameters, restore_shipping_parameters),
    ]
