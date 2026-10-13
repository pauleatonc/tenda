#!/usr/bin/env bash
# Idempotent bootstrap for the Tenda app VPS (8 GB starter).
# Run as root or with sudo. Does not write secrets; copy .env yourself.
set -Eeuo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/tenda/app}"
REPO_URL="${REPO_URL:-}"
OPERATOR_SSH_CIDR="${OPERATOR_SSH_CIDR:-}"

log() { printf '%s\n' "$*"; }

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (or via sudo)." >&2
  exit 64
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl git ufw rsync jq

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends docker-compose-plugin
fi

if ! id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${DEPLOY_USER}"
fi
usermod -aG docker "${DEPLOY_USER}"

mkdir -p "${DEPLOY_PATH}" /var/lib/tenda-deploy /var/lock
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${DEPLOY_PATH}" /var/lib/tenda-deploy

if [[ -n "${REPO_URL}" && ! -d "${DEPLOY_PATH}/.git" ]]; then
  sudo -u "${DEPLOY_USER}" git clone "${REPO_URL}" "${DEPLOY_PATH}"
fi

mkdir -p "${DEPLOY_PATH}/data/web-dist" "${DEPLOY_PATH}/secrets"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${DEPLOY_PATH}/data" "${DEPLOY_PATH}/secrets"
chmod 0700 "${DEPLOY_PATH}/secrets"

# Firewall: only SSH (+ optional operator CIDR) and HTTP 80.
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
if [[ -n "${OPERATOR_SSH_CIDR}" ]]; then
  ufw allow from "${OPERATOR_SSH_CIDR}" to any port 22 proto tcp comment 'ssh-operator'
else
  ufw allow OpenSSH
  log "WARN: OPERATOR_SSH_CIDR unset; SSH open to world (key-only still required)."
fi
ufw allow 80/tcp comment 'http-acme-and-redirect'
ufw allow 443/tcp comment 'https-origin'
ufw --force enable
ufw status verbose

log ""
log "Bootstrap complete."
log "Next:"
log "  1. sudo -u ${DEPLOY_USER} -H docker login ghcr.io"
log "  2. cp ${DEPLOY_PATH}/.env.production.example ${DEPLOY_PATH}/.env  # fill secrets"
log "  3. Configure GitHub Environment 'production' secrets/vars (DEPLOY_*, TENDA_READY_URL)"
log "  4. DNS A/AAAA tenda-app.com → this host"
log "  5. Trigger Deploy, then run ${DEPLOY_PATH}/infra/scripts/issue-letsencrypt.sh"
log "Verify public listeners: ss -tlnp | grep -E ':22|:80|:443'"
log "Memory budget (8 GB): see docs/runbooks/vps-bootstrap.md"
