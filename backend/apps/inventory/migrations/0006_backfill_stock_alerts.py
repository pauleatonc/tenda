from django.db import migrations


def backfill_stock_alerts(apps, schema_editor):
    del schema_editor
    Product = apps.get_model("inventory", "Product")
    InventoryAlert = apps.get_model("inventory", "InventoryAlert")
    alerts = []
    products = Product.objects.exclude(catalog_status="archived").select_related(
        "inventory",
        "balance",
    )
    for product in products:
        balance = getattr(product, "balance", None)
        on_hand = int(getattr(balance, "on_hand", 0))
        reserved = int(getattr(balance, "reserved", 0))
        available = max(on_hand - reserved, 0)
        threshold = (
            product.low_stock_threshold
            if product.low_stock_threshold is not None
            else product.inventory.low_stock_threshold
        )
        if available == 0:
            alert_type = "out_of_stock"
        elif available <= threshold:
            alert_type = "low_stock"
        else:
            continue
        alerts.append(
            InventoryAlert(
                inventory=product.inventory,
                product=product,
                alert_type=alert_type,
                status="active",
                threshold=threshold,
                available_quantity=available,
            )
        )
    InventoryAlert.objects.bulk_create(alerts, ignore_conflicts=True)


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0005_inventory_low_stock_threshold_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_stock_alerts, migrations.RunPython.noop),
    ]
