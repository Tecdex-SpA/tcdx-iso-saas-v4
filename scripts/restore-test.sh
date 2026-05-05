#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DRY_RUN="${DRY_RUN:-false}"
ENV_FILE="${ENV_FILE:-}"
DUMP_FILE="${DUMP_FILE:-}"
DROP_TEST_DB="${DROP_TEST_DB:-false}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-tecdex_saas}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

TS="$(date '+%Y%m%d_%H%M%S')"
RESTORE_TEST_DB="${RESTORE_TEST_DB:-tecdex_saas_restore_test_$TS}"

load_env_file() {
  if [ -n "$ENV_FILE" ]; then
    if [ ! -f "$ENV_FILE" ]; then
      echo "ERROR: ENV_FILE no existe: $ENV_FILE" >&2
      exit 1
    fi
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a

    DB_HOST="${DB_HOST:-127.0.0.1}"
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-tecdex_saas}"
    DB_USER="${DB_USER:-postgres}"
    DB_PASSWORD="${DB_PASSWORD:-}"
  fi
}

validate_safety() {
  if [ "$RESTORE_TEST_DB" = "$DB_NAME" ] || [ "$RESTORE_TEST_DB" = "tecdex_saas" ]; then
    echo "ERROR: RESTORE_TEST_DB no puede ser la DB productiva ($DB_NAME)." >&2
    exit 1
  fi

  case "$RESTORE_TEST_DB" in
    tecdex_saas_restore_test_*) ;;
    *)
      echo "ERROR: RESTORE_TEST_DB debe comenzar con tecdex_saas_restore_test_." >&2
      exit 1
      ;;
  esac
}

print_plan() {
  echo "======================================"
  echo " TCDX RESTORE TEST"
  echo "======================================"
  echo "Fecha          : $(date)"
  echo "Repo root      : $ROOT"
  echo "Dump file      : ${DUMP_FILE:-no informado}"
  echo "DB host        : $DB_HOST"
  echo "DB port        : $DB_PORT"
  echo "DB user        : $DB_USER"
  echo "DB prod name   : $DB_NAME"
  echo "Restore DB tmp : $RESTORE_TEST_DB"
  echo "Drop test DB   : $DROP_TEST_DB"
  echo "Dry run        : $DRY_RUN"
  echo "======================================"
}

run_psql() {
  export PGPASSWORD="$DB_PASSWORD"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$@"
  unset PGPASSWORD
}

run_createdb() {
  export PGPASSWORD="$DB_PASSWORD"
  createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$RESTORE_TEST_DB"
  unset PGPASSWORD
}

run_dropdb() {
  export PGPASSWORD="$DB_PASSWORD"
  dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$RESTORE_TEST_DB"
  unset PGPASSWORD
}

run_pg_restore() {
  export PGPASSWORD="$DB_PASSWORD"
  pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$RESTORE_TEST_DB" "$DUMP_FILE"
  unset PGPASSWORD
}

main() {
  load_env_file
  validate_safety
  print_plan

  if [ "$DRY_RUN" = "true" ]; then
    echo "DRY_RUN=true: no se crea DB temporal ni se ejecuta pg_restore."
    exit 0
  fi

  if [ -z "$DUMP_FILE" ]; then
    echo "ERROR: informa DUMP_FILE=/ruta/archivo.dump." >&2
    exit 1
  fi

  if [ ! -f "$DUMP_FILE" ]; then
    echo "ERROR: DUMP_FILE no existe: $DUMP_FILE" >&2
    exit 1
  fi

  for cmd in psql createdb pg_restore; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "ERROR: comando requerido no disponible: $cmd" >&2
      exit 1
    fi
  done

  echo "Creando DB temporal: $RESTORE_TEST_DB"
  run_createdb

  echo "Restaurando dump en DB temporal..."
  run_pg_restore

  echo "Validando restauración..."
  run_psql -d "$RESTORE_TEST_DB" -v ON_ERROR_STOP=1 -c "SELECT current_database() AS restored_database;"
  run_psql -d "$RESTORE_TEST_DB" -v ON_ERROR_STOP=1 -c "SELECT count(*) AS tables_count FROM information_schema.tables WHERE table_schema='public';"

  if [ "$DROP_TEST_DB" = "true" ]; then
    echo "DROP_TEST_DB=true: eliminando DB temporal $RESTORE_TEST_DB"
    run_dropdb
  else
    echo "DB temporal conservada para inspección: $RESTORE_TEST_DB"
    echo "Para eliminar manualmente:"
    echo "  dropdb -h '$DB_HOST' -p '$DB_PORT' -U '$DB_USER' '$RESTORE_TEST_DB'"
  fi

  echo "Restore-test completado OK."
}

main "$@"
