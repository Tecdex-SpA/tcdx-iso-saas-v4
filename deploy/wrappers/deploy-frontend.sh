#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${TCDX_REMOTE_REPO_DIR:-/home/tecdex/tcdx-iso-saas-v4}"
APP_DIR="${REPO_DIR}/frontend"

echo "======================================"
echo " DEPLOY FRONTEND TCDX ISO SAAS v4"
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

echo "2) Instalando dependencias frontend..."
cd "$APP_DIR"
npm ci

echo "3) Build frontend..."
npm run build

echo "4) Reiniciando servicio..."
sudo systemctl restart tcdx-frontend

echo "5) Validando servicio..."
systemctl is-active tcdx-frontend

echo "6) Validando endpoint local..."
for i in {1..35}; do
  if curl -fsS http://localhost:3001 >/dev/null; then
    echo "Frontend responde correctamente en http://localhost:3001"
    echo "======================================"
    echo " FRONTEND v4 DESPLEGADO CORRECTAMENTE"
    echo "======================================"
    exit 0
  fi
  echo "Esperando frontend... intento $i/35"
  sleep 1
done

echo "ERROR: frontend no responde en http://localhost:3001"
sudo systemctl status tcdx-frontend --no-pager || true
sudo journalctl -u tcdx-frontend -n 100 --no-pager || true
exit 1
