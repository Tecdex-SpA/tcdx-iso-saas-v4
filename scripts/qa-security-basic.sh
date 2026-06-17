#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${API_URL:?API_URL requerido, ej: http://localhost:3000}"
: "${FRONTEND_URL:?FRONTEND_URL requerido, ej: http://localhost:3001}"
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"
TS="$(date '+%Y%m%d_%H%M%S')"

mkdir -p qa-results

TXT="qa-results/qa-security-basic-$TS.txt"
JSON="qa-results/qa-security-basic-$TS.json"
MD="qa-results/qa-security-basic-$TS.md"
ITEMS="qa-results/qa-security-basic-$TS.items.jsonl"
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

check() {
  NAME="$1"
  RESULT="$2"
  DETAIL="$3"
  if [ "$RESULT" = "true" ]; then
    record PASS "$NAME" "$DETAIL"
  else
    record FAIL "$NAME" "$DETAIL"
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
        "data": data,
        "get": get,
        "len": len,
        "isinstance": isinstance,
        "list": list,
        "dict": dict,
        "int": int,
        "str": str,
        "bool": bool,
    }) else "false")
except Exception:
    print("false")
PY
}

{
  echo "======================================"
  echo " TCDX QA SECURITY BASIC"
  echo "======================================"
  echo "Fecha: $(date)"
  echo "API_URL=$API_URL"
  echo "FRONTEND_URL=$FRONTEND_URL"
  echo ""

  check "repo.root" "$([ -d frontend ] && [ -d backend ] && [ -d scripts ] && echo true || echo false)" "estructura repo detectada"

  if git status --porcelain | grep -E '(^|/)\.env$|(^|/)\.env\.local$|(^|/)\.env\.production$|(^|/)\.env\.development$|bak_' >/dev/null 2>&1; then
    record FAIL "git.env" "hay .env reales o backups en cambios"
  else
    record PASS "git.env" "no hay .env reales ni backups en cambios"
  fi

  echo ""

  ROOT_CODE="$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/" || true)"
  case "$ROOT_CODE" in 200|301|302|307|308) ROOT_OK=true ;; *) ROOT_OK=false ;; esac
  check "backend.root" "$ROOT_OK" "HTTP $ROOT_CODE"

  LOGIN_PAGE_CODE="$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/login" || true)"
  case "$LOGIN_PAGE_CODE" in 200|301|302|307|308) LOGIN_PAGE_OK=true ;; *) LOGIN_PAGE_OK=false ;; esac
  check "frontend.login" "$LOGIN_PAGE_OK" "HTTP $LOGIN_PAGE_CODE"

  BAD_LOGIN="qa-results/security-bad-login-$TS.json"
  curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"invalid@example.com","password":"wrong"}' > "$BAD_LOGIN" || true
  check "auth.bad_login.no_token" "$(json_check "$BAD_LOGIN" "not bool(get('token') or get('access_token') or get('data.token'))")" "login inválido no entrega token"

  LOGIN="qa-results/security-login-$TS.json"
  curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" > "$LOGIN"

  TOKEN="$(python3 - "$LOGIN" <<'PY'
import json, sys
try:
    d=json.load(open(sys.argv[1], encoding="utf-8"))
    print(d.get("token") or d.get("access_token") or d.get("data",{}).get("token") or "")
except Exception:
    print("")
