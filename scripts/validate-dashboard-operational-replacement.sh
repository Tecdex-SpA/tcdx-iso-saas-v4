#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-https://181.212.166.187:8443}"
FRONTEND_URL="${FRONTEND_URL:-https://181.212.166.187:8443}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
TOKEN="${TOKEN:-}"
TENANT_ID="${TENANT_ID:-}"
ALLOW_WRITE_TEST="${ALLOW_WRITE_TEST:-false}"

echo "Validando Dashboard operativo consolidado en ${API_URL}"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq es requerido para esta validacion" >&2
  exit 1
fi

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

operational_counts() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" -At -c "
    SELECT 'action_plans:' || COUNT(*) FROM action_plans
    UNION ALL SELECT 'findings:' || COUNT(*) FROM findings
    UNION ALL SELECT 'nonconformities:' || COUNT(*) FROM tenant_nonconformities
    UNION ALL SELECT 'suggestions:' || COUNT(*) FROM iso_operational_suggestions
    UNION ALL SELECT 'conversions:' || COUNT(*) FROM iso_recommended_action_conversions
    UNION ALL SELECT 'preferences:' || COUNT(*) FROM user_dashboard_preferences
    ORDER BY 1;
    " 2>/dev/null || true
  fi
}

before_counts="$(critical_counts || true)"
before_operational="$(operational_counts || true)"
if [[ -n "$before_counts" ]]; then
  echo "Conteos criticos antes:"
  echo "$before_counts"
fi

request_json() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local tmp
  tmp="$(mktemp)"
  local code

  if [[ -n "$body" ]]; then
    code="$(curl -s -o "$tmp" -w "%{http_code}" -X "$method" "${API_URL}${path}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$body")"
  else
    code="$(curl -s -o "$tmp" -w "%{http_code}" -X "$method" "${API_URL}${path}" \
      -H "Authorization: Bearer ${TOKEN}")"
  fi

  if [[ "$code" != "200" ]]; then
    echo "ERROR: ${method} ${path} devolvio HTTP ${code}" >&2
    cat "$tmp" >&2
    rm -f "$tmp"
    exit 1
  fi

  cat "$tmp"
  rm -f "$tmp"
}

summary_json="$(request_json GET "/api/dashboard-v2/summary")"
risks_json="$(request_json GET "/api/dashboard-v2/risks")"
actions_json="$(request_json GET "/api/dashboard-v2/actions")"
prefs_json="$(request_json GET "/api/dashboard-v2/preferences")"
scope_json="$(request_json GET "/api/tenant-standards/scope/${TENANT_ID}")"
lifecycle_json="$(request_json GET "/api/lifecycle/board/${TENANT_ID}")"

echo "$summary_json" | jq -e '.ok == true and ((.data.active_standards // .active_standards) | type == "array")' >/dev/null
echo "$risks_json" | jq -e '.ok == true and ((.data.risks // .risks) | type == "object")' >/dev/null
echo "$actions_json" | jq -e '.ok == true and ((.data.actions // .actions) | type == "object")' >/dev/null
echo "$prefs_json" | jq -e '.ok == true and ((.data.layout_json // .layout_json) | type == "object")' >/dev/null
echo "$lifecycle_json" | jq -e '.ok == true and (.columns | type == "array")' >/dev/null

for payload in "$summary_json" "$risks_json" "$actions_json" "$lifecycle_json"; do
  if grep -Eiq '42703|undefined_column|No se pudo consultar tenant' <<< "$payload"; then
    echo "ERROR: payload contiene error tecnico 42703/undefined_column/tenant" >&2
    echo "$payload" >&2
    exit 1
  fi
done

if echo "$summary_json" | jq -e '(.data.active_standards // .active_standards // [])[] | select(.standard_code == "ISO9001" and .version_code == "2026_FDIS")' >/dev/null; then
  echo "ERROR: ISO9001 2026_FDIS aparece como norma operativa en Dashboard" >&2
  exit 1
fi

active_codes="$(echo "$scope_json" | jq -r '.standards[] | select(.is_active == true) | .code' | sort -u)"
dashboard_codes="$(echo "$summary_json" | jq -r '(.data.active_standards // .active_standards // [])[].standard_code' | sort -u)"
risks_codes="$(echo "$risks_json" | jq -r '[(.data.risks.by_standard // .risks.by_standard // [])[].standard_code, (.data.risks.all_risks // .risks.all_risks // [])[].standard_code] | .[]?' | sort -u)"
actions_codes="$(echo "$actions_json" | jq -r '[(.data.actions.by_standard // .actions.by_standard // [])[].standard_code, (.data.actions.recent // .actions.recent // [])[].standard_code] | .[]?' | sort -u)"
lifecycle_codes="$(echo "$lifecycle_json" | jq -r '[.columns[].items[].standard_code] | .[]?' | sort -u)"

