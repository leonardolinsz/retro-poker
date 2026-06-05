#!/bin/sh
set -e

echo "[entrypoint] ====================================="
echo "[entrypoint] NODE_ENV=$NODE_ENV  SERVE_STATIC=$SERVE_STATIC"
echo "[entrypoint] applying database schema (prisma db push)..."

cd /app/apps/server

# Neon/serverless Postgres can be slow to wake on the first connection.
# Retry db push a few times before giving up, and fail loudly if it never works.
ATTEMPTS=5
i=1
until npx prisma db push --skip-generate --accept-data-loss; do
  if [ "$i" -ge "$ATTEMPTS" ]; then
    echo "[entrypoint] ERROR: prisma db push failed after $ATTEMPTS attempts. Check DATABASE_URL." >&2
    exit 1
  fi
  echo "[entrypoint] db push failed (attempt $i/$ATTEMPTS), retrying in 3s..."
  i=$((i + 1))
  sleep 3
done

echo "[entrypoint] schema applied successfully."
echo "[entrypoint] starting server..."
exec pnpm --filter @focusscrum/server exec tsx src/index.ts
