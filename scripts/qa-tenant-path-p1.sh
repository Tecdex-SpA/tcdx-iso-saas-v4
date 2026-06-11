#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-}"
TENANT_A_ID="${TENANT_A_ID:-}"
TENANT_B_ID="${TENANT_B_ID:-}"
TENANT_A_TOKEN="${TENANT_A_TOKEN:-}"
TENANT_B_TOKEN="${TENANT_B_TOKEN:-}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-10}"
CURL_MAX_TIME="${CURL_MAX_TIME:-60}"
OUT_DIR="${OUT_DIR:-./qa-results/tenant-path-p1-$(date +%Y%m%d_%H%M%S)}"

PASS=0
FAIL=0
SKIP=0

fail_setup() {
  echo "ERROR: $*" >&2
  exit 2
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail_setup "Missing required command: $1"
}

require_env() {
  local name="$1"
  local value="$2"
  [ -n "$value" ] || fail_setup "Missing required env var: $name"
}

contains_code() {
  local code="$1"
  local expected_codes="$2"
  local expected

  IFS=',' read -r -a expected_values <<< "$expected_codes"
  for expected in "${expected_values[@]}"; do
    if [ "$code" = "$expected" ]; then
      return 0
    fi
  done

  return 1
}

request_code() {
  local path="$1"
  local token="$2"
  local out_file="$3"

  curl -skS \
    --connect-timeout "$CURL_CONNECT_TIMEOUT" \
    --max-time "$CURL_MAX_TIME" \
    -X GET "${API_BASE_URL}${path}" \
    -H "Authorization: Bearer $token" \
    -o "$out_file" \
    -w "%{http_code}"
}

record() {
  local status="$1"
  local check_name="$2"
  local detail="$3"

  case "$status" in
    PASS) PASS=$((PASS + 1)) ;;
    FAIL) FAIL=$((FAIL + 1)) ;;
    SKIP) SKIP=$((SKIP + 1)) ;;
  esac

  printf '| %s | `%s` | %s |\n' "$status" "$check_name" "$detail" | tee -a "$OUT_DIR/summary.md"
}

expect_get() {
  local check_name="$1"
  local path="$2"
  local token="$3"
  local expected_codes="$4"
  local safe_name
  local out_file
  local code

  safe_name="$(printf '%s' "$check_name" | tr -c 'a-zA-Z0-9._-' '_')"
  out_file="$OUT_DIR/${safe_name}.response"
  code="$(request_code "$path" "$token" "$out_file" || true)"

  if contains_code "$code" "$expected_codes"; then
    record PASS "$check_name" "HTTP $code"
  else
    record FAIL "$check_name" "HTTP ${code:-sin respuesta}; esperado: $expected_codes"
  fi
}

check_tenant_path() {
  local check_prefix="$1"
  local path_prefix="$2"
  local path_suffix="${3:-}"
  local same_codes="${4:-200,204}"

  expect_get \
    "${check_prefix}-same-tenant-a" \
    "${path_prefix}${TENANT_A_ID}${path_suffix}" \
    "$TENANT_A_TOKEN" \
    "$same_codes"

  expect_get \
    "${check_prefix}-cross-tenant-a-to-b" \
    "${path_prefix}${TENANT_B_ID}${path_suffix}" \
    "$TENANT_A_TOKEN" \
    "403,404"
}

main() {
  need_cmd curl

  require_env API_BASE_URL "$API_BASE_URL"
  require_env TENANT_A_ID "$TENANT_A_ID"
  require_env TENANT_B_ID "$TENANT_B_ID"
  require_env TENANT_A_TOKEN "$TENANT_A_TOKEN"
  require_env TENANT_B_TOKEN "$TENANT_B_TOKEN"

  if [ "$TENANT_A_ID" = "$TENANT_B_ID" ]; then
    fail_setup "TENANT_A_ID and TENANT_B_ID must be different."
  fi

  API_BASE_URL="${API_BASE_URL%/}"
  mkdir -p "$OUT_DIR"

  {
    echo "# QA Tenant Path P1"
    echo
    echo "- API base: \`$API_BASE_URL\`"
    echo "- Tenant A token: provided"
    echo "- Tenant B token: provided"
    echo
    echo "| Resultado | Check | Detalle |"
    echo "|---|---|---|"
  } > "$OUT_DIR/summary.md"

  check_tenant_path "objectives" "/api/objectives/"

  expect_get \
    "objectives-same-tenant-b" \
    "/api/objectives/${TENANT_B_ID}" \
    "$TENANT_B_TOKEN" \
    "200"

  expect_get \
    "objectives-cross-tenant-b-to-a" \
    "/api/objectives/${TENANT_A_ID}" \
    "$TENANT_B_TOKEN" \
    "403,404"

  check_tenant_path "assets" "/api/assets/"
  check_tenant_path "assets-risk-summary" "/api/assets/risk-summary/"
  check_tenant_path "tenant-standards" "/api/tenant-standards/"
  check_tenant_path "policy" "/api/policy/" "/ISO27001" "200,404"
  check_tenant_path "kpi-dashboard" "/api/kpis/dashboard/" "" "200,204,404"
  check_tenant_path "lifecycle-summary" "/api/lifecycle/summary/" "" "200,204"

  record SKIP \
    "tenant-standards-operations" \
    "GET ejecuta ensureDefaultOperation; omitido para evitar escrituras implicitas"
  record SKIP \
    "tenant-standards-scope" \
    "GET ejecuta ensureDefaultOperation; omitido para evitar escrituras implicitas"
  record SKIP \
    "soa" \
    "GET ejecuta bootstrapSoA; omitido para evitar escrituras implicitas"
  record SKIP \
    "lifecycle-board" \
    "GET ejecuta rebuildLifecycle; omitido para evitar escrituras implicitas"

  {
    echo
    echo "## Resumen"
    echo
    echo "- PASS: $PASS"
    echo "- FAIL: $FAIL"
    echo "- SKIP: $SKIP"
  } | tee -a "$OUT_DIR/summary.md"

  echo "Results: $OUT_DIR"

  if [ "$FAIL" -gt 0 ]; then
    exit 1
  fi
}

main "$@"
