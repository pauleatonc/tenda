from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0006_backfill_stock_alerts"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="brand",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="product",
            name="description",
            field=models.TextField(blank=True, default=""),
        ),
    ]