PY
)"
  check "auth.good_login.token" "$([ -n "$TOKEN" ] && echo true || echo false)" "token chars=${#TOKEN}"

  echo ""

  NO_TOKEN_CODE="$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/ai-auditor/scope" || true)"
  case "$NO_TOKEN_CODE" in 401|403) NO_TOKEN_OK=true ;; *) NO_TOKEN_OK=false ;; esac
  check "protected.no_token" "$NO_TOKEN_OK" "HTTP $NO_TOKEN_CODE"

  SCOPE="qa-results/security-scope-$TS.json"
  curl -s "$API_URL/api/ai-auditor/scope" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tcdx-locale: en" > "$SCOPE"
  check "protected.with_token.scope" "$(json_check "$SCOPE" "get('ok') is True")" "scope ok"

  ANALYZE="qa-results/security-analyze-$TS.json"
  curl -s -X POST "$API_URL/api/ai-auditor/analyze" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "x-tcdx-locale: en" \
    -d '{"locale":"en","audit_focus":"general","depth":"executive","include_internet":false}' > "$ANALYZE"
  check "ai_auditor.analyze.ok" "$(json_check "$ANALYZE" "get('ok') is True")" "analyze ok"
  check "ai_auditor.no_create" "$(json_check "$ANALYZE" "get('can_create_records') is False")" "can_create_records=false"
  check "ai_auditor.human_review" "$(json_check "$ANALYZE" "get('human_review_required') is True")" "human_review_required=true"
  check "ai_auditor.db_write" "$(json_check "$ANALYZE" "get('trace.db_write') is False")" "db_write=false"

  echo ""

  CORS_ALLOWED_HEADERS="qa-results/security-cors-allowed-$TS.headers"
  curl -s -D "$CORS_ALLOWED_HEADERS" -o /dev/null \
    -H "Origin: ${FRONTEND_URL}" \
    "$API_URL/api/ai-auditor/scope" || true
  if grep -qi '^Access-Control-Allow-Origin: http://192\.168\.100\.130:3000' "$CORS_ALLOWED_HEADERS"; then
    record PASS "cors.allowed_origin" "Access-Control-Allow-Origin permitido para lab 3000"
  else
    record WARN "cors.allowed_origin" "sin header explícito en GET simple; revisar si navegador falla"
  fi

  CORS_EVIL_HEADERS="qa-results/security-cors-evil-$TS.headers"
  curl -s -D "$CORS_EVIL_HEADERS" -o /dev/null \
    -H "Origin: http://evil.example" \
    "$API_URL/api/ai-auditor/scope" || true
  if grep -qi '^Access-Control-Allow-Origin: http://evil\.example' "$CORS_EVIL_HEADERS"; then
    record FAIL "cors.evil_origin" "origin malicioso permitido"
  else
    record PASS "cors.evil_origin" "origin malicioso no permitido"
  fi

  echo ""

  for ROUTE in /dashboard /ia-compliance /ia-auditor; do
    CODE="$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL$ROUTE" || true)"
    case "$CODE" in 200|301|302|307|308) OK=true ;; *) OK=false ;; esac
    check "frontend$ROUTE" "$OK" "HTTP $CODE"
  done

  HEADERS="qa-results/security-root-headers-$TS.headers"
  curl -s -D "$HEADERS" -o /dev/null "$API_URL/" || true
  check "headers.x_content_type_options" "$(grep -qi '^X-Content-Type-Options: nosniff' "$HEADERS" && echo true || echo false)" "X-Content-Type-Options"
  check "headers.x_frame_options" "$(grep -qi '^X-Frame-Options: SAMEORIGIN' "$HEADERS" && echo true || echo false)" "X-Frame-Options"
  check "headers.referrer_policy" "$(grep -qi '^Referrer-Policy: no-referrer' "$HEADERS" && echo true || echo false)" "Referrer-Policy"

  BIG_PAYLOAD="qa-results/security-big-payload-$TS.json"
  python3 - <<'PY' > "$BIG_PAYLOAD"
import json
print(json.dumps({"email": "a@example.com", "password": "x" * 250000}))
PY
  BIG_CODE="$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    --data-binary "@$BIG_PAYLOAD" || true)"
  case "$BIG_CODE" in 400|401|413|429) BIG_OK=true ;; *) BIG_OK=false ;; esac
  check "payload.large_moderate" "$BIG_OK" "HTTP $BIG_CODE sin tumbar backend"

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
  echo "# TCDX QA Security Basic"
  echo ""
  echo "- PASS: $PASS"
  echo "- WARN: $WARN"
  echo "- FAIL: $FAIL"
  echo ""
  echo "Ver TXT: \`$TXT\`"
} > "$MD"

rm -f "$ITEMS"
test "$FAIL" -eq 0
