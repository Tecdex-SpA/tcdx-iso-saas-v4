#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${API_URL:?API_URL requerido, ej: http://localhost:3000}"
: "${FRONTEND_URL:?FRONTEND_URL requerido, ej: http://localhost:3001}"
: "${AI_ENGINE_URL:?AI_ENGINE_URL requerido, ej: http://localhost:8001}"
REQUIRE_AI_ENGINE="${REQUIRE_AI_ENGINE:-false}"
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"
TOKEN="${TOKEN:-}"

TS="$(date '+%Y%m%d_%H%M%S')"
mkdir -p qa-results

TXT="qa-results/runtime-monitor-$TS.txt"
JSON="qa-results/runtime-monitor-$TS.json"
MD="qa-results/runtime-monitor-$TS.md"
ITEMS="qa-results/runtime-monitor-$TS.items.jsonl"
: > "$ITEMS"

PASS=0
WARN=0
FAIL=0

record() {
  STATUS="$1"
  NAME="$2"
  DETAIL="$3"

  case "$STATUS" in
    PASS) PASS=$((PASS+1)) ;;
    WARN) WARN=$((WARN+1)) ;;
    FAIL) FAIL=$((FAIL+1)) ;;
  esac

  echo "[$STATUS] $NAME — $DETAIL"

  python3 - "$ITEMS" "$STATUS" "$NAME" "$DETAIL" <<'PY'
import json, sys
path, status, name, detail = sys.argv[1:5]
with open(path, "a", encoding="utf-8") as fh:
    fh.write(json.dumps({"status": status, "name": name, "detail": detail}, ensure_ascii=False) + "\n")
PY
}

expect_http() {
  NAME="$1"
  URL="$2"
  EXPECTED_REGEX="${3:-^(200|301|302|307|308)$}"

  CODE="$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 8 "$URL" || true)"
  if echo "$CODE" | grep -Eq "$EXPECTED_REGEX"; then
    record PASS "$NAME" "HTTP $CODE"
  else
    record FAIL "$NAME" "HTTP $CODE en $URL"
  fi
}

json_check() {
  FILE="$1"
  EXPR="$2"
  python3 - "$FILE" "$EXPR" <<'PY'
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
    print("true" if eval(expr, {"__builtins__": {}}, {
        "data": data, "get": get, "len": len, "bool": bool,
        "isinstance": isinstance, "list": list, "dict": dict, "str": str, "int": int
    }) else "false")
except Exception:
    print("false")
PY
}

login_if_needed() {
  if [ -n "$TOKEN" ]; then
    return 0
  fi

  if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
    record WARN "auth.login" "EMAIL/PASSWORD no definidos; se omiten checks autenticados"
    return 0
  fi

  LOGIN_FILE="qa-results/runtime-monitor-login-$TS.json"
  curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" > "$LOGIN_FILE"

  TOKEN="$(python3 - "$LOGIN_FILE" <<'PY'
import json, sys
try:
    d=json.load(open(sys.argv[1], encoding="utf-8"))
    print(d.get("token") or d.get("access_token") or d.get("data",{}).get("token") or "")
except Exception:
    print("")
PY
)"

  if [ -n "$TOKEN" ]; then
    record PASS "auth.login" "token obtenido"
  else
    record FAIL "auth.login" "no se obtuvo token"
  fi
}

check_headers() {
  HEADERS="qa-results/runtime-monitor-headers-$TS.headers"
  curl -s -D "$HEADERS" -o /dev/null "$API_URL/" || true

  grep -qi '^X-Content-Type-Options: nosniff' "$HEADERS" && record PASS "headers.x_content_type_options" "nosniff" || record FAIL "headers.x_content_type_options" "faltante"
  grep -qi '^X-Frame-Options: SAMEORIGIN' "$HEADERS" && record PASS "headers.x_frame_options" "SAMEORIGIN" || record FAIL "headers.x_frame_options" "faltante"
  grep -qi '^Referrer-Policy: no-referrer' "$HEADERS" && record PASS "headers.referrer_policy" "no-referrer" || record FAIL "headers.referrer_policy" "faltante"
}

