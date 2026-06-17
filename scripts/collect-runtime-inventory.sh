#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TS="$(date '+%Y%m%d_%H%M%S')"
OUT="${OUT:-qa-results/runtime-inventory-$TS.txt}"

mkdir -p "$(dirname "$OUT")"

version_or_na() {
  CMD="$1"
  if command -v "$CMD" >/dev/null 2>&1; then
    "$CMD" --version 2>/dev/null | head -1 || true
  else
    echo "$CMD: not installed"
  fi
}

systemctl_status_or_na() {
  SERVICE="$1"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl is-active "$SERVICE" 2>/dev/null || true
  else
    echo "systemctl: not available"
  fi
}

{
  echo "======================================"
  echo " TCDX RUNTIME INVENTORY"
  echo "======================================"
  echo "generated_at=$(date -Iseconds 2>/dev/null || date)"
  echo "hostname=$(hostname 2>/dev/null || echo unknown)"
  echo "user=$(id -un 2>/dev/null || echo unknown)"
  echo "repo_root=$ROOT"
  echo ""

  echo "[system]"
  uname -a 2>/dev/null || true
  uptime 2>/dev/null || true
  df -h 2>/dev/null | sed -n '1,20p' || true
  echo ""

  echo "[versions]"
  version_or_na node
  version_or_na npm
  version_or_na python3
  version_or_na pip3
  version_or_na psql
  version_or_na pg_dump
  version_or_na nginx
  echo ""

  echo "[git]"
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
    echo "commit=$(git rev-parse HEAD 2>/dev/null || echo unknown)"
    echo "status_summary=$(git status --porcelain | wc -l | tr -d ' ') changed-files"
  else
    echo "not a git repository"
  fi
  echo ""

  echo "[systemd]"
  echo "tecdex-backend=$(systemctl_status_or_na tecdex-backend)"
  echo "tecdex-frontend=$(systemctl_status_or_na tecdex-frontend)"
  echo "ai-engine=$(systemctl_status_or_na ai-engine)"
  echo "nginx=$(systemctl_status_or_na nginx)"
  echo "postgresql=$(systemctl_status_or_na postgresql)"
  echo ""

  echo "[listening_ports]"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | grep -E ':3000|:3001|:8000|:5432|:80|:443' || true
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltnp 2>/dev/null | grep -E ':3000|:3001|:8000|:5432|:80|:443' || true
  else
    echo "ss/netstat not available"
  fi
  echo ""

  echo "[package_files]"
  [ -f backend/package.json ] && echo "backend/package.json OK"
  [ -f frontend/package.json ] && echo "frontend/package.json OK"
  [ -f ai-engine/requirements.txt ] && echo "ai-engine/requirements.txt OK"
  [ -f ai-engine/pyproject.toml ] && echo "ai-engine/pyproject.toml OK"
} > "$OUT"

echo "Inventario generado: $OUT"
