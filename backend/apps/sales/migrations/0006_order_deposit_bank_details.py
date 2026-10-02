# Generated manually for deposit bank account snapshots.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0005_buyer_region_commune"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="deposit_bank_details",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
