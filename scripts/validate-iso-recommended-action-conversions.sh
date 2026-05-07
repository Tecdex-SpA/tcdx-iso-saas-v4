#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-${API:-http://192.168.100.120:3000}}"
FRONTEND_URL="${FRONTEND_URL:-http://192.168.100.130:3000}"
TOKEN="${TOKEN:-}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
ALLOW_WRITE_TEST="${ALLOW_WRITE_TEST:-false}"

echo "Validando conversion segura de Acciones Recomendadas ISO en ${API_URL}"

HAS_JQ=false
if command -v jq >/dev/null 2>&1; then
  HAS_JQ=true
fi

login_if_needed() {
  if [[ -n "${TOKEN}" ]]; then
    return
  fi

  if [[ -z "${TEST_EMAIL}" || -z "${TEST_PASSWORD}" ]]; then
    echo "ERROR: define TOKEN o TEST_EMAIL/TEST_PASSWORD." >&2
    exit 1
  fi

  if [[ "${HAS_JQ}" != true ]]; then
    echo "ERROR: jq es necesario para login automatico si TOKEN no esta definido." >&2
    exit 1
  fi

  TOKEN="$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" | jq -r '.token // empty')"

  if [[ -z "${TOKEN}" ]]; then
    echo "ERROR: no se obtuvo TOKEN valido." >&2
    exit 1
  fi
}

request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local tmp_body
  local http_code

  tmp_body="$(mktemp)"

  if [[ -n "${body}" ]]; then
    http_code="$(curl -s -o "${tmp_body}" -w "%{http_code}" -X "${method}" "${API_URL}${path}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "${body}")"
  else
    http_code="$(curl -s -o "${tmp_body}" -w "%{http_code}" -X "${method}" "${API_URL}${path}" \
      -H "Authorization: Bearer ${TOKEN}")"
  fi

  if [[ "${http_code}" -lt 200 || "${http_code}" -ge 300 ]]; then
    echo "ERROR: ${method} ${path} devolvio HTTP ${http_code}" >&2
    cat "${tmp_body}" >&2
    rm -f "${tmp_body}"
    exit 1
  fi

  cat "${tmp_body}"
  rm -f "${tmp_body}"
}

db_counts() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "INFO: DATABASE_URL no definido; se omite validacion SQL de conteos."
    return
  fi

  psql "${DATABASE_URL}" -c "
SELECT 'standards' AS table_name, COUNT(*) AS total FROM standards
UNION ALL
SELECT 'tenant_standards', COUNT(*) FROM tenant_standards
UNION ALL
SELECT 'tenant_controls', COUNT(*) FROM tenant_controls
UNION ALL
SELECT 'evidences', COUNT(*) FROM evidences
ORDER BY table_name;
"
}

login_if_needed

db_counts

summary="$(request GET "/api/iso-operational-execution/summary")"
suggestions="$(request GET "/api/iso-operational-execution/suggestions?status=pending")"

if [[ "${HAS_JQ}" == true ]]; then
  echo "${summary}" | jq -e '.ok == true' >/dev/null
  echo "${suggestions}" | jq -e '.ok == true and (.data | type == "array")' >/dev/null

  first_id="$(echo "${suggestions}" | jq -r '.data[0].id // empty')"
  first_target="$(echo "${suggestions}" | jq -r '.data[0].target_record_type // "action_plan"')"

  if [[ -n "${first_id}" ]]; then
    request GET "/api/iso-recommended-actions/${first_id}/conversion-options" \
      | jq -e '.ok == true and (.options | type == "array")' >/dev/null

    dry_run="$(request POST "/api/iso-recommended-actions/${first_id}/dry-run-convert" \
      "{\"target_type\":\"${first_target}\",\"options\":{}}")"
    echo "${dry_run}" | jq -e '.ok == true and .mode == "dry_run"' >/dev/null

    if [[ "${ALLOW_WRITE_TEST}" == "true" ]]; then
      can_convert="$(echo "${dry_run}" | jq -r '.can_convert')"
      if [[ "${can_convert}" == "true" ]]; then
        request POST "/api/iso-recommended-actions/${first_id}/convert" \
          "{\"target_type\":\"${first_target}\",\"confirmed\":true,\"options\":{}}" \
          | jq -e '.ok == true and .mode == "converted"' >/dev/null
      else
        echo "INFO: primera sugerencia bloqueada para conversion real; no se fuerza escritura."
      fi
    else
      echo "ALLOW_WRITE_TEST=false: no se ejecuto conversion real."
    fi
  else
    echo "INFO: no hay sugerencias pendientes; se validaron endpoints base."
  fi
else
  echo "INFO: jq no disponible; se validaron HTTP 2xx, sin inspeccion JSON avanzada."
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  psql "${DATABASE_URL}" -c "
SELECT to_regclass('public.iso_recommended_action_conversions') AS conversion_table;
"
fi

if curl -s -I "${FRONTEND_URL}/acciones-recomendadas" >/dev/null 2>&1; then
  echo "OK: frontend responde en ${FRONTEND_URL}/acciones-recomendadas"
else
  echo "INFO: frontend no disponible en ${FRONTEND_URL}/acciones-recomendadas; valida luego del deploy."
fi

db_counts

echo "OK: Conversion segura de Acciones Recomendadas ISO validada correctamente."
