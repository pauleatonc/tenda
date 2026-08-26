# ADR 0001: baseline técnico del MVP

- Estado: aceptado
- Fecha: 2026-08-24

## Contexto

Los documentos de Tenda describen dos stacks distintos. El Documento 03 fija
la autoridad documental y sustituye las decisiones anteriores de Next.js,
Strawberry, Apollo y WeasyPrint.

## Decisión

- Backend: Python 3.12, Django 5.2 LTS, Graphene-Django y ASGI.
- Dependencias Python: uv con versiones directas exactas y `uv.lock`.
- Web: React, Vite, React Router, TanStack Query/Table, React Hook Form y Zod.
- Mobile: Expo, Expo Router, TanStack Query y SecureStore.
- Dependencias JavaScript: pnpm 10 con `pnpm-lock.yaml`.
- Persistencia: PostgreSQL 17; Redis solo como broker, caché o coordinación.
- Asincronía: Celery worker y beat; los vencimientos siguen persistidos en
  PostgreSQL.
- Despliegue inicial: imágenes Docker detrás de Nginx.
- Moneda MVP: CLP entero; zona horaria inicial `America/Santiago`.
- La Etapa 4 queda fuera del MVP. `AGENT_FEATURE_STATUS=coming_soon` solo
  habilita copy y controles desactivados.

## Consecuencias

- El schema GraphQL del backend es la fuente canónica y el cliente TypeScript se
  genera en CI.
- Web y mobile comparten contratos, no componentes visuales.
- Las integraciones externas se implementan detrás de interfaces con un fake
  determinista.
- No se introduce pgvector, app `agent`, cola `agent` ni llamadas a modelos.
- Node local debe ser 20.19.4 o superior; CI usa una rama Node soportada.
