#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TS="$(date '+%Y%m%d_%H%M%S')"
OUT="${OUT:-qa-results/ops-logs-$TS.txt}"

mkdir -p "$(dirname "$OUT")"

section() {
  echo ""
  echo "======================================"
  echo " $1"
  echo "======================================"
}

safe_run() {
  LABEL="$1"
  shift
  section "$LABEL"
  if "$@" 2>&1; then
    true
  else
    echo "WARN: comando falló o no está disponible: $*"
  fi
}

service_status() {
  SERVICE="$1"
  if command -v systemctl >/dev/null 2>&1; then
    safe_run "systemctl status $SERVICE" systemctl status "$SERVICE" --no-pager
  else
    section "systemctl status $SERVICE"
    echo "WARN: systemctl no disponible en este host"
  fi
}

service_logs() {
  SERVICE="$1"
  if command -v journalctl >/dev/null 2>&1; then
    safe_run "journalctl $SERVICE últimos 80" journalctl -u "$SERVICE" -n 80 --no-pager
  else
    section "journalctl $SERVICE"
    echo "WARN: journalctl no disponible en este host"
  fi
}

{
  section "TCDX OPS LOG SNAPSHOT"
  echo "generated_at=$(date -Iseconds 2>/dev/null || date)"
  echo "hostname=$(hostname 2>/dev/null || echo unknown)"
  echo "user=$(id -un 2>/dev/null || echo unknown)"
  echo "repo_root=$ROOT"

  safe_run "uname" uname -a
  safe_run "uptime" uptime
  safe_run "disk df -h" df -h

  section "listening ports"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | grep -E ':3000|:3001|:8000|:5432|:80|:443' || true
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltnp 2>/dev/null | grep -E ':3000|:3001|:8000|:5432|:80|:443' || true
  else
    echo "WARN: ss/netstat no disponible"
  fi

  for svc in tecdex-backend tecdex-frontend ai-engine nginx postgresql; do
    service_status "$svc"
    service_logs "$svc"
  done

  section "git status summary"
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git status -sb || true
    git log --oneline -3 || true
  else
    echo "WARN: no es repo git"
  fi
} > "$OUT"

# Redacción defensiva adicional por si algún log contiene patrones sensibles.
python3 - "$OUT" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8", errors="replace").read()
patterns = [
    (r'(?i)(password|secret|token|api[_-]?key|jwt_secret)=([^\s]+)', r'\1=***REDACTED***'),
    (r'(?i)(Authorization:\s*Bearer\s+)[A-Za-z0-9._-]+', r'\1***REDACTED***'),
]
for pat, repl in patterns:
    text = re.sub(pat, repl, text)
open(path, "w", encoding="utf-8").write(text)
PY

echo "Snapshot operativo generado: $OUT"
