from django.db import migrations


PARAMETERS = (
    (
        "commission_mode",
        "disabled",
        "Modo de comisión de Mercado Pago: disabled o percentage.",
    ),
    (
        "commission_rate",
        "0",
        "Porcentaje de comisión solicitado, representado como decimal.",
    ),
    (
        "commission_minimum",
        0,
        "Comisión mínima operacional en CLP.",
    ),
)
ZERO_FEE_FLAG = "mercado_pago_zero_fee"


def seed_payment_configuration(apps, schema_editor):
    del schema_editor
    operational_parameter = apps.get_model("configuration", "OperationalParameter")
    feature_flag = apps.get_model("configuration", "FeatureFlag")
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
    feature_flag.objects.get_or_create(
        organisation=None,
        key=ZERO_FEE_FLAG,
        defaults={
            "enabled": False,
            "description": (
                "Permite solicitar comisión cero; permanece apagado hasta validación real."
            ),
        },
    )


def remove_payment_configuration(apps, schema_editor):
    del schema_editor
    operational_parameter = apps.get_model("configuration", "OperationalParameter")
    feature_flag = apps.get_model("configuration", "FeatureFlag")
    operational_parameter.objects.filter(
        organisation__isnull=True,
        key__in=[key for key, _value, _description in PARAMETERS],
    ).delete()
    feature_flag.objects.filter(
        organisation__isnull=True,
        key=ZERO_FEE_FLAG,
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("configuration", "0002_encryptedcredential"),
    ]

    operations = [
        migrations.RunPython(
            seed_payment_configuration,
            remove_payment_configuration,
        ),
    ]
