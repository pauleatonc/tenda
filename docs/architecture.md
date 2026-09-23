# Arquitectura y mapa del repositorio

Tenda es un monorepo del MVP (Etapas 0–3). El backend Django, la web React,
la app Expo y el cliente GraphQL generado viven juntos. La Etapa 4 (agente de
inventario) no está implementada: solo hay copy y controles desactivados con
`AGENT_FEATURE_STATUS=coming_soon`.

## Cómo se relaciona el código

```
Navegador / Expo
    │  cookie HttpOnly + CSRF  (web)
    │  bearer hasheado         (mobile)
    ▼
Nginx (único puerto público en Dev/Prod)
    ├─ estáticos de frontend/web
    └─ proxy → Django ASGI (GraphQL, REST público, health)
                ├─ PostgreSQL 17  (estado durable)
                ├─ Redis 7        (broker/caché, no fuente de negocio)
                └─ Celery worker + beat (outbox, expiración de reservas, jobs)
```

Las pantallas no hablan SQL. Web y mobile llaman operaciones GraphQL o REST
públicas. El schema canónico sale de Django; TypeScript se genera en
`packages/api-client`.

## Árbol del repositorio

```
app/
├── backend/                 Monolito modular Django 5.2
│   ├── apps/
│   │   ├── users/           Identidad, CSRF, rate limit, sesiones mobile
│   │   ├── organisations/   Tenant, membresías, permisos
│   │   ├── configuration/   Feature flags y OperationalParameter
│   │   ├── audit/           AuditEvent y export del schema GraphQL
│   │   ├── media_assets/    Uploads validados; R2: {env}/organisations/…
│   │   ├── notifications/   Outbox de email (Brevo o fake)
│   │   ├── inventory/       Catálogo, stock inmutable, import/export
│   │   ├── sales/           Pedidos, pagos, balance comercial
│   │   └── shipping/        Envíos: registro de despacho/entrega y etiqueta interna
│   ├── tenda/               Settings Local/Dev/Prod, seguridad, ASGI
│   └── tests/               pytest contra PostgreSQL cuando hay HOST
├── frontend/
│   ├── web/                 React, Vite, React Router, TanStack
│   │   └── src/
│   │       ├── auth/        Login, registro, recuperación
│   │       ├── app/         Shell autenticado y dashboard
│   │       ├── inventory/   Listado, ficha, import/export, media
│   │       ├── sales/       Ventas, pagos, balances
│   │       ├── shipping/    Despachos del vendedor (registrar y notificar)
│   │       ├── public/      Checkout, comprobante y estado del pedido
│   │       ├── components/  Primitivas accesibles (modal, upload, chips)
│   │       └── lib/         HTTP, CSRF, GraphQL
│   └── mobile/              Expo Router
│       ├── app/(auth)/      Login y registro
│       ├── app/(app)/       Tabs: inicio, inventario, ventas, despachos, más
│       ├── components/      UI nativa compartida
│       └── .maestro/        Smoke Maestro del journey autenticado
├── packages/api-client/     schema.graphql + tipos/operaciones generadas
├── e2e/web/                 Playwright del journey + axe WCAG
├── infra/
│   ├── compose.yaml         Local (reload: API 8000, Vite 5173, Metro 8081)
│   ├── compose.dev.yaml     Dev (tenda.settings.dev)
│   ├── compose.prod.yaml    Prod (secrets, read-only, AGENT off)
│   ├── compose.e2e.yaml     Solo Postgres/Redis publicados para el host
│   ├── compose.ops.yaml     Uptime Kuma, Netdata Parent, Portainer (VPS Ops)
│   ├── compose.ops-agents.yaml  Netdata Child y Portainer Agent (VPS App)
│   ├── nginx/               TLS/headers hacia backend y web
│   ├── backup/              Imagen pg_dump 17 + age
│   ├── scripts/             deploy.sh, backup y restore
│   └── ops/                 Plantillas WireGuard y Netdata
├── docs/
│   ├── architecture.md      Este mapa
│   ├── go-live.md           Matriz de Producción y bloqueos humanos
│   ├── accessibility.md     axe + checklist WCAG 2.2 AA
│   ├── runbooks/operations.md  Backup, restore, Kuma, Admin, incidentes
│   ├── adr/                 Decisiones (stack, invariantes)
│   └── implementation-status.md  Checkpoint por paquete T0–T3.7
└── .github/workflows/       CI, publicación GHCR, deploy protegido
```

## Backend: una app por dominio

Cada app Django concentra modelo, servicios, selectores y adaptadores
GraphQL/REST. Las vistas y resolvers no contienen reglas de negocio. Los
identificadores públicos son UUID; las PK internas no salen por la API.

