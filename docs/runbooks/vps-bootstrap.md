# Bootstrap VPS App (tenda-app.com)

Guía para el primer host de aplicación (~**8 GB RAM**). El CD no hardcodea
IP: los secrets viven en el Environment `production` de GitHub.

## Qué queda expuesto a Internet

| Puerto    | Quién    | Notas                                                |
| --------- | -------- | ---------------------------------------------------- |
| `22/tcp`  | Operador | Idealmente restringido a tu IP (`OPERATOR_SSH_CIDR`) |
| `80/tcp`  | Público   | ACME (Let's Encrypt) + redirect a HTTPS              |
| `443/tcp` | Público  | TLS en origen (nginx + Let's Encrypt)                |

Postgres (`5432`), Redis (`6379`), backend (`8000`) y Celery **no** publican
puertos. Solo viven en la red Docker `private`.

Verificar después del deploy:

```bash
ss -tlnp
docker compose -f infra/compose.prod.yaml ps
```

Solo deben escucharse `:22`, `:80` y `:443` en interfaces públicas.

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

   | Tipo       | Nombre                    | Valor                                                                  |
   | ---------- | ------------------------- | ---------------------------------------------------------------------- |
   | secret     | `DEPLOY_SSH_PRIVATE_KEY`  | clave ed25519 del deploy                                               |
   | secret     | `DEPLOY_KNOWN_HOSTS`      | salida de `ssh-keyscan`                                                |
   | secret     | `DEPLOY_HOST`             | IP o hostname del VPS                                                  |
   | secret     | `DEPLOY_USER`             | `deploy`                                                               |
   | secret     | `DEPLOY_PATH`             | `/opt/tenda/app`                                                       |
   | var        | `TENDA_READY_URL`         | `http://127.0.0.1/health/ready/` (probe local por :80; HTTPS es público) |
   | var (repo) | `VITE_TURNSTILE_SITE_KEY` | site key pública                                                       |
   | var (repo) | `VITE_GA_MEASUREMENT_ID`  | opcional                                                               |

5. DNS: A/AAAA `tenda-app.com` (y opcional `www`) → IP del VPS (GoDaddy u otro).
6. En `.env`: `TLS_DOMAIN`, `TLS_SERVER_NAMES`, `TLS_CERTBOT_EMAIL`.
7. Primer deploy: Actions → **Deploy** → `workflow_dispatch` con el SHA de un
   **Publish images** exitoso, o push a `main` (CI → images → deploy automático).
8. En el VPS, emitir el certificado real:

```bash
cd /home/tenda/app   # o tu DEPLOY_PATH
sudo ufw allow 443/tcp
./infra/scripts/issue-letsencrypt.sh
curl -fsS https://tenda-app.com/health/ready/
```

Renovación (cron mensual, como `tenda`):

```bash
mkdir -p /home/tenda/logs
crontab -e
# 15 4 1 * * cd /home/tenda/app && ./infra/scripts/issue-letsencrypt.sh >>/home/tenda/logs/tls-renew.log 2>&1
```

## Firewall

`bootstrap-vps.sh` deja ufw con deny incoming, allow `22`, `80` y `443`.

Admin Django: `DJANGO_ADMIN_ALLOWED_NETWORKS` solo WireGuard/IP admin, nunca
`0.0.0.0/0`.

## Memoria (VPS 8 GB)

Límites en `infra/compose.prod.yaml` (~3.2G de stack + ~2–2.5G SO/cache):

| Servicio      | Límite                         |
| ------------- | ------------------------------ |
| postgres      | 1536M (`shared_buffers=256MB`) |
| redis         | 128M (`--maxmemory 128mb`)     |
| backend       | 512M                           |
| celery_worker | 768M                           |
| celery_beat   | 256M                           |
| nginx         | 64M                            |

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
