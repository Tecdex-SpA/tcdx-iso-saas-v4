#!/usr/bin/env bash
set -euo pipefail

API="${API:-https://181.212.166.187:8443}"
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
tmp_options="$(mktemp)"
trap 'rm -f "$tmp_body" "$tmp_options"' EXIT

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

option_available() {
  local standard="$1"
  local version="$2"

  if [ "$HAS_JQ" != true ]; then
    return 0
  fi

  jq -e \
    --arg standard "$standard" \
    --arg version "$version" \
    '.data.options[]? | select(.standard_code == $standard and .version_code == $version)' \
    "$tmp_options" >/dev/null
}

generate_dry_run_if_available() {
  local standard="$1"
  local version="$2"
  local run_type="$3"
  local required="${4:-false}"

  if ! option_available "$standard" "$version"; then
    if [ "$required" = "true" ]; then
      echo "ERROR: $standard $version no aparece en options para este tenant" >&2
      exit 1
    fi

    echo "SKIP: $standard $version no esta disponible para este tenant."
    return 0
  fi

  request POST "/api/iso-risk-matrix/$TENANT_ID/generate" "$(generate_payload "$standard" "$version" "$run_type" true)"
  assert_ok
}

echo "Validando ISO Risk Matrix API en $API"

request GET "/api/iso-risk-matrix/$TENANT_ID/options"
assert_ok
cp "$tmp_body" "$tmp_options"

generate_dry_run_if_available ISO9001 2015 automated true
assert_ok
if [ "$HAS_JQ" = true ]; then
  jq -e '.data.dry_run == true' "$tmp_body" >/dev/null
fi

generate_dry_run_if_available ISO27001 2022 automated false

generate_dry_run_if_available ISO42001 2023 automated false

if option_available ISO9001 2026_FDIS; then
  request POST "/api/iso-risk-matrix/$TENANT_ID/generate" "$(generate_payload ISO9001 2026_FDIS transition_readiness true)"
  assert_ok
elif [ "$HAS_JQ" = true ]; then
  echo "SKIP: ISO9001 2026_FDIS no esta disponible para este tenant."
fi
if [ "$HAS_JQ" = true ] && option_available ISO9001 2026_FDIS; then
  jq -e '.data.run.certifiable_version == false' "$tmp_body" >/dev/null || {
    echo "ERROR: ISO9001 2026_FDIS no devolvio certifiable_version=false" >&2
    jq . "$tmp_body" >&2
    exit 1
  }
fi

if [ "$APPLY_REAL" = "true" ]; then
  echo "APPLY_REAL=true: generando matriz real ISO9001 2015"
  if ! option_available ISO9001 2015; then
    echo "ERROR: ISO9001 2015 no esta disponible para este tenant; no se aplica matriz real." >&2
    exit 1
  fi
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
