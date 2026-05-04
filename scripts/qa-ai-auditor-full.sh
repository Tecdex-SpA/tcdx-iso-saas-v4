#!/usr/bin/env bash
set -Eeuo pipefail

API_URL="${API_URL:-http://192.168.100.120:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://192.168.100.130:3000}"
EMAIL="${EMAIL:-admin@rieltec.com}"
PASSWORD="${PASSWORD:-123456}"
QA_STRICT="${QA_STRICT:-false}"

TS="$(date '+%Y%m%d_%H%M%S')"
RESULT_DIR="qa-results"
mkdir -p "$RESULT_DIR"

TXT_REPORT="$RESULT_DIR/qa-ai-auditor-full-$TS.txt"
JSON_REPORT="$RESULT_DIR/qa-ai-auditor-full-$TS.json"
MD_REPORT="$RESULT_DIR/qa-ai-auditor-full-$TS.md"
CHECKS_FILE="$RESULT_DIR/qa-ai-auditor-checks-$TS.jsonl"

PASS=0
WARN=0
FAIL=0
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
    data = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception:
    print("")
    raise SystemExit(0)

cur = data
for part in sys.argv[2].split("."):
    if isinstance(cur, dict):
        cur = cur.get(part, "")
    elif isinstance(cur, list):
        try:
            cur = cur[int(part)]
        except Exception:
            cur = ""
            break
    else:
        cur = ""
        break

if isinstance(cur, (dict, list)):
    print(json.dumps(cur, ensure_ascii=False))
else:
    print(cur if cur is not None else "")
PY
}

json_check() {
  local file="$1"
  local expression="$2"
  python3 - "$file" "$expression" <<'PY'
import json, sys
file, expr = sys.argv[1], sys.argv[2]
try:
    data = json.load(open(file, encoding="utf-8"))
except Exception:
    print("false")
    raise SystemExit(0)

def get(path, default=None):
    cur = data
    for part in path.split("."):
        if isinstance(cur, dict):
            cur = cur.get(part, default)
        elif isinstance(cur, list):
            try:
                cur = cur[int(part)]
            except Exception:
                return default
        else:
            return default
    return cur

try:
    result = eval(expr, {"__builtins__": {}}, {"data": data, "get": get, "len": len, "isinstance": isinstance, "list": list, "dict": dict, "int": int, "str": str, "bool": bool})
    print("true" if result else "false")
except Exception:
    print("false")
PY
}

http_code() {
  curl -s -o /dev/null -w "%{http_code}" "$1" || true
}

write_json_summary() {
  local OK="true"
  local EXIT_CODE=0

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
  echo " QA IA AUDITOR FINALIZADO"
  echo " PASS: $PASS | WARN: $WARN | FAIL: $FAIL"
  echo " TXT : $TXT_REPORT"
  echo " JSON: $JSON_REPORT"
  echo " MD  : $MD_REPORT"
  echo "======================================"

  exit "$EXIT_CODE"
}

trap write_json_summary EXIT

cat > "$TXT_REPORT" <<EOF
TCDX ISO SaaS — QA IA Auditor Senior completo
Fecha: $(date)
API_URL: $API_URL
FRONTEND_URL: $FRONTEND_URL
QA_STRICT: $QA_STRICT

EOF

cat > "$MD_REPORT" <<EOF
# TCDX ISO SaaS — QA IA Auditor Senior completo

