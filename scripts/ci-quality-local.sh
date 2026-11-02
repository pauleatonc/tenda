#!/usr/bin/env bash
# Mirror the GitHub Actions "quality" job (without Trivy / shellcheck / compose ops).
# Usage from repo root:
#   ./scripts/ci-quality-local.sh
# Skip frontend build (slow): SKIP_BUILD=1 ./scripts/ci-quality-local.sh
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${root}"

export AGENT_FEATURE_STATUS="${AGENT_FEATURE_STATUS:-coming_soon}"
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-tenda.settings.local}"
export DJANGO_SECRET_KEY="${DJANGO_SECRET_KEY:-ci-only-not-a-production-secret}"
# Isolate from the developer's Postgres/.env and use a fresh SQLite so
# makemigrations --check matches CI (empty DB), not a polluted local history.
unset POSTGRES_HOST POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD POSTGRES_PORT
ci_sqlite="${root}/backend/.ci-local-db.sqlite3"
rm -f "${ci_sqlite}"
export DJANGO_SQLITE_PATH="${ci_sqlite}"
cleanup_ci_sqlite() { rm -f "${ci_sqlite}"; }
trap cleanup_ci_sqlite EXIT

# Prefer Node 22 like CI when nvm is available.
if [[ -z "${SKIP_NVM:-}" ]] && [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "${HOME}/.nvm/nvm.sh"
  nvm install 22 >/dev/null
  nvm use 22 >/dev/null
fi
corepack enable
corepack prepare pnpm@10.34.5 --activate
# Fallback if local Node is still below package.json engines.
export npm_config_engine_strict=false

echo "==> Tool versions"
echo "node $(node -v) · pnpm $(pnpm -v) · uv $(uv --version)"

echo "==> Sync backend venv (uv)"
uv sync --project backend --frozen --group dev

echo "==> Install frontend deps (pnpm)"
pnpm install --frozen-lockfile --config.engineStrict=false

echo "==> Audit production dependencies"
pnpm audit --prod --audit-level moderate
uv export --project backend --frozen --no-dev --no-emit-project \
  --format requirements-txt --output-file /tmp/tenda-backend-requirements.txt
uv run --project backend pip-audit --requirement /tmp/tenda-backend-requirements.txt

echo "==> GraphQL client drift check"
pnpm codegen:check

echo "==> Backend quality"
pnpm lint:backend
pnpm backend:check
pnpm backend:migrations:check
uv run --project backend pytest -c backend/pyproject.toml backend

echo "==> Django deploy check"
DJANGO_SETTINGS_MODULE=tenda.settings.prod \
DJANGO_SECRET_KEY='ci-deploy-check-only-secret-key-with-more-than-fifty-characters' \
DJANGO_ALLOWED_HOSTS=example.com \
DJANGO_CSRF_TRUSTED_ORIGINS=https://example.com \
WEB_ORIGIN=https://app.example.com \
OUTBOX_ENCRYPTION_KEY=ci-outbox-encryption-key \
CREDENTIAL_ENCRYPTION_KEY=ci-credential-encryption-key \
DJANGO_ADMIN_PATH=control-ci-check \
DJANGO_ADMIN_ALLOWED_NETWORKS=10.42.0.0/24 \
DJANGO_ADMIN_TRUST_X_FORWARDED_FOR=true \
TURNSTILE_FAKE_MODE=false \
TURNSTILE_SECRET_KEY=ci-turnstile-secret-for-deploy-check \
uv run --project backend python backend/manage.py check --deploy

echo "==> Frontend quality"
pnpm format:check
pnpm lint:frontend
pnpm typecheck
pnpm test:frontend
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  pnpm build
else
  echo "(SKIP_BUILD=1 — skipping pnpm build)"
fi

echo "==> Compose config (app stacks)"
pnpm compose:config

echo
echo "OK: local quality checks passed (Trivy/shellcheck/ops-compose not included)."
echo "Backend venv: ${root}/backend/.venv"
echo "Activate: source backend/.venv/bin/activate"
