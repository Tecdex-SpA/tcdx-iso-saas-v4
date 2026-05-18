#!/usr/bin/env bash
set -euo pipefail

API="${API:-https://181.212.166.187:8443}"
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

echo "Validando ISO Document Generator API en $API"

OPTIONS_JSON="$TMP_DIR/options.json"
request GET "/api/iso-document-generator/$TENANT_ID/options" "" "$OPTIONS_JSON"

TEMPLATES_JSON="$TMP_DIR/templates.json"
request GET "/api/iso-document-generator/$TENANT_ID/templates?standard_code=ISO9001&version_code=2015" "" "$TEMPLATES_JSON"

POLICY_JSON="$TMP_DIR/policy.json"
request POST "/api/iso-document-generator/$TENANT_ID/generate" \
  '{"standard_code":"ISO9001","version_code":"2015","document_type":"policy","template_code":"quality_policy","language":"es","variables":{"scope":"Sistema de gestion de calidad corporativo"},"use_ai":false}' \
  "$POLICY_JSON"

PROCEDURE_JSON="$TMP_DIR/procedure.json"
request POST "/api/iso-document-generator/$TENANT_ID/generate" \
  '{"standard_code":"ISO9001","version_code":"2015","document_type":"procedure","template_code":"document_control_procedure","language":"es","variables":{"scope":"Control documental del sistema de gestion"},"use_ai":false}' \
  "$PROCEDURE_JSON"

DOCUMENTS_JSON="$TMP_DIR/documents.json"
request GET "/api/iso-document-generator/$TENANT_ID/documents" "" "$DOCUMENTS_JSON"

SUMMARY_JSON="$TMP_DIR/summary.json"
request GET "/api/iso-document-generator/$TENANT_ID/summary" "" "$SUMMARY_JSON"

TRANSITION_JSON="$TMP_DIR/transition.json"
request POST "/api/iso-document-generator/$TENANT_ID/generate" \
  '{"standard_code":"ISO9001","version_code":"2026_FDIS","document_type":"transition_guidance","template_code":"iso9001_2026_transition_guidance","language":"es","variables":{"scope":"Preparacion de transicion"},"use_ai":false}' \
  "$TRANSITION_JSON"

if [ "$HAS_JQ" = true ]; then
  POLICY_ID="$(jq -r '.data.document.id // empty' "$POLICY_JSON")"
  PROCEDURE_ID="$(jq -r '.data.document.id // empty' "$PROCEDURE_JSON")"
  TRANSITION_ID="$(jq -r '.data.document.id // empty' "$TRANSITION_JSON")"

  if [ -z "$POLICY_ID" ] || [ -z "$PROCEDURE_ID" ] || [ -z "$TRANSITION_ID" ]; then
    echo "ERROR: no se generaron todos los documentos esperados" >&2
    jq . "$POLICY_JSON" >&2
    jq . "$PROCEDURE_JSON" >&2
    jq . "$TRANSITION_JSON" >&2
    exit 1
  fi

  TRANSITION_CERTIFIABLE="$(jq -r '
    if (.data.source_trace | has("certifiable")) then
      .data.source_trace.certifiable
    elif (.data.document.source_trace_json | has("certifiable")) then
      .data.document.source_trace_json.certifiable
    else
      empty
    end
  ' "$TRANSITION_JSON")"
  TRANSITION_DISCLAIMER="$(jq -r '.data.document.disclaimer // empty' "$TRANSITION_JSON")"

  if [ "$TRANSITION_CERTIFIABLE" != "false" ]; then
    echo "ERROR: ISO9001 2026_FDIS no devolvio certifiable=false en source_trace" >&2
    jq . "$TRANSITION_JSON" >&2
    exit 1
  fi

  if ! echo "$TRANSITION_DISCLAIMER" | grep -qi "no es version final certificable"; then
    echo "ERROR: ISO9001 2026_FDIS no incluyo disclaimer de no certificabilidad" >&2
    jq . "$TRANSITION_JSON" >&2
    exit 1
  fi
fi

echo "OK: ISO Document Generator API validada correctamente."
