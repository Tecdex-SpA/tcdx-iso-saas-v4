#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_HOST="${DB_HOST:-db.tcdx.int}"
DB_NAME="${DB_NAME:-tecdex_saas}"
SSH_USER="${SSH_USER:-tecdex}"
MIGRATION_FILE="${ROOT_DIR}/database/migrations/20260502_ai_bootstrap_knowledge.sql"

if [[ ! -f "${MIGRATION_FILE}" ]]; then
  echo "No existe migracion: ${MIGRATION_FILE}" >&2
  exit 1
fi

ssh "${SSH_USER}@${DB_HOST}" "sudo -u postgres psql -d '${DB_NAME}' -v ON_ERROR_STOP=1" < "${MIGRATION_FILE}"
