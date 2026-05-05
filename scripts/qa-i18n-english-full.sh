#!/usr/bin/env bash
set -Eeuo pipefail

QA_STRICT="${QA_STRICT:-false}"
TS="$(date '+%Y%m%d_%H%M%S')"
RESULT_DIR="qa-results"
mkdir -p "$RESULT_DIR"

TXT_REPORT="$RESULT_DIR/qa-i18n-english-full-$TS.txt"
JSON_REPORT="$RESULT_DIR/qa-i18n-english-full-$TS.json"
MD_REPORT="$RESULT_DIR/qa-i18n-english-full-$TS.md"
CHECKS_FILE="$RESULT_DIR/qa-i18n-english-full-checks-$TS.jsonl"
SCAN_FILE="$RESULT_DIR/qa-i18n-english-full-scan-$TS.txt"
: > "$CHECKS_FILE"
: > "$SCAN_FILE"

PASS=0
WARN=0
FAIL=0

log_check() {
  local status="$1"
  local name="$2"
  local details="$3"

  case "$status" in
    PASS) PASS=$((PASS + 1)) ;;
    WARN) WARN=$((WARN + 1)) ;;
    FAIL) FAIL=$((FAIL + 1)) ;;
  esac

  echo "[$status] $name — $details" | tee -a "$TXT_REPORT"
  echo "- **$status** — **$name**: $details" >> "$MD_REPORT"

  STATUS="$status" NAME="$name" DETAILS="$details" python3 <<'PY' >> "$CHECKS_FILE"
import json, os
print(json.dumps({
  "status": os.environ.get("STATUS"),
  "name": os.environ.get("NAME"),
  "details": os.environ.get("DETAILS")
}, ensure_ascii=False))
PY
}

pass() { log_check PASS "$1" "$2"; }
warn() { log_check WARN "$1" "$2"; }
fail() { log_check FAIL "$1" "$2"; }

write_json_summary() {
  local ok="true"
  local exit_code=0

  if [ "$FAIL" -gt 0 ]; then
    ok="false"
    exit_code=1
  elif [ "$WARN" -gt 0 ] && [ "$QA_STRICT" = "true" ]; then
    ok="false"
    exit_code=2
  fi

  python3 - "$CHECKS_FILE" "$JSON_REPORT" "$ok" "$PASS" "$WARN" "$FAIL" "$QA_STRICT" <<'PY'
import json, sys
checks_file, out, ok, p, w, f, strict = sys.argv[1:]
checks = []
try:
    for line in open(checks_file, encoding='utf-8'):
        if line.strip():
            checks.append(json.loads(line))
except Exception:
    pass
open(out, 'w', encoding='utf-8').write(json.dumps({
    'ok': ok == 'true',
    'summary': {'pass': int(p), 'warn': int(w), 'fail': int(f), 'qa_strict': strict == 'true'},
    'checks': checks
}, ensure_ascii=False, indent=2))
PY

  {
    echo ""
    echo "Resumen:"
    echo "PASS: $PASS"
    echo "WARN: $WARN"
    echo "FAIL: $FAIL"
    echo "TXT : $TXT_REPORT"
    echo "JSON: $JSON_REPORT"
    echo "MD  : $MD_REPORT"
  } | tee -a "$TXT_REPORT" "$MD_REPORT"

  exit "$exit_code"
}

trap write_json_summary EXIT

cat > "$TXT_REPORT" <<EOF
TCDX ISO SaaS — QA i18n English full
Fecha: $(date)
QA_STRICT: $QA_STRICT

EOF

cat > "$MD_REPORT" <<EOF
# TCDX ISO SaaS — QA i18n English full