- Fecha: $(date)
- API_URL: \`$API_URL\`
- FRONTEND_URL: \`$FRONTEND_URL\`
- QA_STRICT: \`$QA_STRICT\`

## Resultados

EOF

echo "======================================"
echo " TCDX QA IA AUDITOR SENIOR COMPLETO"
echo "======================================"

# Repo
[ -d backend ] && [ -d frontend ] && [ -d scripts ] && pass "repo.root" "Estructura detectada" || fail "repo.root" "No parece raíz del repo"

if git status --porcelain | grep -E '\.env|env.local|env.production|env.development' >/dev/null 2>&1; then
  fail "git.env" "Hay .env en cambios"
else
  pass "git.env" "No hay .env en cambios"
fi

# Sintaxis
if [ -f backend/src/routes/ai-auditor.routes.js ]; then
  node -c backend/src/routes/ai-auditor.routes.js >/dev/null 2>&1 && pass "node:ai-auditor.routes" "Sintaxis OK" || fail "node:ai-auditor.routes" "Error sintaxis"
else
  fail "node:ai-auditor.routes" "No existe"
fi

for file in ai-engine/main.py ai-engine/app/routes/ai.py; do
  if [ -f "$file" ]; then
    python3 -m py_compile "$file" >/dev/null 2>&1 && pass "python:$file" "py_compile OK" || fail "python:$file" "py_compile falló"
  else
    warn "python:$file" "No existe"
  fi
done

# Login
LOGIN="$RESULT_DIR/qa-ai-auditor-login-$TS.json"
curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" > "$LOGIN"

TOKEN="$(python3 - "$LOGIN" <<'PY'
import json, sys
try:
    data=json.load(open(sys.argv[1], encoding="utf-8"))
    print(data.get("token") or data.get("access_token") or data.get("data",{}).get("token") or "")
except Exception:
    print("")
PY
)"

if [ -n "$TOKEN" ]; then
  pass "auth.token" "Token obtenido, largo ${#TOKEN}"
else
  fail "auth.token" "No se obtuvo token"
fi

# Scope global and filtered
if [ -n "$TOKEN" ]; then
  SCOPE="$RESULT_DIR/qa-ai-auditor-scope-global-$TS.json"
  curl -s "$API_URL/api/ai-auditor/scope" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tcdx-locale: en" > "$SCOPE"

  [ "$(json_check "$SCOPE" "get('ok') is True")" = "true" ] && pass "scope.global.ok" "ok=true" || fail "scope.global.ok" "ok no true"
  [ "$(json_check "$SCOPE" "int(get('scope.counts.controls_total') or 0) > 0")" = "true" ] && pass "scope.global.controls_total" "controls_total=$(json_get "$SCOPE" "scope.counts.controls_total")" || fail "scope.global.controls_total" "controls_total no válido"
  [ "$(json_check "$SCOPE" "isinstance(get('scope.controls_by_standard'), list) and len(get('scope.controls_by_standard')) > 0")" = "true" ] && pass "scope.global.controls_by_standard" "Existe controls_by_standard" || fail "scope.global.controls_by_standard" "No existe o vacío"
  [ -n "$(json_get "$SCOPE" "scope.sources.controls_source")" ] && pass "scope.global.controls_source" "controls_source=$(json_get "$SCOPE" "scope.sources.controls_source")" || fail "scope.global.controls_source" "No existe controls_source"

  for standard in ISO27001 ISO9001; do
    OUT="$RESULT_DIR/qa-ai-auditor-scope-$standard-$TS.json"
    curl -s "$API_URL/api/ai-auditor/scope?standard_code=$standard" \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-tcdx-locale: en" > "$OUT"

    [ "$(json_check "$OUT" "get('ok') is True")" = "true" ] && pass "scope.$standard.ok" "ok=true" || fail "scope.$standard.ok" "ok no true"
    [ "$(json_check "$OUT" "get('scope.standard_code') in ('$standard', None, '') or '$standard' in str(get('scope.standards'))")" = "true" ] && pass "scope.$standard.filter" "Filtro aceptado" || warn "scope.$standard.filter" "No se pudo confirmar filtro"
  done

  # Analyze EN
  ANALYZE_EN="$RESULT_DIR/qa-ai-auditor-analyze-en-$TS.json"
  curl -s -X POST "$API_URL/api/ai-auditor/analyze" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "x-tcdx-locale: en" \
    -d '{"locale":"en","audit_focus":"general","depth":"executive","include_internet":false}' > "$ANALYZE_EN"

  [ "$(json_check "$ANALYZE_EN" "get('ok') is True")" = "true" ] && pass "analyze.en.ok" "ok=true" || fail "analyze.en.ok" "ok no true"
  [ "$(json_get "$ANALYZE_EN" "locale")" = "en" ] && pass "analyze.en.locale" "locale=en" || fail "analyze.en.locale" "locale inesperado"
  [ -n "$(json_get "$ANALYZE_EN" "summary.executive_summary")" ] && pass "analyze.en.summary" "summary existe" || fail "analyze.en.summary" "summary no existe"
  [ "$(json_check "$ANALYZE_EN" "int(get('coverage.controls_reviewed') or 0) > 0")" = "true" ] && pass "analyze.en.coverage.controls" "controls_reviewed=$(json_get "$ANALYZE_EN" "coverage.controls_reviewed")" || fail "analyze.en.coverage.controls" "controls_reviewed inválido"
  [ "$(json_check "$ANALYZE_EN" "get('human_review_required') is True")" = "true" ] && pass "analyze.en.human_review" "human_review_required=true" || fail "analyze.en.human_review" "human_review_required no true"
  [ "$(json_check "$ANALYZE_EN" "get('can_create_records') is False")" = "true" ] && pass "analyze.en.no_create" "can_create_records=false" || fail "analyze.en.no_create" "can_create_records no false"
  [ "$(json_check "$ANALYZE_EN" "get('trace.db_write') is False")" = "true" ] && pass "analyze.en.db_write" "db_write=false" || fail "analyze.en.db_write" "db_write no false"
  if [ "$(json_check "$ANALYZE_EN" "get('trace.ai_engine_used') is True")" = "true" ]; then
    pass "analyze.en.ai_engine" "ai_engine_used=true"
  elif [ "$(json_check "$ANALYZE_EN" "get('ok') is True and get('human_review_required') is True and get('can_create_records') is False")" = "true" ]; then
    warn "analyze.en.ai_engine" "ai_engine_used=false pero fallback seguro opera"
  else
    fail "analyze.en.ai_engine" "No hay ai_engine ni fallback seguro"
  fi

  # Analyze ES
  ANALYZE_ES="$RESULT_DIR/qa-ai-auditor-analyze-es-$TS.json"
  curl -s -X POST "$API_URL/api/ai-auditor/analyze" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "x-tcdx-locale: es" \
    -d '{"locale":"es","audit_focus":"general","depth":"executive","include_internet":false}' > "$ANALYZE_ES"

  [ "$(json_check "$ANALYZE_ES" "get('ok') is True")" = "true" ] && pass "analyze.es.ok" "ok=true" || fail "analyze.es.ok" "ok no true"
  [ "$(json_get "$ANALYZE_ES" "locale")" = "es" ] && pass "analyze.es.locale" "locale=es" || fail "analyze.es.locale" "locale inesperado"
  [ -n "$(json_get "$ANALYZE_ES" "summary.executive_summary")" ] && pass "analyze.es.summary" "summary existe" || fail "analyze.es.summary" "summary no existe"
  [ "$(json_check "$ANALYZE_ES" "get('human_review_required') is True")" = "true" ] && pass "analyze.es.human_review" "human_review_required=true" || fail "analyze.es.human_review" "human_review_required no true"
  [ "$(json_check "$ANALYZE_ES" "get('can_create_records') is False")" = "true" ] && pass "analyze.es.no_create" "can_create_records=false" || fail "analyze.es.no_create" "can_create_records no false"

  # Prepare suggestions
  for type in finding action_plan evidence nonconformity; do
    OUT="$RESULT_DIR/qa-ai-auditor-prepare-$type-$TS.json"
    case "$type" in
      finding) LINK_PREFIX="/hallazgos?" ;;
      action_plan) LINK_PREFIX="/plan-accion?" ;;
      evidence) LINK_PREFIX="/evidencias?" ;;
      nonconformity) LINK_PREFIX="/no-conformidades?" ;;
    esac

    curl -s -X POST "$API_URL/api/ai-auditor/suggestions/$type/prepare" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -H "x-tcdx-locale: en" \
      -d "{\"locale\":\"en\",\"suggestion\":{\"title\":\"QA AI Auditor $type\",\"priority\":\"high\",\"severity\":\"high\",\"standard_code\":\"ISO27001\",\"recommended_action\":\"QA validation only. Do not create automatically.\"}}" > "$OUT"

    [ "$(json_check "$OUT" "get('ok') is True")" = "true" ] && pass "prepare.$type.ok" "ok=true" || fail "prepare.$type.ok" "ok no true"
    [ "$(json_get "$OUT" "type")" = "$type" ] && pass "prepare.$type.type" "type=$type" || fail "prepare.$type.type" "type inesperado"
    [ "$(json_check "$OUT" "get('can_create_records') is False")" = "true" ] && pass "prepare.$type.no_create" "can_create_records=false" || fail "prepare.$type.no_create" "can_create_records no false"
    [ "$(json_check "$OUT" "get('human_review_required') is True")" = "true" ] && pass "prepare.$type.human_review" "human_review_required=true" || fail "prepare.$type.human_review" "human_review_required no true"
    [ -n "$(json_get "$OUT" "storage_key")" ] && pass "prepare.$type.storage_key" "storage_key existe" || fail "prepare.$type.storage_key" "storage_key vacío"
    [ "$(json_check "$OUT" "isinstance(get('prepared_payload'), dict)")" = "true" ] && pass "prepare.$type.payload" "prepared_payload existe" || fail "prepare.$type.payload" "prepared_payload no existe"
    deep="$(json_get "$OUT" "deep_link")"
    case "$deep" in
      "$LINK_PREFIX"*) pass "prepare.$type.deep_link" "$deep" ;;
      *) fail "prepare.$type.deep_link" "deep_link inesperado: $deep" ;;
    esac
  done
fi

# Frontend HTTP
for route in /dashboard /auditorias /ia-auditor /hallazgos /plan-accion /evidencias /no-conformidades; do
  code="$(http_code "$FRONTEND_URL$route")"
  case "$code" in
    200|301|302|307|308) pass "frontend$route" "HTTP $code" ;;
    *) fail "frontend$route" "HTTP $code" ;;
  esac
done
