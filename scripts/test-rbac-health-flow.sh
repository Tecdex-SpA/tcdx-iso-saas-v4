#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TCDX_BASE_URL:-https://181.212.166.187:8443}"
EMAIL="${TCDX_EMAIL:-}"
PASSWORD="${TCDX_PASSWORD:-}"
OUT_DIR="${TCDX_OUT_DIR:-./qa-results/rbac-health/$(date +%Y%m%d-%H%M%S)}"

if [ -z "$PASSWORD" ]; then
  echo "ERROR: define TCDX_PASSWORD. El script no incluye credenciales por defecto." >&2
  exit 1
fi
mkdir -p "$OUT_DIR"

curl -sk -X POST "$BASE_URL/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" -o "$OUT_DIR/login.json"
TOKEN="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("token",""))' "$OUT_DIR/login.json")"
[ -n "$TOKEN" ] || { echo "ERROR: login sin token" >&2; exit 1; }

for path in \
  /health/dashboard \
  /health/standards \
  /health/kpis \
  /health/controls-risk \
  /health/root-causes \
  /health/root-causes/standards \
  /health/remediation-summary \
  /health/remediation-summary/standards \
  /health/remediation-plan \
  /health/remediation-executive \
  /health/remediation-executive/standards \
  /health/evidence-approval-queue \
  /health/controls-recovered \
  /health/audit-log \
  /health/audit-log/action-plans \
  /health/audit-log/evidences \
  /health/audit-log/control-recovery
do
  name="$(echo "$path" | tr '/' '_' | sed 's/^_//')"
  curl -sk "$BASE_URL$path" -H "Authorization: Bearer $TOKEN" -o "$OUT_DIR/$name.json"
  if grep -q "RBAC_DENIED" "$OUT_DIR/$name.json"; then
    echo "ERROR: RBAC_DENIED en $path" >&2
    exit 1
  fi
done

echo "OK: artefactos en $OUT_DIR"
