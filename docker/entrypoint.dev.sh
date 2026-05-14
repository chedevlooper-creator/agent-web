#!/bin/sh
set -e

if [ ! -d node_modules/.pnpm ]; then
  echo ">> Installing dependencies (first run)..."
  pnpm install
fi

if [ ! -f packages/core/dist/index.js ] || [ ! -f packages/db/dist/index.js ]; then
  echo ">> Building workspace packages..."
  pnpm --filter @agent-web/core build
  pnpm --filter @agent-web/db build
fi

mkdir -p packages/db/data

exec "$@"
