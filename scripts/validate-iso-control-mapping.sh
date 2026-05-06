#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://192.168.100.120:3000}"
TOKEN="${TOKEN:-}"

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

suggest_9001_file="$(request "/api/iso-control-mapping/suggestions?standard_code=ISO9001&version_code=2015")"
suggest_27001_file="$(request "/api/iso-control-mapping/suggestions?standard_code=ISO27001&version_code=2022")"
suggest_9001_2026_file="$(request "/api/iso-control-mapping/suggestions?standard_code=ISO9001&version_code=2026_FDIS")"
suggest_42001_file="$(request "/api/iso-control-mapping/suggestions?standard_code=ISO42001&version_code=2023")"

assert_jq "$coverage_file" '.data | type == "array"' "coverage debe devolver arreglo"
assert_jq "$sync_file" '.data[] | select(.sync_target == "controls_catalog")' "sync-status debe incluir controls_catalog"
assert_jq "$suggest_9001_file" '.data | type == "array"' "suggestions ISO9001 2015 debe devolver arreglo"
assert_jq "$suggest_27001_file" '.data | type == "array"' "suggestions ISO27001 2022 debe devolver arreglo"
assert_jq "$suggest_9001_2026_file" '[.data[] | select(.suggested_relationship_type != "transition")] | length == 0' "ISO9001 2026_FDIS solo debe sugerir transition"
assert_jq "$suggest_9001_2026_file" '[.data[] | select(.confidence > 0.80)] | length == 0' "ISO9001 2026_FDIS no debe superar confidence 0.80"
assert_jq "$suggest_42001_file" '.data | type == "array"' "suggestions ISO42001 2023 debe devolver arreglo"

echo "OK: ISO Control Mapping API validada correctamente."
