#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TCDX_BASE_URL:-https://181.212.166.187:8443}"
EMAIL="${TCDX_EMAIL:-admin@rieltec.com}"
PASSWORD="${TCDX_PASSWORD:-123456}"

REPORT_TYPE_CODE="${TCDX_REPORT_TYPE_CODE:-executive_iso_status}"
REPORT_PERIOD="${TCDX_REPORT_PERIOD:-Mayo 2026}"

MODEL_MODE="${TCDX_MODEL_MODE:-deep}"
USE_LLM="${TCDX_USE_LLM:-true}"
USE_RAG="${TCDX_USE_RAG:-true}"
USE_WEB="${TCDX_USE_WEB:-false}"
USE_DRIVE="${TCDX_USE_DRIVE:-false}"
DEPTH="${TCDX_DEPTH:-deep}"
QUALITY="${TCDX_QUALITY:-premium_deep}"

OUT_DIR="${TCDX_OUT_DIR:-./qa-results/generated-reports}"
POLL_INTERVAL="${TCDX_POLL_INTERVAL_SECONDS:-${TCDX_POLL_INTERVAL:-5}}"
MAX_WAIT_SECONDS="${TCDX_MAX_WAIT_SECONDS:-900}"

mkdir -p "$OUT_DIR"

ts() {
  date +"%Y-%m-%d %H:%M:%S"
}

log() {
  echo "[$(ts)] $*"
}

json_get() {
  python3 -c '
import json, sys
path = sys.argv[1].split(".")
try:
    data = json.load(sys.stdin)
    for p in path:
        if isinstance(data, dict):
            data = data.get(p)
        else:
            data = None
            break
    if data is None:
        print("")
    elif isinstance(data, bool):
        print("true" if data else "false")
    else:
        print(data)
except Exception:
    print("")
' "$1"
}

json_first() {
  python3 -c '
import json, sys
paths = sys.argv[1:]
try:
    data = json.load(sys.stdin)
    for raw in paths:
        cur = data
        for part in raw.split("."):
            if isinstance(cur, dict):
                cur = cur.get(part)
            else:
                cur = None
                break
        if cur not in (None, ""):
            print(cur if not isinstance(cur, bool) else ("true" if cur else "false"))
            break
except Exception:
    print("")
' "$@"
}

log "============================================================"
log "TCDX Deep Report CLI"
log "BASE_URL=$BASE_URL"
log "REPORT_TYPE_CODE=$REPORT_TYPE_CODE"
log "REPORT_PERIOD=$REPORT_PERIOD"
log "MODEL_MODE=$MODEL_MODE"
log "USE_LLM=$USE_LLM"
log "USE_RAG=$USE_RAG"
log "USE_WEB=$USE_WEB"
log "USE_DRIVE=$USE_DRIVE"
log "DEPTH=$DEPTH"
log "QUALITY=$QUALITY"
log "OUT_DIR=$OUT_DIR"
log "============================================================"

log "1) Login..."

LOGIN_RESPONSE="$(curl -sk -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"

TOKEN="$(printf '%s' "$LOGIN_RESPONSE" | json_get token)"

if [[ -z "$TOKEN" ]]; then
  echo "$LOGIN_RESPONSE" > "$OUT_DIR/login-error.json"
  log "ERROR: No se pudo obtener token. Revisar $OUT_DIR/login-error.json"
  exit 1
fi

log "Token obtenido."

PAYLOAD="$(python3 - <<PY
import json
print(json.dumps({
  "report_type_code": "$REPORT_TYPE_CODE",
  "period": "$REPORT_PERIOD",
  "model_mode": "$MODEL_MODE",
  "use_llm": "$USE_LLM".lower() == "true",
  "use_rag": "$USE_RAG".lower() == "true",
  "use_web": "$USE_WEB".lower() == "true",
  "use_drive": "$USE_DRIVE".lower() == "true",
  "depth": "$DEPTH",
  "quality": "$QUALITY"
}))
PY
)"

log "2) Solicitando generación async del reporte..."

START_RESPONSE="$(curl -sk -X POST "$BASE_URL/api/reports/generate/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD")"

JOB_ID="$(printf '%s' "$START_RESPONSE" | json_get job_id)"
INITIAL_STATUS="$(printf '%s' "$START_RESPONSE" | json_get status)"

