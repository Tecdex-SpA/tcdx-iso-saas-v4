#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://192.168.100.120:3000}"
TOKEN="${TOKEN:-}"
APPLY_REAL="${APPLY_REAL:-false}"
MIN_CONFIDENCE="${MIN_CONFIDENCE:-0.85}"

if [ -z "$TOKEN" ]; then
  echo "ERROR: TOKEN esta vacio. Exporta TOKEN con un JWT valido antes de ejecutar." >&2
  exit 1
fi

HAS_JQ=0
if command -v jq >/dev/null 2>&1; then
  HAS_JQ=1
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

request() {
  local path="$1"
  local output="$TMP_DIR/$(echo "$path" | tr '/?=&' '____').json"
  local status

  status="$(curl -sS -o "$output" -w "%{http_code}" \
    "$API$path" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/json")"

  if [ "$status" != "200" ]; then
    echo "ERROR: GET $path devolvio HTTP $status" >&2
    if [ "$HAS_JQ" -eq 1 ]; then
      jq . "$output" >&2 || cat "$output" >&2
    else
      cat "$output" >&2
    fi
    exit 1
  fi

  if [ "$HAS_JQ" -eq 1 ] && ! jq -e '.ok == true' "$output" >/dev/null; then
    echo "ERROR: GET $path no devolvio ok=true" >&2
    jq . "$output" >&2
    exit 1
  fi

  echo "$output"
}

post_json() {
  local path="$1"
  local payload="$2"
  local output="$TMP_DIR/$(echo "$path" | tr '/?=&' '____')_post.json"
  local status

  status="$(curl -sS -o "$output" -w "%{http_code}" \
    -X POST "$API$path" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d "$payload")"

  if [ "$status" != "200" ]; then
    echo "ERROR: POST $path devolvio HTTP $status" >&2
    if [ "$HAS_JQ" -eq 1 ]; then
      jq . "$output" >&2 || cat "$output" >&2
    else
      cat "$output" >&2
    fi
    exit 1
  fi

  if [ "$HAS_JQ" -eq 1 ] && ! jq -e '.ok == true and .success == true' "$output" >/dev/null; then
    echo "ERROR: POST $path no devolvio ok/success=true" >&2
    jq . "$output" >&2
    exit 1
  fi

  echo "$output"
}

assert_jq() {
  local file="$1"
  local expression="$2"
  local message="$3"

  if [ "$HAS_JQ" -ne 1 ]; then
    echo "WARN: jq no esta disponible; omitiendo validacion estructural: $message"
    return 0
  fi

  if ! jq -e "$expression" "$file" >/dev/null; then
    echo "ERROR: $message" >&2
    jq . "$file" >&2
    exit 1
  fi
}

echo "Validando ISO Control Mapping API en $API"

coverage_file="$(request "/api/iso-control-mapping/coverage")"
sync_file="$(request "/api/iso-control-mapping/sync-status")"
request "/api/iso-control-mapping/unlinked-iso-controls" >/dev/null
request "/api/iso-control-mapping/unlinked-catalog-controls" >/dev/null
request "/api/iso-control-mapping/catalog-links" >/dev/null
review_queue_file="$(request "/api/iso-control-mapping/review-queue?min_confidence=$MIN_CONFIDENCE")"
application_summary_file="$(request "/api/iso-control-mapping/application-summary")"

suggest_9001_file="$(request "/api/iso-control-mapping/suggestions?standard_code=ISO9001&version_code=2015&min_confidence=$MIN_CONFIDENCE")"
suggest_27001_file="$(request "/api/iso-control-mapping/suggestions?standard_code=ISO27001&version_code=2022&min_confidence=$MIN_CONFIDENCE")"
suggest_9001_2026_file="$(request "/api/iso-control-mapping/suggestions?standard_code=ISO9001&version_code=2026_FDIS&min_confidence=$MIN_CONFIDENCE")"
suggest_42001_file="$(request "/api/iso-control-mapping/suggestions?standard_code=ISO42001&version_code=2023&min_confidence=$MIN_CONFIDENCE")"

dry_run_9001_file="$(post_json "/api/iso-control-mapping/apply-suggestions" "{\"standard_code\":\"ISO9001\",\"version_code\":\"2015\",\"min_confidence\":$MIN_CONFIDENCE,\"dry_run\":true}")"
dry_run_27001_file="$(post_json "/api/iso-control-mapping/apply-suggestions" "{\"standard_code\":\"ISO27001\",\"version_code\":\"2022\",\"min_confidence\":$MIN_CONFIDENCE,\"dry_run\":true}")"
dry_run_9001_2026_file="$(post_json "/api/iso-control-mapping/apply-suggestions" "{\"standard_code\":\"ISO9001\",\"version_code\":\"2026_FDIS\",\"min_confidence\":$MIN_CONFIDENCE,\"dry_run\":true}")"

assert_jq "$coverage_file" '.data | type == "array"' "coverage debe devolver arreglo"
assert_jq "$sync_file" '.data[] | select(.sync_target == "controls_catalog")' "sync-status debe incluir controls_catalog"
assert_jq "$review_queue_file" '.data | type == "array"' "review-queue debe devolver arreglo"
assert_jq "$application_summary_file" '.data.coverage | type == "array"' "application-summary debe incluir coverage"
assert_jq "$suggest_9001_file" '.data | type == "array"' "suggestions ISO9001 2015 debe devolver arreglo"
assert_jq "$suggest_27001_file" '.data | type == "array"' "suggestions ISO27001 2022 debe devolver arreglo"
assert_jq "$suggest_9001_2026_file" '[.data[] | select(.suggested_relationship_type != "transition")] | length == 0' "ISO9001 2026_FDIS solo debe sugerir transition"
assert_jq "$suggest_9001_2026_file" '[.data[] | select(.confidence > 0.80)] | length == 0' "ISO9001 2026_FDIS no debe superar confidence 0.80"
assert_jq "$suggest_42001_file" '.data | type == "array"' "suggestions ISO42001 2023 debe devolver arreglo"
assert_jq "$dry_run_9001_file" '.dry_run == true and .summary.applied == 0' "dry-run ISO9001 2015 no debe aplicar"
assert_jq "$dry_run_27001_file" '.dry_run == true and .summary.applied == 0' "dry-run ISO27001 2022 no debe aplicar"
assert_jq "$dry_run_9001_2026_file" '.dry_run == true and .summary.applied == 0 and .summary.can_auto_apply == 0' "ISO9001 2026_FDIS no debe ser autoaplicable"

if [ "$APPLY_REAL" = "true" ]; then
  echo "APPLY_REAL=true: aplicando sugerencias autoaplicables para ISO9001 2015 e ISO27001 2022"
  apply_9001_file="$(post_json "/api/iso-control-mapping/apply-suggestions" "{\"standard_code\":\"ISO9001\",\"version_code\":\"2015\",\"min_confidence\":$MIN_CONFIDENCE,\"dry_run\":false}")"
  apply_27001_file="$(post_json "/api/iso-control-mapping/apply-suggestions" "{\"standard_code\":\"ISO27001\",\"version_code\":\"2022\",\"min_confidence\":$MIN_CONFIDENCE,\"dry_run\":false}")"
  assert_jq "$apply_9001_file" '.dry_run == false' "apply real ISO9001 2015 debe ejecutar"
  assert_jq "$apply_27001_file" '.dry_run == false' "apply real ISO27001 2022 debe ejecutar"
else
  echo "APPLY_REAL=false: no se aplicaron mapeos reales."
fi

echo "OK: ISO Control Mapping API validada correctamente."
