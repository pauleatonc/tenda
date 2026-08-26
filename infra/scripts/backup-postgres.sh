#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

required=(
  POSTGRES_DB
  POSTGRES_HOST
  POSTGRES_PASSWORD
  POSTGRES_USER
  R2_ENDPOINT_URL
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  BACKUP_R2_BUCKET
  BACKUP_AGE_RECIPIENT
)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required backup setting: ${name}" >&2
    exit 64
  fi
done

timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
prefix="${BACKUP_R2_PREFIX:-tenda/backups}"
prefix="${prefix#/}"
prefix="${prefix%/}"
name="${POSTGRES_DB}-${timestamp}.dump"
dump="/work/${name}"
encrypted="${dump}.age"
checksum="${encrypted}.sha256"
object_key="${prefix}/postgres/${name}.age"
rclone_config="/work/rclone.conf"

cleanup() {
  rm -f "${dump}" "${encrypted}" "${checksum}" "${rclone_config}"
}
trap cleanup EXIT

export PGPASSWORD="${POSTGRES_PASSWORD}"
pg_dump \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT:-5432}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="${dump}"

age --recipient "${BACKUP_AGE_RECIPIENT}" --output "${encrypted}" "${dump}"
sha256sum "${encrypted}" | awk '{print $1}' >"${checksum}"

cat >"${rclone_config}" <<EOF
[r2]
type = s3
provider = Cloudflare
access_key_id = ${R2_ACCESS_KEY_ID}
secret_access_key = ${R2_SECRET_ACCESS_KEY}
endpoint = ${R2_ENDPOINT_URL}
acl = private
EOF

rclone \
  --config "${rclone_config}" \
  copyto "${encrypted}" "r2:${BACKUP_R2_BUCKET}/${object_key}"
rclone \
  --config "${rclone_config}" \
  copyto "${checksum}" "r2:${BACKUP_R2_BUCKET}/${object_key}.sha256"

echo "backup_object_key=${object_key}"
echo "backup_sha256=$(<"${checksum}")"
