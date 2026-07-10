#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/healthcheck.sh

Optional environment:
  BACKEND_URL       Default: http://localhost:3000
  FRONTEND_URL      Default: http://192.168.2.43
  AI_ENGINE_URL     Default: http://ai-v4.tcdx.int:8001
  REQUIRE_AI_ENGINE Default: false
  PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD for DB check

Exit code:
  0 when critical components pass.
  Non-zero when backend, frontend or DB readiness fails.
  AI Engine failure is degraded by default unless REQUIRE_AI_ENGINE=true.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://192.168.2.43}"
AI_ENGINE_URL="${AI_ENGINE_URL:-http://ai-v4.tcdx.int:8001}"
REQUIRE_AI_ENGINE="${REQUIRE_AI_ENGINE:-false}"
PGPORT="${PGPORT:-5432}"

FAILURES=0
WARNINGS=0

record_ok() {
  printf '[OK] %s\n' "$*"
}

record_warn() {
  WARNINGS=$((WARNINGS + 1))
  printf '[DEGRADED] %s\n' "$*"
}

record_fail() {
  FAILURES=$((FAILURES + 1))
  printf '[FAIL] %s\n' "$*" >&2
}

http_code() {
  local url="$1"
  curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 12 "$url" 2>/dev/null || printf '000'
}

check_backend() {
  local root_code
  local health_code

  root_code="$(http_code "${BACKEND_URL%/}/")"
  health_code="$(http_code "${BACKEND_URL%/}/api/health")"

  if [[ "$root_code" =~ ^(200|204|301|302|307|308)$ ]]; then
    record_ok "backend root ${BACKEND_URL%/}/ => HTTP ${root_code}"
    return 0
  fi

  if [[ "$health_code" =~ ^(200|401|403)$ ]]; then
    record_ok "backend /api/health reachable => HTTP ${health_code}"
    return 0
  fi

  record_fail "backend unavailable: root HTTP ${root_code}, /api/health HTTP ${health_code}"
}

check_frontend() {
  local code
  code="$(http_code "$FRONTEND_URL")"

  if [[ "$code" =~ ^(200|204|301|302|307|308)$ ]]; then
    record_ok "frontend ${FRONTEND_URL} => HTTP ${code}"
  else
    record_fail "frontend unavailable: ${FRONTEND_URL} => HTTP ${code}"
  fi
}

check_db() {
  if [[ -z "${PGHOST:-}" || -z "${PGDATABASE:-}" || -z "${PGUSER:-}" ]]; then
    record_fail "database check missing PGHOST, PGDATABASE or PGUSER"
    return 0
  fi

  if command -v pg_isready >/dev/null 2>&1; then
    if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null; then
      record_ok "database readiness ${PGHOST}:${PGPORT}/${PGDATABASE}"
    else
      record_fail "database not ready ${PGHOST}:${PGPORT}/${PGDATABASE}"
      return 0
    fi
  elif ! command -v psql >/dev/null 2>&1; then
    record_fail "database check requires pg_isready or psql"
    return 0
  fi

  if command -v psql >/dev/null 2>&1; then
    if PGPASSWORD="${PGPASSWORD:-}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
      -v ON_ERROR_STOP=1 -qAt -c 'select 1;' >/dev/null; then
      record_ok "database query select 1"
    else
      record_fail "database query failed for ${PGHOST}:${PGPORT}/${PGDATABASE}"
    fi
  fi
}

check_ai_engine() {
  local code
  code="$(http_code "${AI_ENGINE_URL%/}/health")"

  if [[ "$code" == "200" ]]; then
    record_ok "AI Engine ${AI_ENGINE_URL%/}/health => HTTP 200"
    return 0
  fi

  if [[ "$REQUIRE_AI_ENGINE" == "true" ]]; then
    record_fail "AI Engine unavailable and REQUIRE_AI_ENGINE=true: HTTP ${code}"
  else
    record_warn "AI Engine unavailable: HTTP ${code}; SaaS can remain operational through backend fallback"
  fi
}

printf 'TCDX minimal healthcheck\n'
printf 'Backend URL: %s\n' "$BACKEND_URL"
printf 'Frontend URL: %s\n' "$FRONTEND_URL"
printf 'AI Engine URL: %s\n' "$AI_ENGINE_URL"

check_backend
check_frontend
check_db
check_ai_engine

printf 'Summary: failures=%s degraded=%s\n' "$FAILURES" "$WARNINGS"

if [[ "$FAILURES" -gt 0 ]]; then
  exit 1
fi
