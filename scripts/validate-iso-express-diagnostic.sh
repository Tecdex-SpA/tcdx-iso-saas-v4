#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://192.168.100.120:3000}"
TOKEN="${TOKEN:-}"
TENANT_ID="${TENANT_ID:-}"

if [ -z "$TOKEN" ]; then
  echo "ERROR: TOKEN esta vacio. Exporta TOKEN con un JWT valido." >&2
  exit 1
fi

if [ -z "$TENANT_ID" ]; then
  echo "ERROR: TENANT_ID esta vacio. Exporta TENANT_ID con un tenant valido." >&2
  exit 1
fi

HAS_JQ=false
if command -v jq >/dev/null 2>&1; then
  HAS_JQ=true
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local output="$4"
  local http_code

  if [ -n "$body" ]; then
    http_code="$(
      curl -s -o "$output" -w "%{http_code}" -X "$method" "$API$path" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$body"
    )"
  else
    http_code="$(
      curl -s -o "$output" -w "%{http_code}" -X "$method" "$API$path" \
        -H "Authorization: Bearer $TOKEN"
    )"
  fi

  if [ "$http_code" -lt 200 ] || [ "$http_code" -ge 300 ]; then
    echo "ERROR: $method $path devolvio HTTP $http_code" >&2
    if [ "$HAS_JQ" = true ]; then
      jq . "$output" >&2 || cat "$output" >&2
    else
      cat "$output" >&2
    fi
    exit 1
  fi
}

extract() {
  local file="$1"
  local filter="$2"

  if [ "$HAS_JQ" != true ]; then
    echo ""
    return
  fi

  jq -r "$filter" "$file"
}

echo "Validando ISO Express Diagnostic API en $API"

OPTIONS_JSON="$TMP_DIR/options.json"
request GET "/api/iso-express-diagnostic/options/$TENANT_ID" "" "$OPTIONS_JSON"

if [ "$HAS_JQ" = true ]; then
  OPTION_COUNT="$(jq '.data.options | length' "$OPTIONS_JSON")"
  if [ "$OPTION_COUNT" -lt 1 ]; then
    echo "ERROR: options no devolvio normas evaluables" >&2
    jq . "$OPTIONS_JSON" >&2
    exit 1
  fi
fi

ISO9001_JSON="$TMP_DIR/iso9001.json"
request POST "/api/iso-express-diagnostic/$TENANT_ID/calculate" \
  '{"standard_code":"ISO9001","version_code":"2015","assessment_type":"express","answers":[]}' \
  "$ISO9001_JSON"

ASSESSMENT_ID="$(extract "$ISO9001_JSON" '.data.assessment.id // empty')"

if [ "$HAS_JQ" = true ] && [ -z "$ASSESSMENT_ID" ]; then
  echo "ERROR: no se obtuvo assessment_id para ISO9001 2015" >&2
  jq . "$ISO9001_JSON" >&2
  exit 1
fi

LATEST_JSON="$TMP_DIR/latest.json"
request GET "/api/iso-express-diagnostic/$TENANT_ID/latest" "" "$LATEST_JSON"

if [ -n "$ASSESSMENT_ID" ]; then
  DETAIL_JSON="$TMP_DIR/detail.json"
  GAPS_JSON="$TMP_DIR/gaps.json"
  PLAN_JSON="$TMP_DIR/plan.json"
  request GET "/api/iso-express-diagnostic/$TENANT_ID/$ASSESSMENT_ID" "" "$DETAIL_JSON"
  request GET "/api/iso-express-diagnostic/$TENANT_ID/$ASSESSMENT_ID/gaps" "" "$GAPS_JSON"
  request GET "/api/iso-express-diagnostic/$TENANT_ID/$ASSESSMENT_ID/plan" "" "$PLAN_JSON"
fi

READINESS_JSON="$TMP_DIR/readiness.json"
request GET "/api/iso-express-diagnostic/$TENANT_ID/readiness?standard_code=ISO9001&version_code=2015" "" "$READINESS_JSON"

FDIS_JSON="$TMP_DIR/iso9001_2026_fdis.json"
request POST "/api/iso-express-diagnostic/$TENANT_ID/calculate" \
  '{"standard_code":"ISO9001","version_code":"2026_FDIS","assessment_type":"transition_readiness","answers":[]}' \
  "$FDIS_JSON"

if [ "$HAS_JQ" = true ]; then
  FDIS_CERTIFIABLE="$(jq -r '
    if (.data.assessment | has("certifiable_version")) then
      .data.assessment.certifiable_version
    elif (.data.summary | has("certifiable")) then
      .data.summary.certifiable
    else
      empty
    end
  ' "$FDIS_JSON")"
  FDIS_TYPE="$(jq -r '.data.assessment.assessment_type // empty' "$FDIS_JSON")"

  if [ "$FDIS_CERTIFIABLE" != "false" ]; then
    echo "ERROR: ISO9001 2026_FDIS no devolvio certifiable=false" >&2
    jq . "$FDIS_JSON" >&2
    exit 1
  fi

  if [ "$FDIS_TYPE" != "transition_readiness" ]; then
    echo "ERROR: ISO9001 2026_FDIS no uso transition_readiness" >&2
    jq . "$FDIS_JSON" >&2
    exit 1
  fi
fi

echo "OK: ISO Express Diagnostic API validada correctamente."
