#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-${API:-}}"
: "${API_URL:?API_URL o API requerido, ej: http://localhost:3000}"
: "${FRONTEND_URL:?FRONTEND_URL requerido, ej: http://localhost:3001}"
TOKEN="${TOKEN:-}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"

echo "Validando Acciones Recomendadas ISO en ${API_URL}"

HAS_JQ=false
if command -v jq >/dev/null 2>&1; then
  HAS_JQ=true
fi

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

if [[ -z "${TOKEN}" ]]; then
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
fi

if [[ -z "${TOKEN}" ]]; then
  echo "ERROR: no se obtuvo TOKEN valido." >&2
  exit 1
fi

summary="$(request GET "/api/iso-operational-execution/summary")"
suggestions="$(request GET "/api/iso-operational-execution/suggestions?status=pending")"
dry_run="$(request POST "/api/iso-operational-execution/generate" '{"dry_run":true}')"

if [[ "${HAS_JQ}" == true ]]; then
  echo "${summary}" | jq -e '.ok == true' >/dev/null
  echo "${suggestions}" | jq -e '.ok == true and (.data | type == "array")' >/dev/null
  echo "${dry_run}" | jq -e '.ok == true and .dry_run == true' >/dev/null

  first_id="$(echo "${suggestions}" | jq -r '.data[0].id // empty')"
  first_target="$(echo "${suggestions}" | jq -r '.data[0].target_record_type // "action_plan"')"

  if [[ -n "${first_id}" ]]; then
    request POST "/api/iso-operational-execution/${first_id}/approve" \
      "{\"target_record_type\":\"${first_target}\",\"dry_run\":true}" | jq -e '.ok == true and .dry_run == true' >/dev/null
  else
    echo "INFO: no hay sugerencias pendientes para probar approve dry-run."
  fi
else
  echo "INFO: jq no disponible; se validaron HTTP 2xx, sin inspeccion JSON avanzada."
fi

if curl -s -I "${FRONTEND_URL}/acciones-recomendadas" >/dev/null 2>&1; then
  echo "OK: frontend responde en ${FRONTEND_URL}/acciones-recomendadas"
else
  echo "INFO: frontend no disponible en ${FRONTEND_URL}/acciones-recomendadas; valida luego del deploy."
fi

echo "OK: Acciones Recomendadas ISO validada correctamente."
