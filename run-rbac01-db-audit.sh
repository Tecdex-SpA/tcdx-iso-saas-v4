#!/usr/bin/env bash
set -euo pipefail

DB_HOST="db-v4.tcdx.int"
DB_IP="192.168.2.40"
DB_PORT="5432"
DB_NAME="tecdex_saas"
DB_USER="postgres"
DB_SSL="false"
SSH_HOST="192.168.2.40"
SSH_USER="tecdex"
SSH_PORT="22"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$ROOT_DIR/RBAC01_DB_READONLY_AUDIT.sql"
OUT_DIR="$ROOT_DIR/artifacts/rbac01-db-audit"
TS="$(date +"%Y-%m-%d_%H%M")"
RESULT_FILE="$OUT_DIR/RBAC01_DB_AUDIT_RESULTS_$TS.txt"
ROLES_CSV="$OUT_DIR/roles.csv"
USERS_BY_ROLE_CSV="$OUT_DIR/users_by_role.csv"
TENANT_PLANS_CSV="$OUT_DIR/tenant_plans.csv"
TENANT_MODULES_CSV="$OUT_DIR/tenant_modules.csv"
ENTITLEMENTS_CSV="$OUT_DIR/entitlements.csv"
ROLE_PERMISSIONS_CSV="$OUT_DIR/role_permissions.csv"
DEALER_ASSIGNMENTS_CSV="$OUT_DIR/dealer_assignments.csv"

LOCAL_PORT=""
SSH_CONTROL_DIR="$(mktemp -d /tmp/rbac01-ssh.XXXXXX)"
SSH_CONTROL_PATH="$SSH_CONTROL_DIR/cm.sock"

cleanup() {
  if [[ -S "$SSH_CONTROL_PATH" ]]; then
    ssh -p "$SSH_PORT" -S "$SSH_CONTROL_PATH" -O exit "$SSH_USER@$SSH_HOST" >/dev/null 2>&1 || true
  fi
  rm -f "$SSH_CONTROL_PATH"
  rmdir "$SSH_CONTROL_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

print_header() {
  cat <<'TEXT'
========================================
 RBAC-01 READ-ONLY DATABASE AUDIT
========================================
TEXT
}

require_tool() {
  local tool="$1"
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Falta la herramienta requerida: $tool"
    return 1
  fi
}

read_pg_password() {
  printf "Contraseña PostgreSQL: "
  IFS= read -r -s DB_PASSWORD
  printf "\n"
}

pick_local_port() {
  local port
  for port in 55432 55433 55434 55435 55436 55437 55438 55439; do
    if ! (echo >"/dev/tcp/127.0.0.1/$port") >/dev/null 2>&1; then
      LOCAL_PORT="$port"
      return 0
    fi
  done
  echo "No se encontró un puerto local libre para el túnel SSH."
  return 1
}

psql_env() {
  PGPASSWORD="$DB_PASSWORD" PGSSLMODE=disable "$@"
}

test_postgres() {
  local host="$1"
  local port="$2"
  psql_env psql \
    -h "$host" \
    -p "$port" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    -qAt \
    -c "SELECT 1" >/dev/null 2>&1
}

run_audit() {
  local host="$1"
  local port="$2"

  mkdir -p "$OUT_DIR"
  rm -f "$ROLES_CSV" "$USERS_BY_ROLE_CSV" "$TENANT_PLANS_CSV" "$TENANT_MODULES_CSV" \
    "$ENTITLEMENTS_CSV" "$ROLE_PERMISSIONS_CSV" "$DEALER_ASSIGNMENTS_CSV"

  echo "Ejecutando auditoría READ-ONLY..."
  psql_env psql \
    -h "$host" \
    -p "$port" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    -v "result_file=$RESULT_FILE" \
    -v "roles_csv=$ROLES_CSV" \
    -v "users_by_role_csv=$USERS_BY_ROLE_CSV" \
    -v "tenant_plans_csv=$TENANT_PLANS_CSV" \
    -v "tenant_modules_csv=$TENANT_MODULES_CSV" \
    -v "entitlements_csv=$ENTITLEMENTS_CSV" \
    -v "role_permissions_csv=$ROLE_PERMISSIONS_CSV" \
    -v "dealer_assignments_csv=$DEALER_ASSIGNMENTS_CSV" \
    -f "$SQL_FILE" >/dev/null
  echo "[OK]"
}

open_tunnel() {
  pick_local_port

  echo "Intentando túnel SSH con ${SSH_USER}@${SSH_HOST}..."

  if ssh -p "$SSH_PORT" -o BatchMode=yes -o ConnectTimeout=5 "$SSH_USER@$SSH_HOST" true >/dev/null 2>&1; then
    ssh -p "$SSH_PORT" \
      -M \
      -S "$SSH_CONTROL_PATH" \
      -fN \
      -o ExitOnForwardFailure=yes \
      -L "${LOCAL_PORT}:127.0.0.1:${DB_PORT}" \
      "$SSH_USER@$SSH_HOST"
  else
    echo "Contraseña SSH para ${SSH_USER}@${SSH_HOST}:"
    ssh -p "$SSH_PORT" \
      -M \
      -S "$SSH_CONTROL_PATH" \
      -fN \
      -o ExitOnForwardFailure=yes \
      -L "${LOCAL_PORT}:127.0.0.1:${DB_PORT}" \
      "$SSH_USER@$SSH_HOST"
  fi

  sleep 2
  if [[ ! -S "$SSH_CONTROL_PATH" ]]; then
    echo "No fue posible crear el túnel SSH."
    return 1
  fi

  echo "Túnel SSH creado."
}

main() {
  print_header
  echo

  require_tool psql
  require_tool ssh

  if [[ ! -f "$SQL_FILE" ]]; then
    echo "No se encontró el archivo SQL requerido: $SQL_FILE"
    exit 1
  fi

  cat <<TEXT
Base de datos:
  Host: $DB_HOST
  IP: $DB_IP
  Port: $DB_PORT
  DB: $DB_NAME
  User: $DB_USER
  SSL: $DB_SSL
  SSH user: $SSH_USER
  SSH port: $SSH_PORT

TEXT

  echo "Probando conexión directa..."
  echo
  read_pg_password

  if test_postgres "$DB_HOST" "$DB_PORT"; then
    echo "Conectado."
    echo
    run_audit "$DB_HOST" "$DB_PORT"
  else
    echo "Conexión PostgreSQL directa no disponible."
    open_tunnel
    echo
    if ! test_postgres "127.0.0.1" "$LOCAL_PORT"; then
      echo "No fue posible conectar a PostgreSQL mediante el túnel SSH."
      exit 1
    fi
    run_audit "127.0.0.1" "$LOCAL_PORT"
  fi

  csv_files=()
  while IFS= read -r csv_file; do
    csv_files+=("$csv_file")
  done < <(find "$OUT_DIR" -maxdepth 1 -type f -name '*.csv' -print | sort)

  echo
  echo "RBAC-01 Database Audit COMPLETE"
  echo
  echo "Resultado principal:"
  echo "$RESULT_FILE"
  echo
  echo "Archivos CSV:"
  if [[ "${#csv_files[@]}" -eq 0 ]]; then
    echo "(no se generaron CSV porque no se encontraron tablas/vistas aplicables)"
  else
    printf '%s\n' "${csv_files[@]}"
  fi
  echo
  echo "No se modificó la base de datos."
}

main "$@"