check_ai_engine() {
  CODE="$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 8 "$AI_ENGINE_URL/health" || true)"
  if [ "$CODE" = "200" ]; then
    record PASS "ai_engine.health" "HTTP 200 /health"
    return 0
  fi

  CODE_ROOT="$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 8 "$AI_ENGINE_URL/" || true)"
  if [ "$CODE_ROOT" = "200" ]; then
    record PASS "ai_engine.root" "HTTP 200 /"
    return 0
  fi

  if [ "$REQUIRE_AI_ENGINE" = "true" ]; then
    record FAIL "ai_engine.health" "sin respuesta compatible /health=$CODE /=$CODE_ROOT"
  else
    record WARN "ai_engine.health" "sin respuesta compatible /health=$CODE /=$CODE_ROOT"
  fi
}

check_authenticated_endpoint() {
  NAME="$1"
  URL="$2"
  EXPR="$3"

  if [ -z "$TOKEN" ]; then
    record WARN "$NAME" "sin token; check omitido"
    return 0
  fi

  OUT="qa-results/runtime-monitor-${NAME//[^a-zA-Z0-9_]/_}-$TS.json"
  curl -s "$URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tcdx-locale: en" > "$OUT"

  if [ "$(json_check "$OUT" "$EXPR")" = "true" ]; then
    record PASS "$NAME" "respuesta válida"
  else
    record FAIL "$NAME" "respuesta no válida"
  fi
}

{
  echo "======================================"
  echo " TCDX RUNTIME MONITOR"
  echo "======================================"
  echo "Fecha: $(date)"
  echo "API_URL=$API_URL"
  echo "FRONTEND_URL=$FRONTEND_URL"
  echo "AI_ENGINE_URL=$AI_ENGINE_URL"
  echo "REQUIRE_AI_ENGINE=$REQUIRE_AI_ENGINE"
  echo ""

  expect_http "backend.root" "$API_URL/"
  expect_http "frontend.login" "$FRONTEND_URL/login"
  expect_http "frontend.dashboard" "$FRONTEND_URL/dashboard"
  expect_http "frontend.ia_compliance" "$FRONTEND_URL/ia-compliance"
  expect_http "frontend.ia_auditor" "$FRONTEND_URL/ia-auditor"
  check_ai_engine
  check_headers
  login_if_needed
  check_authenticated_endpoint "ai_auditor.scope" "$API_URL/api/ai-auditor/scope" "get('ok') is True"
  check_authenticated_endpoint "ai_compliance.engine_health" "$API_URL/api/ai-compliance/engine-health" "get('ok') is True"

  echo ""
  echo "Resumen:"
  echo "PASS: $PASS"
  echo "WARN: $WARN"
  echo "FAIL: $FAIL"
  echo "TXT : $TXT"
  echo "JSON: $JSON"
  echo "MD  : $MD"
} | tee "$TXT"

python3 - "$JSON" "$PASS" "$WARN" "$FAIL" "$ITEMS" <<'PY'
import json, sys
path, p, w, f, items_path = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
items = []
try:
    with open(items_path, encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                items.append(json.loads(line))
except FileNotFoundError:
    pass
with open(path, "w", encoding="utf-8") as fh:
    json.dump({"pass": p, "warn": w, "fail": f, "items": items}, fh, ensure_ascii=False, indent=2)
PY

{
  echo "# TCDX Runtime Monitor"
  echo ""
  echo "- PASS: $PASS"
  echo "- WARN: $WARN"
  echo "- FAIL: $FAIL"
  echo ""
  echo "Ver TXT: \`$TXT\`"
} > "$MD"

rm -f "$ITEMS"
test "$FAIL" -eq 0
