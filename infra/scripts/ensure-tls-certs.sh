#!/usr/bin/env bash
# Create Let's Encrypt directory layout + a self-signed placeholder so nginx
# can bind :443 before the first real certificate is issued.
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${root}/.env"

if [[ -f "${env_file}" ]]; then
  while IFS= read -r line; do
    case "${line}" in
      TLS_DOMAIN=*) TLS_DOMAIN="${line#TLS_DOMAIN=}" ;;
      TLS_SERVER_NAMES=*) TLS_SERVER_NAMES="${line#TLS_SERVER_NAMES=}" ;;
    esac
  done < <(grep -E '^(TLS_DOMAIN|TLS_SERVER_NAMES)=' "${env_file}" || true)
fi

domain="${TLS_DOMAIN:?Set TLS_DOMAIN in .env (e.g. tenda-app.com)}"
live_dir="${root}/data/letsencrypt/live/${domain}"
archive_dir="${root}/data/letsencrypt/archive/${domain}"
www_dir="${root}/data/certbot-www"

mkdir -p "${live_dir}" "${archive_dir}" "${www_dir}"

if [[ -f "${live_dir}/fullchain.pem" && -f "${live_dir}/privkey.pem" ]]; then
  echo "TLS certs already present for ${domain}"
  exit 0
fi

echo "Creating self-signed placeholder certificate for ${domain}"
openssl req -x509 -nodes -newkey rsa:2048 -days 7 \
  -keyout "${archive_dir}/privkey.pem" \
  -out "${archive_dir}/fullchain.pem" \
  -subj "/CN=${domain}"

ln -sfn "../../archive/${domain}/fullchain.pem" "${live_dir}/fullchain.pem"
ln -sfn "../../archive/${domain}/privkey.pem" "${live_dir}/privkey.pem"
chmod 640 "${archive_dir}/privkey.pem" "${archive_dir}/fullchain.pem"
printf 'placeholder\n' >"${live_dir}/.tenda-placeholder"
echo "Placeholder ready at data/letsencrypt/live/${domain}/"
echo "Next: ./infra/scripts/issue-letsencrypt.sh"
