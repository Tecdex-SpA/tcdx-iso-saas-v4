#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TS="$(date '+%Y%m%d_%H%M%S')"
mkdir -p qa-results

TXT="qa-results/qa-observability-$TS.txt"
JSON="qa-results/qa-observability-$TS.json"
MD="qa-results/qa-observability-$TS.md"
ITEMS="qa-results/qa-observability-$TS.items.jsonl"
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
  if "$@" >/tmp/tcdx-observability.log 2>&1; then
    record PASS "$NAME" "OK"
  else
    record FAIL "$NAME" "falló: $*"
    sed -n '1,120p' /tmp/tcdx-observability.log || true
  fi
}

{
  echo "======================================"
  echo " TCDX QA OBSERVABILITY"
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
  check_file "script.monitor_runtime" "scripts/monitor-runtime.sh"
  check_file "script.collect_ops_logs" "scripts/collect-ops-logs.sh"
  check_file "script.qa_observability" "scripts/qa-observability.sh"

  echo ""
  echo "Docs..."
  check_file "doc.observability" "docs/observability-runbook.md"
  check_file "doc.continuity" "docs/continuity-operations-runbook.md"

  echo ""
  echo "Bash syntax..."
  run_check "bash.monitor_runtime" bash -n scripts/monitor-runtime.sh
  run_check "bash.collect_ops_logs" bash -n scripts/collect-ops-logs.sh
  run_check "bash.qa_observability" bash -n scripts/qa-observability.sh

  echo ""
  echo "Runtime monitor..."
  run_check "monitor.runtime" bash scripts/monitor-runtime.sh

  echo ""
  echo "Ops logs..."
  run_check "collect.ops_logs" bash scripts/collect-ops-logs.sh

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
  echo "# TCDX QA Observability"
  echo ""
  echo "- PASS: $PASS"
  echo "- WARN: $WARN"
  echo "- FAIL: $FAIL"
  echo ""
  echo "Ver TXT: \`$TXT\`"
} > "$MD"

rm -f "$ITEMS"
test "$FAIL" -eq 0
