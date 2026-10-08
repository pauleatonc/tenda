# Facturación freemium (suscripciones Mercado Pago)

Tenda cobra planes SaaS a la **Organisation** con Mercado Pago Preapproval.
Esto es **independiente** del OAuth de cobro a compradores (`SellerPaymentConnection`).

## Planes

| Código    | Precio CLP/mes | Productos (no archivados) | Creación asistida |
| --------- | -------------- | ------------------------- | ----------------- |
| `free`    | 0              | 5                         | No                |
| `starter` | 4.990          | 15                        | Sí                |
| `growth`  | 9.990          | 25                        | Sí                |
| `pro`     | 14.990         | Ilimitado                 | Sí                |

- Bloqueo duro al crear productos o importar filas nuevas si no hay cupo.
- Archivar un producto libera cupo.
- Tras cancelación o `past_due` fuera de gracia (`BILLING_PAST_DUE_GRACE_DAYS`, default 3), las entitlements vuelven a Free sin borrar el catálogo.

## Backend

- App: `apps.billing`
- Modelos: `Plan`, `OrganisationSubscription`, `BillingWebhookEvent`
- Entitlements: `apps.billing.entitlements`
- Provider: `apps.billing.provider` (`fake` / `mercado_pago`)
- Webhook HTTP: `POST /api/v1/webhooks/mercado-pago-billing`
- GraphQL: `organisationBilling`, `startPlanCheckout`, `cancelSubscription`, `resumeSubscription`

### Sync de planes en Mercado Pago

```bash
uv run --project backend python backend/manage.py sync_billing_plans
# o forzar creación de preapproval_plan nuevos:
uv run --project backend python backend/manage.py sync_billing_plans --force
```

En desarrollo con `BILLING_PROVIDER=fake` los IDs seed (`seed-starter`, etc.) bastan.

## Variables de entorno

Ver `.env.example`:

- `BILLING_PROVIDER` (default = `PAYMENT_PROVIDER`)
- `MERCADO_PAGO_BILLING_ACCESS_TOKEN` (token de la cuenta Tenda; no el del vendedor)
- `MERCADO_PAGO_BILLING_WEBHOOK_SECRET`
- `BILLING_BACK_URL` (retorno post-checkout, p. ej. `/app/configuracion/plan`)
- `BILLING_PAST_DUE_GRACE_DAYS`

## Webhooks en el panel MP

Configurar notificación al endpoint de **billing** (separado del de ventas):

- URL: `{PUBLIC_API_URL}/api/v1/webhooks/mercado-pago-billing`
- Topics: `subscription_preapproval`, `subscription_authorized_payment` (y plan si aplica)

El webhook de ventas (`/api/v1/webhooks/mercado-pago`) no procesa suscripciones SaaS.

## Frontend

- Web: `/app/configuracion/plan`
- Mobile: Más → Plan y facturación (`/mas/plan`)
- Registro (web/mobile): el usuario elige plan; `planCode` se envía a `/api/v1/auth/register` y queda como intención `OrganisationSubscription` pending. Tras verificar el correo, si el plan no es free se abre el checkout MP.
- Chooser de alta de producto oculta/bloquea asistida en Free y avisa al chocar el cupo.
