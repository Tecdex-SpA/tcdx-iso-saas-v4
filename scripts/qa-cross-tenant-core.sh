#!/usr/bin/env bash
set -Eeuo pipefail

API_BASE_URL="${API_BASE_URL:-}"
TENANT_A_ID="${TENANT_A_ID:-}"
TENANT_B_ID="${TENANT_B_ID:-}"
TENANT_A_TOKEN="${TENANT_A_TOKEN:-}"
TENANT_B_TOKEN="${TENANT_B_TOKEN:-}"
PLATFORM_TOKEN="${PLATFORM_TOKEN:-}"

RUN_WRITE_CHECKS="${RUN_WRITE_CHECKS:-true}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-10}"
CURL_MAX_TIME="${CURL_MAX_TIME:-60}"
OUT_DIR="${OUT_DIR:-./qa-results/cross-tenant-core-$(date +%Y%m%d_%H%M%S)}"

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

mask_id() {
  local value="$1"
  if [ "${#value}" -le 10 ]; then
    printf '%s' "$value"
  else
    printf '%s...%s' "${value:0:8}" "${value: -4}"
  fi
}

json_escape() {
  python3 - "$1" <<'PY'
import json, sys
print(json.dumps(sys.argv[1]))
PY
}

contains_code() {
  local code="$1"
  local list="$2"
  IFS=',' read -r -a values <<< "$list"
  for expected in "${values[@]}"; do
    if [ "$code" = "$expected" ]; then
      return 0
    fi
  done
  return 1
}

render_template() {
  local template="$1"
  local tenant_id="$2"
  local rendered="${template//\{\{TENANT_ID\}\}/$tenant_id}"
  rendered="${rendered//%TENANT_ID%/$tenant_id}"
  printf '%s' "$rendered"
}

request_code() {
  local method="$1"
  local url="$2"
  local token="$3"
  local body="${4:-}"
  local out_file="$5"

  if [ -n "$body" ]; then
    curl -skS \
      --connect-timeout "$CURL_CONNECT_TIMEOUT" \
      --max-time "$CURL_MAX_TIME" \
      -X "$method" "$url" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      --data "$body" \
      -o "$out_file" \
      -w "%{http_code}"
  else
    curl -skS \
      --connect-timeout "$CURL_CONNECT_TIMEOUT" \
      --max-time "$CURL_MAX_TIME" \
      -X "$method" "$url" \
      -H "Authorization: Bearer $token" \
      -o "$out_file" \
      -w "%{http_code}"
  fi
}

record() {
  local status="$1"
  local module="$2"
  local operation="$3"
  local details="$4"

  case "$status" in
    PASS) PASS=$((PASS + 1)) ;;
    FAIL) FAIL=$((FAIL + 1)) ;;
    SKIP) SKIP=$((SKIP + 1)) ;;
  esac

  printf '[%s] %s/%s - %s\n' "$status" "$module" "$operation" "$details" | tee -a "$OUT_DIR/summary.txt"
}

run_case() {
  local module="$1"
  local operation="$2"
  local method="$3"
  local path_template="$4"
  local body_template="$5"
  local same_codes="${6:-200,201,202,204}"
  local cross_codes="${7:-403,404}"
  local requires_write="${8:-false}"

  if [ "$requires_write" = "true" ] && [ "$RUN_WRITE_CHECKS" != "true" ]; then
    record SKIP "$module" "$operation" "RUN_WRITE_CHECKS=false"
    return 0
  fi

  local same_path
  local cross_path
  same_path="$(render_template "$path_template" "$TENANT_A_ID")"
  cross_path="$(render_template "$path_template" "$TENANT_B_ID")"

  local same_body=""
  local cross_body=""
  if [ -n "$body_template" ]; then
    same_body="$(render_template "$body_template" "$TENANT_A_ID")"
    cross_body="$(render_template "$body_template" "$TENANT_B_ID")"
  fi

  local safe_name
  safe_name="$(printf '%s-%s' "$module" "$operation" | tr -c 'a-zA-Z0-9._-' '_')"
  local same_out="$OUT_DIR/${safe_name}-same.json"
  local cross_out="$OUT_DIR/${safe_name}-cross.json"

  local same_code
  local cross_code
  same_code="$(request_code "$method" "$API_BASE_URL$same_path" "$TENANT_A_TOKEN" "$same_body" "$same_out" || true)"
  cross_code="$(request_code "$method" "$API_BASE_URL$cross_path" "$TENANT_A_TOKEN" "$cross_body" "$cross_out" || true)"

  if contains_code "$same_code" "$same_codes"; then
    record PASS "$module" "${operation}:same-tenant" "HTTP $same_code"
  else
    record FAIL "$module" "${operation}:same-tenant" "HTTP $same_code, expected one of $same_codes"
  fi

  if contains_code "$cross_code" "$cross_codes"; then
    record PASS "$module" "${operation}:cross-tenant" "HTTP $cross_code"
  else
    record FAIL "$module" "${operation}:cross-tenant" "HTTP $cross_code, expected one of $cross_codes"
  fi
}

