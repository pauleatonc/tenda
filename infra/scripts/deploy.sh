#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose=(
  docker compose
  --project-name tenda-prod
  --file "${root}/infra/compose.prod.yaml"
)
state_dir="${TENDA_DEPLOY_STATE_DIR:-/var/lib/tenda-deploy}"
state_file="${state_dir}/last-good.env"
lock_file="${TENDA_DEPLOY_LOCK_FILE:-/var/lock/tenda-deploy.lock}"

for name in TENDA_BACKEND_IMAGE TENDA_WEB_IMAGE TENDA_BACKUP_IMAGE TENDA_READY_URL; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required deploy setting: ${name}" >&2
    exit 64
  fi
done

immutable='(@sha256:[a-f0-9]{64}|:[a-f0-9]{40})$'
for image in "${TENDA_BACKEND_IMAGE}" "${TENDA_WEB_IMAGE}" "${TENDA_BACKUP_IMAGE}"; do
  if [[ ! "${image}" =~ ${immutable} ]]; then
    echo "Deployment images must use a digest or full Git SHA tag: ${image}" >&2
    exit 64
  fi
done

mkdir -p "${state_dir}" "$(dirname "${lock_file}")"
exec 9>"${lock_file}"
if ! flock --nonblock 9; then
  echo "Another Tenda deployment is already running." >&2
  exit 75
fi

previous_backend=""
previous_web=""
previous_backup=""
if [[ -f "${state_file}" ]]; then
  # This file is root-owned output from this script, never user input.
  # shellcheck disable=SC1090
  source "${state_file}"
  previous_backend="${LAST_GOOD_BACKEND_IMAGE:-}"
  previous_web="${LAST_GOOD_WEB_IMAGE:-}"
  previous_backup="${LAST_GOOD_BACKUP_IMAGE:-}"
fi

new_backend="${TENDA_BACKEND_IMAGE}"
new_web="${TENDA_WEB_IMAGE}"
new_backup="${TENDA_BACKUP_IMAGE}"

rollback_images() {
  if [[ -z "${previous_backend}" || -z "${previous_web}" ]]; then
    echo "No previous image set is available for automatic rollback." >&2
    return 1
  fi
  echo "Readiness failed; restoring the previous image set." >&2
  export TENDA_BACKEND_IMAGE="${previous_backend}"
  export TENDA_WEB_IMAGE="${previous_web}"
  export TENDA_BACKUP_IMAGE="${previous_backup:-${new_backup}}"
  "${compose[@]}" up --detach --no-build backend celery_worker celery_beat web nginx
}

export TENDA_BACKEND_IMAGE="${new_backend}"
export TENDA_WEB_IMAGE="${new_web}"
export TENDA_BACKUP_IMAGE="${new_backup}"

"${compose[@]}" config --quiet
"${compose[@]}" pull backend celery_worker celery_beat web backup

if [[ "${SKIP_PREDEPLOY_BACKUP:-false}" != "true" ]]; then
  "${compose[@]}" --profile operations run --rm backup
fi

"${compose[@]}" run --rm migrate
"${compose[@]}" up \
  --detach \
  --no-build \
  --remove-orphans \
  backend celery_worker celery_beat web nginx

ready=false
for _attempt in $(seq 1 "${TENDA_READY_ATTEMPTS:-30}"); do
  if curl \
    --fail \
    --silent \
    --show-error \
    --max-time 5 \
    "${TENDA_READY_URL}" >/dev/null; then
    ready=true
    break
  fi
  sleep "${TENDA_READY_INTERVAL_SECONDS:-5}"
done

if [[ "${ready}" != "true" ]]; then
  rollback_images || true
  exit 1
fi

temporary_state="${state_file}.tmp"
{
  printf 'LAST_GOOD_BACKEND_IMAGE=%q\n' "${new_backend}"
  printf 'LAST_GOOD_WEB_IMAGE=%q\n' "${new_web}"
  printf 'LAST_GOOD_BACKUP_IMAGE=%q\n' "${new_backup}"
  printf 'LAST_GOOD_DEPLOYED_AT=%q\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
} >"${temporary_state}"
chmod 0600 "${temporary_state}"
mv "${temporary_state}" "${state_file}"

echo "deployment_status=healthy"
echo "backend_image=${new_backend}"
echo "web_image=${new_web}"
