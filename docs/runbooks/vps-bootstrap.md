# Bootstrap VPS App (tenda-app.com)

Guía para el primer host de aplicación (~**8 GB RAM**). El CD no hardcodea
IP: los secrets viven en el Environment `production` de GitHub.

## Qué queda expuesto a Internet

| Puerto | Quién | Notas |
| ------ | ----- | ----- |
| `22/tcp` | Operador | Idealmente restringido a tu IP (`OPERATOR_SSH_CIDR`) |
| `80/tcp` | Cloudflare → nginx | TLS termina en Cloudflare (SSL Full). No abrir `443` en origen. |

Postgres (`5432`), Redis (`6379`), backend (`8000`) y Celery **no** publican
puertos. Solo viven en la red Docker `private`.

Verificar después del deploy:

```bash
ss -tlnp
docker compose -f infra/compose.prod.yaml ps
```

Solo deben escucharse `:22` y `:80` en interfaces públicas.

## Script

Como root en una Ubuntu reciente:

```bash
export DEPLOY_USER=deploy
export DEPLOY_PATH=/opt/tenda/app
export REPO_URL=git@github.com:ORG/tenda-app.git   # o HTTPS
export OPERATOR_SSH_CIDR=TU.IP.PUBLICA/32          # recomendado
sudo -E ./infra/scripts/bootstrap-vps.sh
```

Luego:

1. `sudo -u deploy -H docker login ghcr.io` (PAT con `read:packages`).
2. `cp .env.production.example .env` y completar secretos (chmod `0600`).
3. Crear `data/web-dist` (el script ya lo hace) y `secrets/backup-age.key` si aplica.
4. En GitHub → Settings → Environments → **production**:

   | Tipo | Nombre | Valor |
   | ---- | ------ | ----- |
   | secret | `DEPLOY_SSH_PRIVATE_KEY` | clave ed25519 del deploy |
   | secret | `DEPLOY_KNOWN_HOSTS` | salida de `ssh-keyscan` |
   | secret | `DEPLOY_HOST` | IP o hostname del VPS |
   | secret | `DEPLOY_USER` | `deploy` |
   | secret | `DEPLOY_PATH` | `/opt/tenda/app` |
   | var | `TENDA_READY_URL` | `https://tenda-app.com/health/ready/` |
   | var (repo) | `VITE_TURNSTILE_SITE_KEY` | site key pública |
   | var (repo) | `VITE_GA_MEASUREMENT_ID` | opcional |

5. DNS: A/AAAA `tenda-app.com` (y opcional `www`) → IP del VPS; proxy Cloudflare
   ON; modo SSL **Full**. Redirect `www` → apex en Cloudflare si aplica.
6. Primer deploy: Actions → **Deploy** → `workflow_dispatch` con el SHA de un
   **Publish images** exitoso, o push a `main` (CI → images → deploy automático).

## Firewall y Cloudflare

`bootstrap-vps.sh` deja ufw con deny incoming, allow `22` y `80`. Para acotar
HTTP a [IPs de Cloudflare](https://www.cloudflare.com/ips/):

```bash
# Ejemplo IPv4 (repetir por cada rango de la lista oficial)
ufw allow from 173.245.48.0/20 to any port 80 proto tcp comment 'cf'
ufw delete allow 80/tcp
```

Admin Django: `DJANGO_ADMIN_ALLOWED_NETWORKS` solo WireGuard/IP admin, nunca
`0.0.0.0/0`.

## Memoria (VPS 8 GB)

Límites en `infra/compose.prod.yaml` (~3.2G de stack + ~2–2.5G SO/cache):

| Servicio | Límite |
| -------- | ------ |
| postgres | 1536M (`shared_buffers=256MB`) |
| redis | 128M (`--maxmemory 128mb`) |
| backend | 512M |
| celery_worker | 768M |
| celery_beat | 256M |
| nginx | 64M |

Al subir a 16 GB: postgres → 2G, backend → 768M, celery_worker → 1G.

Monitorear la primera semana: `docker stats`, `dmesg | grep -i oom`.

## Pipeline

```text
push main → CI → Publish images (GHCR backend+backup + artifact web-dist)
              → Deploy production (rsync estáticos + deploy.sh)
```

- Front: estáticos en `data/web-dist`, servidos por nginx (`/var/www/tenda`).
- No hay contenedor `web` en prod.
- Rollback: imágenes anteriores + snapshot `web-dist.last-good` en
  `/var/lib/tenda-deploy`.
