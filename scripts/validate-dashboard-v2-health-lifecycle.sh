#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://192.168.100.120:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://192.168.100.130:3000}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
TOKEN="${TOKEN:-}"
TENANT_ID="${TENANT_ID:-}"

echo "Validando Dashboard v2 Salud ISO + Ciclo de Vida en ${API_URL}"

if [[ -n "$TEST_EMAIL" && -n "$TEST_PASSWORD" ]]; then
  TOKEN="$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" | jq -r '.token // .data.token // empty')"
fi

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: define TOKEN o TEST_EMAIL/TEST_PASSWORD" >&2
  exit 1
fi

if [[ -z "$TENANT_ID" ]]; then
  TENANT_ID="$(curl -s "${API_URL}/api/me" \
    -H "Authorization: Bearer ${TOKEN}" | jq -r '.tenant_id // .tenantId // .scope.tenant_id // .data.tenant_id // empty')"
fi

if [[ -z "$TENANT_ID" ]]; then
  echo "ERROR: no se pudo resolver TENANT_ID desde token/api/me" >&2
  exit 1
fi

critical_counts() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" -At -c "
    SELECT 'standards:' || COUNT(*) FROM standards
    UNION ALL SELECT 'tenant_standards:' || COUNT(*) FROM tenant_standards
    UNION ALL SELECT 'tenant_controls:' || COUNT(*) FROM tenant_controls
    UNION ALL SELECT 'evidences:' || COUNT(*) FROM evidences
    ORDER BY 1;
    "
  fi
}

before_counts="$(critical_counts || true)"
if [[ -n "$before_counts" ]]; then
  echo "Conteos criticos antes:"
  echo "$before_counts"
fi

request_json() {
  local path="$1"
  local tmp
  tmp="$(mktemp)"
  local code
  code="$(curl -s -o "$tmp" -w "%{http_code}" "${API_URL}${path}" \
    -H "Authorization: Bearer ${TOKEN}")"
  if [[ "$code" != "200" ]]; then
    echo "ERROR: GET ${path} devolvio HTTP ${code}" >&2
    cat "$tmp" >&2
    rm -f "$tmp"
    exit 1
  fi
  cat "$tmp"
  rm -f "$tmp"
}

dashboard_json="$(request_json "/api/dashboard-v2/summary")"
health_json="$(request_json "/health/dashboard?tenant_id=${TENANT_ID}")"
health_standards_json="$(request_json "/health/standards?tenant_id=${TENANT_ID}")"
lifecycle_json="$(request_json "/api/lifecycle/board/${TENANT_ID}")"
scope_json="$(request_json "/api/tenant-standards/scope/${TENANT_ID}")"

echo "$dashboard_json" | jq -e '.ok == true and ((.data.active_standards // .active_standards) | type == "array")' >/dev/null
echo "$health_json" | jq -e '.ok == true and (.data | type == "array")' >/dev/null
echo "$health_standards_json" | jq -e '.ok == true and (.data | type == "array")' >/dev/null
echo "$lifecycle_json" | jq -e '.ok == true and (.columns | type == "array")' >/dev/null
echo "$scope_json" | jq -e '(.standards | type == "array")' >/dev/null

if echo "$dashboard_json" | jq -e '[(.data.active_standards // .active_standards // [])[].publication_status] | index("transition_prep")' >/dev/null; then
  echo "ERROR: Dashboard v2 activo incluye version transition_prep como operativa" >&2
  exit 1
fi

active_codes="$(echo "$scope_json" | jq -r '.standards[] | select(.is_active == true) | .code' | sort -u)"
dashboard_codes="$(echo "$dashboard_json" | jq -r '(.data.active_standards // .active_standards // [])[].standard_code' | sort -u)"
health_codes="$(echo "$health_standards_json" | jq -r '.data[].standard_code' | sort -u)"
lifecycle_codes="$(echo "$lifecycle_json" | jq -r '.columns[].items[].standard_code' | sort -u)"

check_subset() {
  local label="$1"
  local visible="$2"
  while IFS= read -r code; do
    [[ -z "$code" ]] && continue
    if ! grep -qx "$code" <<< "$active_codes"; then
      echo "ERROR: ${label} devolvio norma no contratada/activa: ${code}" >&2
      exit 1
    fi
  done <<< "$visible"
}

check_subset "Dashboard v2" "$dashboard_codes"
check_subset "Salud ISO" "$health_codes"
check_subset "Ciclo de vida" "$lifecycle_codes"

frontend_code="$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/dashboard-v2")"
if [[ "$frontend_code" != "200" && "$frontend_code" != "307" && "$frontend_code" != "308" ]]; then
  echo "ERROR: frontend /dashboard-v2 devolvio HTTP ${frontend_code}" >&2
  exit 1
fi

after_counts="$(critical_counts || true)"
if [[ -n "$after_counts" ]]; then
  echo "Conteos criticos despues:"
  echo "$after_counts"
  if [[ "$before_counts" != "$after_counts" ]]; then
    echo "ERROR: cambiaron conteos criticos por consultas de Dashboard v2" >&2
    exit 1
  fi
fi

echo "OK: Dashboard v2 Salud ISO + Ciclo de Vida validado correctamente."
