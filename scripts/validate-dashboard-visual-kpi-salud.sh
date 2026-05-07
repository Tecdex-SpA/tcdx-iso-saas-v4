#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://192.168.100.120:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://192.168.100.130:3000}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
TOKEN="${TOKEN:-}"
TENANT_ID="${TENANT_ID:-}"

echo "Validando Dashboard visual KPI + Salud ISO en ${API_URL}"

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
    SELECT 'evidences:' || COUNT(*) FROM evidences
    UNION ALL SELECT 'standards:' || COUNT(*) FROM standards
    UNION ALL SELECT 'tenant_controls:' || COUNT(*) FROM tenant_controls
    UNION ALL SELECT 'tenant_standards:' || COUNT(*) FROM tenant_standards
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

summary_json="$(request_json "/api/dashboard-v2/summary")"
kpis_json="$(request_json "/api/dashboard-v2/kpis")"
health_json="$(request_json "/health/dashboard?tenant_id=${TENANT_ID}")"
health_standards_json="$(request_json "/health/standards?tenant_id=${TENANT_ID}")"
scope_json="$(request_json "/api/tenant-standards/scope/${TENANT_ID}")"

for payload in "$summary_json" "$kpis_json" "$health_json" "$health_standards_json"; do
  if grep -Eiq '42703|undefined_column|No se pudo consultar tenant' <<< "$payload"; then
    echo "ERROR: payload contiene error tecnico 42703/undefined_column/tenant" >&2
    echo "$payload" >&2
    exit 1
  fi
done

echo "$summary_json" | jq -e '.ok == true and ((.data.active_standards // .active_standards) | type == "array")' >/dev/null
echo "$summary_json" | jq -e '((.data.operational_panels.kpis // .operational_panels.kpis) | type == "object")' >/dev/null
echo "$kpis_json" | jq -e '.ok == true and ((.data.kpis // .kpis) | type == "object")' >/dev/null
echo "$health_json" | jq -e '.ok == true' >/dev/null
echo "$health_standards_json" | jq -e '.ok == true and (.data | type == "array")' >/dev/null
echo "$scope_json" | jq -e '(.standards | type == "array")' >/dev/null

if echo "$summary_json" | jq -e '(.data.active_standards // .active_standards // [])[] | select(.standard_code == "ISO9001" and .version_code == "2026_FDIS" and .certifiable == true)' >/dev/null; then
  echo "ERROR: ISO9001 2026_FDIS aparece como certificable operativa" >&2
  exit 1
fi

active_codes="$(echo "$scope_json" | jq -r '.standards[] | select(.is_active == true) | .code' | sort -u)"
dashboard_codes="$(echo "$summary_json" | jq -r '(.data.active_standards // .active_standards // [])[].standard_code' | sort -u)"
kpi_codes="$(echo "$kpis_json" | jq -r '[(.data.kpis.items // .kpis.items // [])[].standard_code, (.data.kpis.by_standard // .kpis.by_standard // [])[].standard_code] | .[]?' | sort -u)"
health_codes="$(echo "$health_standards_json" | jq -r '.data[].standard_code' | sort -u)"

check_subset() {
  local label="$1"
  local visible="$2"
  while IFS= read -r code; do
    [[ -z "$code" || "$code" == "null" ]] && continue
    if ! grep -qx "$code" <<< "$active_codes"; then
      echo "ERROR: ${label} devolvio norma no contratada/activa: ${code}" >&2
      exit 1
    fi
  done <<< "$visible"
}

check_subset "Dashboard" "$dashboard_codes"
check_subset "KPIs" "$kpi_codes"
check_subset "Salud ISO" "$health_codes"

dashboard_code="$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/dashboard")"
dashboard_v2_code="$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/dashboard-v2")"
if [[ "$dashboard_code" != "200" && "$dashboard_code" != "307" && "$dashboard_code" != "308" ]]; then
  echo "ERROR: frontend /dashboard devolvio HTTP ${dashboard_code}" >&2
  exit 1
fi
if [[ "$dashboard_v2_code" != "200" && "$dashboard_v2_code" != "307" && "$dashboard_v2_code" != "308" ]]; then
  echo "ERROR: frontend /dashboard-v2 devolvio HTTP ${dashboard_v2_code}" >&2
  exit 1
fi

after_counts="$(critical_counts || true)"
if [[ -n "$after_counts" ]]; then
  echo "Conteos criticos despues:"
  echo "$after_counts"
  if [[ "$before_counts" != "$after_counts" ]]; then
    echo "ERROR: cambiaron conteos criticos por consultar Dashboard" >&2
    exit 1
  fi
fi

echo "OK: Dashboard visual KPI + Salud ISO validado correctamente."
