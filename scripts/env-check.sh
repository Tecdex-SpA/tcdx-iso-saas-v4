#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_URL="${API_URL:-http://192.168.100.120:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://192.168.100.130:3000}"
FRONTEND_INTERNAL_URL="${FRONTEND_INTERNAL_URL:-http://127.0.0.1:8080}"
AI_ENGINE_URL="${AI_ENGINE_URL:-http://192.168.100.140:8000}"
DB_HOST="${DB_HOST:-192.168.100.110}"
DB_PORT="${DB_PORT:-5432}"
BACKEND_PORT="${PORT:-3000}"
FRONTEND_INTERNAL_PORT="${FRONTEND_INTERNAL_PORT:-8080}"
AI_ENGINE_PORT="${AI_ENGINE_PORT:-8000}"

echo "======================================"
echo " TCDX ENV CHECK"
echo "======================================"
echo "API_URL               : $API_URL"
echo "FRONTEND_URL externo  : $FRONTEND_URL"
echo "FRONTEND interno      : $FRONTEND_INTERNAL_URL"
echo "AI_ENGINE_URL         : $AI_ENGINE_URL"
echo "DB_HOST               : $DB_HOST"
echo "DB_PORT               : $DB_PORT"
echo "BACKEND_PORT          : $BACKEND_PORT"
echo "FRONTEND_INTERNAL_PORT: $FRONTEND_INTERNAL_PORT"
echo "AI_ENGINE_PORT        : $AI_ENGINE_PORT"
echo ""

if git status --porcelain | grep -E '(^|/)\.env$|(^|/)\.env\.local$|(^|/)\.env\.production$|(^|/)\.env\.development$|bak_' >/dev/null 2>&1; then
  echo "[FAIL] Hay .env reales o backups en cambios git."
  git status --porcelain | grep -E '(^|/)\.env$|(^|/)\.env\.local$|(^|/)\.env\.production$|(^|/)\.env\.development$|bak_' || true
  exit 1
else
  echo "[PASS] No se ven .env reales ni backups en cambios git."
fi

echo ""
echo "Escaneo conservador de IPs/URLs en runtime..."
WARN=0

MATCHES="$(grep -RInE '192\.168\.100\.(110|120|130|140)|http://192\.168\.100\.|localhost:[0-9]+' frontend/src backend/src ai-engine 2>/dev/null || true)"
if [ -n "$MATCHES" ]; then
  echo "[WARN] Se detectaron referencias runtime a IPs/hosts internos."
  echo "       Pueden ser fallbacks de laboratorio aceptados; revisar antes de producción cloud:"
  echo "$MATCHES"
  WARN=1
else
  echo "[PASS] No se detectaron IPs internas runtime evidentes en frontend/src backend/src ai-engine."
fi

echo ""
echo "Referencias permitidas en scripts/docs/examples:"
grep -RInE '192\.168\.100\.(110|120|130|140)|:3000|:8080|:8000|:5432|nginx|proxy_pass' \
  scripts docs .env.example frontend/.env.example backend/.env.example ai-engine/.env.example 2>/dev/null || true

echo ""
if [ "$WARN" -eq 1 ]; then
  echo "Resultado: WARN"
else
  echo "Resultado: PASS"
fi
