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
  local output="$TMP_DIR/$(echo "$path" | tr '/?' '__').json"
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

  if [ "$HAS_JQ" -eq 1 ]; then
    if ! jq -e '.ok == true' "$output" >/dev/null; then
      echo "ERROR: GET $path no devolvio ok=true" >&2
      jq . "$output" >&2
      exit 1
    fi
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

echo "Validando ISO Knowledge API en $API"

standards_file="$(request "/api/iso-knowledge/standards")"
versions_9001_file="$(request "/api/iso-knowledge/standards/ISO9001/versions")"
versions_27001_file="$(request "/api/iso-knowledge/standards/ISO27001/versions")"
versions_42001_file="$(request "/api/iso-knowledge/standards/ISO42001/versions")"

request "/api/iso-knowledge/ISO9001/2015/clauses" >/dev/null
request "/api/iso-knowledge/ISO9001/2015/controls" >/dev/null
request "/api/iso-knowledge/ISO9001/2015/evidence-expectations" >/dev/null
request "/api/iso-knowledge/ISO9001/2015/policy-templates" >/dev/null
request "/api/iso-knowledge/ISO9001/2015/procedure-templates" >/dev/null
request "/api/iso-knowledge/ISO9001/2015/risk-templates" >/dev/null
request "/api/iso-knowledge/ISO9001/2015/audit-questions" >/dev/null
request "/api/iso-knowledge/ISO9001/2015/gap-rules" >/dev/null
request "/api/iso-knowledge/ISO9001/2015/maturity-rules" >/dev/null
request "/api/iso-knowledge/ISO9001/2015/ai-guidance" >/dev/null

request "/api/iso-knowledge/ISO9001/2026_FDIS/controls" >/dev/null
ai_2026_file="$(request "/api/iso-knowledge/ISO9001/2026_FDIS/ai-guidance")"

request "/api/iso-knowledge/ISO27001/2022/controls" >/dev/null
request "/api/iso-knowledge/ISO27001/2022/evidence-expectations" >/dev/null
request "/api/iso-knowledge/ISO42001/2023/controls" >/dev/null
request "/api/iso-knowledge/ISO42001/2023/evidence-expectations" >/dev/null
request "/api/iso-knowledge/crosswalks" >/dev/null
transition_file="$(request "/api/iso-knowledge/transition/iso9001-2026")"
sync_file="$(request "/api/iso-knowledge/sync-status")"
request "/api/iso-knowledge/ISO9001/2015/catalog-links" >/dev/null

assert_jq "$standards_file" '.data[] | select(.standard_code == "ISO9001")' "ISO9001 no existe en /standards"
assert_jq "$standards_file" '.data[] | select(.standard_code == "ISO27001")' "ISO27001 no existe en /standards"
assert_jq "$standards_file" '.data[] | select(.standard_code == "ISO42001")' "ISO42001 no existe en /standards"
assert_jq "$versions_9001_file" '.data[] | select(.version_code == "2015" and .certifiable == true)' "ISO9001 2015 debe ser certifiable=true"
assert_jq "$versions_9001_file" '.data[] | select(.version_code == "2026_FDIS" and .certifiable == false)' "ISO9001 2026_FDIS debe ser certifiable=false"
assert_jq "$versions_27001_file" '.data[] | select(.version_code == "2022" and .certifiable == true)' "ISO27001 2022 debe existir y ser certifiable=true"
assert_jq "$versions_42001_file" '.data[] | select(.version_code == "2023" and .certifiable == true)' "ISO42001 2023 debe existir y ser certifiable=true"
assert_jq "$ai_2026_file" '.data[] | select((.forbidden_claims | index("No afirmar que ISO9001:2026_FDIS es certificable final")) != null)' "AI guidance 2026_FDIS debe prohibir afirmar certificabilidad final"
assert_jq "$transition_file" '.data.certifiable_target == false and .data.target.version_code == "2026_FDIS"' "Transicion ISO9001 2026 debe devolver certifiable_target=false"
assert_jq "$sync_file" '.data[] | select(.sync_target == "controls_catalog")' "sync-status debe incluir controls_catalog"
assert_jq "$sync_file" '.data[] | select(.sync_target == "ai_knowledge_records")' "sync-status debe incluir ai_knowledge_records"
assert_jq "$sync_file" '.data[] | select(.sync_target == "tenant_controls")' "sync-status debe incluir tenant_controls"

echo "OK: ISO Knowledge API validada correctamente."
