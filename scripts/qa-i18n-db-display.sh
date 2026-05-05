#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TS="$(date '+%Y%m%d_%H%M%S')"
OUT_DIR="qa-results"
OUT_TXT="$OUT_DIR/qa-i18n-db-display-$TS.txt"
OUT_JSON="$OUT_DIR/qa-i18n-db-display-$TS.json"
OUT_MD="$OUT_DIR/qa-i18n-db-display-$TS.md"

mkdir -p "$OUT_DIR"

PASS=0
WARN=0
FAIL=0

pass(){ PASS=$((PASS+1)); echo "[PASS] $1"; }
warn(){ WARN=$((WARN+1)); echo "[WARN] $1"; }
fail(){ FAIL=$((FAIL+1)); echo "[FAIL] $1"; }

{
echo "======================================"
echo " QA I18N DB DISPLAY FASE 5A"
echo "======================================"
echo "Fecha: $(date)"
echo ""

[ -f frontend/src/i18n/displayText.ts ] && pass "Existe frontend/src/i18n/displayText.ts" || fail "Falta frontend/src/i18n/displayText.ts"

grep -q "translateDisplayText" frontend/src/i18n/displayText.ts && pass "Helper translateDisplayText exportado" || fail "No se detecta translateDisplayText"
grep -q "translateStatusLabel" frontend/src/i18n/displayText.ts && pass "Helper translateStatusLabel exportado" || fail "No se detecta translateStatusLabel"
grep -q "translatePriorityLabel" frontend/src/i18n/displayText.ts && pass "Helper translatePriorityLabel exportado" || fail "No se detecta translatePriorityLabel"
grep -q "translateSeverityLabel" frontend/src/i18n/displayText.ts && pass "Helper translateSeverityLabel exportado" || fail "No se detecta translateSeverityLabel"
grep -q "translateStandardLabel" frontend/src/i18n/displayText.ts && pass "Helper translateStandardLabel exportado" || fail "No se detecta translateStandardLabel"
grep -q "translateClauseLabel" frontend/src/i18n/displayText.ts && pass "Helper translateClauseLabel exportado" || fail "No se detecta translateClauseLabel"

python3 -m json.tool frontend/src/i18n/dictionaries/es.json >/tmp/tcdx-es-i18n.json \
  && pass "es.json válido" || fail "es.json inválido"

python3 -m json.tool frontend/src/i18n/dictionaries/en.json >/tmp/tcdx-en-i18n.json \
  && pass "en.json válido" || fail "en.json inválido"

grep -q "translateDisplayText" frontend/src/components/objectives/ObjectivesPanel.tsx \
  && pass "ObjectivesPanel usa capa displayText central" \
  || warn "ObjectivesPanel no usa capa displayText central"

grep -q "EnglishVisualTextGuard" frontend/src/components/AppLayout.tsx \
  && pass "EnglishVisualTextGuard montado en AppLayout" \
  || warn "EnglishVisualTextGuard no detectado en AppLayout"

grep -q "EnglishFindingsTextGuard" frontend/src/components/AppLayout.tsx \
  && pass "EnglishFindingsTextGuard montado en AppLayout" \
  || warn "EnglishFindingsTextGuard no detectado en AppLayout"

grep -q "EnglishAdminSaasTextGuard" frontend/src/components/AppLayout.tsx \
  && pass "EnglishAdminSaasTextGuard montado en AppLayout" \
  || warn "EnglishAdminSaasTextGuard no detectado en AppLayout"

# Fase 5A.2.1: vistas con datos BD
for VIEW in   frontend/src/app/controles/page.tsx   frontend/src/app/evidencias/page.tsx   frontend/src/app/plan-accion/page.tsx
 do
  if grep -q "@/i18n/displayText" "$VIEW"; then
    pass "$(basename "$(dirname "$VIEW")") usa displayText"
  else
    fail "$(basename "$(dirname "$VIEW")") no importa displayText"
  fi
 done


for NEEDLE in \
  "Clause 8: Operation" \
  "Evaluated suppliers" \
  "Headquarters" \
  "Contract created from accepted quotation" \
  "Draft" \
  "Resolved" \
  "In progress" \
  "Critical" \
  "Medium"
do
  grep -q "$NEEDLE" frontend/src/i18n/displayText.ts \
    && pass "Mapeo presente: $NEEDLE" \
    || fail "Falta mapeo: $NEEDLE"
done

if git status --porcelain | grep -E '(^|/)\.env$|(^|/)\.env\.local$|(^|/)\.env\.production$|(^|/)\.env\.development$|bak_|\.dump$|\.tar\.gz$' >/dev/null 2>&1; then
  warn "Hay .env reales, backups, dumps o tar.gz en cambios o working tree. Revisar antes de commit."
else
  pass "Sin .env reales, backups, dumps ni tar.gz en cambios"
fi

echo ""
echo "Resumen:"
echo "PASS=$PASS"
echo "WARN=$WARN"
echo "FAIL=$FAIL"
echo "TXT=$OUT_TXT"
echo "JSON=$OUT_JSON"
echo "MD=$OUT_MD"
echo "======================================"
} | tee "$OUT_TXT"

cat > "$OUT_JSON" <<JSON
{
  "qa": "i18n-db-display",
  "timestamp": "$TS",
  "pass": $PASS,
  "warn": $WARN,
  "fail": $FAIL
}
JSON

cat > "$OUT_MD" <<MD
# QA i18n DB Display

- Timestamp: $TS
- PASS: $PASS
- WARN: $WARN
- FAIL: $FAIL

Ver detalle en:

\`$OUT_TXT\`
MD

test "$FAIL" -eq 0


grep -q "translateDisplayText" frontend/src/app/hallazgos/page.tsx \
  && pass "hallazgos usa displayText" \
  || warn "hallazgos no usa displayText"

grep -q "translateDisplayText" frontend/src/app/no-conformidades/page.tsx \
  && pass "no-conformidades usa displayText" \
  || warn "no-conformidades no usa displayText"

grep -q "translateDisplayText" frontend/src/app/auditorias/page.tsx \
  && pass "auditorias usa displayText" \
  || warn "auditorias no usa displayText"

grep -q "translateDisplayText" frontend/src/app/auditorias/ejecucion/page.tsx \
  && pass "auditorias ejecucion usa displayText" \
  || warn "auditorias ejecucion no usa displayText"
