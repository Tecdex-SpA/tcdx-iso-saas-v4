#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(git rev-parse --show-toplevel)"

BRANCH="$(git branch --show-current)"

echo "======================================"
echo " TCDX ISO SAAS - PUSH + DEPLOY"
echo "======================================"
echo "Rama actual: $BRANCH"
echo ""

if [ "$BRANCH" != "main" ]; then
  echo "ADVERTENCIA: No estás en main. Estás en: $BRANCH"
  read -r -p "¿Quieres continuar igual? Escribe SI para continuar: " CONFIRM
  if [ "$CONFIRM" != "SI" ]; then
    echo "Cancelado."
    exit 1
  fi
fi

echo "1) Estado actual de Git:"
git status --short
echo ""

HAS_CHANGES="no"

if ! git diff --quiet; then
  HAS_CHANGES="yes"
fi

if ! git diff --cached --quiet; then
  HAS_CHANGES="yes"
fi

if [ -n "$(git ls-files --others --exclude-standard)" ]; then
  HAS_CHANGES="yes"
fi

if [ "$HAS_CHANGES" = "yes" ]; then
  MSG="${1:-}"

  if [ -z "$MSG" ]; then
    read -r -p "Mensaje del commit: " MSG
  fi

  if [ -z "$MSG" ]; then
    echo "ERROR: Debes indicar un mensaje de commit."
    echo "Ejemplo:"
    echo './scripts/push-deploy.sh "Actualizar dashboard"'
    exit 1
  fi

  echo ""
  echo "2) Agregando cambios..."
  git add .

  echo ""
  echo "3) Creando commit..."
  git commit -m "$MSG"
else
  echo "2) No hay cambios locales para commitear."
fi

echo ""
echo "4) Actualizando rama local con GitHub..."
git pull --rebase origin "$BRANCH"

echo ""
echo "5) Subiendo cambios a GitHub..."
git push origin "$BRANCH"

echo ""
echo "6) Desplegando en VMs..."
./scripts/deploy-vms.sh

echo ""
echo "======================================"
echo " PUSH + DEPLOY FINALIZADO OK"
echo "======================================"
