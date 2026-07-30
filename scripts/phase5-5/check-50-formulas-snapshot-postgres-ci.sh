#!/usr/bin/env bash
set -Eeuo pipefail

CONTAINER_NAME="tcdx-phase5-5-snapshot-${RANDOM}-${RANDOM}"
PORT="${PHASE5_5_SNAPSHOT_PG_PORT:-55439}"
cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tcdx_phase5_snapshot \
  -p "${PORT}:5432" \
  postgres:16-alpine >/dev/null

for attempt in $(seq 1 45); do
  if docker exec "$CONTAINER_NAME" pg_isready -U postgres -d tcdx_phase5_snapshot >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == "45" ]]; then
    echo "ERROR: PostgreSQL snapshot test did not become ready"
    docker logs "$CONTAINER_NAME" || true
    exit 1
  fi
  sleep 1
done

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PORT}/tcdx_phase5_snapshot"
export PHASE5_5_TEST_DATABASE_URL="$DATABASE_URL"
node scripts/phase5-5/check-50-formulas-snapshot-postgres.js
