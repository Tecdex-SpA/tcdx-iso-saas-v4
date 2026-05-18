#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-https://181.212.166.187:8443}"
FRONTEND_URL="${FRONTEND_URL:-https://181.212.166.187:8443}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
TOKEN="${TOKEN:-}"

echo "Validando preferencias personalizadas Dashboard v2 en ${API_URL}"

if [[ -n "$TEST_EMAIL" && -n "$TEST_PASSWORD" ]]; then
  TOKEN="$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" | jq -r '.token // .data.token // empty')"
fi

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: define TOKEN o TEST_EMAIL/TEST_PASSWORD" >&2
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
    SELECT 'evidences:' || COUNT(*) FROM evidences
    UNION ALL SELECT 'tenant_controls:' || COUNT(*) FROM tenant_controls
    UNION ALL SELECT 'tenant_standards:' || COUNT(*) FROM tenant_standards
    UNION ALL SELECT 'suggestions:' || COUNT(*) FROM iso_operational_suggestions
    UNION ALL SELECT 'conversions:' || COUNT(*) FROM iso_recommended_action_conversions
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

if [[ -n "${DATABASE_URL:-}" ]]; then
  psql "$DATABASE_URL" -c "\dt public.user_dashboard_preferences" >/dev/null
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

original_json="$(request_json GET "/api/dashboard-v2/preferences")"
echo "$original_json" | jq -e '.ok == true and ((.data.layout_json // .layout_json) | type == "object")' >/dev/null

original_layout="$(echo "$original_json" | jq -c '.data.layout_json // .layout_json')"
original_is_default="$(echo "$original_json" | jq -r '.data.is_default // .is_default // false')"

test_layout='{
  "dashboard_key":"dashboard_v2",
  "layout_json":{
    "version":1,
    "order":["riesgos","acciones","standards","salud_iso","ciclo_vida","kpis","alertas"],
    "collapsed":{"acciones":true,"alertas":true}
  }
}'

put_json="$(request_json PUT "/api/dashboard-v2/preferences" "$test_layout")"
echo "$put_json" | jq -e '.ok == true and (.data.layout_json.order[0] == "riesgos")' >/dev/null

saved_json="$(request_json GET "/api/dashboard-v2/preferences")"
echo "$saved_json" | jq -e '.ok == true and (.data.layout_json.order[0] == "riesgos") and (.data.layout_json.collapsed.acciones == true)' >/dev/null

reset_json="$(request_json DELETE "/api/dashboard-v2/preferences")"
echo "$reset_json" | jq -e '.ok == true and (.data.is_default == true)' >/dev/null

if [[ "$original_is_default" != "true" && "$original_layout" != "null" ]]; then
  restore_body="$(jq -n --argjson layout "$original_layout" '{dashboard_key:"dashboard_v2", layout_json:$layout}')"
  request_json PUT "/api/dashboard-v2/preferences" "$restore_body" >/dev/null
fi

summary_json="$(request_json GET "/api/dashboard-v2/summary")"
echo "$summary_json" | jq -e '.ok == true' >/dev/null

frontend_code="$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/dashboard-v2")"
if [[ "$frontend_code" != "200" && "$frontend_code" != "307" && "$frontend_code" != "308" ]]; then
  echo "ERROR: frontend /dashboard-v2 devolvio HTTP ${frontend_code}" >&2
  exit 1
fi

after_counts="$(critical_counts || true)"
after_operational="$(operational_counts || true)"

if [[ -n "$after_counts" ]]; then
  echo "Conteos criticos despues:"
  echo "$after_counts"
  if [[ "$before_counts" != "$after_counts" ]]; then
    echo "ERROR: cambiaron conteos criticos por preferencias Dashboard v2" >&2
    exit 1
  fi
fi

if [[ -n "$before_operational" && "$before_operational" != "$after_operational" ]]; then
  echo "ERROR: cambiaron datos operativos por preferencias Dashboard v2" >&2
  echo "Antes:"
  echo "$before_operational"
  echo "Despues:"
  echo "$after_operational"
  exit 1
fi

echo "OK: preferencias personalizadas Dashboard v2 validadas correctamente."
