#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TS="$(date '+%Y%m%d_%H%M%S')"
mkdir -p qa-results

TXT="qa-results/qa-backup-readiness-$TS.txt"
JSON="qa-results/qa-backup-readiness-$TS.json"
MD="qa-results/qa-backup-readiness-$TS.md"
ITEMS="qa-results/qa-backup-readiness-$TS.items.jsonl"
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

check_file() {
  NAME="$1"
  FILE="$2"
  if [ -f "$FILE" ]; then
    record PASS "$NAME" "$FILE existe"
  else
    record FAIL "$NAME" "$FILE no existe"
  fi
}

run_check() {
  NAME="$1"
  shift
  if "$@" >/tmp/tcdx-backup-readiness.log 2>&1; then
    record PASS "$NAME" "OK"
  else
    record FAIL "$NAME" "falló: $*"
    sed -n '1,80p' /tmp/tcdx-backup-readiness.log || true
  fi
}

check_gitignore_pattern() {
  PATTERN="$1"
  LABEL="$2"
  if grep -Fx "$PATTERN" .gitignore >/dev/null 2>&1 || grep -F "$PATTERN" .gitignore >/dev/null 2>&1; then
    record PASS "gitignore.$LABEL" "$PATTERN"
  else
    record FAIL "gitignore.$LABEL" "falta $PATTERN"
  fi
}

{
  echo "======================================"
  echo " TCDX QA BACKUP READINESS"
  echo "======================================"
  echo "Fecha: $(date)"
  echo ""

  [ -d backend ] && [ -d frontend ] && [ -d scripts ] && record PASS "repo.root" "estructura repo detectada" || record FAIL "repo.root" "estructura repo incompleta"

  if git status --porcelain | grep -E '(^|/)\.env$|(^|/)\.env\.local$|(^|/)\.env\.production$|(^|/)\.env\.development$|bak_|\.dump$|\.tar\.gz$' >/dev/null 2>&1; then
    record FAIL "git.sensitive_changes" "hay .env reales, backups, dumps, tar.gz o backups en cambios"
  else
    record PASS "git.sensitive_changes" "no hay .env reales, backups, dumps ni tar.gz en cambios"
  fi

  echo ""
  echo "Scripts..."
  check_file "script.backup_runtime" "scripts/backup-runtime.sh"
  check_file "script.restore_test" "scripts/restore-test.sh"
  check_file "script.inventory" "scripts/collect-runtime-inventory.sh"
  check_file "script.qa_backup" "scripts/qa-backup-readiness.sh"

  echo ""
  echo "Docs..."
  check_file "doc.backup_restore" "docs/backup-restore-runbook.md"
  check_file "doc.continuity" "docs/continuity-operations-runbook.md"
  check_file "doc.oracle_backup_restore" "docs/oracle-cloud-backup-restore.md"

  echo ""
  echo "Bash syntax..."
  run_check "bash.backup_runtime" bash -n scripts/backup-runtime.sh
  run_check "bash.restore_test" bash -n scripts/restore-test.sh
  run_check "bash.inventory" bash -n scripts/collect-runtime-inventory.sh
  run_check "bash.qa_backup" bash -n scripts/qa-backup-readiness.sh

  echo ""
  echo ".gitignore..."
  check_gitignore_pattern ".env" "env"
  check_gitignore_pattern ".env.*" "env_star"
  check_gitignore_pattern "backups/" "backups"
  check_gitignore_pattern "*.dump" "dump"
  check_gitignore_pattern "*.sql" "sql"
  check_gitignore_pattern "*.tar.gz" "tar_gz"
  check_gitignore_pattern "qa-results/" "qa_results"
  check_gitignore_pattern "*.bak" "bak"

  echo ""
  echo "Dry runs..."
  run_check "dry_run.backup_runtime" env DRY_RUN=true bash scripts/backup-runtime.sh
  run_check "dry_run.restore_test" env DRY_RUN=true bash scripts/restore-test.sh

  echo ""
  echo "Secret scan scripts..."
  # Detecta asignaciones literales sospechosas, pero excluye patrones seguros como:
  # DB_PASSWORD="${DB_PASSWORD:-}" o variables vacías por defecto.
  if grep -RInE "(JWT_SECRET|DB_PASSWORD|AI_INTERNAL_TOKEN|BRAVE_API_KEY)=['\"][^'\"]{8,}['\"]" scripts/backup-runtime.sh scripts/restore-test.sh scripts/collect-runtime-inventory.sh scripts/qa-backup-readiness.sh \
    | grep -vE '\$\{(JWT_SECRET|DB_PASSWORD|AI_INTERNAL_TOKEN|BRAVE_API_KEY):-\}' \
    >/tmp/tcdx-backup-secret-scan.log 2>&1; then
    record FAIL "scripts.secret_scan" "posibles secretos hardcodeados"
    sed -n '1,80p' /tmp/tcdx-backup-secret-scan.log || true
  else
    record PASS "scripts.secret_scan" "sin secretos hardcodeados evidentes"
  fi

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
  echo "# TCDX QA Backup Readiness"
  echo ""
  echo "- PASS: $PASS"
  echo "- WARN: $WARN"
  echo "- FAIL: $FAIL"
  echo ""
  echo "Ver TXT: \`$TXT\`"
} > "$MD"

rm -f "$ITEMS"
test "$FAIL" -eq 0
