from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0004_buyer_recipient_tax_id"),
    ]

    operations = [
        migrations.RenameField(
            model_name="buyersnapshot",
            old_name="municipality",
            new_name="commune",
        ),
        migrations.RenameField(
            model_name="buyersnapshot",
            old_name="city",
            new_name="region",
        ),
        migrations.RenameField(
            model_name="buyersnapshot",
            old_name="tax_municipality",
            new_name="tax_commune",
        ),
        migrations.RenameField(
            model_name="buyersnapshot",
            old_name="tax_city",
            new_name="tax_region",
        ),
    ]
