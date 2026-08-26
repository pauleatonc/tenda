from django.db import migrations


PARAMETERS = (
    (
        "shipping.delivery_check_hours",
        72,
        "Horas tras el despacho antes de pasar el envío a chequeo de entrega.",
    ),
    (
        "shipping.awaiting_reminder_hours",
        48,
        "Horas de espera al comprador antes de enviar el recordatorio de la consulta.",
    ),
    (
        "shipping.autoclose_days",
        7,
        "Días tras el recordatorio/escalamiento previo antes de autocerrar la consulta.",
    ),
    (
        "sales.proof_review_hours",
        24,
        "Horas de revisión de comprobante de pago en desarrollo.",
    ),
)


def seed_cadence_parameters(apps, schema_editor):
    del schema_editor
    operational_parameter = apps.get_model("configuration", "OperationalParameter")
    for key, value, description in PARAMETERS:
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


def remove_cadence_parameters(apps, schema_editor):
    del schema_editor
    operational_parameter = apps.get_model("configuration", "OperationalParameter")
    operational_parameter.objects.filter(
        organisation__isnull=True,
        key__in=[key for key, _value, _description in PARAMETERS],
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("configuration", "0003_payment_commission_defaults"),
    ]

    operations = [
        migrations.RunPython(
            seed_cadence_parameters,
            remove_cadence_parameters,
        ),
    ]
