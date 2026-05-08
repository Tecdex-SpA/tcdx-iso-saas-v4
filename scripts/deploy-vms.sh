#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_DEPLOY_DIR="${TCDX_DEPLOY_MAIN_DIR:-$HOME/repos/tcdx-iso-saas}"
CURRENT_DIR="$(pwd -P)"
EXPECTED_DIR="$(cd "$EXPECTED_DEPLOY_DIR" 2>/dev/null && pwd -P || printf '%s' "$EXPECTED_DEPLOY_DIR")"
CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || true)"
CURRENT_STATUS="$(git status --porcelain 2>/dev/null || true)"
CURRENT_COMMIT="$(git log -1 --oneline 2>/dev/null || true)"
ORIGIN_URL="$(git remote get-url origin 2>/dev/null || true)"
DEPLOY_TS="$(date '+%Y-%m-%d %H:%M:%S %Z')"

echo "======================================"
echo " PREFLIGHT DEPLOY TCDX ISO SAAS"
echo "======================================"
echo "Fecha/hora:      ${DEPLOY_TS}"
echo "Carpeta actual:  ${CURRENT_DIR}"
echo "Carpeta esperada:${EXPECTED_DIR}"
echo "Rama actual:     ${CURRENT_BRANCH:-no-detectada}"
echo "Ultimo commit:   ${CURRENT_COMMIT:-no-detectado}"
echo "Origin:          ${ORIGIN_URL:-no-detectado}"

if [[ ! -d .git && ! -f .git ]]; then
  echo ""
  echo "ERROR: este comando debe ejecutarse desde un worktree Git valido."
  echo "Usa:"
  echo "  cd ${EXPECTED_DEPLOY_DIR}"
  exit 1
fi

if [[ "$CURRENT_DIR" != "$EXPECTED_DIR" ]]; then
  echo ""
  echo "ERROR: deploy bloqueado porque no estas en el worktree main estable."
  echo "Worktree permitido:"
  echo "  ${EXPECTED_DIR}"
  echo "Worktree actual:"
  echo "  ${CURRENT_DIR}"
  echo ""
  echo "No ejecutes deploy desde worktrees experimentales, backend, frontend, ai-engine ni ~/.codex/worktrees."
  echo "Si realmente necesitas saltarte esta proteccion, ejecuta:"
  echo "  TCDX_ALLOW_UNSAFE_DEPLOY=YES ./scripts/deploy-vms.sh"
  if [[ "${TCDX_ALLOW_UNSAFE_DEPLOY:-}" != "YES" ]]; then
    exit 1
  fi
  echo "ADVERTENCIA: TCDX_ALLOW_UNSAFE_DEPLOY=YES activo; continuando bajo responsabilidad explicita."
fi

if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo ""
  echo "ERROR: deploy bloqueado porque la rama actual no es main."
  echo "Rama actual: ${CURRENT_BRANCH:-no-detectada}"
  echo "Usa:"
  echo "  cd ${EXPECTED_DEPLOY_DIR}"
  echo "  git checkout main"
  if [[ "${TCDX_ALLOW_UNSAFE_DEPLOY:-}" != "YES" ]]; then
    exit 1
  fi
  echo "ADVERTENCIA: TCDX_ALLOW_UNSAFE_DEPLOY=YES activo; continuando desde rama no main."
fi

if [[ -n "$CURRENT_STATUS" ]]; then
  echo ""
  echo "ERROR: deploy bloqueado porque hay cambios sin commit."
  echo "$CURRENT_STATUS"
  echo ""
  echo "Antes de desplegar, deja main limpio:"
  echo "  git status"
  echo "  git add ..."
  echo "  git commit -m \"...\""
  echo "  git push"
  if [[ "${TCDX_ALLOW_UNSAFE_DEPLOY:-}" != "YES" ]]; then
    exit 1
  fi
  echo "ADVERTENCIA: TCDX_ALLOW_UNSAFE_DEPLOY=YES activo; continuando con working tree sucio."
fi

echo "Preflight OK: deploy autorizado desde main estable."
echo ""

echo "======================================"
echo " DEPLOY GLOBAL TCDX ISO SAAS"
echo "======================================"

echo ""
echo "1) Desplegando backend..."
ssh tecdex@192.168.100.120 '/home/tecdex/deploy-backend.sh'

echo ""
echo "2) Desplegando frontend..."
ssh tecdex@192.168.100.130 '/home/tecdex/deploy-frontend.sh'

echo ""
echo "3) Desplegando AI Engine..."
ssh tecdex@192.168.100.140 '/home/tecdex/deploy-ai-engine.sh'

echo ""
echo "======================================"
echo " DEPLOY GLOBAL FINALIZADO"
echo "======================================"
