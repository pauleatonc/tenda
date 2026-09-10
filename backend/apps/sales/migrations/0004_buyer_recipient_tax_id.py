from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0003_order_paymentwebhookevent_attempts_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="buyersnapshot",
            name="recipient_tax_id",
            field=models.CharField(blank=True, max_length=16),
        ),
    ]
