from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("shipping", "0005_shipment_recipient_tax_id"),
    ]

    operations = [
        migrations.RenameField(
            model_name="shipment",
            old_name="municipality",
            new_name="commune",
        ),
        migrations.RenameField(
            model_name="shipment",
            old_name="city",
            new_name="region",
        ),
    ]
