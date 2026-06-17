#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-${API:-}}"
: "${API_URL:?API_URL o API requerido, ej: http://localhost:3000}"
: "${FRONTEND_URL:?FRONTEND_URL requerido, ej: http://localhost:3001}"
TOKEN="${TOKEN:-}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"

echo "Validando ISO Command Center en ${API_URL}"

HAS_JQ=false
if command -v jq >/dev/null 2>&1; then
  HAS_JQ=true
fi

login_if_needed() {
  if [[ -n "${TOKEN}" && ( -z "${TEST_EMAIL}" || -z "${TEST_PASSWORD}" ) ]]; then
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
  local tmp_body
  local http_code

  tmp_body="$(mktemp)"
  http_code="$(curl -s -o "${tmp_body}" -w "%{http_code}" -X "${method}" "${API_URL}${path}" \
    -H "Authorization: Bearer ${TOKEN}")"

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

summary="$(request GET "/api/iso-command-center/summary")"
standards="$(request GET "/api/iso-command-center/standards")"
readiness="$(request GET "/api/iso-command-center/readiness")"
activity="$(request GET "/api/iso-command-center/activity")"

if [[ "${HAS_JQ}" == true ]]; then
  echo "${summary}" | jq -e '.ok == true and (.summary | type == "object") and (.standards | type == "array")' >/dev/null
  echo "${standards}" | jq -e '.ok == true and (.standards | type == "array")' >/dev/null
  echo "${readiness}" | jq -e '.ok == true and (.standards | type == "array")' >/dev/null
  echo "${activity}" | jq -e '.ok == true and (.activity | type == "array")' >/dev/null
else
  echo "INFO: jq no disponible; se validaron HTTP 2xx, sin inspeccion JSON avanzada."
fi

if curl -s -I "${FRONTEND_URL}/dashboard" >/dev/null 2>&1; then
  echo "OK: frontend oficial responde en ${FRONTEND_URL}/dashboard"
else
  echo "INFO: frontend oficial no disponible en ${FRONTEND_URL}/dashboard; valida luego del deploy."
fi

db_counts

echo "OK: ISO Command Center validado correctamente."
