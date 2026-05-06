#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://192.168.100.120:3000}"
TOKEN="${TOKEN:-}"
TENANT_ID="${TENANT_ID:-}"
APPLY_REAL="${APPLY_REAL:-false}"

if [ -z "$TOKEN" ]; then
  echo "ERROR: TOKEN vacio. Exporta TOKEN con un JWT valido." >&2
  exit 1
fi

if [ -z "$TENANT_ID" ]; then
  echo "ERROR: TENANT_ID vacio. Exporta TENANT_ID valido." >&2
  exit 1
fi

HAS_JQ=false
if command -v jq >/dev/null 2>&1; then
  HAS_JQ=true
fi

tmp_body="$(mktemp)"
trap 'rm -f "$tmp_body"' EXIT

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

generate_payload() {
  local standard="$1"
  local version="$2"
  local run_type="$3"
  local dry_run="$4"

  printf '{"standard_code":"%s","version_code":"%s","run_type":"%s","include_assets":true,"include_diagnostic_gaps":true,"include_existing_asset_risks":true,"dry_run":%s}' \
    "$standard" "$version" "$run_type" "$dry_run"
}

echo "Validando ISO Risk Matrix API en $API"

request GET "/api/iso-risk-matrix/$TENANT_ID/options"
assert_ok

request POST "/api/iso-risk-matrix/$TENANT_ID/generate" "$(generate_payload ISO9001 2015 automated true)"
assert_ok
if [ "$HAS_JQ" = true ]; then
  jq -e '.data.dry_run == true' "$tmp_body" >/dev/null
fi

request POST "/api/iso-risk-matrix/$TENANT_ID/generate" "$(generate_payload ISO27001 2022 automated true)"
assert_ok

request POST "/api/iso-risk-matrix/$TENANT_ID/generate" "$(generate_payload ISO42001 2023 automated true)"
assert_ok

request POST "/api/iso-risk-matrix/$TENANT_ID/generate" "$(generate_payload ISO9001 2026_FDIS transition_readiness true)"
assert_ok
if [ "$HAS_JQ" = true ]; then
  jq -e '.data.run.certifiable_version == false' "$tmp_body" >/dev/null || {
    echo "ERROR: ISO9001 2026_FDIS no devolvio certifiable_version=false" >&2
    jq . "$tmp_body" >&2
    exit 1
  }
fi

if [ "$APPLY_REAL" = "true" ]; then
  echo "APPLY_REAL=true: generando matriz real ISO9001 2015"
  request POST "/api/iso-risk-matrix/$TENANT_ID/generate" "$(generate_payload ISO9001 2015 automated false)"
  assert_ok
else
  echo "APPLY_REAL=false: no se genero matriz real."
fi

request GET "/api/iso-risk-matrix/$TENANT_ID/runs"
assert_ok

request GET "/api/iso-risk-matrix/$TENANT_ID/latest?standard_code=ISO9001&version_code=2015"
assert_ok

request GET "/api/iso-risk-matrix/$TENANT_ID/summary"
assert_ok

echo "OK: ISO Risk Matrix API validada correctamente."
