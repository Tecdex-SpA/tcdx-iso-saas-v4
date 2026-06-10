#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_URL="${API_URL:-https://181.212.166.187:8443}"
FRONTEND_URL="${FRONTEND_URL:-https://181.212.166.187:8443}"
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"
TS="$(date '+%Y%m%d_%H%M%S')"

mkdir -p qa-results

TXT="qa-results/qa-rbac-basic-$TS.txt"
JSON="qa-results/qa-rbac-basic-$TS.json"
MD="qa-results/qa-rbac-basic-$TS.md"
ITEMS="qa-results/qa-rbac-basic-$TS.items.jsonl"
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

json_get() {
  FILE="$1"
  PATH_EXPR="$2"
  python3 - "$FILE" "$PATH_EXPR" <<'PY'
import json, sys
file, path = sys.argv[1], sys.argv[2]
try:
    data = json.load(open(file, encoding="utf-8"))
except Exception:
    print("")
    raise SystemExit(0)
cur = data
for part in path.split("."):
    if isinstance(cur, dict):
        cur = cur.get(part)
    elif isinstance(cur, list):
        try:
            cur = cur[int(part)]
        except Exception:
            cur = None
    else:
        cur = None
    if cur is None:
        break
if cur is None:
    print("")
elif isinstance(cur, (dict, list)):
    print(json.dumps(cur, ensure_ascii=False))
else:
    print(cur)
PY
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

http_code_no_token() {
  PATH_URL="$1"
  curl -s -o /dev/null -w "%{http_code}" "$API_URL$PATH_URL" || true
}

http_code_token() {
  PATH_URL="$1"
  TOKEN="$2"
  curl -s -o "qa-results/qa-rbac-http-body-$TS.json" -w "%{http_code}" \
    "$API_URL$PATH_URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tcdx-locale: es" || true
}

{
  echo "======================================"
  echo " TCDX QA RBAC BASIC"
  echo "======================================"
  echo "Fecha: $(date)"
  echo "API_URL=$API_URL"
  echo "FRONTEND_URL=$FRONTEND_URL"
  echo ""

  check "repo.root" "$([ -d backend ] && [ -d frontend ] && [ -d scripts ] && echo true || echo false)" "estructura repo detectada"

  if git status --porcelain | grep -E '(^|/)\.env$|(^|/)\.env\.local$|(^|/)\.env\.production$|(^|/)\.env\.development$|bak_' >/dev/null 2>&1; then
    record FAIL "git.env" "hay .env reales o backups en cambios"
  else
    record PASS "git.env" "no hay .env reales ni backups en cambios"
  fi

  echo ""

  BACKEND_CODE="$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/" || true)"
  case "$BACKEND_CODE" in 200|301|302|307|308) BACKEND_OK=true ;; *) BACKEND_OK=false ;; esac
  check "backend.root" "$BACKEND_OK" "HTTP $BACKEND_CODE"

  FRONTEND_CODE="$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/login" || true)"
  case "$FRONTEND_CODE" in 200|301|302|307|308) FRONTEND_OK=true ;; *) FRONTEND_OK=false ;; esac
  check "frontend.login" "$FRONTEND_OK" "HTTP $FRONTEND_CODE"

  LOGIN="qa-results/qa-rbac-login-$TS.json"
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
  check "auth.token" "$([ -n "$TOKEN" ] && echo true || echo false)" "token chars=${#TOKEN}"

  ROLE="$(json_get "$LOGIN" "user.role")"
  TENANT_ID="$(json_get "$LOGIN" "user.tenant_id")"
  echo "role detectado login: ${ROLE:-no informado}"
  echo "tenant_id detectado login: ${TENANT_ID:-no informado}"
  echo ""

  ME_SESSION="qa-results/qa-rbac-me-session-$TS.json"
  ME_CODE="$(curl -s -o "$ME_SESSION" -w "%{http_code}" "$API_URL/api/me/session" \
    -H "Authorization: Bearer $TOKEN" || true)"
  case "$ME_CODE" in
    200) check "me.session" "$(json_check "$ME_SESSION" "get('ok') is True")" "HTTP 200 ok=true" ;;
    404) record WARN "me.session" "endpoint no disponible HTTP 404" ;;
    *) record WARN "me.session" "HTTP $ME_CODE" ;;
  esac

  ME_MODULES="qa-results/qa-rbac-me-modules-$TS.json"
  MODULES_CODE="$(curl -s -o "$ME_MODULES" -w "%{http_code}" "$API_URL/api/me/modules" \
    -H "Authorization: Bearer $TOKEN" || true)"
  case "$MODULES_CODE" in
    200) check "me.modules" "$(json_check "$ME_MODULES" "get('ok') is True")" "HTTP 200 ok=true" ;;
    404) record WARN "me.modules" "endpoint no disponible HTTP 404" ;;
    *) record WARN "me.modules" "HTTP $MODULES_CODE" ;;
  esac

  PERMS="qa-results/qa-rbac-me-permissions-$TS.json"
  PERMS_CODE="$(curl -s -o "$PERMS" -w "%{http_code}" "$API_URL/api/me/permissions" \
    -H "Authorization: Bearer $TOKEN" || true)"
  case "$PERMS_CODE" in
    200) check "me.permissions" "$(json_check "$PERMS" "get('ok') is True")" "HTTP 200 ok=true" ;;
    404) record WARN "me.permissions" "endpoint no disponible HTTP 404" ;;
    *) record WARN "me.permissions" "HTTP $PERMS_CODE" ;;
  esac

  echo ""

  for PATH_URL in /api/admin-saas /api/users /api/tenants; do
    CODE="$(http_code_no_token "$PATH_URL")"
    case "$CODE" in
      401|403|404|405) OK=true ;;
      *) OK=false ;;
    esac
    check "sensitive.no_token$PATH_URL" "$OK" "HTTP $CODE sin token"
  done

  echo ""

  for PATH_URL in /api/admin-saas /api/users /api/tenants; do
    CODE="$(http_code_token "$PATH_URL" "$TOKEN")"
    case "$CODE" in
      200|204) record PASS "sensitive.admin_token$PATH_URL" "HTTP $CODE con admin actual" ;;
      403) record WARN "sensitive.admin_token$PATH_URL" "HTTP 403 con admin actual; revisar rol real si debe administrar esta sección" ;;
      404|405) record WARN "sensitive.admin_token$PATH_URL" "HTTP $CODE ruta base no expone GET directo, no necesariamente error" ;;
      *) record FAIL "sensitive.admin_token$PATH_URL" "HTTP $CODE inesperado con token admin actual" ;;
    esac
  done

  echo ""

  SCOPE="qa-results/qa-rbac-ai-auditor-scope-$TS.json"
  curl -s "$API_URL/api/ai-auditor/scope" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tcdx-locale: en" > "$SCOPE"
  check "ai_auditor.scope" "$(json_check "$SCOPE" "get('ok') is True")" "scope ok"

  ENGINE="qa-results/qa-rbac-ai-compliance-engine-$TS.json"
  curl -s "$API_URL/api/ai-compliance/engine-health" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tcdx-locale: en" > "$ENGINE"
  check "ai_compliance.engine_health" "$(json_check "$ENGINE" "get('ok') is True")" "engine-health ok"

  echo ""

  for ROUTE in /dashboard /admin-saas /usuarios /ia-auditor /ia-compliance; do
    CODE="$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL$ROUTE" || true)"
    case "$CODE" in
      200|301|302|307|308) OK=true ;;
      *) OK=false ;;
    esac
    check "frontend$ROUTE" "$OK" "HTTP $CODE"
  done

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
  echo "# TCDX QA RBAC Basic"
  echo ""
  echo "- PASS: $PASS"
  echo "- WARN: $WARN"
  echo "- FAIL: $FAIL"
  echo ""
  echo "Ver TXT: \`$TXT\`"
} > "$MD"

rm -f "$ITEMS"
test "$FAIL" -eq 0
