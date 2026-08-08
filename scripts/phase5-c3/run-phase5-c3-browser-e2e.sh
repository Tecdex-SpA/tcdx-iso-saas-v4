#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
[[ "${PHASE5_C3_DB_PORT:-}" =~ ^[0-9]+$ && -n "${PHASE5_C3_DB_NAME:-}" ]] || { echo "Phase 5-C3 browser requires an isolated PostgreSQL fixture" >&2; exit 1; }
BACKEND_PORT=$((43000 + RANDOM % 1000))
FRONTEND_PORT=$((44000 + RANDOM % 1000))
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tcdx-c3-browser.XXXXXX")"
backend_pid=''; frontend_pid=''
cleanup() {
  local code=$?
  trap - EXIT INT TERM
  [[ -n "$frontend_pid" ]] && kill "$frontend_pid" >/dev/null 2>&1 || true
  [[ -n "$backend_pid" ]] && kill "$backend_pid" >/dev/null 2>&1 || true
  if (( code != 0 )); then
    tail -80 "$RUN_DIR/backend.log" >&2 || true
    tail -40 "$RUN_DIR/frontend.log" >&2 || true
  fi
  rm -rf "$RUN_DIR"
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

(cd "$REPO_ROOT/backend" && DB_HOST=127.0.0.1 DB_PORT="$PHASE5_C3_DB_PORT" DB_USER=postgres DB_NAME="$PHASE5_C3_DB_NAME" JWT_SECRET=phase5-c3-local-only CORS_ORIGIN="http://127.0.0.1:$FRONTEND_PORT" FRONTEND_URL="http://127.0.0.1:$FRONTEND_PORT" NODE_ENV=test PORT="$BACKEND_PORT" npm start) >"$RUN_DIR/backend.log" 2>&1 &
backend_pid=$!
(cd "$REPO_ROOT/frontend" && NEXT_PUBLIC_API_URL="http://127.0.0.1:$BACKEND_PORT" npm run build) >"$RUN_DIR/frontend-build.log" 2>&1 || { cat "$RUN_DIR/frontend-build.log" >&2; exit 1; }
(cd "$REPO_ROOT/frontend" && PORT="$FRONTEND_PORT" npm run start) >"$RUN_DIR/frontend.log" 2>&1 &
frontend_pid=$!

ready=0
for _attempt in {1..90}; do
  if curl -fsS "http://127.0.0.1:$FRONTEND_PORT/login" >/dev/null 2>&1 && [[ "$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$BACKEND_PORT/api/auth/me")" == "401" ]]; then ready=1; break; fi
  sleep 1
done
if (( ready != 1 )); then cat "$RUN_DIR/backend.log" "$RUN_DIR/frontend.log" >&2; exit 1; fi

(cd "$REPO_ROOT/frontend" && WEB_BASE_URL="http://127.0.0.1:$FRONTEND_PORT" API_BASE_URL="http://127.0.0.1:$BACKEND_PORT" npx playwright test --config=playwright.phase5-c3.config.ts)
printf '{"status":"VERIFIED_PHASE5_C3_BROWSER","api_interception":false,"profiles":4,"tenants":2,"cross_tenant":"not_found"}\n'

# The parent demo harness removes its disposable tenant after this browser gate.
# Phase 5-C3 correctly protects published governance records from UPDATE/DELETE,
# so cascading fixture teardown would otherwise fail after all six browser tests pass.
# Disable only those immutability triggers in this explicitly isolated PostgreSQL fixture;
# production/runtime immutability is verified separately by the C3 PostgreSQL gate.
psql -h 127.0.0.1 -p "$PHASE5_C3_DB_PORT" -U postgres -d "$PHASE5_C3_DB_NAME" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
DO $$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE NOT t.tgisinternal
      AND p.proname = 'reject_published_indicator_governance_change'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER %I', item.schema_name, item.table_name, item.trigger_name);
  END LOOP;
END
$$;
SQL
printf '{"status":"PHASE5_C3_DISPOSABLE_FIXTURE_TEARDOWN_READY","immutability_runtime_unchanged":true}\n'
