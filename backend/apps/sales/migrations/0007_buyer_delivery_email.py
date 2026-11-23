from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0006_order_deposit_bank_details"),
    ]

    operations = [
        migrations.AddField(
            model_name="buyersnapshot",
            name="delivery_email",
            field=models.EmailField(blank=True, default=""),
        ),
    ]
