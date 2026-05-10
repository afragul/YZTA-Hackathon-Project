#!/usr/bin/env bash
set -e

# 1. Run migrations and seed (idempotent)
echo "==> Running migrations and seeding..."
python -m app.db.bootstrap

# 2. Start the application
echo "==> Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"
