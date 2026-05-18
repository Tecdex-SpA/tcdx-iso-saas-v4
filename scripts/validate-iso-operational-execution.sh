#!/usr/bin/env bash
set -euo pipefail

API="${API_URL:-${API:-https://181.212.166.187:8443}}"
TOKEN="${TOKEN:-}"
TEST_EMAIL="${TEST_EMAIL:-admin@rieltec.com}"
TEST_PASSWORD="${TEST_PASSWORD:-123456}"
DATABASE_URL_CHECK="${DATABASE_URL:-}"

HAS_JQ=false
if command -v jq >/dev/null 2>&1; then
  HAS_JQ=true
fi

if [ -z "$TOKEN" ]; then
  if [ "$HAS_JQ" != true ]; then
    echo "ERROR: TOKEN vacio y jq no disponible para login automatico." >&2
    exit 1
  fi

  TOKEN="$(curl -s -X POST "$API/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" | jq -r '.token // empty')"
fi

if [ -z "$TOKEN" ]; then
  echo "ERROR: no se pudo obtener TOKEN valido." >&2
  exit 1
fi

tmp_body="$(mktemp)"
tmp_before="$(mktemp)"
tmp_after="$(mktemp)"
trap 'rm -f "$tmp_body" "$tmp_before" "$tmp_after"' EXIT

request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local status

  if [ -n "$body" ]; then
    status="$(curl -s -o "$tmp_body" -w "%{http_code}" -X "$method" "$API$path" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$body")"
  else
    status="$(curl -s -o "$tmp_body" -w "%{http_code}" -X "$method" "$API$path" \
      -H "Authorization: Bearer $TOKEN")"
  fi

  if [ "$status" -lt 200 ] || [ "$status" -ge 300 ]; then
    echo "ERROR: $method $path devolvio HTTP $status" >&2
    if [ "$HAS_JQ" = true ]; then jq . "$tmp_body" >&2 || cat "$tmp_body" >&2; else cat "$tmp_body" >&2; fi
    exit 1
  fi
}

assert_ok() {
  if [ "$HAS_JQ" = true ]; then
    jq -e '.ok == true' "$tmp_body" >/dev/null
  fi
}

capture_counts() {
  local output_file="$1"

  if [ -z "$DATABASE_URL_CHECK" ]; then
    return 0
  fi

  psql "$DATABASE_URL_CHECK" -At -c "
SELECT 'tenant_standards=' || COUNT(*) FROM tenant_standards
UNION ALL SELECT 'tenant_controls=' || COUNT(*) FROM tenant_controls
UNION ALL SELECT 'evidences=' || COUNT(*) FROM evidences
UNION ALL SELECT 'action_plans=' || COUNT(*) FROM action_plans
UNION ALL SELECT 'findings=' || COUNT(*) FROM findings
UNION ALL SELECT 'tenant_nonconformities=' || COUNT(*) FROM tenant_nonconformities;
" > "$output_file"
}

count_value() {
  local file="$1"
  local key="$2"
  grep "^$key=" "$file" | cut -d= -f2
}

echo "Validando ISO Operational Execution API en $API"

capture_counts "$tmp_before"

request GET "/api/iso-operational-execution/summary"
assert_ok

request POST "/api/iso-operational-execution/generate" '{"dry_run":true}'
assert_ok
if [ "$HAS_JQ" = true ]; then
  jq -e '.data.dry_run == true' "$tmp_body" >/dev/null
fi

request POST "/api/iso-operational-execution/generate" '{"dry_run":false}'
assert_ok

request GET "/api/iso-operational-execution/suggestions?status=pending"
assert_ok

if [ "$HAS_JQ" = true ]; then
  suggestion_id="$(jq -r '.data[0].id // empty' "$tmp_body")"
  if [ -n "$suggestion_id" ]; then
    request GET "/api/iso-operational-execution/$suggestion_id"
    assert_ok

    request POST "/api/iso-operational-execution/$suggestion_id/approve" '{"dry_run":true}'
    assert_ok
    jq -e '.data.dry_run == true' "$tmp_body" >/dev/null
  else
    echo "WARN: no hay sugerencias pendientes para probar approve dry-run."
  fi
fi

capture_counts "$tmp_after"

if [ -s "$tmp_before" ] && [ -s "$tmp_after" ]; then
  for key in tenant_standards tenant_controls evidences; do
    before="$(count_value "$tmp_before" "$key")"
    after="$(count_value "$tmp_after" "$key")"
    if [ "$before" != "$after" ]; then
      echo "ERROR: conteo $key cambio durante generate ($before -> $after)" >&2
      exit 1
    fi
  done

  before_actions="$(count_value "$tmp_before" action_plans)"
  after_actions="$(count_value "$tmp_after" action_plans)"
  if [ "$before_actions" != "$after_actions" ]; then
    echo "ERROR: generate/dry-run creo action_plans automaticamente ($before_actions -> $after_actions)" >&2
    exit 1
  fi
fi

echo "OK: ISO Operational Execution API validada correctamente."
