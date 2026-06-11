#!/usr/bin/env bash
set -euo pipefail
set +x

API_BASE_URL="${API_BASE_URL:-}"
TENANT_A_ID="${TENANT_A_ID:-}"
TENANT_A_TOKEN="${TENANT_A_TOKEN:-}"

TENANT_B_ID="${TENANT_B_ID:-}"
TENANT_B_TOKEN="${TENANT_B_TOKEN:-}"
VIEWER_TOKEN="${VIEWER_TOKEN:-}"
EXPIRED_TOKEN="${EXPIRED_TOKEN:-}"
INVALID_TOKEN="${INVALID_TOKEN:-}"
REPORT_EXPORT_ID="${REPORT_EXPORT_ID:-}"
EVIDENCE_ID="${EVIDENCE_ID:-}"

CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-10}"
CURL_MAX_TIME="${CURL_MAX_TIME:-60}"
OUT_DIR="${OUT_DIR:-./qa-results/e2e-minimal-$(date +%Y%m%d_%H%M%S)}"

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
  local body="${4:-}"

  if [ -n "$body" ]; then
    curl -skS \
      --connect-timeout "$CURL_CONNECT_TIMEOUT" \
      --max-time "$CURL_MAX_TIME" \
      -X "$method" "${API_BASE_URL}${path}" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      --data "$body" \
      -o /dev/null \
      -w "%{http_code}"
  else
    curl -skS \
      --connect-timeout "$CURL_CONNECT_TIMEOUT" \
      --max-time "$CURL_MAX_TIME" \
      -X "$method" "${API_BASE_URL}${path}" \
      -H "Authorization: Bearer $token" \
      -o /dev/null \
      -w "%{http_code}"
  fi
}

record() {
  local check_name="$1"
  local endpoint="$2"
  local expected="$3"
  local obtained="$4"
  local result="$5"
  local observation="$6"

  case "$result" in
    PASS) PASS=$((PASS + 1)) ;;
    FAIL) FAIL=$((FAIL + 1)) ;;
    SKIP) SKIP=$((SKIP + 1)) ;;
  esac

  printf '| `%s` | `%s` | `%s` | `%s` | %s | %s |\n' \
    "$check_name" \
    "$endpoint" \
    "$expected" \
    "$obtained" \
    "$result" \
    "$observation" \
    | tee -a "$OUT_DIR/summary.md"
}

expect_request() {
  local check_name="$1"
  local method="$2"
  local path="$3"
  local token="$4"
  local expected_codes="$5"
  local observation="$6"
  local body="${7:-}"
  local code

  code="$(request_code "$method" "$path" "$token" "$body" || true)"
  code="${code:-000}"

  if contains_code "$code" "$expected_codes"; then
    record "$check_name" "$method $path" "$expected_codes" "$code" PASS "$observation"
  else
    record "$check_name" "$method $path" "$expected_codes" "$code" FAIL "$observation"
  fi
}

record_skip() {
  local check_name="$1"
  local endpoint="$2"
  local expected="$3"
  local reason="$4"

  record "$check_name" "$endpoint" "$expected" "-" SKIP "$reason"
}

provided_state() {
  if [ -n "$1" ]; then
    printf 'provided'
  else
    printf 'not set'
  fi
}