main() {
  need_cmd curl
  need_cmd python3

  require_env API_BASE_URL "$API_BASE_URL"
  require_env TENANT_A_ID "$TENANT_A_ID"
  require_env TENANT_B_ID "$TENANT_B_ID"
  require_env TENANT_A_TOKEN "$TENANT_A_TOKEN"
  require_env TENANT_B_TOKEN "$TENANT_B_TOKEN"

  if [ "$TENANT_A_ID" = "$TENANT_B_ID" ]; then
    fail_setup "TENANT_A_ID and TENANT_B_ID must be different."
  fi

  mkdir -p "$OUT_DIR"
  : > "$OUT_DIR/summary.txt"

  echo "TCDX cross-tenant core QA" | tee -a "$OUT_DIR/summary.txt"
  echo "API_BASE_URL=$API_BASE_URL" | tee -a "$OUT_DIR/summary.txt"
  echo "TENANT_A_ID=$(mask_id "$TENANT_A_ID")" | tee -a "$OUT_DIR/summary.txt"
  echo "TENANT_B_ID=$(mask_id "$TENANT_B_ID")" | tee -a "$OUT_DIR/summary.txt"
  echo "TENANT_A_TOKEN=provided" | tee -a "$OUT_DIR/summary.txt"
  echo "TENANT_B_TOKEN=provided" | tee -a "$OUT_DIR/summary.txt"
  [ -n "$PLATFORM_TOKEN" ] && echo "PLATFORM_TOKEN=provided" | tee -a "$OUT_DIR/summary.txt"
  echo "RUN_WRITE_CHECKS=$RUN_WRITE_CHECKS" | tee -a "$OUT_DIR/summary.txt"
  echo "" | tee -a "$OUT_DIR/summary.txt"

  local tiny_body
  tiny_body='{"tenant_id":"{{TENANT_ID}}","qa_cross_tenant":true}'

  run_case dashboard read GET '/api/dashboard/{{TENANT_ID}}' '' '200,204' '403,404'
  run_case controls read GET '/api/controls/{{TENANT_ID}}' '' '200,204' '403,404'
  run_case controls read-workbench GET '/api/controls/workbench/{{TENANT_ID}}/ISO9001' '' '200,204,400,404' '403,404'
  run_case risks read GET '/api/iso-risk-matrix/{{TENANT_ID}}/latest' '' '200,204,404' '403,404'
  run_case evidences read GET '/api/evidences/{{TENANT_ID}}' '' '200,204' '403,404'
  run_case evidences jobs GET '/api/evidences/jobs/{{TENANT_ID}}' '' '200,204' '403,404'
  run_case audits read GET '/api/audits/{{TENANT_ID}}' '' '200,204' '403,404'
  run_case audits summary GET '/api/audits/summary/{{TENANT_ID}}' '' '200,204' '403,404'
  run_case findings read GET '/api/findings/{{TENANT_ID}}' '' '200,204' '403,404'
  run_case findings controls GET '/api/findings/controls/{{TENANT_ID}}' '' '200,204' '403,404'
  run_case nonconformities read GET '/api/nonconformities/{{TENANT_ID}}' '' '200,204' '403,404'
  run_case action-plans read GET '/api/action-plans/{{TENANT_ID}}' '' '200,204' '403,404'
  run_case reports exports GET '/api/reports/exports?tenant_id={{TENANT_ID}}' '' '200,204' '403,404'
  run_case reports types GET '/api/reports/types?tenant_id={{TENANT_ID}}' '' '200,204' '403,404'
  run_case document-integrations sources GET '/api/document-integrations/sources?tenant_id={{TENANT_ID}}' '' '200,204' '403,404'
  run_case document-integrations documents GET '/api/document-integrations/documents?tenant_id={{TENANT_ID}}' '' '200,204' '403,404'
  run_case ai-compliance health-summary GET '/api/ai-compliance/health-summary?tenant_id={{TENANT_ID}}' '' '200,204,403' '403,404'
  run_case ai-compliance analyze POST '/api/ai-compliance/analyze' "$tiny_body" '200,201,202,400,403' '403,404' true
  run_case ai-auditor scope GET '/api/ai-auditor/scope?tenant_id={{TENANT_ID}}' '' '200,204,403' '403,404'
  run_case ai-auditor runs GET '/api/ai-auditor/runs/{{TENANT_ID}}' '' '200,204,403' '403,404'
  run_case health summary GET '/api/health/summary?tenant_id={{TENANT_ID}}' '' '200,204,404' '403,404'
  run_case tenant-files read GET '/api/files/tenant/{{TENANT_ID}}/qa-cross-tenant-missing-file' '' '404' '403,404'

  if [ -n "${REPORT_EXPORT_ID:-}" ]; then
    run_case reports download GET "/api/reports/download/${REPORT_EXPORT_ID}?tenant_id={{TENANT_ID}}" '' '200,204,404' '403,404'
  else
    record SKIP reports download 'REPORT_EXPORT_ID not set'
  fi

  if [ -n "${EVIDENCE_ID:-}" ]; then
    run_case evidences download GET "/api/evidences/file/${EVIDENCE_ID}?tenant_id={{TENANT_ID}}" '' '200,204,404' '403,404'
  else
    record SKIP evidences download 'EVIDENCE_ID not set'
  fi

  echo "" | tee -a "$OUT_DIR/summary.txt"
  echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP" | tee -a "$OUT_DIR/summary.txt"
  echo "Results: $OUT_DIR" | tee -a "$OUT_DIR/summary.txt"

  if [ "$FAIL" -gt 0 ]; then
    exit 1
  fi
}

main "$@"
