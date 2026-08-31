# Tenda

Tenda es una aplicación web y móvil para microemprendedores: administra
inventario, reservas, ventas, pagos operativos, balances comerciales y
despachos. Este repositorio implementa el MVP definido en los documentos de la
raíz (Etapas 0–3).

El mapa de carpetas, el despliegue y el go-live están en:

- [`docs/architecture.md`](docs/architecture.md) — qué hay y dónde
- [`docs/go-live.md`](docs/go-live.md) — matriz de Producción y bloqueos
- [`docs/accessibility.md`](docs/accessibility.md) — axe y revisión WCAG
- [`docs/runbooks/operations.md`](docs/runbooks/operations.md) — backup, restore, Kuma
- [`docs/implementation-status.md`](docs/implementation-status.md) — checkpoint T0–T3.7

## Stack

- Django 5.2 LTS, Graphene-Django y Celery.
- PostgreSQL 17 y Redis 7.
- React, Vite, React Router y TanStack Query/Table.
- Expo, Expo Router y SecureStore.
- pnpm workspaces y uv con lockfiles versionados.
- Docker Compose y Nginx.

La Etapa 4 de IA no forma parte del MVP. La interfaz solo muestra controles
desactivados con el estado “Próximamente”.

## Requisitos

- Python 3.12 y [uv](https://docs.astral.sh/uv/).
- Node 20.19.4 o superior y Corepack.
- Docker 28 con Compose v2.

## Inicio rápido local

```bash
cp .env.example .env
corepack pnpm install --frozen-lockfile
uv sync --project backend --frozen
docker compose -f infra/compose.yaml up --build
```

Servicios locales (`tenda.settings.local`). El código del host se monta en
el contenedor: el backend recarga con uvicorn, la web con Vite y mobile con
Metro. No hay Nginx de borde. El navegador llama a la API en
`http://localhost:8000`.

- Web: <http://localhost:5173>
- Mobile (Metro): <http://localhost:8081>
- API GraphQL: <http://localhost:8000/graphql/>
- Django Admin: <http://localhost:8000/admin/>
- Live: <http://localhost:8000/health/live/>
- Ready: <http://localhost:8000/health/ready/>

Ambiente Dev (Django `tenda.settings.dev`):

```bash
docker compose -f infra/compose.dev.yaml up --build
```

Para ejecutar sin contenedores de aplicación (Postgres y Redis sí en Docker):

```bash
docker compose -f infra/compose.e2e.yaml up -d
export POSTGRES_HOST=localhost POSTGRES_PASSWORD=tenda-local
uv run --project backend python backend/manage.py migrate
uv run --project backend python backend/manage.py runserver
corepack pnpm dev:web
corepack pnpm dev:mobile
```

Django Admin es el mantenedor general de los modelos. Crear un superusuario:

```bash
uv run --project backend python backend/manage.py createsuperuser
```

En local la ruta es `/admin/`. En Producción el prefijo es `control-*` y la red
queda acotada; ver `docs/runbooks/operations.md`.

## Verificación

```bash
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm codegen
corepack pnpm build
corepack pnpm backend:check
corepack pnpm backend:migrations:check
corepack pnpm compose:config
```

`pnpm test` cubre unitarias y contrato. `pnpm test:e2e` levanta Django + Vite,
siembra `e2e.owner@tenda.test` y corre el journey Playwright más axe.

Smoke mobile (emulador o dispositivo, con el mismo owner):

```bash
uv run --project backend python backend/manage.py prepare_e2e_journey
maestro test frontend/mobile/.maestro/smoke.yaml
```

Las pruebas de concurrencia y constraints se ejecutan contra PostgreSQL real;
SQLite solo facilita pruebas unitarias que no dependen de esas garantías.

## Estructura

```
backend/                 Django: apps de users, organisations, inventory,
                         sales, shipping, media, notifications, audit,
                         configuration
frontend/web/            App autenticada (/app) y flujos públicos (/p, /s)
frontend/mobile/         Expo Router; smoke Maestro en .maestro/
packages/api-client/     Schema GraphQL canónico y cliente TypeScript
e2e/web/                 Playwright (journey + axe)
infra/                   Compose Local/Dev/Prod/Ops, Nginx, backup, deploy
docs/                    Arquitectura, go-live, a11y, ADR, runbooks, status
.github/workflows/       CI, imágenes GHCR, deploy protegido
```

Detalle por carpeta: [`docs/architecture.md`](docs/architecture.md).

## Configuración

`.env.example` enumera la configuración. Las credenciales externas son
opcionales en desarrollo: los paquetes funcionales usan adaptadores fake
deterministas hasta ejecutar los smokes reales de Producción.

No se deben versionar `.env`, tokens, credenciales OAuth, payloads sensibles ni
archivos privados de compradores.

## Operación y despliegue

- CI verifica formato, tipos, pruebas, codegen, E2E/axe, dependencias, secretos
  y Compose.
- Las imágenes GHCR se publican por SHA solo después de CI verde.
- El despliegue manual protegido ejecuta backup, migración one-shot, readiness
  y rollback de imágenes (`infra/scripts/deploy.sh`).
- Backup/restore, WireGuard, Kuma, Netdata, Portainer y endurecimiento de
  Django Admin: `docs/runbooks/operations.md`.
- Dominios, R2, Brevo, Mercado Pago real, cadencias y retención de Producción
  no están aprobados por este repositorio: `docs/go-live.md`.
