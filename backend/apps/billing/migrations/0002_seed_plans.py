from django.db import migrations

PLANS = (
    {
        "code": "free",
        "name": "Gratis",
        "price_clp": 0,
        "product_limit": 5,
        "ai_assisted_enabled": False,
        "position": 0,
        "mp_preapproval_plan_id": "",
    },
    {
        "code": "starter",
        "name": "Starter",
        "price_clp": 4990,
        "product_limit": 15,
        "ai_assisted_enabled": True,
        "position": 1,
        "mp_preapproval_plan_id": "seed-starter",
    },
    {
        "code": "growth",
        "name": "Growth",
        "price_clp": 9990,
        "product_limit": 25,
        "ai_assisted_enabled": True,
        "position": 2,
        "mp_preapproval_plan_id": "seed-growth",
    },
    {
        "code": "pro",
        "name": "Pro",
        "price_clp": 14990,
        "product_limit": None,
        "ai_assisted_enabled": True,
        "position": 3,
        "mp_preapproval_plan_id": "seed-pro",
    },
)


def seed_plans(apps, schema_editor):
    del schema_editor
    plan_model = apps.get_model("billing", "Plan")
    for row in PLANS:
        plan_model.objects.update_or_create(
            code=row["code"],
            defaults={
                "name": row["name"],
                "price_clp": row["price_clp"],
                "product_limit": row["product_limit"],
                "ai_assisted_enabled": row["ai_assisted_enabled"],
                "position": row["position"],
                "mp_preapproval_plan_id": row["mp_preapproval_plan_id"],
                "is_active": True,
            },
        )


def unseed_plans(apps, schema_editor):
    del schema_editor
    plan_model = apps.get_model("billing", "Plan")
    plan_model.objects.filter(code__in=[row["code"] for row in PLANS]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_plans, unseed_plans),
    ]
