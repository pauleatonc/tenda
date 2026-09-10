from django.db import migrations


PARAMETERS = (
    (
        "sales.reservation_ttl_hours",
        24,
        "Hours a reserved sale and its public link stay valid.",
    ),
)


def seed_reservation_ttl(apps, schema_editor):
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


def remove_reservation_ttl(apps, schema_editor):
    del schema_editor
    operational_parameter = apps.get_model("configuration", "OperationalParameter")
    operational_parameter.objects.filter(
        organisation__isnull=True,
        key__in=[key for key, _value, _description in PARAMETERS],
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("configuration", "0004_shipping_cadence_defaults"),
    ]

    operations = [
        migrations.RunPython(seed_reservation_ttl, remove_reservation_ttl),
    ]
