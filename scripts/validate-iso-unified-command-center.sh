#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://192.168.100.120:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://192.168.100.130:3000}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
TOKEN="${TOKEN:-}"
TENANT_ID="${TENANT_ID:-}"

echo "Validando Centro de Control ISO Unificado en ${API_URL}"

if [[ -n "$TEST_EMAIL" && -n "$TEST_PASSWORD" ]]; then
  TOKEN="$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" | jq -r '.token // .data.token // empty')"
fi

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: define TOKEN o TEST_EMAIL/TEST_PASSWORD" >&2
  exit 1
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

summary_json="$(request_json "/api/iso-command-center/unified")"
standards_json="$(request_json "/api/iso-command-center/standards")"
readiness_json="$(request_json "/api/iso-command-center/readiness")"

echo "$summary_json" | jq -e '.ok == true and ((.data.standard_cards // .standard_cards) | type == "array")' >/dev/null
echo "$standards_json" | jq -e '.ok == true' >/dev/null
echo "$readiness_json" | jq -e '.ok == true' >/dev/null

if echo "$summary_json" | jq -e '[(.data.standard_cards // .standard_cards // [])[].publication_status] | index("transition_prep")' >/dev/null; then
  echo "ERROR: standard_cards incluye version transition_prep; debe quedar solo como transition_items" >&2
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  psql "$DATABASE_URL" -c "
  SELECT 'standards' AS table_name, COUNT(*) AS total FROM standards
  UNION ALL SELECT 'tenant_standards', COUNT(*) FROM tenant_standards
  UNION ALL SELECT 'tenant_controls', COUNT(*) FROM tenant_controls
  UNION ALL SELECT 'evidences', COUNT(*) FROM evidences
  ORDER BY table_name;
  "

  if [[ -n "$TENANT_ID" ]]; then
    active_codes="$(psql "$DATABASE_URL" -At -c "
      SELECT DISTINCT standard_code
      FROM tenant_standards
      WHERE tenant_id = '${TENANT_ID}'::uuid
        AND is_active IS DISTINCT FROM false
      ORDER BY standard_code;
    ")"

    visible_codes="$(echo "$summary_json" | jq -r '(.data.standard_cards // .standard_cards // [])[].standard_code' | sort -u)"
    while IFS= read -r code; do
      [[ -z "$code" ]] && continue
      if ! grep -qx "$code" <<< "$active_codes"; then
        echo "ERROR: Centro de Control devolvio norma no contratada: ${code}" >&2
        exit 1
      fi
    done <<< "$visible_codes"
  fi
fi

frontend_code="$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/centro-control-iso")"
if [[ "$frontend_code" != "200" && "$frontend_code" != "307" && "$frontend_code" != "308" ]]; then
  echo "ERROR: frontend /centro-control-iso devolvio HTTP ${frontend_code}" >&2
  exit 1
fi

echo "OK: Centro de Control ISO Unificado validado correctamente."