| App             | Responsabilidad principal                                           |
| --------------- | ------------------------------------------------------------------- |
| `users`         | Email, verificación, OIDC fake, CSRF, rate limit durable            |
| `organisations` | Tienda, inventario activo, roles y permisos                   |
| `configuration` | Parámetros versionados (reserva, revisión de comprobante)           |
| `audit`         | Trazas de operaciones críticas                                      |
| `media_assets`  | Presign/complete, propósito, tenant y tipo/tamaño                   |
| `notifications` | Outbox transaccional; el worker envía después del commit            |
| `inventory`     | Productos, movimientos inmutables, `available = on_hand - reserved` |
| `sales`         | Reserva 8 h, checkout público, comprobante, MP fake, balance        |
| `shipping`      | Shipment (pending → dispatched \| delivered), etiqueta PDF, correo  |

Settings:

- `tenda.settings.local` — desarrollo en host o Compose local.
- `tenda.settings.dev` — Compose Dev (debug, Turnstile real).
- `tenda.settings.prod` — HTTPS, cookies secure, Admin acotado a WireGuard.

## Frontend

La web autenticada vive bajo `/app/*`. Los flujos públicos no piden cuenta:

- Pedido: `/p/:token`, `/p/:token/comprar`, `/p/:token/comprobante`, `/p/:token/estado`

El despacho no tiene página pública: cuando el vendedor registra el despacho o
la entrega, el comprador recibe un correo con transportista, tracking y detalle
del pedido. No hay seguimiento, confirmación ni consultas posteriores.

Mobile replica las mismas operaciones con Expo Router y SecureStore. No comparte
componentes visuales con la web; sí comparte `@tenda/api-client`.

## Infraestructura y despliegue

Hay dos hosts previstos: **VPS App** (Nginx, Django, Celery, Postgres, Redis)
y **VPS Ops** (Kuma, Netdata Parent, Portainer). Se unen por WireGuard. Solo
Nginx publica HTTP/HTTPS. Postgres, Redis y paneles no salen a Internet.

### Local / Dev

```bash
cp .env.example .env
corepack pnpm install --frozen-lockfile
uv sync --project backend --frozen
docker compose -f infra/compose.yaml up --build
```

Web (Vite) en <http://localhost:5173>, Metro en <http://localhost:8081>, API en
<http://localhost:8000>. El código del host se monta y recarga solo. Django usa
`tenda.settings.local`. El proxy Nginx solo está en Dev/Prod. Para Dev:

```bash
docker compose -f infra/compose.dev.yaml up --build
```

Sin contenedores de aplicación, con Postgres/Redis publicados para el host:

```bash
docker compose -f infra/compose.e2e.yaml up -d
uv run --project backend python backend/manage.py migrate
uv run --project backend python backend/manage.py runserver
corepack pnpm dev:web
```

### Producción

1. CI verde (calidad + E2E Playwright/axe).
2. Workflow `Publish images` etiqueta backend, web y backup en GHCR con el SHA
   completo, SBOM y provenance. No hay tags `latest`.
3. Workflow `Deploy` (ambiente protegido) hace SSH al VPS App, checkout del
   mismo SHA y ejecuta `infra/scripts/deploy.sh`:
   - rechaza imágenes mutables;
   - `flock` para no solapar deploys;
   - backup cifrado salvo excepción explícita de Dev;
   - migración one-shot;
   - reemplazo de servicios y espera de `/health/ready/`;
   - rollback de imágenes si readiness falla (no revierte esquema).

Detalle operativo: `docs/runbooks/operations.md`. Matriz de secretos y
bloqueos humanos: `docs/go-live.md`.

## Pruebas

| Capa         | Dónde                           | Comando                                            |
| ------------ | ------------------------------- | -------------------------------------------------- |
| Backend      | `backend/tests`                 | `uv run --project backend pytest`                  |
| Web unit     | `frontend/web/src/**/__tests__` | `pnpm --filter @tenda/web test`                    |
| Mobile unit  | `frontend/mobile/**/__tests__`  | `pnpm --filter @tenda/mobile test`                 |
| E2E web      | `e2e/web/tests`                 | `pnpm test:e2e`                                    |
| A11y         | axe en Playwright               | incluido en `pnpm test:e2e`                        |
| Mobile smoke | `frontend/mobile/.maestro`      | `maestro test frontend/mobile/.maestro/smoke.yaml` |

El journey E2E cubre
login → inventario → venta → pago con comprobante → balance → registro de
despacho. Reutiliza el owner `e2e.owner@tenda.test` creado por
`prepare_e2e_journey`, que también limpia buckets de rate limit de auth para
no bloquear corridas repetidas contra la misma base.
