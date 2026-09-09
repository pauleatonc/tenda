#!/bin/sh
set -e
cd /repo

LOCK=pnpm-lock.yaml
MARKER=node_modules/.modules.yaml
if [ ! -f "$MARKER" ] || [ "$LOCK" -nt "$MARKER" ]; then
  pnpm install --frozen-lockfile --filter @tenda/web... --filter @tenda/mobile...
fi
if [ ! -f packages/api-client/dist/index.js ] \
  || [ packages/api-client/src/generated/graphql.ts -nt packages/api-client/dist/index.js ]; then
  pnpm --filter @tenda/api-client build
fi

exec "$@"
