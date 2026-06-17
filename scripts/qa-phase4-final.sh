#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${API_URL:?API_URL requerido, ej: http://localhost:3000}"
: "${FRONTEND_URL:?FRONTEND_URL requerido, ej: http://localhost:3001}"
: "${AI_ENGINE_URL:?AI_ENGINE_URL requerido, ej: http://localhost:8001}"
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"

TS="$(date '+%Y%m%d_%H%M%S')"
mkdir -p qa-results

TXT="qa-results/qa-phase4-final-$TS.txt"
JSON="qa-results/qa-phase4-final-$TS.json"
MD="qa-results/qa-phase4-final-$TS.md"
ITEMS="qa-results/qa-phase4-final-$TS.items.jsonl"
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
  if "$@" >/tmp/tcdx-phase4-final-check.log 2>&1; then
    record PASS "$NAME" "OK"
  else
    record FAIL "$NAME" "falló: $*"
    sed -n '1,160p' /tmp/tcdx-phase4-final-check.log || true
  fi
}

{
  echo "======================================"
  echo " TCDX QA PHASE 4 FINAL"
  echo "======================================"
  echo "Fecha: $(date)"
  echo "API_URL=$API_URL"
  echo "FRONTEND_URL=$FRONTEND_URL"
  echo "AI_ENGINE_URL=$AI_ENGINE_URL"
  echo ""

  [ -d backend ] && [ -d frontend ] && [ -d ai-engine ] && [ -d docs ] && [ -d scripts ] && record PASS "repo.root" "estructura repo detectada" || record FAIL "repo.root" "estructura repo incompleta"

  if git status --porcelain | grep -E '(^|/)\.env$|(^|/)\.env\.local$|(^|/)\.env\.production$|(^|/)\.env\.development$|bak_|\.dump$|\.tar\.gz$' >/dev/null 2>&1; then
    record FAIL "git.sensitive_changes" "hay .env reales, backups, dumps o tar.gz en cambios"
  else
    record PASS "git.sensitive_changes" "sin .env reales, backups, dumps ni tar.gz en cambios"
  fi

  echo ""
  echo "Docs cierre..."
  check_file "doc.phase4_summary" "docs/phase-4-final-summary.md"
  check_file "doc.go_live" "docs/go-live-checklist.md"
  check_file "doc.pilot_demo" "docs/pilot-demo-checklist.md"
  check_file "doc.risk_register" "docs/phase-4-risk-register.md"
  check_file "doc.qa_matrix" "docs/phase-4-qa-matrix.md"
  check_file "doc.runbooks_index" "docs/runbooks-index.md"

  echo ""
  echo "Scripts clave..."
  check_file "script.env_check" "scripts/env-check.sh"
  check_file "script.qa_security" "scripts/qa-security-basic.sh"
  check_file "script.qa_rbac" "scripts/qa-rbac-basic.sh"
  check_file "script.qa_cloud" "scripts/qa-cloud-readiness.sh"
  check_file "script.qa_backup" "scripts/qa-backup-readiness.sh"
  check_file "script.qa_observability" "scripts/qa-observability.sh"
  check_file "script.qa_ai_auditor" "scripts/qa-ai-auditor-full.sh"
  check_file "script.qa_phase4_final" "scripts/qa-phase4-final.sh"

  echo ""
  echo "Bash syntax..."
  run_check "bash.env_check" bash -n scripts/env-check.sh
  run_check "bash.qa_security" bash -n scripts/qa-security-basic.sh
  run_check "bash.qa_rbac" bash -n scripts/qa-rbac-basic.sh
  run_check "bash.qa_cloud" bash -n scripts/qa-cloud-readiness.sh
  run_check "bash.qa_backup" bash -n scripts/qa-backup-readiness.sh
  run_check "bash.qa_observability" bash -n scripts/qa-observability.sh
  run_check "bash.qa_ai_auditor" bash -n scripts/qa-ai-auditor-full.sh
  run_check "bash.qa_phase4_final" bash -n scripts/qa-phase4-final.sh

  echo ""
  echo "QA agregados..."
  run_check "qa.cloud_readiness" bash scripts/qa-cloud-readiness.sh
  run_check "qa.backup_readiness" bash scripts/qa-backup-readiness.sh
  run_check "qa.observability" env API_URL="$API_URL" FRONTEND_URL="$FRONTEND_URL" AI_ENGINE_URL="$AI_ENGINE_URL" EMAIL="$EMAIL" PASSWORD="$PASSWORD" bash scripts/qa-observability.sh
  run_check "qa.security" env API_URL="$API_URL" FRONTEND_URL="$FRONTEND_URL" EMAIL="$EMAIL" PASSWORD="$PASSWORD" bash scripts/qa-security-basic.sh
  run_check "qa.rbac" env API_URL="$API_URL" FRONTEND_URL="$FRONTEND_URL" EMAIL="$EMAIL" PASSWORD="$PASSWORD" bash scripts/qa-rbac-basic.sh
  run_check "qa.ai_auditor" env API_URL="$API_URL" FRONTEND_URL="$FRONTEND_URL" EMAIL="$EMAIL" PASSWORD="$PASSWORD" bash scripts/qa-ai-auditor-full.sh

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
  echo "# TCDX QA Phase 4 Final"
  echo ""
  echo "- PASS: $PASS"
  echo "- WARN: $WARN"
  echo "- FAIL: $FAIL"
  echo ""
  echo "Ver TXT: \`$TXT\`"
} > "$MD"

rm -f "$ITEMS"
test "$FAIL" -eq 0