main() {
  local invalid_token_to_test

  need_cmd curl

  require_env API_BASE_URL "$API_BASE_URL"
  require_env TENANT_A_ID "$TENANT_A_ID"
  require_env TENANT_A_TOKEN "$TENANT_A_TOKEN"

  if { [ -n "$TENANT_B_ID" ] && [ -z "$TENANT_B_TOKEN" ]; } ||
     { [ -z "$TENANT_B_ID" ] && [ -n "$TENANT_B_TOKEN" ]; }; then
    fail_setup "TENANT_B_ID and TENANT_B_TOKEN must be provided together."
  fi

  if [ -n "$TENANT_B_ID" ] && [ "$TENANT_A_ID" = "$TENANT_B_ID" ]; then
    fail_setup "TENANT_A_ID and TENANT_B_ID must be different."
  fi

  API_BASE_URL="${API_BASE_URL%/}"
  invalid_token_to_test="${INVALID_TOKEN:-invalid.token.value}"
  mkdir -p "$OUT_DIR"

  {
    echo "# QA E2E minima demo/piloto"
    echo
    echo "- API base: \`$API_BASE_URL\`"
    echo "- Tenant A token: provided"
    echo "- Tenant B ID/token: $(provided_state "$TENANT_B_TOKEN")"
    echo "- Viewer token: $(provided_state "$VIEWER_TOKEN")"
    echo "- Expired token: $(provided_state "$EXPIRED_TOKEN")"
    echo "- Invalid token: $(provided_state "$INVALID_TOKEN")"
    echo "- Report export ID: $(provided_state "$REPORT_EXPORT_ID")"
    echo "- Evidence ID: $(provided_state "$EVIDENCE_ID")"
    echo
    echo "| Check | Endpoint | Esperado | Obtenido | Resultado | Observacion |"
    echo "|---|---|---|---|---|---|"
  } > "$OUT_DIR/summary.md"

  expect_request \
    "session-authorized" \
    GET \
    "/api/me/session" \
    "$TENANT_A_TOKEN" \
    "200" \
    "Sesion JWT valida."

  expect_request \
    "dashboard-authorized" \
    GET \
    "/api/dashboard/${TENANT_A_ID}" \
    "$TENANT_A_TOKEN" \
    "200" \
    "Ruta principal de demo."

  expect_request \
    "evidences-authorized" \
    GET \
    "/api/evidences/${TENANT_A_ID}" \
    "$TENANT_A_TOKEN" \
    "200" \
    "Listado de evidencias same-tenant."

  expect_request \
    "reports-exports-authorized" \
    GET \
    "/api/reports/exports?tenant_id=${TENANT_A_ID}" \
    "$TENANT_A_TOKEN" \
    "200" \
    "Historial de exportes same-tenant."

  expect_request \
    "health-authorized" \
    GET \
    "/api/health/summary?tenant_id=${TENANT_A_ID}" \
    "$TENANT_A_TOKEN" \
    "200" \
    "Resumen de salud same-tenant."

  record_skip \
    "logout" \
    "N/A" \
    "SKIP" \
    "No existe endpoint logout backend identificado; no se invalida un token compartido."

  if [ -n "$EXPIRED_TOKEN" ]; then
    expect_request \
      "expired-token-denied" \
      GET \
      "/api/me/session" \
      "$EXPIRED_TOKEN" \
      "401,403" \
      "Token expirado rechazado."
  else
    record_skip \
      "expired-token-denied" \
      "GET /api/me/session" \
      "401,403" \
      "EXPIRED_TOKEN no definido."
  fi

  expect_request \
    "invalid-token-denied" \
    GET \
    "/api/me/session" \
    "$invalid_token_to_test" \
    "401,403" \
    "Token invalido rechazado."

  if [ -n "$VIEWER_TOKEN" ]; then
    expect_request \
      "viewer-reports-read" \
      GET \
      "/api/reports/exports?tenant_id=${TENANT_A_ID}" \
      "$VIEWER_TOKEN" \
      "200" \
      "Viewer puede leer reportes de su tenant."

    expect_request \
      "viewer-reports-generate-denied" \
      POST \
      "/api/reports/generate" \
      "$VIEWER_TOKEN" \
      "403,404" \
      "Viewer no puede generar reportes." \
      "{\"tenant_id\":\"${TENANT_A_ID}\"}"
  else
    record_skip \
      "viewer-reports-read" \
      "GET /api/reports/exports?tenant_id={TENANT_A_ID}" \
      "200" \
      "VIEWER_TOKEN no definido."
    record_skip \
      "viewer-reports-generate-denied" \
      "POST /api/reports/generate" \
      "403,404" \
      "VIEWER_TOKEN no definido."
  fi

  if [ -n "$REPORT_EXPORT_ID" ]; then
    expect_request \
      "report-download-same-tenant" \
      GET \
      "/api/reports/download/${REPORT_EXPORT_ID}" \
      "$TENANT_A_TOKEN" \
      "200" \
      "Descarga de export autorizado."
  else
    record_skip \
      "report-download-same-tenant" \
      "GET /api/reports/download/{REPORT_EXPORT_ID}" \
      "200" \
      "REPORT_EXPORT_ID no definido."
  fi

  if [ -n "$EVIDENCE_ID" ]; then
    expect_request \
      "evidence-download-same-tenant" \
      GET \
      "/api/evidences/file/${EVIDENCE_ID}" \
      "$TENANT_A_TOKEN" \
      "200,206" \
      "Descarga completa o parcial de evidencia autorizada."
  else
    record_skip \
      "evidence-download-same-tenant" \
      "GET /api/evidences/file/{EVIDENCE_ID}" \
      "200,206" \
      "EVIDENCE_ID no definido."
  fi

  if [ -n "$TENANT_B_ID" ]; then
    expect_request \
      "dashboard-cross-tenant-denied" \
      GET \
      "/api/dashboard/${TENANT_B_ID}" \
      "$TENANT_A_TOKEN" \
      "403,404" \
      "Tenant A no puede navegar el dashboard de Tenant B."

    expect_request \
      "tenant-b-session-authorized" \
      GET \
      "/api/me/session" \
      "$TENANT_B_TOKEN" \
      "200" \
      "Sesion opcional de Tenant B valida."
  else
    record_skip \
      "dashboard-cross-tenant-denied" \
      "GET /api/dashboard/{TENANT_B_ID}" \
      "403,404" \
      "TENANT_B_ID/TENANT_B_TOKEN no definidos."
    record_skip \
      "tenant-b-session-authorized" \
      "GET /api/me/session" \
      "200" \
      "TENANT_B_ID/TENANT_B_TOKEN no definidos."
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
