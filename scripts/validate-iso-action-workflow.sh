#!/usr/bin/env bash
set -euo pipefail

: "${API_URL:?API_URL requerido, ej: http://localhost:3000}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
TOKEN="${TOKEN:-}"
ALLOW_WRITE_TEST="${ALLOW_WRITE_TEST:-false}"

echo "Validando workflow de acciones recomendadas ISO en ${API_URL}"

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
code="$(curl -s -o "$tmp" -w "%{http_code}" "${API_URL}/api/iso-recommended-actions/workflow-summary" \
  -H "Authorization: Bearer ${TOKEN}")"

if [[ "$code" != "200" ]]; then
  echo "ERROR: GET /api/iso-recommended-actions/workflow-summary devolvio HTTP ${code}" >&2
  cat "$tmp" >&2
  rm -f "$tmp"
  exit 1
fi

jq -e '.ok == true' "$tmp" >/dev/null
rm -f "$tmp"

if [[ "$ALLOW_WRITE_TEST" == "true" ]]; then
  echo "ALLOW_WRITE_TEST=true: valida solo si ACTION_ID esta definido."
  if [[ -n "${ACTION_ID:-}" ]]; then
    tmp="$(mktemp)"
    code="$(curl -s -o "$tmp" -w "%{http_code}" -X POST "${API_URL}/api/iso-recommended-actions/${ACTION_ID}/workflow/comment" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"comment":"Validacion controlada de workflow ISO."}')"
    if [[ "$code" != "200" ]]; then
      echo "ERROR: POST workflow/comment devolvio HTTP ${code}" >&2
      cat "$tmp" >&2
      rm -f "$tmp"
      exit 1
    fi
    rm -f "$tmp"
  fi
else
  echo "ALLOW_WRITE_TEST=false: no se escribieron eventos de workflow."
fi

echo "OK: workflow de acciones recomendadas ISO validado correctamente."
