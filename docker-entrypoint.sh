#!/bin/sh
set -e

echo "[entrypoint] applying database schema (prisma db push)..."
# Sync the Prisma schema to the database. Idempotent: safe to run on every boot.
# --skip-generate: client is already generated at build time.
# --accept-data-loss is intentionally NOT used; push only adds missing tables/columns.
cd /app/apps/server && npx prisma db push --skip-generate

echo "[entrypoint] starting server..."
exec pnpm --filter @focusscrum/server exec tsx src/index.ts
