#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DRY_RUN="${DRY_RUN:-false}"
ENV_FILE="${ENV_FILE:-}"
BACKUP_DIR="${BACKUP_DIR:-/home/tecdex/backups}"
BACKUP_DB="${BACKUP_DB:-true}"
BACKUP_UPLOADS="${BACKUP_UPLOADS:-true}"
BACKUP_PLAIN_SQL="${BACKUP_PLAIN_SQL:-false}"
COMPRESS_FINAL="${COMPRESS_FINAL:-true}"
UPLOADS_DIR="${UPLOADS_DIR:-/home/tecdex/backend/uploads}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-tecdex_saas}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

TS="$(date '+%Y%m%d_%H%M%S')"
HOST="$(hostname 2>/dev/null || echo unknown-host)"
RUN_DIR="$BACKUP_DIR/tcdx-backup-$TS"
MANIFEST="$RUN_DIR/manifest.txt"
LOG_FILE="$RUN_DIR/backup.log"

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

ensure_backup_dir_is_outside_repo() {
  case "$BACKUP_DIR" in
    "$ROOT"|"$ROOT"/*)
      echo "ERROR: BACKUP_DIR apunta dentro del repo. Usa una ruta externa, por ejemplo /home/tecdex/backups." >&2
      exit 1
      ;;
  esac
}

print_plan() {
  echo "======================================"
  echo " TCDX BACKUP RUNTIME"
  echo "======================================"
  echo "Fecha        : $(date)"
  echo "Host         : $HOST"
  echo "Repo root    : $ROOT"
  echo "Backup dir   : $BACKUP_DIR"
  echo "Run dir      : $RUN_DIR"
  echo "Backup DB    : $BACKUP_DB"
  echo "DB host      : $DB_HOST"
  echo "DB port      : $DB_PORT"
  echo "DB name      : $DB_NAME"
  echo "DB user      : $DB_USER"
  echo "Plain SQL    : $BACKUP_PLAIN_SQL"
  echo "Uploads      : $BACKUP_UPLOADS"
  echo "Uploads dir  : $UPLOADS_DIR"
  echo "Compress     : $COMPRESS_FINAL"
  echo "Dry run      : $DRY_RUN"
  echo "======================================"
}

version_or_na() {
  CMD="$1"
  if command -v "$CMD" >/dev/null 2>&1; then
    "$CMD" --version 2>/dev/null | head -1 || true
  else
    echo "$CMD: not installed"
  fi
}

write_manifest() {
  {
    echo "TCDX Runtime Backup Manifest"
    echo "generated_at=$(date -Iseconds 2>/dev/null || date)"
    echo "host=$HOST"
    echo "repo_root=$ROOT"
    echo "backup_dir=$RUN_DIR"
    echo "backup_db=$BACKUP_DB"
    echo "db_host=$DB_HOST"
    echo "db_port=$DB_PORT"
    echo "db_name=$DB_NAME"
    echo "db_user=$DB_USER"
    echo "backup_uploads=$BACKUP_UPLOADS"
    echo "uploads_dir=$UPLOADS_DIR"
    echo ""
    echo "[versions]"
    version_or_na node
    version_or_na npm
    version_or_na python3
    version_or_na psql
    version_or_na pg_dump
    echo ""
    echo "[git]"
    if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      echo "commit=$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
      echo "branch=$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
    else
      echo "commit=unknown"
      echo "branch=unknown"
    fi
  } > "$MANIFEST"
}

sha_file() {
  FILE="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$FILE" > "$FILE.sha256"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$FILE" > "$FILE.sha256"
  else
    echo "WARN: no se encontró sha256sum ni shasum; no se generó checksum para $FILE" | tee -a "$LOG_FILE"
  fi
}

run_pg_dump() {
  if ! command -v pg_dump >/dev/null 2>&1; then
    echo "ERROR: pg_dump no está instalado y BACKUP_DB=true." | tee -a "$LOG_FILE" >&2
    exit 1
  fi

  DUMP_FILE="$RUN_DIR/${DB_NAME}_${TS}.dump"
  SQL_FILE="$RUN_DIR/${DB_NAME}_${TS}.sql"

  echo "Generando dump custom PostgreSQL..." | tee -a "$LOG_FILE"

  if [ -n "${DATABASE_URL:-}" ]; then
    pg_dump -Fc "$DATABASE_URL" > "$DUMP_FILE"
    if [ "$BACKUP_PLAIN_SQL" = "true" ]; then
      pg_dump "$DATABASE_URL" > "$SQL_FILE"
    fi
  else
    export PGPASSWORD="$DB_PASSWORD"
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Fc > "$DUMP_FILE"
    if [ "$BACKUP_PLAIN_SQL" = "true" ]; then
      pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$SQL_FILE"
    fi
    unset PGPASSWORD
  fi

  sha_file "$DUMP_FILE"
  [ -f "$SQL_FILE" ] && sha_file "$SQL_FILE"
  echo "DB backup OK: $DUMP_FILE" | tee -a "$LOG_FILE"
}

run_uploads_backup() {
  if [ ! -d "$UPLOADS_DIR" ]; then
    echo "WARN: UPLOADS_DIR no existe, se omite: $UPLOADS_DIR" | tee -a "$LOG_FILE"
    return 0
  fi

  UPLOADS_TAR="$RUN_DIR/uploads_${TS}.tar.gz"
  echo "Generando backup uploads..." | tee -a "$LOG_FILE"
  tar -czf "$UPLOADS_TAR" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"
  sha_file "$UPLOADS_TAR"
  echo "Uploads backup OK: $UPLOADS_TAR" | tee -a "$LOG_FILE"
}

compress_run_dir() {
  if [ "$COMPRESS_FINAL" != "true" ]; then
    return 0
  fi

  FINAL_TAR="$BACKUP_DIR/tcdx-backup-$TS.tar.gz"
  tar -czf "$FINAL_TAR" -C "$BACKUP_DIR" "tcdx-backup-$TS"
  sha_file "$FINAL_TAR"
  echo "Backup final comprimido: $FINAL_TAR" | tee -a "$LOG_FILE"
}

main() {
  load_env_file
  ensure_backup_dir_is_outside_repo
  print_plan

  if [ "$DRY_RUN" = "true" ]; then
    echo "DRY_RUN=true: no se crean carpetas, dumps ni tar.gz."
    exit 0
  fi

  mkdir -p "$RUN_DIR"
  touch "$LOG_FILE"
  chmod 700 "$RUN_DIR" || true

  write_manifest

  if [ "$BACKUP_DB" = "true" ]; then
    run_pg_dump
  else
    echo "BACKUP_DB=false: se omite respaldo DB." | tee -a "$LOG_FILE"
  fi

  if [ "$BACKUP_UPLOADS" = "true" ]; then
    run_uploads_backup
  else
    echo "BACKUP_UPLOADS=false: se omite respaldo uploads." | tee -a "$LOG_FILE"
  fi

  echo "" >> "$MANIFEST"
  echo "[files]" >> "$MANIFEST"
  find "$RUN_DIR" -maxdepth 1 -type f -print | sort >> "$MANIFEST"

  compress_run_dir

  echo "Backup completado OK."
  echo "Directorio: $RUN_DIR"
}

main "$@"
