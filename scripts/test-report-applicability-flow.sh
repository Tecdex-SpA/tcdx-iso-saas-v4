#!/usr/bin/env bash
set -euo pipefail

: "${TCDX_BASE_URL:?TCDX_BASE_URL requerido, ej: http://localhost:3001}"
BASE_URL="$TCDX_BASE_URL"
EMAIL="${TCDX_EMAIL:-}"
PASSWORD="${TCDX_PASSWORD:-}"
OUT_DIR="${TCDX_OUT_DIR:-./qa-results/report-applicability/$(date +%Y%m%d-%H%M%S)}"
MAX_WAIT="${TCDX_MAX_WAIT_SECONDS:-600}"

if [ -z "$PASSWORD" ]; then
  echo "ERROR: define TCDX_PASSWORD. El script no incluye credenciales por defecto." >&2
  exit 1
fi
mkdir -p "$OUT_DIR"

curl -sk -X POST "$BASE_URL/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" -o "$OUT_DIR/login.json"
TOKEN="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("token",""))' "$OUT_DIR/login.json")"
[ -n "$TOKEN" ] || { echo "ERROR: login sin token" >&2; exit 1; }

curl -sk "$BASE_URL/api/me/entitlements" -H "Authorization: Bearer $TOKEN" -o "$OUT_DIR/entitlements.json"
AI_ENABLED="$(python3 - "$OUT_DIR/entitlements.json" <<'PY'
import json, sys
try:
    print(str(json.load(open(sys.argv[1])).get("ai",{}).get("enabled", False)).lower())
except Exception:
    print("false")
PY
)"

curl -sk -X POST "$BASE_URL/api/reports/generate/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"report_type_code":"executive_iso_status","period":"QA","model_mode":"balanced","use_llm":true,"use_rag":true,"use_web":false,"quality":"premium"}' \
  -o "$OUT_DIR/job-start.json"

JOB_ID="$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("job_id") or d.get("data",{}).get("job_id") or "")' "$OUT_DIR/job-start.json")"
[ -n "$JOB_ID" ] || { echo "ERROR: sin job_id" >&2; exit 1; }

deadline=$((SECONDS + MAX_WAIT))
while [ "$SECONDS" -lt "$deadline" ]; do
  curl -sk "$BASE_URL/api/reports/jobs/$JOB_ID" -H "Authorization: Bearer $TOKEN" -o "$OUT_DIR/job-latest.json"
  status="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("status",""))' "$OUT_DIR/job-latest.json")"
  [ "$status" = "completed" ] && break
  [ "$status" = "failed" ] && break
  sleep 5
done

python3 - "$OUT_DIR/job-latest.json" <<'PY'
import json, sys
d=json.load(open(sys.argv[1]))
if d.get("status") != "completed":
    print("JOB_ID:", d.get("job_id") or d.get("id") or "")
    print("STATUS:", d.get("status"))
    print("ERROR_JSON:", json.dumps(d.get("error_json") or d.get("error") or {}, ensure_ascii=False, indent=2))
    raise SystemExit(f"job no completado: {d.get('status')}")
result = d.get("result_json") or {}
trace = result.get("trace") or result.get("ai") or result.get("metrics") or {}
if trace.get("fallback_used") is True and trace.get("ai_enrichment_failed") is not True:
    raise SystemExit("fallback sin ai_enrichment_failed")
PY

if [ "$AI_ENABLED" != "true" ]; then
  python3 - "$OUT_DIR/job-latest.json" <<'PY'
import json, sys
d=json.load(open(sys.argv[1]))
blob=json.dumps(d.get("result_json") or {}, ensure_ascii=False).lower()
if '"ai_engine_used": true' in blob or '"ai_engine_used":true' in blob:
    raise SystemExit("tenant sin IA: result_json declara ai_engine_used=true")
if "qwen" in blob:
    raise SystemExit("tenant sin IA: result_json expone modelo qwen")
if "ai_disabled_by_plan" not in blob:
    raise SystemExit("tenant sin IA: result_json no declara ai_disabled_by_plan")
PY
fi

DOWNLOAD_URL="$(python3 - "$OUT_DIR/job-latest.json" <<'PY'
import json, sys
d=json.load(open(sys.argv[1]))
r=d.get("result_json") or {}
print(
  d.get("result_download_url")
  or r.get("result_download_url")
  or (r.get("data") or {}).get("file_url")
  or ((r.get("data") or {}).get("export") or {}).get("file_url")
  or ""
)
PY
)"
if [ -n "$DOWNLOAD_URL" ]; then
  case "$DOWNLOAD_URL" in
    http*) FINAL_URL="$DOWNLOAD_URL" ;;
    *) FINAL_URL="$BASE_URL$DOWNLOAD_URL" ;;
  esac
  curl -sk -I "$FINAL_URL" -H "Authorization: Bearer $TOKEN" -o "$OUT_DIR/report-headers.txt"
  if ! grep -qi "content-type: application/pdf" "$OUT_DIR/report-headers.txt"; then
    echo "ERROR: descarga no declara application/pdf" >&2
    cat "$OUT_DIR/report-headers.txt" >&2
    exit 1
  fi
  curl -sk -L "$FINAL_URL" -H "Authorization: Bearer $TOKEN" -o "$OUT_DIR/report.pdf"
  size="$(wc -c < "$OUT_DIR/report.pdf" | tr -d ' ')"
  if [ "${size:-0}" -lt 20000 ]; then
    echo "ERROR: PDF demasiado pequeño: $size bytes" >&2
    exit 1
  fi
fi

echo "OK: artefactos en $OUT_DIR"
