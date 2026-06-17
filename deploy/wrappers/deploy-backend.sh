#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${TCDX_REMOTE_REPO_DIR:-/home/tecdex/tcdx-iso-saas-v4}"
APP_DIR="${REPO_DIR}/backend"

echo "======================================"
echo " DEPLOY BACKEND TCDX ISO SAAS v4"
echo "======================================"

test -d "$REPO_DIR/.git"
test -d "$APP_DIR"

cd "$REPO_DIR"

ORIGIN_URL="$(git remote get-url origin)"
case "$ORIGIN_URL" in
  *tcdx-iso-saas-v4*) ;;
  *)
    echo "ERROR: origin no apunta a tcdx-iso-saas-v4"
    git remote -v
    exit 1
    ;;
esac

echo "1) Actualizando repo main v4..."
git fetch origin main
git switch main
git reset --hard origin/main

echo "Último commit:"
git log -1 --oneline

echo "2) Instalando dependencias backend..."
cd "$APP_DIR"
npm ci

echo "3) Validando sintaxis..."
npm run check

echo "4) Reiniciando servicio..."
sudo systemctl restart tecdex-backend

echo "5) Validando servicio..."
systemctl is-active tecdex-backend

echo "6) Validando endpoint local..."
for i in {1..25}; do
  if curl -fsS http://localhost:3000 >/dev/null; then
    echo "Backend responde correctamente en http://localhost:3000"
    echo "======================================"
    echo " BACKEND v4 DESPLEGADO CORRECTAMENTE"
    echo "======================================"
    exit 0
  fi
  echo "Esperando backend... intento $i/25"
  sleep 1
done

echo "ERROR: backend no responde en http://localhost:3000"
sudo systemctl status tecdex-backend --no-pager || true
sudo journalctl -u tecdex-backend -n 100 --no-pager || true
exit 1
