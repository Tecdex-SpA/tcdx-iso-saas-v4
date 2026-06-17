#!/usr/bin/env bash
set -euo pipefail

: "${TCDX_BASE_URL:?TCDX_BASE_URL requerido, ej: http://localhost:3001}"
BASE_URL="$TCDX_BASE_URL"
EMAIL="${TCDX_EMAIL:-}"
PASSWORD="${TCDX_PASSWORD:-}"
MAX_WAIT_SECONDS="${TCDX_MAX_WAIT_SECONDS:-1200}"
POLL_INTERVAL_SECONDS="${TCDX_POLL_INTERVAL_SECONDS:-5}"
OUT_ROOT="${TCDX_OUT_DIR:-./qa-results/company-profile-ai}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${OUT_ROOT}/${STAMP}"

mkdir -p "$OUT_DIR"

json_get() {
  local file="$1"
  local expr="$2"
  python3 - "$file" "$expr" <<'PY'
import json, sys
path, expr = sys.argv[1], sys.argv[2]
with open(path, "r", encoding="utf-8") as fh:
    data = json.load(fh)
cur = data
for part in expr.split("."):
    if not part:
        continue
    if isinstance(cur, dict):
        cur = cur.get(part)
    else:
        cur = None
        break
if isinstance(cur, bool):
    print("true" if cur else "false")
elif cur is None:
    print("")
else:
    print(cur)
PY
}

echo "[company-profile-ai] Login against ${BASE_URL}"
LOGIN_JSON="${OUT_DIR}/login.json"
curl -sk -X POST "${BASE_URL}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
  -o "$LOGIN_JSON"

TOKEN="$(json_get "$LOGIN_JSON" "token")"
if [ -z "$TOKEN" ]; then
  echo "ERROR: login did not return token. See ${LOGIN_JSON}" >&2
  exit 1
fi

PROFILE_BODY="${OUT_DIR}/profile-payload.json"
cat > "$PROFILE_BODY" <<'JSON'
{
  "profile_json": {
    "company_name": "Rieltec QA",
    "industry": "Servicios tecnológicos",
    "subindustry": "Infraestructura y cumplimiento",
    "company_size": "pyme",
    "current_maturity_level": "partial",
    "risk_appetite": "moderado",
    "active_standards": ["ISO9001", "ISO27001"],
    "critical_processes": ["Gestión de servicios TI", "Soporte a clientes", "Gestión documental"],
    "critical_assets": ["Plataforma SaaS", "Base de datos PostgreSQL", "Repositorio documental"],
    "main_products_services": ["Servicios SaaS de cumplimiento ISO"],
    "audit_scope": "Procesos de gestión SaaS, soporte, seguridad de información y control documental.",
    "known_weaknesses": ["Evidencia incompleta", "Planes de acción vencidos"],
    "improvement_priorities": ["Cerrar brechas de evidencia", "Formalizar responsables", "Medir eficacia de acciones"]
  },
  "industry": "Servicios tecnológicos",
  "subindustry": "Infraestructura y cumplimiento",
  "company_size": "pyme",
  "maturity_level": "partial",
  "risk_appetite": "moderado",
  "allow_web_research": true,
  "allow_document_context": true,
  "allow_ai_recommendations": true
}
JSON

echo "[company-profile-ai] Saving profile"
SAVE_JSON="${OUT_DIR}/profile-save.json"
curl -sk -X PUT "${BASE_URL}/api/company-profile" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  --data-binary "@${PROFILE_BODY}" \
  -o "$SAVE_JSON"

if [ "$(json_get "$SAVE_JSON" "ok")" != "true" ]; then
  echo "ERROR: profile save failed. See ${SAVE_JSON}" >&2
  exit 1
fi

echo "[company-profile-ai] Starting async AI analysis"
START_JSON="${OUT_DIR}/job-start.json"
curl -sk -X POST "${BASE_URL}/api/company-profile/analyze/start" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"model_mode":"balanced"}' \
  -o "$START_JSON"

JOB_ID="$(json_get "$START_JSON" "job_id")"
if [ -z "$JOB_ID" ]; then
  echo "ERROR: analyze/start did not return job_id. See ${START_JSON}" >&2
  exit 1
fi

echo "[company-profile-ai] job_id=${JOB_ID}"
STATUS="queued"
ELAPSED=0
JOB_JSON="${OUT_DIR}/job-latest.json"
while [ "$ELAPSED" -lt "$MAX_WAIT_SECONDS" ]; do
  sleep "$POLL_INTERVAL_SECONDS"
  ELAPSED=$((ELAPSED + POLL_INTERVAL_SECONDS))
  curl -sk -H "Authorization: Bearer ${TOKEN}" \
    "${BASE_URL}/api/company-profile/analyze/jobs/${JOB_ID}" \
    -o "$JOB_JSON"
  STATUS="$(json_get "$JOB_JSON" "status")"
  echo "[company-profile-ai] status=${STATUS} elapsed=${ELAPSED}s"
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
done

if [ "$STATUS" != "completed" ]; then
  echo "ERROR: analysis job did not complete successfully. status=${STATUS}. See ${JOB_JSON}" >&2
  exit 1
fi

PROFILE_JSON="${OUT_DIR}/profile-after-analysis.json"
curl -sk -H "Authorization: Bearer ${TOKEN}" \
  "${BASE_URL}/api/company-profile" \
  -o "$PROFILE_JSON"

