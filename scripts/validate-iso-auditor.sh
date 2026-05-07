#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://192.168.100.120:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://192.168.100.130:3000}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
TOKEN="${TOKEN:-}"

echo "Validando Auditor ISO asistido en ${API_URL}"

if [[ -n "$TEST_EMAIL" && -n "$TEST_PASSWORD" ]]; then
  TOKEN="$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" | jq -r '.token // .data.token // empty')"
fi

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: define TOKEN o TEST_EMAIL/TEST_PASSWORD" >&2
  exit 1
fi

tmp="$(mktemp)"
code="$(curl -s -o "$tmp" -w "%{http_code}" "${API_URL}/api/iso-auditor/preview" \
  -H "Authorization: Bearer ${TOKEN}")"

if [[ "$code" != "200" ]]; then
  echo "ERROR: GET /api/iso-auditor/preview devolvio HTTP ${code}" >&2
  cat "$tmp" >&2
  rm -f "$tmp"
  exit 1
fi

jq -e '.ok == true and ((.data.standards // .standards) | type == "array")' "$tmp" >/dev/null

if jq -e '[(.data.standards // .standards // [])[].publication_status] | index("transition_prep")' "$tmp" >/dev/null; then
  echo "ERROR: Auditor ISO devolvio version transition_prep como norma auditada operativa" >&2
  rm -f "$tmp"
  exit 1
fi

rm -f "$tmp"

frontend_code="$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/auditor-iso")"
if [[ "$frontend_code" != "200" && "$frontend_code" != "307" && "$frontend_code" != "308" ]]; then
  echo "ERROR: frontend /auditor-iso devolvio HTTP ${frontend_code}" >&2
  exit 1
fi

echo "OK: Auditor ISO asistido validado correctamente."
