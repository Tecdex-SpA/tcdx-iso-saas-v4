
#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TS="$(date '+%Y%m%d_%H%M%S')"
OUT_DIR="qa-results"
OUT_TXT="$OUT_DIR/qa-ai-locale-consistency-$TS.txt"
OUT_JSON="$OUT_DIR/qa-ai-locale-consistency-$TS.json"
OUT_MD="$OUT_DIR/qa-ai-locale-consistency-$TS.md"
mkdir -p "$OUT_DIR"

PASS=0
WARN=0
FAIL=0
pass(){ PASS=$((PASS+1)); echo "[PASS] $1"; }
warn(){ WARN=$((WARN+1)); echo "[WARN] $1"; }
fail(){ FAIL=$((FAIL+1)); echo "[FAIL] $1"; }

{
echo "======================================"
echo " TCDX QA AI LOCALE CONSISTENCY"
echo "======================================"
echo "Fecha: $(date)"
echo ""

[ -f backend/src/utils/aiLocaleText.js ] && pass "aiLocaleText.js existe" || fail "falta aiLocaleText.js"
[ -f backend/src/middleware/aiLocaleResponseGuard.js ] && pass "aiLocaleResponseGuard.js existe" || fail "falta aiLocaleResponseGuard.js"

grep -q "aiLocaleResponseGuard" backend/src/app.js && pass "app.js monta aiLocaleResponseGuard" || fail "app.js no monta aiLocaleResponseGuard"
grep -q "buildAiLocaleInstruction" backend/src/utils/aiLocaleText.js && pass "buildAiLocaleInstruction existe" || fail "falta buildAiLocaleInstruction"
grep -q "translatePayload" backend/src/utils/aiLocaleText.js && pass "translatePayload existe" || fail "falta translatePayload"
grep -q "build_tcdx_language_instruction" ai-engine/app/services/language_service.py && pass "ai-engine language instruction helper existe" || warn "helper ai-engine no detectado"

node -c backend/src/app.js && pass "node app.js sintaxis OK" || fail "node app.js sintaxis FAIL"
node -c backend/src/utils/aiLocaleText.js && pass "node aiLocaleText.js sintaxis OK" || fail "node aiLocaleText.js sintaxis FAIL"
node -c backend/src/middleware/aiLocaleResponseGuard.js && pass "node aiLocaleResponseGuard.js sintaxis OK" || fail "node aiLocaleResponseGuard.js sintaxis FAIL"

python3 -m py_compile ai-engine/app/services/language_service.py && pass "py_compile language_service.py OK" || fail "py_compile language_service.py FAIL"

node <<'NODE'
const { translateAiLocaleText, translatePayload, buildAiLocaleInstruction } = require('./backend/src/utils/aiLocaleText');
const checks = [
  ['Se recomienda revisar la evidencia', 'It is recommended'],
  ['Riesgos detectados', 'Detected risks'],
  ['Próximo paso', 'Next step'],
  ['Resumen de salud', 'Health summary'],
  ['Prioridades recomendadas', 'Recommended priorities'],
  ['Pendiente definir', 'To be defined']
];
let fail = 0;
for (const [input, expected] of checks) {
  const out = translateAiLocaleText(input, 'en');
  if (!out.includes(expected)) {
    console.error(`[FAIL] ${input} => ${out} expected ${expected}`);
    fail += 1;
  }
}
const payload = translatePayload({ ok: true, summary: 'Se recomienda revisar la evidencia', id: 'ABC123' }, 'en');
if (!payload.summary.includes('It is recommended')) fail += 1;
if (payload.id !== 'ABC123') fail += 1;
if (!buildAiLocaleInstruction('en').includes('Respond only in English')) fail += 1;
process.exit(fail ? 1 : 0);
NODE
[ "$?" -eq 0 ] && pass "runtime locale translation smoke OK" || fail "runtime locale translation smoke FAIL"

if git status --porcelain | grep -E '(^|/)\.env$|(^|/)\.env\.local$|(^|/)\.env\.production$|(^|/)\.env\.development$|\.dump$|\.tar\.gz$|bak_' >/dev/null 2>&1; then
  fail "hay .env reales/backups/dumps/tar.gz en cambios"
else
  pass "sin .env reales/backups/dumps/tar.gz en cambios"
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
{"qa":"ai-locale-consistency","timestamp":"$TS","pass":$PASS,"warn":$WARN,"fail":$FAIL}
JSON

cat > "$OUT_MD" <<MD
# QA AI Locale Consistency

- Timestamp: $TS
- PASS: $PASS
- WARN: $WARN
- FAIL: $FAIL

Detalle: \`$OUT_TXT\`
MD

test "$FAIL" -eq 0
