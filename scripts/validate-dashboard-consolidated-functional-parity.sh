#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-https://181.212.166.187:8443}"
FRONTEND_URL="${FRONTEND_URL:-https://181.212.166.187:8443}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
TOKEN="${TOKEN:-}"
TENANT_ID="${TENANT_ID:-}"

echo "Validando paridad funcional Dashboard consolidado en ${API_URL}"

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

write_guard_counts() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" -At -c "
    SELECT 'action_plans:' || COUNT(*) FROM action_plans
    UNION ALL SELECT 'evidences:' || COUNT(*) FROM evidences
    UNION ALL SELECT 'findings:' || COUNT(*) FROM findings
    UNION ALL SELECT 'tenant_controls:' || COUNT(*) FROM tenant_controls
    UNION ALL SELECT 'tenant_nonconformities:' || COUNT(*) FROM tenant_nonconformities
    ORDER BY 1;
    " 2>/dev/null || true
  fi
}

before_counts="$(critical_counts || true)"
before_write_guard="$(write_guard_counts || true)"

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
actions_json="$(request_json "/api/dashboard-v2/actions")"
risks_json="$(request_json "/api/dashboard-v2/risks")"
kpis_json="$(request_json "/api/dashboard-v2/kpis")"
alerts_json="$(request_json "/api/dashboard-v2/alerts")"
preferences_json="$(request_json "/api/dashboard-v2/preferences")"
health_json="$(request_json "/health/dashboard?tenant_id=${TENANT_ID}")"
health_standards_json="$(request_json "/health/standards?tenant_id=${TENANT_ID}")"
lifecycle_json="$(request_json "/api/lifecycle/board/${TENANT_ID}")"
scope_json="$(request_json "/api/tenant-standards/scope/${TENANT_ID}")"

for payload in "$summary_json" "$actions_json" "$risks_json" "$kpis_json" "$alerts_json" "$preferences_json"; do
  if grep -Eiq '42703|undefined_column|No se pudo consultar tenant' <<< "$payload"; then
    echo "ERROR: payload Dashboard contiene error tecnico 42703/undefined_column/tenant" >&2
    echo "$payload" >&2
    exit 1
  fi
done

echo "$summary_json" | jq -e '.ok == true and ((.data.active_standards // .active_standards) | type == "array")' >/dev/null
echo "$summary_json" | jq -e '((.data.operational_panels // .operational_panels) | type == "object")' >/dev/null
echo "$actions_json" | jq -e '.ok == true and ((.data.actions // .actions) | type == "object")' >/dev/null
echo "$risks_json" | jq -e '.ok == true and ((.data.risks // .risks) | type == "object")' >/dev/null
echo "$kpis_json" | jq -e '.ok == true and ((.data.kpis // .kpis) | type == "object")' >/dev/null
echo "$alerts_json" | jq -e '.ok == true and ((.data.alerts // .alerts) | type == "array")' >/dev/null
echo "$preferences_json" | jq -e '.ok == true and ((.data.layout_json // .layout_json) | type == "object")' >/dev/null
echo "$health_json" | jq -e '.ok == true' >/dev/null
echo "$health_standards_json" | jq -e '.ok == true and (.data | type == "array")' >/dev/null
echo "$lifecycle_json" | jq -e '.ok == true and (.columns | type == "array")' >/dev/null
echo "$scope_json" | jq -e '(.standards | type == "array")' >/dev/null

if echo "$summary_json" | jq -e '[(.data.active_standards // .active_standards // [])[].publication_status] | index("transition_prep")' >/dev/null; then
  echo "ERROR: Dashboard consolidado incluyo transition_prep como norma operativa" >&2
  exit 1
fi

if echo "$summary_json" | jq -e '(.data.active_standards // .active_standards // [])[] | select(.standard_code == "ISO9001" and .version_code == "2026_FDIS" and .certifiable == true)' >/dev/null; then
  echo "ERROR: ISO9001 2026_FDIS aparece como certificable operativa" >&2
  exit 1
fi

active_codes="$(echo "$scope_json" | jq -r '.standards[] | select(.is_active == true) | .code' | sort -u)"

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

dashboard_codes="$(echo "$summary_json" | jq -r '(.data.active_standards // .active_standards // [])[].standard_code' | sort -u)"
action_codes="$(echo "$actions_json" | jq -r '[(.data.actions.recent // .actions.recent // [])[].standard_code, (.data.actions.by_standard // .actions.by_standard // [])[].standard_code] | .[]?' | sort -u)"
risk_codes="$(echo "$risks_json" | jq -r '[(.data.risks.all_risks // .risks.all_risks // [])[].standard_code, (.data.risks.by_standard // .risks.by_standard // [])[].standard_code] | .[]?' | sort -u)"
kpi_codes="$(echo "$kpis_json" | jq -r '[(.data.kpis.items // .kpis.items // [])[].standard_code, (.data.kpis.by_standard // .kpis.by_standard // [])[].standard_code] | .[]?' | sort -u)"
alert_codes="$(echo "$alerts_json" | jq -r '(.data.alerts // .alerts // [])[].standard_code // empty' | sort -u)"
health_codes="$(echo "$health_standards_json" | jq -r '.data[].standard_code' | sort -u)"
lifecycle_codes="$(echo "$lifecycle_json" | jq -r '.columns[].items[].standard_code' | sort -u)"

check_subset "Dashboard consolidado" "$dashboard_codes"
check_subset "Acciones Dashboard" "$action_codes"
check_subset "Riesgos Dashboard" "$risk_codes"
check_subset "KPIs Dashboard" "$kpi_codes"
check_subset "Alertas Dashboard" "$alert_codes"
check_subset "Salud ISO" "$health_codes"
check_subset "Ciclo de vida" "$lifecycle_codes"

frontend_code="$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/dashboard-v2")"
if [[ "$frontend_code" != "200" && "$frontend_code" != "307" && "$frontend_code" != "308" ]]; then
  echo "ERROR: frontend /dashboard-v2 devolvio HTTP ${frontend_code}" >&2
  exit 1
fi

after_counts="$(critical_counts || true)"
after_write_guard="$(write_guard_counts || true)"

if [[ -n "$after_counts" ]]; then
  echo "Conteos criticos despues:"
  echo "$after_counts"
  if [[ "$before_counts" != "$after_counts" ]]; then
    echo "ERROR: cambiaron conteos criticos por GET del Dashboard" >&2
    exit 1
  fi
fi

if [[ -n "$before_write_guard" && "$before_write_guard" != "$after_write_guard" ]]; then
  echo "ERROR: GET del Dashboard creo/modifico objetos operativos" >&2
  echo "Antes:"
  echo "$before_write_guard"
  echo "Despues:"
  echo "$after_write_guard"
  exit 1
fi

echo "OK: Dashboard consolidado con paridad funcional validado correctamente."
