#!/bin/sh
set -e
cd /repo

if [ ! -f node_modules/.modules.yaml ]; then
  pnpm install --frozen-lockfile --filter @tenda/web... --filter @tenda/mobile...
fi
if [ ! -f packages/api-client/dist/index.js ]; then
  pnpm --filter @tenda/api-client build
fi

exec "$@"