- Fecha: $(date)
- QA_STRICT: \`$QA_STRICT\`

## Resultados

EOF

echo "======================================"
echo " TCDX QA I18N ENGLISH FULL"
echo "======================================"

[ -d frontend ] && [ -d scripts ] && [ -d docs ] && pass "repo.root" "estructura repo detectada" || fail "repo.root" "no parece raíz del repo"

if git status --porcelain | grep -E '(^|/)\.env$|(^|/)\.env\.local$|(^|/)\.env\.production$|(^|/)\.env\.development$|bak_|\.dump$|\.tar\.gz$' >/dev/null 2>&1; then
  fail "git.sensitive_changes" "hay .env reales, backups, dumps o tar.gz en cambios"
else
  pass "git.sensitive_changes" "sin .env reales, backups, dumps ni tar.gz en cambios"
fi

for file in frontend/src/i18n/dictionaries/es.json frontend/src/i18n/dictionaries/en.json; do
  if [ -f "$file" ]; then
    python3 -m json.tool "$file" >/dev/null && pass "json.$file" "JSON válido" || fail "json.$file" "JSON inválido"
  else
    warn "json.$file" "no existe, revisar estructura i18n real"
  fi
done

for file in \
  frontend/src/components/EnglishVisualTextGuard.tsx \
  frontend/src/components/EnglishFindingsTextGuard.tsx \
  frontend/src/components/EnglishAdminSaasTextGuard.tsx \
  frontend/src/components/objectives/ObjectivesPanel.tsx \
  frontend/src/i18n/statusLabels.ts
do
  [ -f "$file" ] && pass "file.$file" "existe" || fail "file.$file" "no existe"
done

grep -q "useTranslation" frontend/src/components/objectives/ObjectivesPanel.tsx 2>/dev/null \
  && pass "objectives.useTranslation" "ObjectivesPanel usa i18n" \
  || fail "objectives.useTranslation" "ObjectivesPanel no usa useTranslation"

grep -q "translateDisplayText" frontend/src/components/objectives/ObjectivesPanel.tsx 2>/dev/null \
  && pass "objectives.displayText" "ObjectivesPanel traduce texto visible de BD por helper" \
  || warn "objectives.displayText" "ObjectivesPanel no referencia translateDisplayText directamente"

for guard in EnglishVisualTextGuard EnglishFindingsTextGuard EnglishAdminSaasTextGuard; do
  file="frontend/src/components/$guard.tsx"
  if [ -f "$file" ]; then
    grep -q "locale !== 'en'" "$file" && pass "$guard.locale_gate" "solo actúa en English" || fail "$guard.locale_gate" "no limita por locale en"
    grep -q "MutationObserver" "$file" && pass "$guard.observer" "cubre contenido dinámico" || warn "$guard.observer" "no usa MutationObserver"
  fi
done

grep -q "EnglishFindingsTextGuard" frontend/src/components/AppLayout.tsx 2>/dev/null \
  && pass "layout.findings_guard" "guard hallazgos montado" \
  || fail "layout.findings_guard" "guard hallazgos no montado"

grep -q "EnglishAdminSaasTextGuard" frontend/src/components/AppLayout.tsx 2>/dev/null \
  && pass "layout.admin_guard" "guard admin-saas montado" \
  || fail "layout.admin_guard" "guard admin-saas no montado"

python3 <<'PY' > "$SCAN_FILE"
from pathlib import Path
import re

priority_files = [
    'frontend/src/components/objectives/ObjectivesPanel.tsx',
    'frontend/src/app/no-conformidades/page.tsx',
    'frontend/src/app/hallazgos/page.tsx',
    'frontend/src/app/admin-saas/page.tsx',
    'frontend/src/app/diagnostico/page.tsx',
    'frontend/src/app/cotizador/page.tsx',
    'frontend/src/app/prefacturacion/page.tsx',
    'frontend/src/app/usuarios/page.tsx',
]
patterns = [
    'Objetivos', 'Nuevo objetivo', 'Cerrar formulario', 'Cumplidos', 'En progreso', 'Atrasados',
    'Guardar objetivo', 'Listado de objetivos', 'Sin descripción', 'Responsable', 'Evidencia',
    'Hallazgos', 'No conformidades', 'Acciones correctivas', 'Plan de acción', 'Diagnóstico',
    'Cotizador', 'Prefacturación', 'Usuarios', 'Empresas', 'Administración', 'Normas', 'Controles',
    'Auditorías', 'Evidencias', 'Riesgo', 'Matriz', 'Estado', 'Prioridad', 'Severidad',
    'Vencimiento', 'Guardar', 'Crear', 'Actualizar', 'Eliminar', 'Buscar', 'Filtrar', 'Limpiar',
    'Exportar', 'Descargar', 'Generar', 'Recomendaciones', 'Resumen', 'Cumplimiento', 'Pendiente',
    'Activo', 'Inactivo', 'Crítico', 'Aprobado', 'Rechazado', 'Abierto', 'Cerrado', 'Vencido',
    'En revisión', 'No aplica', 'Seleccionar archivo', 'Sin archivos seleccionados', 'Cotización',
    'Contrato creado', 'Casa matriz', 'mayo de', 'prefactura', 'Borrador', 'Marcar revisada',
]
compiled = re.compile('|'.join(re.escape(p) for p in patterns), re.I)
ignore = re.compile(r"(//|/\*|\*/|console\.|TCDX-I18N|statusLabels|English.*TextGuard|dictionary|diccionario)", re.I)
for file in priority_files:
    p = Path(file)
    if not p.exists():
        continue
    for idx, line in enumerate(p.read_text(encoding='utf-8', errors='ignore').splitlines(), 1):
        if ignore.search(line):
            continue
        if compiled.search(line):
            print(f"{file}:{idx}:{line.strip()[:220]}")
PY

if [ -s "$SCAN_FILE" ]; then
  warn "static.priority_spanish_scan" "posibles residuos críticos; revisar $SCAN_FILE"
else
  pass "static.priority_spanish_scan" "sin residuos críticos en archivos prioritarios"
fi

for phrase in \
  "Nonconformities" \
  "Finding" \
  "SaaS Administration" \
  "Basic company data" \
  "External AI" \
  "Standards and modules" \
  "Action Plan" \
  "Evidence"
do
  if grep -Riq "$phrase" frontend/src/components frontend/src/app 2>/dev/null; then
    pass "english.marker.$phrase" "marcador inglés detectado"
  else
    warn "english.marker.$phrase" "no se detectó marcador inglés"
  fi
done

if [ -f frontend/package.json ]; then
  if (cd frontend && npm run build) > "$RESULT_DIR/frontend-build-i18n-$TS.log" 2>&1; then
    pass "frontend.build" "npm run build OK"
  else
    fail "frontend.build" "npm run build falló. Ver $RESULT_DIR/frontend-build-i18n-$TS.log"
  fi
else
  fail "frontend.build" "frontend/package.json no existe"
fi

echo "======================================"
echo " QA I18N ENGLISH FULL FINALIZADO"
echo "======================================"
