#!/bin/bash
set -e

echo "=== Agent Web — Dev Entrypoint ==="

# Ensure DB directory exists
mkdir -p /app/packages/db/data

# Run database migrations (auto-creates tables if needed)
echo "Running DB migrations..."
node -e "
  const { ensureMigrated } = require('@agent-web/db');
  ensureMigrated().then(() => console.log('Migrations complete.')).catch((e) => console.error('Migration error:', e));
" 2>/dev/null || echo "Migration step skipped (DB may not be ready yet)"

# Pre-build packages for dev (dist/ must exist for workspace links)
echo "Building workspace packages..."
cd /app
pnpm --filter @agent-web/core build 2>/dev/null || true
pnpm --filter @agent-web/db build 2>/dev/null || true

echo "Starting Next.js dev server..."
exec "$@"
