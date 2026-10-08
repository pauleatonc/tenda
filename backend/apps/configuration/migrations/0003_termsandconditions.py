from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


DEFAULT_BODY = """
<h2>1. Aceptación</h2>
<p>Al crear una cuenta o seleccionar un plan en Tenda, aceptas estos términos y
condiciones. Si no estás de acuerdo, no uses el servicio.</p>
<h2>2. El servicio</h2>
<p>Tenda ofrece herramientas de inventario, ventas y despacho para negocios.
Las funciones disponibles dependen del plan contratado.</p>
<h2>3. Cuenta y responsabilidades</h2>
<p>Eres responsable de la veracidad de los datos de tu negocio, del uso de tu
cuenta y del cumplimiento de la normativa aplicable a tus ventas.</p>
<h2>4. Pagos y planes</h2>
<p>Los planes de pago se facturan según lo indicado en la contratación. Los
cobros a tus compradores se gestionan con los proveedores de pago que
conectes; Tenda no es parte de esas transacciones salvo que se indique lo
contrario.</p>
<h2>5. Datos</h2>
<p>Tratamos los datos necesarios para prestar el servicio. Puedes solicitar
información o eliminación conforme a la ley aplicable.</p>
<h2>6. Cambios</h2>
<p>Podemos actualizar estos términos. El texto vigente siempre estará
disponible en esta página.</p>
""".strip()


def seed_terms(apps, schema_editor):
    del schema_editor
    terms = apps.get_model("configuration", "TermsAndConditions")
    terms.objects.get_or_create(
        pk=1,
        defaults={
            "title": "Términos y condiciones",
            "body_html": DEFAULT_BODY,
        },
    )


def unseed_terms(apps, schema_editor):
    del schema_editor
    terms = apps.get_model("configuration", "TermsAndConditions")
    terms.objects.filter(pk=1).delete()


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("configuration", "0002_seed_defaults"),
    ]

    operations = [
        migrations.CreateModel(
            name="TermsAndConditions",
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
                    "title",
                    models.CharField(
                        default="Términos y condiciones",
                        max_length=200,
                    ),
                ),
                (
                    "body_html",
                    models.TextField(
                        help_text="HTML del documento. Se muestra tal cual en la web (sin scripts).",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Términos y condiciones",
                "verbose_name_plural": "Términos y condiciones",
            },
        ),
        migrations.RunPython(seed_terms, unseed_terms),
    ]
