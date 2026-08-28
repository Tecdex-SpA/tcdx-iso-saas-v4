#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SQL_FILE="${REPO_ROOT}/RBAC02_COMMERCIAL_GATING_READONLY_AUDIT.sql"
ARTIFACT_DIR="${REPO_ROOT}/artifacts/rbac02-commercial-gating-audit"

DB_HOST="${DB_HOST:-db-v4.tcdx.int}"
DB_IP="${DB_IP:-192.168.2.40}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-tecdex_saas}"
DB_USER="${DB_USER:-postgres}"
DB_SSL="${DB_SSL:-disable}"
SSH_HOST="${SSH_HOST:-192.168.2.40}"
SSH_USER="${SSH_USER:-tecdex}"
SSH_PORT="${SSH_PORT:-22}"
LOCAL_PORT="${RBAC02_LOCAL_PORT:-15432}"
CONTROL_PATH="/tmp/rbac02-audit-${USER:-u}-$$.sock"
TUNNEL_OPENED="NO"

cleanup() {
  if [[ "$TUNNEL_OPENED" == "YES" ]]; then
    ssh -S "$CONTROL_PATH" -O exit -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" >/dev/null 2>&1 || true
  fi
  rm -f "$CONTROL_PATH" "${CONTROL_PATH}."* 2>/dev/null || true
  unset PGPASSWORD
}
trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: comando requerido no disponible: $1" >&2
    exit 1
  fi
}

run_psql() {
  local host="$1"
  local port="$2"

  psql \
    "host=${host} port=${port} dbname=${DB_NAME} user=${DB_USER} sslmode=${DB_SSL}" \
    -v tenants_csv="${ARTIFACT_DIR}/tenants.csv" \
    -v users_roles_csv="${ARTIFACT_DIR}/users_roles.csv" \
    -v roles_catalog_csv="${ARTIFACT_DIR}/roles_catalog.csv" \
    -v role_permissions_csv="${ARTIFACT_DIR}/role_permissions.csv" \
    -v subscriptions_csv="${ARTIFACT_DIR}/subscriptions.csv" \
    -v tenant_modules_csv="${ARTIFACT_DIR}/tenant_modules.csv" \
    -v tenant_capabilities_csv="${ARTIFACT_DIR}/tenant_capabilities.csv" \
    -v dealer_assignments_csv="${ARTIFACT_DIR}/dealer_assignments.csv" \
    -v dashboard_access_matrix_csv="${ARTIFACT_DIR}/dashboard_access_matrix.csv" \
    -v route_access_matrix_csv="${ARTIFACT_DIR}/route_access_matrix.csv" \
    -v module_key_mismatches_csv="${ARTIFACT_DIR}/module_key_mismatches.csv" \
    -v expired_entitlements_csv="${ARTIFACT_DIR}/expired_entitlements.csv" \
    -v legacy_role_anomalies_csv="${ARTIFACT_DIR}/legacy_role_anomalies.csv" \
    -v summary_txt="${ARTIFACT_DIR}/rbac02_summary.txt" \
    -f "$SQL_FILE"
}

require_command psql
require_command ssh

mkdir -p "$ARTIFACT_DIR"
rm -f "${ARTIFACT_DIR}/"*.csv "${ARTIFACT_DIR}/rbac02_summary.txt"

if [[ -z "${PGPASSWORD:-}" ]]; then
  read -rsp "PostgreSQL password for ${DB_USER}@${DB_HOST}/${DB_NAME}: " PGPASSWORD
  echo
  export PGPASSWORD
fi

echo "RBAC-02 read-only audit: trying direct PostgreSQL connection to ${DB_HOST}:${DB_PORT}"
if psql "host=${DB_HOST} port=${DB_PORT} dbname=${DB_NAME} user=${DB_USER} sslmode=${DB_SSL}" -v ON_ERROR_STOP=1 -Atqc "SELECT 'direct-ok'" >/dev/null 2>&1; then
  run_psql "$DB_HOST" "$DB_PORT"
else
  echo "Direct connection failed; opening SSH tunnel through ${SSH_USER}@${SSH_HOST}:${SSH_PORT}"
  ssh \
    -M \
    -S "$CONTROL_PATH" \
    -fN \
    -p "$SSH_PORT" \
    -L "127.0.0.1:${LOCAL_PORT}:127.0.0.1:${DB_PORT}" \
    "${SSH_USER}@${SSH_HOST}"
  TUNNEL_OPENED="YES"
  run_psql "127.0.0.1" "$LOCAL_PORT"
fi

echo "RBAC-02 read-only audit artifacts:"
find "$ARTIFACT_DIR" -maxdepth 1 -type f | sort
