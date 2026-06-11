#!/usr/bin/env bash
set -Eeuo pipefail

API_BASE_URL="${API_BASE_URL:-}"
TENANT_A_ID="${TENANT_A_ID:-}"
TENANT_B_ID="${TENANT_B_ID:-}"
TENANT_A_TOKEN="${TENANT_A_TOKEN:-}"
TENANT_B_TOKEN="${TENANT_B_TOKEN:-}"
VIEWER_TOKEN="${VIEWER_TOKEN:-}"
REPORT_EXPORT_ID="${REPORT_EXPORT_ID:-}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-10}"
CURL_MAX_TIME="${CURL_MAX_TIME:-120}"
OUT_DIR="${OUT_DIR:-./qa-results/reports-rbac-p1-$(date +%Y%m%d_%H%M%S)}"

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
  local method="$1"
  local path="$2"
  local token="$3"
  local out_file="$4"
  local body="${5:-}"

  if [ -n "$body" ]; then
    curl -skS \
      --connect-timeout "$CURL_CONNECT_TIMEOUT" \
      --max-time "$CURL_MAX_TIME" \
      -X "$method" "${API_BASE_URL}${path}" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      --data "$body" \
      -o "$out_file" \
      -w "%{http_code}"
  else
    curl -skS \
      --connect-timeout "$CURL_CONNECT_TIMEOUT" \
      --max-time "$CURL_MAX_TIME" \
      -X "$method" "${API_BASE_URL}${path}" \
      -H "Authorization: Bearer $token" \
      -o "$out_file" \
      -w "%{http_code}"
  fi
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

expect_request() {
  local check_name="$1"
  local method="$2"
  local path="$3"
  local token="$4"
  local expected_codes="$5"
  local body="${6:-}"
  local safe_name
  local out_file
  local code

  safe_name="$(printf '%s' "$check_name" | tr -c 'a-zA-Z0-9._-' '_')"
  out_file="$OUT_DIR/${safe_name}.response"
  code="$(request_code "$method" "$path" "$token" "$out_file" "$body" || true)"

  if contains_code "$code" "$expected_codes"; then
    record PASS "$check_name" "HTTP $code"
  else
    record FAIL "$check_name" "HTTP $code; esperado: $expected_codes"
  fi
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
    echo "# QA Reports RBAC P1"
    echo
    echo "- API base: \`$API_BASE_URL\`"
    echo "- Tenant A token: provided"
    echo "- Tenant B token: provided"
    echo "- Viewer token: $([ -n "$VIEWER_TOKEN" ] && printf 'provided' || printf 'not provided')"
    echo "- Report export ID: $([ -n "$REPORT_EXPORT_ID" ] && printf 'provided' || printf 'not provided')"
    echo
    echo "| Resultado | Check | Detalle |"
    echo "|---|---|---|"
  } > "$OUT_DIR/summary.md"

  expect_request \
    "reports-read-same-tenant" \
    GET \
    "/api/reports/exports?tenant_id=${TENANT_A_ID}" \
    "$TENANT_A_TOKEN" \
    "200"

  expect_request \
    "reports-read-cross-tenant" \
    GET \
    "/api/reports/exports?tenant_id=${TENANT_B_ID}" \
    "$TENANT_A_TOKEN" \
    "403,404"

  local permission_probe_body
  permission_probe_body="{\"tenant_id\":\"${TENANT_A_ID}\"}"

  if [ -n "$VIEWER_TOKEN" ]; then
    expect_request \
      "reports-generate-viewer-denied" \
      POST \
      "/api/reports/generate" \
      "$VIEWER_TOKEN" \
      "403" \
      "$permission_probe_body"
  else
    record SKIP "reports-generate-viewer-denied" "VIEWER_TOKEN no definido"
  fi

  expect_request \
    "reports-generate-authorized-role" \
    POST \
    "/api/reports/generate" \
    "$TENANT_A_TOKEN" \
    "200,201,202,400,404,422" \
    "$permission_probe_body"

  if [ -n "$REPORT_EXPORT_ID" ]; then
    expect_request \
      "reports-download-same-tenant" \
      GET \
      "/api/reports/download/${REPORT_EXPORT_ID}" \
      "$TENANT_A_TOKEN" \
      "200"

    expect_request \
      "reports-download-cross-tenant" \
      GET \
      "/api/reports/download/${REPORT_EXPORT_ID}" \
      "$TENANT_B_TOKEN" \
      "403,404"
  else
    record SKIP "reports-download-same-tenant" "REPORT_EXPORT_ID no definido"
    record SKIP "reports-download-cross-tenant" "REPORT_EXPORT_ID no definido"
  fi

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
