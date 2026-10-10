#!/bin/sh
set -eu

domain="${TLS_DOMAIN:?TLS_DOMAIN is required}"
server_names="${TLS_SERVER_NAMES:-${domain}}"

sed \
  -e "s/__TLS_DOMAIN__/${domain}/g" \
  -e "s/__TLS_SERVER_NAMES__/${server_names}/g" \
  /etc/nginx/nginx.conf.template >/tmp/nginx.conf

exec /docker-entrypoint.sh nginx -c /tmp/nginx.conf -g 'daemon off;'
