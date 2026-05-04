#!/usr/bin/env bash
set -Eeuo pipefail

API_URL="${API_URL:-http://192.168.100.120:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://192.168.100.130:8080}"
EMAIL="${EMAIL:-admin@rieltec.com}"
PASSWORD="${PASSWORD:-123456}"
QA_STRICT="${QA_STRICT:-false}"

TS="$(date '+%Y%m%d_%H%M%S')"
RESULT_DIR="qa-results"
mkdir -p "$RESULT_DIR"

TXT_REPORT="$RESULT_DIR/qa-bilingual-full-$TS.txt"
JSON_REPORT="$RESULT_DIR/qa-bilingual-full-$TS.json"
MD_REPORT="$RESULT_DIR/qa-bilingual-full-$TS.md"

PASS=0
WARN=0
FAIL=0
CHECKS_FILE="$RESULT_DIR/checks-$TS.jsonl"
: > "$CHECKS_FILE"

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

json_get() {
  local file="$1"
  local path="$2"
  python3 - "$file" "$path" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception:
    print("")
    raise SystemExit(0)

cur = data
for part in sys.argv[2].split("."):
    if isinstance(cur, dict):
        cur = cur.get(part, "")
    else:
        cur = ""
        break
print(cur if cur is not None else "")
PY
}

contains_json_text() {
  local file="$1"
  local pattern="$2"
  python3 - "$file" "$pattern" <<'PY'
import re, sys
try:
    raw = open(sys.argv[1], encoding="utf-8").read()
except Exception:
    print("false")
    raise SystemExit(0)
print("true" if re.search(sys.argv[2], raw, re.I | re.S) else "false")
PY
}

http_code() {
  curl -s -o /dev/null -w "%{http_code}" "$1" || true
}

decode_tenant() {
  local token="$1"
  python3 - "$token" <<'PY'
import sys, json, base64
token = sys.argv[1]
try:
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    data = json.loads(base64.urlsafe_b64decode(payload.encode()).decode())
    print(data.get("tenant_id") or data.get("tenantId") or "")
except Exception:
    print("")
PY
}

write_json_summary() {
  OK="true"
  EXIT_CODE=0

  if [ "$FAIL" -gt 0 ]; then
    OK="false"
    EXIT_CODE=1
  elif [ "$WARN" -gt 0 ] && [ "$QA_STRICT" = "true" ]; then
    OK="false"
    EXIT_CODE=2
  fi

  python3 - "$CHECKS_FILE" "$JSON_REPORT" "$OK" "$PASS" "$WARN" "$FAIL" "$API_URL" "$FRONTEND_URL" <<'PY'
import json, sys
checks_file, out, ok, p, w, f, api, frontend = sys.argv[1:]
checks = []
try:
    for line in open(checks_file, encoding="utf-8"):
        if line.strip():
            checks.append(json.loads(line))
except Exception:
    pass

data = {
  "ok": ok == "true",
  "summary": {
    "pass": int(p),
    "warn": int(w),
    "fail": int(f),
    "api_url": api,
    "frontend_url": frontend
  },
  "checks": checks
}

open(out, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=2))
PY

  {
    echo ""
    echo "Resumen:"
    echo "PASS: $PASS"
    echo "WARN: $WARN"
    echo "FAIL: $FAIL"
    echo ""
    echo "Archivos:"
    echo "TXT : $TXT_REPORT"
    echo "JSON: $JSON_REPORT"
    echo "MD  : $MD_REPORT"
  } | tee -a "$TXT_REPORT" "$MD_REPORT"

  echo ""
  echo "======================================"
  echo " QA FINALIZADO"
  echo " PASS: $PASS | WARN: $WARN | FAIL: $FAIL"
  echo " TXT : $TXT_REPORT"
  echo " JSON: $JSON_REPORT"
  echo " MD  : $MD_REPORT"
  echo "======================================"

  exit "$EXIT_CODE"
}

trap write_json_summary EXIT

cat > "$TXT_REPORT" <<EOF
TCDX ISO SaaS — QA bilingüe completo
Fecha: $(date)
API_URL: $API_URL
FRONTEND_URL: $FRONTEND_URL
QA_STRICT: $QA_STRICT

EOF

cat > "$MD_REPORT" <<EOF
# TCDX ISO SaaS — QA bilingüe completo