if [[ -z "$JOB_ID" ]]; then
  echo "$START_RESPONSE" > "$OUT_DIR/report-start-error.json"
  log "ERROR: No se creó job. Revisar $OUT_DIR/report-start-error.json"
  exit 1
fi

log "Job creado: $JOB_ID"
log "Estado inicial: $INITIAL_STATUS"

START_TS="$(date +%s)"
STATUS="$INITIAL_STATUS"
RESULT_AVAILABLE="false"

log "3) Polling hasta completed/failed..."

while true; do
  NOW_TS="$(date +%s)"
  ELAPSED="$((NOW_TS - START_TS))"

  JOB_RESPONSE="$(curl -sk "$BASE_URL/api/reports/jobs/$JOB_ID" \
    -H "Authorization: Bearer $TOKEN")"

  STATUS="$(printf '%s' "$JOB_RESPONSE" | json_get status)"
  RESULT_AVAILABLE="$(printf '%s' "$JOB_RESPONSE" | json_get result_available)"

  log "Job $JOB_ID | status=$STATUS | elapsed=${ELAPSED}s | result_available=$RESULT_AVAILABLE"

  echo "$JOB_RESPONSE" > "$OUT_DIR/job-$JOB_ID-latest.json"

  if [[ "$STATUS" == "completed" ]]; then
    break
  fi

  if [[ "$STATUS" == "failed" || "$STATUS" == "error" ]]; then
    log "ERROR: Job falló. Revisar $OUT_DIR/job-$JOB_ID-latest.json"
    exit 1
  fi

  if (( ELAPSED >= MAX_WAIT_SECONDS )); then
    log "ERROR: Timeout esperando job después de ${MAX_WAIT_SECONDS}s."
    exit 1
  fi

  sleep "$POLL_INTERVAL"
done

log "4) Obteniendo resultado final del job..."

RESULT_RESPONSE="$(curl -sk "$BASE_URL/api/reports/jobs/$JOB_ID/result" \
  -H "Authorization: Bearer $TOKEN")"

echo "$RESULT_RESPONSE" > "$OUT_DIR/result-$JOB_ID.json"

DOWNLOAD_URL="$(printf '%s' "$RESULT_RESPONSE" | json_first \
  result_download_url \
  data.result_download_url \
  data.file_url \
  data.export.file_url \
  data.export.result_download_url \
  data.export.legacy_file_url)"

if [[ -z "$DOWNLOAD_URL" ]]; then
  log "ERROR: No se encontró result_download_url. Revisar $OUT_DIR/result-$JOB_ID.json"
  exit 1
fi

