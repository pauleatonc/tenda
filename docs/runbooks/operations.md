# Runbook de operación y recuperación

Este runbook cubre T0.8. No convierte los defaults de desarrollo en una
aprobación de Producción: dominios, credenciales, retención, R2, Brevo,
Google y Mercado Pago deben validarse por ambiente.

## Topología y exposición

- PostgreSQL y Redis viven únicamente en la red privada de Compose y no
  publican puertos.
- Solo Nginx publica HTTP/HTTPS en el VPS App.
- Uptime Kuma, Netdata Parent y Portainer Server viven en el VPS Ops.
- Netdata Child y Portainer Agent viven en el VPS App.
- Los puertos de paneles y agentes se enlazan exclusivamente a las IP de
  WireGuard. El firewall debe permitirlos solo entre `10.42.0.1` y
  `10.42.0.2`.
- No se debe publicar 3001, 19999, 9001 ni 9443 en la interfaz pública.

Las plantillas WireGuard están en `infra/ops/`. Las claves privadas se crean
en cada host, fuera del repositorio. Una vez activo el túnel:

```bash
sudo wg show
ping -c 3 10.42.0.1
ping -c 3 10.42.0.2
```

## Monitoreo externo

1. Copiar las plantillas Netdata fuera del repositorio, generar un UUID
   aleatorio como API key, reemplazar IP/key y aplicar permisos `0600`.
2. En VPS Ops:

   ```bash
   OPS_WIREGUARD_IP=10.42.0.1 \
   NETDATA_PARENT_STREAM_CONFIG=/etc/tenda/netdata-parent-stream.conf \
   docker compose -f infra/compose.ops.yaml up -d
   ```

3. En VPS App:

   ```bash
   APP_WIREGUARD_IP=10.42.0.2 \
   NETDATA_CHILD_STREAM_CONFIG=/etc/tenda/netdata-child-stream.conf \
   PORTAINER_AGENT_SECRET='<secreto-fuera-de-git>' \
   docker compose -f infra/compose.ops-agents.yaml up -d
   ```

4. En Uptime Kuma crear, como mínimo:
   - HTTPS `https://DOMINIO/health/live/`, intervalo 60 s.
   - HTTPS `https://DOMINIO/health/ready/`, intervalo 60 s.
   - Alerta tras dos fallos y recuperación posterior.
   - Notificación hacia un canal operado fuera del VPS App.
5. Detener Nginx de forma controlada en Dev y comprobar que Kuma alerta desde
   VPS Ops. Registrar hora de caída, detección y recuperación.

## Imágenes y despliegue

`Publish images` se ejecuta únicamente después de CI verde. Publica backend,
web y backup en GHCR con el SHA completo, SBOM y provenance. El workflow
manual `Deploy` usa ambientes protegidos y exige ese SHA.

En el host, `infra/scripts/deploy.sh`:

1. rechaza tags mutables;
2. serializa despliegues con `flock`;
3. valida Compose y descarga las imágenes exactas;
4. crea un backup cifrado salvo excepción explícita de Dev;
5. ejecuta migraciones como tarea one-shot;
6. reemplaza servicios y espera readiness;
7. restaura el último set de imágenes si readiness falla.

El rollback de imagen no revierte esquema. Toda migración desplegada debe ser
compatible hacia atrás durante una versión. Si no lo es, detener el despliegue
y usar el procedimiento de restore aprobado.

## Backup cifrado off-site

El contenedor de backup usa `pg_dump` 17, cifra antes de transmitir con `age`
y carga el artefacto y su SHA-256 a un bucket R2 privado. Configurar:

- credenciales R2 de mínimo privilegio, limitadas al prefijo de backup;
- `BACKUP_R2_BUCKET` y `BACKUP_R2_PREFIX`;
- `BACKUP_AGE_RECIPIENT`, que es la clave pública;
- lifecycle/retención del bucket aprobados por negocio.

Generar la identidad en una estación segura:

```bash
age-keygen -o backup-age.key
chmod 0600 backup-age.key
```

Guardar la identidad privada fuera de ambos VPS y en el gestor de secretos.
Solo el recipient público se instala en VPS App.

Backup manual:

```bash
docker compose \
  -f infra/compose.prod.yaml \
  --profile operations run --rm backup
```

Conservar de la salida `backup_object_key` y `backup_sha256`. Nunca registrar
contraseñas, claves privadas ni el archivo descifrado.

## Ensayo de restauración

El restore es destructivo y requiere dos confirmaciones. Se ensaya contra una
base descartable, no contra Producción:

```bash
docker compose -f infra/compose.prod.yaml exec postgres \
  createdb -U tenda tenda_restore_drill

POSTGRES_DB=tenda_restore_drill \
BACKUP_OBJECT_KEY='PREFIJO/postgres/ARCHIVO.dump.age' \
BACKUP_AGE_IDENTITY_PATH='/ruta/segura/backup-age.key' \
RESTORE_ALLOW_OVERWRITE=true \
RESTORE_CONFIRM_DATABASE=tenda_restore_drill \
docker compose \
  -f infra/compose.prod.yaml \
  --profile restore run --rm restore

POSTGRES_DB=tenda_restore_drill \
docker compose \
  -f infra/compose.prod.yaml \
  run --rm migrate
```

Después ejecutar checks y un smoke de login/tenant contra la base restaurada,
comparar conteos críticos y eliminar la base de ensayo. La evidencia debe
registrar fecha, object key, SHA-256, duración, migraciones y resultado del
smoke. Sin un ensayo aprobado, el go-live queda bloqueado.

## Django Admin

Es el mantenedor general de los modelos del backend (identidad, catálogo, ventas,
despachos, configuración, auditoría y notificaciones). Los ledgers append-only
(movimientos de stock, líneas de tiempo, auditoría) se pueden crear y consultar,
no reescribir ni borrar. Pedidos, envíos, tickets y devoluciones no se eliminan.

- En local: `http://localhost:8000/admin/` con un superusuario
  (`manage.py createsuperuser`).
- Cambiar `DJANGO_ADMIN_PATH` por un prefijo `control-*` no predecible.
- Configurar `DJANGO_ADMIN_ALLOWED_NETWORKS` con la red WireGuard.
- Activar `DJANGO_ADMIN_TRUST_X_FORWARDED_FOR=true` solo detrás del Nginx
  versionado.
- Entregar `is_staff` únicamente a soporte autorizado; cuentas normales y
  operadores no lo reciben.
- Los intentos de login se limitan de forma durable. Credenciales y tokens
  cifrados no aparecen en formularios Admin.
- Aplicar MFA/SSO en la capa de acceso del proveedor antes de Producción si
  está disponible; no publicar Admin directamente a Internet.

## Incidente mínimo

1. Confirmar la alerta desde VPS Ops y revisar correlation ID en Nginx,
   Django y Sentry.
2. Verificar `/health/live/` y `/health/ready/` por separado.
3. No reiniciar PostgreSQL ni ejecutar restore antes de preservar evidencia.
4. Para regresión de aplicación, redeplegar el último SHA bueno.
5. Para corrupción/pérdida de datos, declarar ventana, seleccionar backup por
   checksum y seguir el restore ensayado.
6. Documentar causa, impacto, tiempos, acciones y seguimiento.
