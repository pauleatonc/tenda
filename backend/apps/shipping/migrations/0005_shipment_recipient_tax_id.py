from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shipping", "0004_follow_up_ticket_and_return_case"),
    ]

    operations = [
        migrations.AddField(
            model_name="shipment",
            name="recipient_tax_id",
            field=models.CharField(blank=True, max_length=16),
        ),
    ]