- Fecha: $(date)
- API_URL: \`$API_URL\`
- FRONTEND_URL: \`$FRONTEND_URL\`
- QA_STRICT: \`$QA_STRICT\`

## Resultados

EOF

echo "======================================"
echo " TCDX QA BILINGÜE COMPLETO"
echo "======================================"

# Repo
[ -d backend ] && [ -d frontend ] && [ -d scripts ] && pass "repo.root" "Estructura detectada" || fail "repo.root" "No parece raíz del repo"

if git status --porcelain | grep -E '\.env|env.local|env.production|env.development' >/dev/null 2>&1; then
  fail "git.env" "Hay .env en cambios"
else
  pass "git.env" "No hay .env en cambios"
fi

# Sintaxis backend
for file in \
  backend/src/utils/locale.js \
  backend/src/utils/errorResponse.js \
  backend/src/utils/errorCodes.js \
  backend/src/routes/auth.routes.js \
  backend/src/routes/reports.routes.js \
  backend/src/routes/ai-answer.routes.js \
  backend/src/routes/ai-compliance.routes.js \
  backend/src/routes/notifications.routes.js \
  backend/src/controllers/notifications.controller.js
do
  if [ -f "$file" ]; then
    node -c "$file" >/dev/null 2>&1 && pass "node:$file" "Sintaxis OK" || fail "node:$file" "Error sintaxis"
  else
    warn "node:$file" "No existe"
  fi
done

# AI engine py_compile si existe
for file in \
  ai-engine/main.py \
  ai-engine/app/routes/ai.py \
  ai-engine/app/services/language_service.py
do
  if [ -f "$file" ]; then
    python3 -m py_compile "$file" >/dev/null 2>&1 && pass "python:$file" "py_compile OK" || fail "python:$file" "py_compile falló"
  else
    warn "python:$file" "No existe"
  fi
done

# Frontend build
if [ -f frontend/package.json ]; then
  if (cd frontend && npm run build) > "$RESULT_DIR/frontend-build-$TS.log" 2>&1; then
    pass "frontend.build" "npm run build OK"
  else
    fail "frontend.build" "npm run build falló. Ver $RESULT_DIR/frontend-build-$TS.log"
  fi
else
  fail "frontend.build" "frontend/package.json no existe"
fi

# Frontend HTTP
for route in /login /dashboard /dashboard-kpi /health /ciclo-vida /controles /evidencias /hallazgos /plan-accion /auditorias /matriz-riesgo /activos /exportes; do
  code="$(http_code "$FRONTEND_URL$route")"
  case "$code" in
    200|301|302|307|308) pass "frontend$route" "HTTP $code" ;;
    404) warn "frontend$route" "HTTP 404, puede no existir" ;;
    *) fail "frontend$route" "HTTP $code" ;;
  esac
done

# Login token
LOGIN="$RESULT_DIR/login-$TS.json"
curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" > "$LOGIN"

TOKEN="$(python3 - "$LOGIN" <<'PY'
import json,sys
try:
    d=json.load(open(sys.argv[1]))
    print(d.get("token") or d.get("access_token") or d.get("data",{}).get("token") or "")
except Exception:
    print("")
PY
)"

if [ -n "$TOKEN" ]; then
  pass "auth.token" "Token obtenido, largo ${#TOKEN}"
else
  fail "auth.token" "No se obtuvo token"
fi

TENANT_ID="$(decode_tenant "$TOKEN")"
[ -n "$TENANT_ID" ] && pass "auth.tenant" "tenant_id=$TENANT_ID" || warn "auth.tenant" "No se pudo extraer tenant_id"

# Errores auth locale
for locale in en es; do
  OUT="$RESULT_DIR/login-invalid-$locale-$TS.json"
  curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -H "x-tcdx-locale: $locale" \
    -d '{"email":"admin@rieltec.com","password":"mala"}' > "$OUT"

  code="$(json_get "$OUT" "error_code")"
  resp_locale="$(json_get "$OUT" "locale")"

  [ "$code" = "AUTH_INVALID_CREDENTIALS" ] && [ "$resp_locale" = "$locale" ] \
    && pass "auth.invalid.$locale" "$code locale=$resp_locale" \
    || fail "auth.invalid.$locale" "Respuesta inesperada"
done

# IA bilingüe
if [ -n "$TOKEN" ]; then
  AI_EN="$RESULT_DIR/ai-en-$TS.json"
  curl -s -X POST "$API_URL/api/ai-compliance/answer" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "x-tcdx-locale: en" \
    -d '{"question":"What evidence should I upload for ISO 27001 business continuity?","locale":"en","limit":5,"knowledge_limit":5,"benchmark_limit":3}' > "$AI_EN"

  ai_locale="$(json_get "$AI_EN" "locale")"
  [ "$ai_locale" = "en" ] && pass "ai.en.locale" "locale=en" || fail "ai.en.locale" "locale inesperado"

  if [ "$(contains_json_text "$AI_EN" "Criterio auditor|No se observan brechas|con confianza medium")" = "true" ]; then
    fail "ai.en.spanish_residue" "Detecta residuos españoles críticos"
  else
    pass "ai.en.spanish_residue" "Sin residuos críticos conocidos"
  fi

  if [ "$(contains_json_text "$AI_EN" "Auditor criterion|No critical gaps|Most relevant internal results|Review")" = "true" ]; then
    pass "ai.en.markers" "Marcadores ingleses detectados"
  else
    warn "ai.en.markers" "No detectó marcadores ingleses esperados"
  fi

  AI_ES="$RESULT_DIR/ai-es-$TS.json"
  curl -s -X POST "$API_URL/api/ai-compliance/answer" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "x-tcdx-locale: es" \
    -d '{"question":"Qué evidencia debo cargar para continuidad operacional ISO 27001?","locale":"es","limit":5,"knowledge_limit":5,"benchmark_limit":3}' > "$AI_ES"

  [ "$(json_get "$AI_ES" "locale")" = "es" ] && pass "ai.es.locale" "locale=es" || fail "ai.es.locale" "locale inesperado"

  AI_ERR="$RESULT_DIR/ai-error-$TS.json"
  curl -s -X POST "$API_URL/api/ai-compliance/answer" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "x-tcdx-locale: en" \
    -d '{"locale":"en"}' > "$AI_ERR"

  [ "$(json_get "$AI_ERR" "error_code")" = "VALIDATION_ERROR" ] && [ "$(json_get "$AI_ERR" "locale")" = "en" ] \
    && pass "ai.error.validation" "VALIDATION_ERROR locale=en" \
    || fail "ai.error.validation" "No devolvió VALIDATION_ERROR locale=en"
fi

# Notificaciones
if [ -n "$TOKEN" ]; then
  NOTIF="$RESULT_DIR/notification-notfound-$TS.json"
  curl -s -X PATCH "$API_URL/api/notifications/00000000-0000-0000-0000-000000000000/read" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "x-tcdx-locale: en" > "$NOTIF"

  [ "$(json_get "$NOTIF" "error_code")" = "NOTIFICATION_NOT_FOUND" ] && [ "$(json_get "$NOTIF" "locale")" = "en" ] \
    && pass "notifications.not_found" "NOTIFICATION_NOT_FOUND locale=en" \
    || fail "notifications.not_found" "Respuesta inesperada"
fi

# Helpers críticos
[ -f frontend/src/i18n/statusLabels.ts ] && pass "statusLabels.file" "Existe" || fail "statusLabels.file" "No existe"
for fn in getStatusLabel getPriorityLabel getHealthStatusLabel getActionPlanStatusLabel getEvidenceStatusLabel getComplianceStatusLabel; do
  grep -q "$fn" frontend/src/i18n/statusLabels.ts 2>/dev/null && pass "statusLabels.$fn" "Existe" || fail "statusLabels.$fn" "No existe"
done

[ -f backend/src/utils/errorCodes.js ] && pass "errorCodes.file" "Existe" || fail "errorCodes.file" "No existe"
grep -q "buildErrorResponse" backend/src/utils/errorResponse.js 2>/dev/null && pass "errorResponse.build" "buildErrorResponse existe" || fail "errorResponse.build" "No existe"
grep -q "sendError" backend/src/utils/errorResponse.js 2>/dev/null && pass "errorResponse.send" "sendError existe" || fail "errorResponse.send" "No existe"

# Escaneo estático conservador
STATIC="$RESULT_DIR/static-spanish-scan-$TS.txt"
grep -RniE "Ver detalle|Ver evidencias|Eliminar|Guardar plan|Responsable|Vencimiento|Prioridad|Último update|Aprobación cierre|Informe para|Resumen ejecutivo|Estado operativo" frontend/src/app --exclude='*.bak*' > "$STATIC" || true
if [ -s "$STATIC" ]; then
  warn "static.spanish.scan" "Posibles textos españoles. Revisar $STATIC"
else
  pass "static.spanish.scan" "Sin residuos conocidos"
fi
