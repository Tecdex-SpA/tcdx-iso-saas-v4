#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${TCDX_REMOTE_REPO_DIR:-/home/tecdex/tcdx-iso-saas-v4}"
APP_DIR="${REPO_DIR}/ai-engine"

echo "======================================"
echo " DEPLOY AI ENGINE TCDX ISO SAAS v4"
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

cd "$APP_DIR"

echo "2) Preparando entorno Python..."
if [[ -d ".venv" ]]; then
  VENV_DIR=".venv"
elif [[ -d "venv" ]]; then
  VENV_DIR="venv"
else
  python3 -m venv .venv
  VENV_DIR=".venv"
fi

# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

echo "3) Instalando dependencias..."
python -m pip install --upgrade pip
if [[ -f requirements.txt ]]; then
  pip install -r requirements.txt
else
  echo "ADVERTENCIA: requirements.txt no existe; se omite pip install -r"
fi

echo "4) Validando sintaxis..."
python -m py_compile app/core/config.py knowledge_client.py

echo "5) Reiniciando servicio..."
sudo systemctl restart ai-engine

echo "6) Validando servicio..."
systemctl is-active ai-engine

echo "7) Validando endpoint local..."
for i in {1..25}; do
  if curl -fsS http://localhost:8001/health >/dev/null; then
    echo "AI Engine responde correctamente en http://localhost:8001/health"
    echo "======================================"
    echo " AI ENGINE v4 DESPLEGADO CORRECTAMENTE"
    echo "======================================"
    exit 0
  fi
  echo "Esperando ai-engine... intento $i/25"
  sleep 1
done

echo "ERROR: ai-engine no responde en /health"
sudo systemctl status ai-engine --no-pager || true
sudo journalctl -u ai-engine -n 100 --no-pager || true
exit 1
