#!/usr/bin/env bash
set -u

API="${API:-http://192.168.100.120:3000}"

GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
NC="\033[0m"

PASS=0
FAIL=0
SKIP=0

print_header() {
  echo ""
  echo "======================================"
  echo " $1"
  echo "======================================"
}

ok() {
  echo -e "${GREEN}OK${NC} $1"
  PASS=$((PASS+1))
}

fail() {
  echo -e "${RED}FAIL${NC} $1"
  FAIL=$((FAIL+1))
}

skip() {
  echo -e "${YELLOW}SKIP${NC} $1"
  SKIP=$((SKIP+1))
}

extract_json_value() {
  local key="$1"

  python3 -c '
import json
import sys

key = sys.argv[1]
raw = sys.stdin.read()

try:
    data = json.loads(raw)
except Exception:
    print("")
    raise SystemExit(0)

value = data

for part in key.split("."):
    if isinstance(value, dict):
        value = value.get(part)
    else:
        value = None
        break

if value is None:
    print("")
else:
    print(value)
' "$key"
}

login() {
  local email="$1"
  local password="$2"

  curl -sS -X POST "$API/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}"
}

http_code() {
  local method="$1"
  local path="$2"
  local token="$3"
  local body="${4:-{}}"

  if [[ "$method" == "GET" ]]; then
    curl -sS -o /tmp/rbac_body.txt -w "%{http_code}" \
      "$API$path" \
      -H "Authorization: Bearer $token"
  else
    curl -sS -o /tmp/rbac_body.txt -w "%{http_code}" \
      -X "$method" \
      "$API$path" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$body"
  fi
}

expect_code() {
  local role="$1"
  local description="$2"
  local method="$3"
  local path="$4"
  local token="$5"
  local expected="$6"
  local body="${7:-{}}"

  local code
  code="$(http_code "$method" "$path" "$token" "$body")"

  if [[ ",$expected," == *",$code,"* ]]; then
    ok "[$role] $description => HTTP $code"
  else
    fail "[$role] $description => HTTP $code esperado $expected"
    echo "Respuesta:"
    cat /tmp/rbac_body.txt || true
    echo ""
  fi
}

run_role() {
  local prefix="$1"
  local role="$2"

  local email_var="${prefix}_EMAIL"
  local pass_var="${prefix}_PASS"

  local email="${!email_var:-}"
  local password="${!pass_var:-}"

  print_header "ROL $role"

  if [[ -z "$email" || -z "$password" ]]; then
    skip "Credenciales no configuradas para $role. Define $email_var y $pass_var."
    return
  fi

  local session
  session="$(login "$email" "$password")"

  local token
  token="$(echo "$session" | extract_json_value "token")"

  local tenant_id
  tenant_id="$(echo "$session" | extract_json_value "user.tenant_id")"

  if [[ -z "$token" ]]; then
    fail "No se pudo obtener token para $role ($email)"
    echo "$session"
    return
  fi

  echo "Usuario: $email"
  echo "Tenant : ${tenant_id:-SIN_TENANT}"

  case "$role" in
    viewer)
      expect_code "$role" "GET dashboard ejecutivo" "GET" "/api/dashboard/$tenant_id" "$token" "200"
      expect_code "$role" "GET dashboard KPI" "GET" "/api/kpis/dashboard/$tenant_id" "$token" "200"
      expect_code "$role" "GET auditorías" "GET" "/api/audits/$tenant_id" "$token" "200"
      expect_code "$role" "GET reportes historial" "GET" "/api/reports/exports" "$token" "200"
      expect_code "$role" "POST recalcular KPI bloqueado" "POST" "/api/kpis/recalculate/$tenant_id" "$token" "403"
      expect_code "$role" "POST crear auditoría bloqueado" "POST" "/api/audits" "$token" "403" "{}"
      expect_code "$role" "POST crear plan bloqueado" "POST" "/api/action-plans" "$token" "403" "{}"
      expect_code "$role" "GET usuarios bloqueado" "GET" "/api/users" "$token" "403"
      ;;
    operativo)
      expect_code "$role" "GET dashboard ejecutivo" "GET" "/api/dashboard/$tenant_id" "$token" "200"
      expect_code "$role" "GET auditorías lectura" "GET" "/api/audits/$tenant_id" "$token" "200"
      expect_code "$role" "GET planes lectura" "GET" "/api/action-plans/$tenant_id" "$token" "200"
      expect_code "$role" "GET reportes historial" "GET" "/api/reports/exports" "$token" "200"
      expect_code "$role" "POST crear auditoría bloqueado" "POST" "/api/audits" "$token" "403" "{}"
      expect_code "$role" "GET usuarios bloqueado" "GET" "/api/users" "$token" "403"
      ;;
    auditor)
      expect_code "$role" "GET dashboard ejecutivo" "GET" "/api/dashboard/$tenant_id" "$token" "200"
      expect_code "$role" "GET auditorías" "GET" "/api/audits/$tenant_id" "$token" "200"
      expect_code "$role" "GET reportes tipos" "GET" "/api/reports/types" "$token" "200"
      expect_code "$role" "POST recalcular KPI bloqueado" "POST" "/api/kpis/recalculate/$tenant_id" "$token" "403"
      expect_code "$role" "GET usuarios bloqueado" "GET" "/api/users" "$token" "403"
      ;;
    admin)
      expect_code "$role" "GET dashboard ejecutivo" "GET" "/api/dashboard/$tenant_id" "$token" "200"
      expect_code "$role" "GET dashboard KPI" "GET" "/api/kpis/dashboard/$tenant_id" "$token" "200"
      expect_code "$role" "GET usuarios" "GET" "/api/users" "$token" "200"
      expect_code "$role" "GET auditorías" "GET" "/api/audits/$tenant_id" "$token" "200"
      expect_code "$role" "GET reportes tipos" "GET" "/api/reports/types" "$token" "200"
      ;;
    dealer)
      expect_code "$role" "GET reportes clientes dealer" "GET" "/api/reports/clients" "$token" "200"
      expect_code "$role" "GET reportes historial dealer" "GET" "/api/reports/exports" "$token" "200"
      expect_code "$role" "GET usuarios bloqueado" "GET" "/api/users" "$token" "403"
      ;;
    superadmin)
      expect_code "$role" "GET admin SaaS tenants" "GET" "/api/admin-saas/tenants" "$token" "200"
      expect_code "$role" "GET reportes clientes" "GET" "/api/reports/clients" "$token" "200"
      ;;
    *)
      skip "Rol no definido en script: $role"
      ;;
  esac
}

print_header "TCDX RBAC CHECK"
echo "API: $API"

run_role "VIEWER" "viewer"
run_role "OPERATIVO" "operativo"
run_role "AUDITOR" "auditor"
run_role "ADMIN" "admin"
run_role "DEALER" "dealer"
run_role "SUPERADMIN" "superadmin"

print_header "RESUMEN"
echo -e "${GREEN}PASS:${NC} $PASS"
echo -e "${RED}FAIL:${NC} $FAIL"
echo -e "${YELLOW}SKIP:${NC} $SKIP"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi

exit 0
