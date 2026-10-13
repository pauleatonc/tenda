#!/usr/bin/env bash
# Issue (or renew) a Let's Encrypt certificate via HTTP-01 webroot, then reload nginx.
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${root}/.env"
compose=(
  docker compose
  --project-name tenda-prod
  --env-file "${env_file}"
  --file "${root}/infra/compose.prod.yaml"
  --profile tls
)

if [[ ! -f "${env_file}" ]]; then
  echo "Missing ${env_file}" >&2
  exit 64
fi

while IFS= read -r line; do
  case "${line}" in
    TLS_DOMAIN=*) TLS_DOMAIN="${line#TLS_DOMAIN=}" ;;
    TLS_SERVER_NAMES=*) TLS_SERVER_NAMES="${line#TLS_SERVER_NAMES=}" ;;
    TLS_CERTBOT_EMAIL=*) TLS_CERTBOT_EMAIL="${line#TLS_CERTBOT_EMAIL=}" ;;
  esac
done < <(grep -E '^(TLS_DOMAIN|TLS_SERVER_NAMES|TLS_CERTBOT_EMAIL)=' "${env_file}" || true)

domain="${TLS_DOMAIN:?Set TLS_DOMAIN in .env}"
email="${TLS_CERTBOT_EMAIL:?Set TLS_CERTBOT_EMAIL in .env}"
server_names="${TLS_SERVER_NAMES:-${domain}}"
live_dir="${root}/data/letsencrypt/live/${domain}"

if [[ -f "${live_dir}/.tenda-placeholder" ]]; then
  echo "Removing self-signed placeholder so Certbot can issue a real certificate"
  rm -rf "${live_dir}" "${root}/data/letsencrypt/archive/${domain}"
fi

domain_args=()
# shellcheck disable=SC2086
for name in ${server_names}; do
  domain_args+=(-d "${name}")
done

"${compose[@]}" run --rm --entrypoint certbot certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --cert-name "${domain}" \
  --email "${email}" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  --keep-until-expiring \
  "${domain_args[@]}"

"${compose[@]}" exec nginx nginx -c /tmp/nginx.conf -s reload
echo "Issued/renewed certificate for: ${server_names}"
echo "Verify: curl -fsS https://${domain}/health/ready/"
