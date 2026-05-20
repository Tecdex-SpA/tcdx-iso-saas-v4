#!/usr/bin/env bash
set -euo pipefail

AI_URL="${TCDX_AI_ENGINE_URL:-http://ai.tcdx.int:8001}"
AI_TOKEN="${TCDX_AI_TOKEN:-${AI_INTERNAL_TOKEN:-}}"
TENANT_ID="${TCDX_TENANT_ID:-00000000-0000-0000-0000-000000000000}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${TCDX_QA_OUT_DIR:-./qa-results/ai-engine-contracts/$STAMP}"

mkdir -p "$OUT_DIR"

if [[ -z "$AI_TOKEN" ]]; then
  echo "TCDX_AI_TOKEN or AI_INTERNAL_TOKEN is required" >&2
  exit 2
fi

post_json() {
  local name="$1"
  local path="$2"
  local payload="$3"
  local out_json="$OUT_DIR/$name.json"
  local out_headers="$OUT_DIR/$name.headers.txt"

  curl -skS -D "$out_headers" \
    -H "Content-Type: application/json" \
    -H "x-ai-token: $AI_TOKEN" \
    -H "x-request-id: qa-$STAMP-$name" \
    -X POST "$AI_URL$path" \
    -d "$payload" \
    -o "$out_json"

  python3 - "$out_json" "$name" <<'PY'
import json, sys
path, name = sys.argv[1], sys.argv[2]
raw = open(path, "r", encoding="utf-8", errors="replace").read()
if raw.lstrip().startswith("<"):
    raise SystemExit(f"{name}: response is HTML, expected JSON")
try:
    data = json.loads(raw or "{}")
except Exception as exc:
    raise SystemExit(f"{name}: invalid JSON: {exc}")
trace = data.get("trace") or data.get("engine") or data.get("metrics") or {}
print(json.dumps({
    "name": name,
    "ok": data.get("ok"),
    "source": data.get("source"),
    "ai_engine_used": trace.get("ai_engine_used"),
    "fallback_used": trace.get("fallback_used"),
    "used_web": trace.get("used_web"),
    "selected_model": trace.get("selected_model") or trace.get("model"),
}, ensure_ascii=False))
PY
}

curl -skS "$AI_URL/health" -o "$OUT_DIR/health.json" || true

post_json "external_lookup" "/api/ai/internal/external-lookup/search" "{
  \"tenant_id\":\"$TENANT_ID\",
  \"title\":\"ISO 9001 corrective actions evidence\",
  \"description\":\"controlled QA web context\",
  \"force\":true,
  \"queries\":[\"ISO 9001 corrective action evidence audit best practices\"],
  \"max_results\":3
}"

post_json "company_profile" "/api/ai/company-profile/analyze" "{
  \"tenant_id\":\"$TENANT_ID\",
  \"locale\":\"es\",
  \"model_mode\":\"fast\",
  \"use_llm\":false,
  \"use_rag\":true,
  \"use_web\":false,
  \"allow_web_research\":false,
  \"company_profile\":{\"profile_json\":{\"company_name\":\"QA Tenant\",\"industry\":\"servicios\"}},
  \"request_id\":\"qa-$STAMP-company-profile\"
}"

post_json "report_ai_enrichment" "/api/ai/report-ai-enrichment" "{
  \"tenant_id\":\"$TENANT_ID\",
  \"report_type_code\":\"executive_iso_status\",
  \"period\":\"QA\",
  \"locale\":\"es\",
  \"model_mode\":\"fast\",
  \"use_llm\":false,
  \"use_rag\":true,
  \"use_web\":false,
  \"context\":{\"company_profile\":{\"profile_json\":{\"company_name\":\"QA Tenant\",\"industry\":\"servicios\"}}},
  \"request_id\":\"qa-$STAMP-report\"
}"

echo "AI engine contract QA artifacts: $OUT_DIR"
