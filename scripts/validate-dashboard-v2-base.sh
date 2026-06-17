#!/usr/bin/env bash
set -euo pipefail

: "${API_URL:?API_URL requerido, ej: http://localhost:3000}"
: "${FRONTEND_URL:?FRONTEND_URL requerido, ej: http://localhost:3001}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
TOKEN="${TOKEN:-}"
TENANT_ID="${TENANT_ID:-}"

echo "Validando Dashboard v2 base en ${API_URL}"

if [[ -n "$TEST_EMAIL" && -n "$TEST_PASSWORD" ]]; then
  TOKEN="$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" | jq -r '.token // .data.token // empty')"
fi

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: define TOKEN o TEST_EMAIL/TEST_PASSWORD" >&2
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Conteos criticos antes:"
  psql "$DATABASE_URL" -c "
  SELECT 'standards' AS table_name, COUNT(*) AS total FROM standards
  UNION ALL SELECT 'tenant_standards', COUNT(*) FROM tenant_standards
  UNION ALL SELECT 'tenant_controls', COUNT(*) FROM tenant_controls
  UNION ALL SELECT 'evidences', COUNT(*) FROM evidences
  ORDER BY table_name;
  "
fi

tmp="$(mktemp)"
code="$(curl -s -o "$tmp" -w "%{http_code}" "${API_URL}/api/dashboard-v2/summary" \
  -H "Authorization: Bearer ${TOKEN}")"

if [[ "$code" != "200" ]]; then
  echo "ERROR: GET /api/dashboard-v2/summary devolvio HTTP ${code}" >&2
  cat "$tmp" >&2
  rm -f "$tmp"
  exit 1
fi

jq -e '.ok == true and ((.data.active_standards // .active_standards) | type == "array")' "$tmp" >/dev/null

if jq -e '[(.data.active_standards // .active_standards // [])[].publication_status] | index("transition_prep")' "$tmp" >/dev/null; then
  echo "ERROR: Dashboard v2 devolvio ISO9001 2026_FDIS como norma operativa certificable" >&2
  rm -f "$tmp"
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" && -n "$TENANT_ID" ]]; then
  active_codes="$(psql "$DATABASE_URL" -At -c "
    SELECT DISTINCT standard_code
    FROM tenant_standards
    WHERE tenant_id = '${TENANT_ID}'::uuid
      AND is_active IS DISTINCT FROM false
    ORDER BY standard_code;
  ")"

  visible_codes="$(jq -r '(.data.active_standards // .active_standards // [])[].standard_code' "$tmp" | sort -u)"
  while IFS= read -r code; do
    [[ -z "$code" ]] && continue
    if ! grep -qx "$code" <<< "$active_codes"; then
      echo "ERROR: Dashboard v2 devolvio norma no contratada para tenant ${TENANT_ID}: ${code}" >&2
      rm -f "$tmp"
      exit 1
    fi
  done <<< "$visible_codes"
fi

rm -f "$tmp"

frontend_code="$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/dashboard-v2")"
if [[ "$frontend_code" != "200" && "$frontend_code" != "307" && "$frontend_code" != "308" ]]; then
  echo "ERROR: frontend /dashboard-v2 devolvio HTTP ${frontend_code}" >&2
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Conteos criticos despues:"
  psql "$DATABASE_URL" -c "
  SELECT 'standards' AS table_name, COUNT(*) AS total FROM standards
  UNION ALL SELECT 'tenant_standards', COUNT(*) FROM tenant_standards
  UNION ALL SELECT 'tenant_controls', COUNT(*) FROM tenant_controls
  UNION ALL SELECT 'evidences', COUNT(*) FROM evidences
  ORDER BY table_name;
  "
fi

echo "OK: Dashboard v2 base validado correctamente."