SELECTED_MODEL="$(json_get "$PROFILE_JSON" "data.ai_research_trace_json.selected_model")"
FALLBACK_USED="$(json_get "$PROFILE_JSON" "data.ai_research_trace_json.fallback_used")"
USED_WEB="$(json_get "$PROFILE_JSON" "data.ai_research_trace_json.used_web")"
DURATION_MS="$(json_get "$PROFILE_JSON" "data.ai_research_trace_json.duration_ms")"
CONTEXT_SUMMARY="$(json_get "$PROFILE_JSON" "data.ai_profile_summary_json.tenant_applied_context_summary")"
CONTROLS_ANALYZED="$(json_get "$PROFILE_JSON" "data.ai_profile_summary_json.tenant_applied_context_summary.controls_analyzed")"
KPIS_ANALYZED="$(json_get "$PROFILE_JSON" "data.ai_profile_summary_json.tenant_applied_context_summary.kpis_analyzed")"

if [ -z "$(json_get "$PROFILE_JSON" "data.ai_profile_summary_json")" ]; then
  echo "ERROR: ai_profile_summary_json is empty. See ${PROFILE_JSON}" >&2
  exit 1
fi
if [ "$SELECTED_MODEL" = "backend_fallback" ] || [ "$FALLBACK_USED" = "true" ]; then
  echo "ERROR: analysis completed with fallback. selected_model=${SELECTED_MODEL} fallback_used=${FALLBACK_USED}. See ${PROFILE_JSON}" >&2
  exit 1
fi
if [ "$USED_WEB" != "true" ]; then
  echo "ERROR: expected used_web=true when allow_web_research=true. See ${PROFILE_JSON}" >&2
  exit 1
fi
if [ -z "$DURATION_MS" ]; then
  echo "ERROR: expected duration_ms in AI trace. See ${PROFILE_JSON}" >&2
  exit 1
fi
if [ -z "$CONTEXT_SUMMARY" ]; then
  echo "ERROR: expected tenant_applied_context_summary in AI profile summary. See ${PROFILE_JSON}" >&2
  exit 1
fi
if [ -z "$CONTROLS_ANALYZED" ]; then
  echo "ERROR: expected controls_analyzed in tenant_applied_context_summary. See ${PROFILE_JSON}" >&2
  exit 1
fi
if [ -z "$KPIS_ANALYZED" ]; then
  echo "ERROR: expected kpis_analyzed in tenant_applied_context_summary. See ${PROFILE_JSON}" >&2
  exit 1
fi

RESULT_JSON="${OUT_DIR}/job-result.json"
curl -sk -H "Authorization: Bearer ${TOKEN}" \
  "${BASE_URL}/api/company-profile/analyze/jobs/${JOB_ID}/result" \
  -o "$RESULT_JSON"

echo "[company-profile-ai] Exporting context document"
EXPORT_JSON="${OUT_DIR}/context-export.json"
curl -sk -X POST "${BASE_URL}/api/company-profile/export-context-document" \
  -H "Authorization: Bearer ${TOKEN}" \
  -o "$EXPORT_JSON"

DOWNLOAD_URL="$(json_get "$EXPORT_JSON" "data.download_url")"
if [ -z "$DOWNLOAD_URL" ]; then
  DOWNLOAD_URL="$(json_get "$EXPORT_JSON" "data.file_url")"
fi
if [ -z "$DOWNLOAD_URL" ]; then
  DOWNLOAD_URL="$(json_get "$EXPORT_JSON" "data.result_download_url")"
fi
if [ -z "$DOWNLOAD_URL" ]; then
  DOWNLOAD_URL="/api/company-profile/context-document/download"
fi

PDF_PATH="${OUT_DIR}/context-document.pdf"
HEADERS_PATH="${OUT_DIR}/headers.txt"
HTTP_CODE="$(curl -sk -L \
  -H "Authorization: Bearer ${TOKEN}" \
  -D "$HEADERS_PATH" \
  -o "$PDF_PATH" \
  -w '%{http_code}' \
  "${BASE_URL}${DOWNLOAD_URL}")"

CONTENT_TYPE="$(awk 'BEGIN{IGNORECASE=1} /^content-type:/ {print $0}' "$HEADERS_PATH" | tail -1)"
PDF_SIZE="$(wc -c < "$PDF_PATH" | tr -d ' ')"
if [ "$HTTP_CODE" != "200" ] || ! echo "$CONTENT_TYPE" | grep -qi 'application/pdf'; then
  echo "ERROR: PDF download failed. http=${HTTP_CODE} content_type=${CONTENT_TYPE}. See ${HEADERS_PATH}" >&2
  exit 1
fi
if [ "$PDF_SIZE" -lt 51200 ]; then
  echo "ERROR: PDF is too small (${PDF_SIZE} bytes). Expected > 50 KB. See ${PDF_PATH}" >&2
  exit 1
fi

SUMMARY="${OUT_DIR}/summary.txt"
{
  echo "job_id=${JOB_ID}"
  echo "selected_model=${SELECTED_MODEL}"
  echo "used_web=${USED_WEB}"
  echo "fallback_used=${FALLBACK_USED}"
  echo "duration_ms=${DURATION_MS}"
  echo "controls_analyzed=${CONTROLS_ANALYZED}"
  echo "kpis_analyzed=${KPIS_ANALYZED}"
  echo "pdf=${PDF_PATH}"
  echo "pdf_size=${PDF_SIZE}"
} > "$SUMMARY"

echo "[company-profile-ai] OK"
cat "$SUMMARY"
