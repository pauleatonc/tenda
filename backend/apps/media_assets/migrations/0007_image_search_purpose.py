from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("media_assets", "0006_alter_mediaasset_purpose"),
    ]

    operations = [
        migrations.AlterField(
            model_name="mediaasset",
            name="purpose",
            field=models.CharField(
                choices=[
                    ("product_image", "Product image"),
                    ("image_search", "Assisted image search"),
                    ("profile_photo", "Profile photo"),
                    ("organisation_logo", "Organisation logo"),
                    ("payment_receipt", "Payment receipt"),
                    ("import_file", "Import file"),
                    ("import_report", "Import report"),
                    ("inventory_export", "Inventory export"),
                    ("shipping_label", "Shipping label"),
                ],
                max_length=32,
            ),
        ),
    ]
