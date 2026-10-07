# @tenda/analytics

Catálogo compartido de eventos GA4 para web (`gtag`) y mobile (Firebase Analytics → misma property).

## Configuración GA4 (checklist admin)

1. Crear una **property GA4** en [Google Analytics](https://analytics.google.com/).
2. Añadir un **web stream** y copiar el Measurement ID (`G-…`).
3. Crear un proyecto **Firebase**, enlazarlo a la misma property GA4.
4. Registrar apps **Android** (`cl.tenda.app`) e **iOS**; descargar:
   - `google-services.json` → `frontend/mobile/` (gitignored)
   - `GoogleService-Info.plist` → `frontend/mobile/` (gitignored)
5. En EAS, subir esos archivos como secretos/files del build.
6. Definir custom dimensions / event-scoped params:
   - `payment_method`, `delivery_mode`, `sale_source`, `product_create_mode`
   - User-scoped: `organisation_id`, `role`, `has_bank_details`, `has_mercadopago`
7. Marcar como **key events**:
   - `sale_link_published`
   - `buyer_checkout_completed`
   - `buyer_proof_uploaded`
   - `buyer_mp_redirect`
   - `activation_completed`
8. Crear explorations:
   - Registro → `email_verified` → `product_created` → payments setup → `sale_link_published`
   - `buyer_offer_viewed` → checkout → MP redirect **o** proof upload
9. Validar en **DebugView** (web: extensión GA Debugger / `debug_mode`; mobile: Firebase DebugView). Confirmar que **no** llegan RUT, email, tokens ni números de cuenta.

## Variables de entorno

| Variable | Dónde | Uso |
|----------|--------|-----|
| `VITE_GA_MEASUREMENT_ID` | web / Docker / compose | Measurement ID del stream web. Vacío = no-op (sin scripts). |

## Privacidad

- Web: Consent Mode v2 + banner; `analytics_storage` denegado hasta aceptar.
- No enviar PII en params de eventos.
- `user_id` = UUID interno del viewer.

## Mobile / Expo

- Sin `google-services*` el cliente hace **no-op** (Expo Go OK).
- `frontend/mobile/app.config.js` declara plugins `@react-native-firebase/*` y rutas a los archivos de Google Services.
- Validar analytics en **EAS build / dev client**, no en Expo Go.
