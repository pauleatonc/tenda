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
  BACKUP_OBJECT_KEY
  BACKUP_AGE_IDENTITY_FILE
)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required restore setting: ${name}" >&2
    exit 64
  fi
done

if [[ "${RESTORE_ALLOW_OVERWRITE:-false}" != "true" ]]; then
  echo "Set RESTORE_ALLOW_OVERWRITE=true for this destructive operation." >&2
  exit 64
fi
if [[ "${RESTORE_CONFIRM_DATABASE:-}" != "${POSTGRES_DB}" ]]; then
  echo "RESTORE_CONFIRM_DATABASE must exactly match POSTGRES_DB." >&2
  exit 64
fi
if [[ ! -f "${BACKUP_AGE_IDENTITY_FILE}" || ! -r "${BACKUP_AGE_IDENTITY_FILE}" ]]; then
  echo "The age identity file is not readable." >&2
  exit 64
fi

encrypted="/work/restore.dump.age"
checksum="/work/restore.dump.age.sha256"
dump="/work/restore.dump"
rclone_config="/work/rclone.conf"

cleanup() {
  rm -f "${encrypted}" "${checksum}" "${dump}" "${rclone_config}"
}
trap cleanup EXIT

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
  copyto "r2:${BACKUP_R2_BUCKET}/${BACKUP_OBJECT_KEY}" "${encrypted}"
rclone \
  --config "${rclone_config}" \
  copyto "r2:${BACKUP_R2_BUCKET}/${BACKUP_OBJECT_KEY}.sha256" "${checksum}"

expected="$(tr -d '[:space:]' <"${checksum}")"
actual="$(sha256sum "${encrypted}" | awk '{print $1}')"
if [[ -z "${expected}" || "${actual}" != "${expected}" ]]; then
  echo "Backup checksum verification failed." >&2
  exit 65
fi

age \
  --decrypt \
  --identity "${BACKUP_AGE_IDENTITY_FILE}" \
  --output "${dump}" \
  "${encrypted}"

export PGPASSWORD="${POSTGRES_PASSWORD}"
pg_restore \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT:-5432}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --exit-on-error \
  "${dump}"

echo "restore_completed_database=${POSTGRES_DB}"
echo "restore_source=${BACKUP_OBJECT_KEY}"