if [[ "$DOWNLOAD_URL" == /* ]]; then
  DOWNLOAD_URL="$BASE_URL$DOWNLOAD_URL"
fi

log "Download URL: $DOWNLOAD_URL"

PDF_FILE="$OUT_DIR/tcdx-report-${REPORT_TYPE_CODE}-${MODEL_MODE}-${JOB_ID}.pdf"
SUMMARY_FILE="$OUT_DIR/report-summary-$JOB_ID.txt"
HEADERS_FILE="$OUT_DIR/report-headers-$JOB_ID.txt"
JOB_JSON_FILE="$OUT_DIR/job-$JOB_ID-latest.json"
RESULT_JSON_FILE="$OUT_DIR/result-$JOB_ID.json"

log "5) Descargando PDF..."

curl -skL "$DOWNLOAD_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -o "$PDF_FILE"

if [[ ! -s "$PDF_FILE" ]]; then
  log "ERROR: PDF no descargado o vacío: $PDF_FILE"
  exit 1
fi

BYTES="$(wc -c < "$PDF_FILE" | tr -d ' ')"
if (( BYTES < 20480 )); then
  log "ERROR: PDF demasiado pequeño (${BYTES} bytes)."
  exit 1
fi
MIME="$(python3 - <<PY
import mimetypes
print(mimetypes.guess_type("$PDF_FILE")[0] or "unknown")
PY
)"

log "Archivo descargado: $PDF_FILE"
log "Tamaño: $BYTES bytes"
log "MIME local: $MIME"

log "6) Validando headers remotos..."

curl -skI "$DOWNLOAD_URL" \
  -H "Authorization: Bearer $TOKEN" \
  > "$HEADERS_FILE"

if ! grep -qi 'content-type: application/pdf' "$HEADERS_FILE"; then
  log "ERROR: headers remotos no confirman application/pdf. Revisar $HEADERS_FILE"
  exit 1
fi

REPORT_ID="$(printf '%s' "$RESULT_RESPONSE" | json_first data.export.id data.export_id export_id data.id)"
TRACE_MODEL_MODE="$(printf '%s' "$RESULT_RESPONSE" | json_first data.export.payload_json.ai.ai_metrics.model_mode_used data.export.payload_json.ai.ai_metrics.model_mode data.export.payload_json.ai_report_addendum.model_mode_used data.export.payload_json.ai_report_addendum.ai_metrics.model_mode_used)"
TRACE_LLM_USED="$(printf '%s' "$RESULT_RESPONSE" | json_first data.export.payload_json.ai.ai_metrics.llm_used data.export.payload_json.ai_report_addendum.llm_used data.export.payload_json.ai_report_addendum.ai_metrics.llm_used)"
TRACE_MODEL_NAME="$(printf '%s' "$RESULT_RESPONSE" | json_first data.export.payload_json.ai.ai_metrics.model_name data.export.payload_json.ai_report_addendum.model_name data.export.payload_json.ai_report_addendum.ai_metrics.model_name)"
TRACE_FALLBACK="$(printf '%s' "$RESULT_RESPONSE" | json_first data.export.payload_json.ai.ai_metrics.fallback_used data.export.payload_json.ai_report_addendum.fallback_used data.export.payload_json.ai_report_addendum.ai_metrics.fallback_used)"
TRACE_AI_FAILED="$(printf '%s' "$RESULT_RESPONSE" | json_first data.export.payload_json.ai.ai_metrics.ai_enrichment_failed data.export.payload_json.ai_report_addendum.ai_enrichment_failed data.export.payload_json.ai_report_addendum.ai_metrics.ai_enrichment_failed)"
TRACE_DURATION="$(printf '%s' "$RESULT_RESPONSE" | json_first data.export.payload_json.ai.ai_metrics.duration_ms data.export.payload_json.ai_report_addendum.duration_ms data.export.payload_json.ai_report_addendum.ai_metrics.duration_ms)"

{
  echo "TCDX Deep Report CLI Summary"
  echo "============================================================"
  echo "generated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "base_url=$BASE_URL"
  echo "report_type_code=$REPORT_TYPE_CODE"
  echo "period=$REPORT_PERIOD"
  echo "model_mode=$MODEL_MODE"
  echo "use_llm=$USE_LLM"
  echo "use_rag=$USE_RAG"
  echo "use_web=$USE_WEB"
  echo "use_drive=$USE_DRIVE"
  echo "depth=$DEPTH"
  echo "quality=$QUALITY"
  echo "job_id=$JOB_ID"
  echo "report_id=$REPORT_ID"
  echo "pdf_file=$PDF_FILE"
  echo "job_json=$JOB_JSON_FILE"
  echo "result_json=$RESULT_JSON_FILE"
  echo "bytes=$BYTES"
  echo "download_url=$DOWNLOAD_URL"
  echo "trace_model_mode=${TRACE_MODEL_MODE:-$MODEL_MODE}"
  echo "trace_llm_used=${TRACE_LLM_USED:-unknown}"
  echo "trace_model_name=${TRACE_MODEL_NAME:-unknown}"
  echo "trace_fallback_used=${TRACE_FALLBACK:-unknown}"
  echo "trace_ai_enrichment_failed=${TRACE_AI_FAILED:-unknown}"
  echo "trace_duration_ms=${TRACE_DURATION:-unknown}"
  echo
  echo "Remote headers:"
  cat "$HEADERS_FILE"
} > "$SUMMARY_FILE"

log "============================================================"
log "REPORTE GENERADO OK"
log "PDF: $PDF_FILE"
log "Resumen: $SUMMARY_FILE"
log "job_id=$JOB_ID report_id=${REPORT_ID:-unknown} model_mode=${TRACE_MODEL_MODE:-$MODEL_MODE} llm_used=${TRACE_LLM_USED:-unknown} model=${TRACE_MODEL_NAME:-unknown} fallback=${TRACE_FALLBACK:-unknown} ai_failed=${TRACE_AI_FAILED:-unknown} duration_ms=${TRACE_DURATION:-unknown}"
log "============================================================"
