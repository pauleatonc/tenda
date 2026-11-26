from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0007_product_brand_description"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="marketing_description",
            field=models.TextField(blank=True, default=""),
        ),
    ]
