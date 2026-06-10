#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TCDX_BASE_URL:-https://181.212.166.187:8443}"
EMAIL="${TCDX_EMAIL:-}"
PASSWORD="${TCDX_PASSWORD:-}"
OUT_DIR="${TCDX_OUT_DIR:-./qa-results/document-suggestion-evidence-mapping/$(date +%Y%m%d-%H%M%S)}"

if [ -z "$PASSWORD" ]; then
  echo "ERROR: define TCDX_PASSWORD. El script no incluye credenciales por defecto." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

json_get() {
  node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const p=process.argv[2].split('.'); let v=o; for (const k of p) v=v?.[k]; if (v===undefined||v===null) process.exit(2); if (typeof v==='object') console.log(JSON.stringify(v)); else console.log(String(v));" "$1" "$2"
}

curl -sk -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  -o "$OUT_DIR/login.json"

TOKEN="$(json_get "$OUT_DIR/login.json" token || true)"
[ -n "$TOKEN" ] || { echo "ERROR: login sin token" >&2; exit 1; }

curl -sk "$BASE_URL/api/document-integrations/suggestions?status=approved" \
  -H "Authorization: Bearer $TOKEN" \
  -o "$OUT_DIR/suggestions.json"

SUGGESTION_ID="$(node - "$OUT_DIR/suggestions.json" <<'NODE'
const fs = require('fs');
const json = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const rows = json.suggestions || json.data || json.rows || [];
const target = rows.find((row) => {
  const std = String(row.suggested_standard_code || row.standard_code || '').toUpperCase();
  const ref = String(row.suggested_control_ref || row.control_ref || '').trim();
  return std.includes('9001') && ['2', '6', 'ISO9001 / 2', 'ISO9001 / 6'].includes(ref);
}) || rows[0];
process.stdout.write(target?.id || target?.suggestion_id || '');
NODE
)"

if [ -z "$SUGGESTION_ID" ]; then
  echo "[SKIP] No hay sugerencias documentales aprobadas para validar create-evidence." | tee "$OUT_DIR/summary.txt"
  exit 0
fi

HTTP_CODE="$(curl -sk -w '%{http_code}' -X POST "$BASE_URL/api/document-integrations/suggestions/$SUGGESTION_ID/create-evidence" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}' \
  -o "$OUT_DIR/create-evidence.json")"
echo "$HTTP_CODE" > "$OUT_DIR/create-evidence.status"

node - "$OUT_DIR/create-evidence.json" "$HTTP_CODE" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const httpCode = Number(process.argv[3]);
const text = fs.readFileSync(file, 'utf8');
if (text.includes('<html') || text.includes('<!DOCTYPE')) {
  throw new Error('respuesta HTML inesperada');
}
const json = JSON.parse(text);
if (httpCode >= 500) {
  throw new Error(`HTTP ${httpCode}: no debe ser 5xx`);
}
if (json.ok === true && json.evidence) {
  if (!json.resolved_control?.tenant_control_id) {
    throw new Error('evidencia creada sin tenant_control_id resuelto');
  }
  process.exit(0);
}
if (httpCode === 422 && json.code === 'CONTROL_MAPPING_REQUIRED') {
  if (json.mapping_required !== true) throw new Error('CONTROL_MAPPING_REQUIRED sin mapping_required=true');
  if (json.tenant_filter_enforced !== true) throw new Error('falta tenant_filter_enforced=true');
  if (json.applicability_universe_applied !== true) throw new Error('falta applicability_universe_applied=true');
  process.exit(0);
}
throw new Error(`respuesta inesperada HTTP ${httpCode}: ${text.slice(0, 500)}`);
NODE

cat > "$OUT_DIR/summary.txt" <<SUMMARY
base_url=$BASE_URL
suggestion_id=$SUGGESTION_ID
http_code=$HTTP_CODE
result=OK
SUMMARY

echo "OK: artefactos en $OUT_DIR"
