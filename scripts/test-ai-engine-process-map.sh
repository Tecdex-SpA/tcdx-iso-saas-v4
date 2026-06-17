#!/usr/bin/env bash
set -euo pipefail

AI_ENGINE_URL="${TCDX_AI_ENGINE_URL:-${AI_ENGINE_URL:-}}"
: "${AI_ENGINE_URL:?TCDX_AI_ENGINE_URL o AI_ENGINE_URL requerido, ej: http://localhost:8001}"
AI_TOKEN="${TCDX_AI_TOKEN:-${AI_INTERNAL_TOKEN:-}}"
OUT_DIR="${TCDX_OUT_DIR:-./qa-results/ai-engine-process-map/$(date +%Y%m%d-%H%M%S)}"

if [ -z "$AI_TOKEN" ]; then
  echo "ERROR: define TCDX_AI_TOKEN o AI_INTERNAL_TOKEN. El script no incluye tokens por defecto." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

post_json() {
  local name="$1"
  local path="$2"
  local body="$3"
  curl -sk -X POST "$AI_ENGINE_URL$path" \
    -H "x-ai-token: $AI_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "$body" \
    -o "$OUT_DIR/$name.json"
  python3 - "$OUT_DIR/$name.json" "$name" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
name = sys.argv[2]
trace = data.get("trace") or data.get("engine") or data.get("metrics") or {}
if data.get("ok") is False and not trace.get("fallback_used"):
    raise SystemExit(f"{name}: ok=false sin fallback_used trazable")
if trace.get("fallback_used") is True and data.get("ok") is True:
    raise SystemExit(f"{name}: OK falso con fallback")
if not (trace.get("llm_used") is True or trace.get("deterministic_mode") is True):
    raise SystemExit(f"{name}: no declara llm_used ni deterministic_mode")
PY
}

curl -sk "$AI_ENGINE_URL/health" -o "$OUT_DIR/health.json"

COMMON='{"tenant_id":"qa-tenant","locale":"es","model_mode":"balanced","use_llm":true,"use_rag":true,"use_web":false,"company_applicability_universe":{"active_universe":true},"applicable_controls":[{"control_code":"QA-CTRL","control_name":"Control QA"}],"applicable_kpis":[{"kpi_code":"QA-KPI","kpi_name":"KPI QA"}],"request_metadata":{"request_id":"qa-process-map"}}'

post_json "company-profile-analyze" "/api/ai/company-profile/analyze" "$COMMON"
post_json "report-ai-enrichment" "/api/ai/report-ai-enrichment" "$COMMON"
post_json "health-summary" "/api/ai/suggest/health-summary" '{"tenant_id":"qa-tenant","summary":{"avg_health_score":75},"request_id":"qa-health-summary"}'
post_json "finding-analysis" "/api/ai/suggest/finding-analysis" '{"tenant_id":"qa-tenant","finding":{"title":"Hallazgo QA"},"request_id":"qa-finding"}'
post_json "nonconformity-draft" "/api/ai/suggest/nonconformity-draft" '{"tenant_id":"qa-tenant","finding":{"title":"NC QA"},"request_id":"qa-nc"}'
post_json "action-plan" "/api/ai/suggest/action-plan" '{"tenant_id":"qa-tenant","finding":{"title":"Acción QA"},"request_id":"qa-action"}'

echo "OK: artefactos en $OUT_DIR"