check_subset() {
  local label="$1"
  local visible="$2"
  while IFS= read -r code; do
    [[ -z "$code" || "$code" == "null" ]] && continue
    if [[ "$code" == "ISO9001" ]] && echo "$summary_json" | jq -e '(.data.active_standards // .active_standards // [])[] | select(.standard_code == "ISO9001" and .version_code == "2026_FDIS")' >/dev/null; then
      echo "ERROR: ISO9001 2026_FDIS no debe verse como operativa" >&2
      exit 1
    fi
    if ! grep -qx "$code" <<< "$active_codes"; then
      echo "ERROR: ${label} devolvio norma no contratada/activa: ${code}" >&2
      exit 1
    fi
  done <<< "$visible"
}

check_subset "Dashboard" "$dashboard_codes"
check_subset "Riesgos" "$risks_codes"
check_subset "Acciones" "$actions_codes"
check_subset "Ciclo de Vida" "$lifecycle_codes"

test_layout='{
  "dashboard_key":"dashboard_v2",
  "layout_json":{
    "version":1,
    "order":["acciones","riesgos","standards","salud_iso","ciclo_vida","kpis","alertas"],
    "collapsed":{"riesgos":true}
  }
}'
put_prefs_json="$(request_json PUT "/api/dashboard-v2/preferences" "$test_layout")"
echo "$put_prefs_json" | jq -e '.ok == true and (.data.layout_json.order[0] == "acciones")' >/dev/null

first_action_id="$(echo "$actions_json" | jq -r '(.data.actions.recent // .actions.recent // [])[0].id // empty')"
first_action_target="$(echo "$actions_json" | jq -r '(.data.actions.recent // .actions.recent // [])[0].target_record_type // "action_plan"')"
if [[ -n "$first_action_id" ]]; then
  request_json GET "/api/iso-recommended-actions/${first_action_id}/conversion-options" >/dev/null
  dry_run_body="$(jq -n --arg target "$first_action_target" '{target_type:$target, options:{}}')"
  dry_run_json="$(request_json POST "/api/iso-recommended-actions/${first_action_id}/dry-run-convert" "$dry_run_body")"
  echo "$dry_run_json" | jq -e '.ok == true' >/dev/null
else
  echo "INFO: sin acciones recientes; se omite conversion-options/dry-run."
fi

if [[ "$ALLOW_WRITE_TEST" == "true" ]]; then
  echo "INFO: ALLOW_WRITE_TEST=true; validar movimiento de ciclo de vida manualmente con una tarjeta controlada."
else
  echo "ALLOW_WRITE_TEST=false: no se ejecutaron cambios de etapa reales."
fi

frontend_dashboard="$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/dashboard")"
frontend_dashboard_v2="$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/dashboard-v2")"
for code in "$frontend_dashboard" "$frontend_dashboard_v2"; do
  if [[ "$code" != "200" && "$code" != "307" && "$code" != "308" ]]; then
    echo "ERROR: frontend devolvio HTTP ${code}" >&2
    exit 1
  fi
done

after_counts="$(critical_counts || true)"
after_operational="$(operational_counts || true)"
if [[ -n "$after_counts" ]]; then
  echo "Conteos criticos despues:"
  echo "$after_counts"
  if [[ "$before_counts" != "$after_counts" ]]; then
    echo "ERROR: cambiaron conteos criticos por consultar Dashboard" >&2
    exit 1
  fi
fi

if [[ -n "$before_operational" && -n "$after_operational" ]]; then
  before_without_prefs="$(echo "$before_operational" | grep -v '^preferences:' || true)"
  after_without_prefs="$(echo "$after_operational" | grep -v '^preferences:' || true)"
  if [[ "$before_without_prefs" != "$after_without_prefs" ]]; then
    echo "ERROR: cambiaron datos operativos por consultar Dashboard" >&2
    echo "Antes:"
    echo "$before_operational"
    echo "Despues:"
    echo "$after_operational"
    exit 1
  fi
fi

echo "OK: Dashboard operativo consolidado validado correctamente."
