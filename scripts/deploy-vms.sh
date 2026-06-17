#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_DEPLOY_DIR="${TCDX_DEPLOY_MAIN_DIR:-$HOME/repos/tcdx-iso-saas-v4}"
CURRENT_DIR="$(pwd -P)"
EXPECTED_DIR="$(cd "$EXPECTED_DEPLOY_DIR" 2>/dev/null && pwd -P || printf '%s' "$EXPECTED_DEPLOY_DIR")"
CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || true)"
CURRENT_STATUS="$(git status --porcelain 2>/dev/null || true)"
CURRENT_COMMIT="$(git log -1 --oneline 2>/dev/null || true)"
ORIGIN_URL="$(git remote get-url origin 2>/dev/null || true)"
DEPLOY_TS="$(date '+%Y-%m-%d %H:%M:%S %Z')"

DEPLOY_USER="${TCDX_DEPLOY_USER:-tecdex}"
BACKEND_HOST="${TCDX_BACKEND_HOST:-${TCDX_NEW_BACKEND_HOST:-bk-v4.tcdx.int}}"
FRONTEND_HOST="${TCDX_FRONTEND_HOST:-${TCDX_NEW_FRONTEND_HOST:-www-v4.tcdx.int}}"
AI_HOST="${TCDX_AI_HOST:-${TCDX_NEW_AI_HOST:-ai-v4.tcdx.int}}"

REMOTE_REPO_DIR="${TCDX_REMOTE_REPO_DIR:-/home/tecdex/tcdx-iso-saas-v4}"
REMOTE_BACKEND_DIR="${REMOTE_REPO_DIR}/backend"
REMOTE_FRONTEND_DIR="${REMOTE_REPO_DIR}/frontend"
REMOTE_AI_ENGINE_DIR="${REMOTE_REPO_DIR}/ai-engine"

BACKEND_WRAPPER="/home/tecdex/deploy-backend.sh"
FRONTEND_WRAPPER="/home/tecdex/deploy-frontend.sh"
AI_ENGINE_WRAPPER="/home/tecdex/deploy-ai-engine.sh"

run_ssh() {
  local host="$1"
  shift

  ssh \
    -o BatchMode=yes \
    -o ConnectTimeout=10 \
    "${DEPLOY_USER}@${host}" \
    "$@"
}

preflight_remote() {
  local label="$1"
  local host="$2"
  local remote_dir="$3"
  local wrapper="$4"
  local service="$5"

  echo ""
  echo "Preflight remoto ${label}: ${host}"

  run_ssh "$host" "hostname" >/dev/null || {
    echo "ERROR: SSH no respondio para ${label} en ${host}."
    exit 1
  }

  run_ssh "$host" "test -d '${remote_dir}'" || {
    echo "ERROR: ruta remota no existe para ${label}: ${remote_dir}"
    exit 1
  }

  run_ssh "$host" "test -x '${wrapper}'" || {
    echo "ERROR: wrapper remoto no existe o no es ejecutable para ${label}: ${wrapper}"
    exit 1
  }

  run_ssh "$host" "systemctl list-unit-files '${service}' >/dev/null" || {
    echo "ERROR: servicio esperado no existe para ${label}: ${service}"
    exit 1
  }

  echo "${label} OK"
}

deploy_remote() {
  local label="$1"
  local host="$2"
  local wrapper="$3"

  echo ""
  echo "--------------------------------------"
  echo "Deploy ${label}: ${host}"
  echo "Wrapper: ${wrapper}"
  echo "--------------------------------------"

  run_ssh "$host" "$wrapper"
}

validate_backend() {
  local host="$1"

  echo ""
  echo "Validando backend: ${host}"

  ssh "${DEPLOY_USER}@${host}" '
    systemctl is-active tecdex-backend

    for i in {1..25}; do
      if curl -fsS http://localhost:3000 >/dev/null; then
        echo "backend OK en http://localhost:3000"
        exit 0
      fi

      status_code="$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/me || true)"
      if [[ "$status_code" == "401" ]]; then
        echo "backend OK: endpoint protegido responde 401 esperado"
        exit 0
      fi

      echo "esperando backend... $i/25"
      sleep 1
    done

    echo "ERROR: backend no responde de forma válida"
    systemctl status tecdex-backend --no-pager || true
    journalctl -u tecdex-backend -n 80 --no-pager || true
    exit 1
  '
}

validate_ai() {
  echo ""
  echo "Validando AI Engine: ${AI_HOST}"

  run_ssh "$AI_HOST" '
    systemctl is-active ai-engine.service &&
    for i in {1..25}; do
      if curl -fsS http://localhost:8001/health >/dev/null; then
        echo "ai-engine OK"
        exit 0
      fi
      echo "esperando ai-engine... $i/25"
      sleep 1
    done
    echo "ERROR: ai-engine no responde en /health"
    sudo systemctl status ai-engine.service --no-pager || true
    sudo journalctl -u ai-engine.service -n 80 --no-pager || true
    exit 1
  ' || {
    echo "ERROR: servicio AI Engine no quedó activo o healthcheck no paso."
    exit 1
  }
}

validate_frontend() {
  echo ""
  echo "Validando frontend: ${FRONTEND_HOST}"

  run_ssh "$FRONTEND_HOST" '
    systemctl is-active tcdx-frontend.service &&
    for i in {1..35}; do
      if curl -fsS http://localhost:3001 >/dev/null; then
        echo "frontend OK en 3001"
        exit 0
      fi
      echo "esperando frontend... $i/35"
      sleep 1
    done
    echo "ERROR: frontend no responde en 3001"
    sudo systemctl status tcdx-frontend.service --no-pager || true
    sudo journalctl -u tcdx-frontend.service -n 80 --no-pager || true
    exit 1
  ' || {
    echo "ERROR: servicio frontend no quedó activo o healthcheck no paso."
    exit 1
  }
}

echo ""
echo "======================================"
echo " PREFLIGHT DEPLOY TCDX ISO SAAS"
echo " Deploy v4 only"
echo "======================================"
echo "Fecha/hora:        ${DEPLOY_TS}"
echo "Carpeta actual:    ${CURRENT_DIR}"
echo "Carpeta esperada:  ${EXPECTED_DIR}"
echo "Rama actual:       ${CURRENT_BRANCH:-no-detectada}"
echo "Ultimo commit:     ${CURRENT_COMMIT:-no-detectado}"
echo "Origin:            ${ORIGIN_URL:-no-detectado}"
echo "Usuario deploy:    ${DEPLOY_USER}"
echo "Deploy mode:       v4 only"
echo "Backend host:      ${BACKEND_HOST}"
echo "AI Engine host:    ${AI_HOST}"
echo "Frontend host:     ${FRONTEND_HOST}"
echo "Remote repo dir:   ${REMOTE_REPO_DIR}"
echo "Backend dir:       ${REMOTE_BACKEND_DIR}"
echo "Frontend dir:      ${REMOTE_FRONTEND_DIR}"
echo "AI engine dir:     ${REMOTE_AI_ENGINE_DIR}"

if [[ ! -d .git && ! -f .git ]]; then
  echo ""
  echo "ERROR: este comando debe ejecutarse desde un worktree Git válido."
  echo "Usa:"
  echo "  cd ${EXPECTED_DEPLOY_DIR}"
  exit 1
fi

if [[ "$CURRENT_DIR" != "$EXPECTED_DIR" ]]; then
  echo ""
  echo "ERROR: deploy bloqueado porque no estás en el worktree estable esperado."
  echo "Worktree permitido:"
  echo "  ${EXPECTED_DIR}"
  echo "Worktree actual:"
  echo "  ${CURRENT_DIR}"
  echo ""
  echo "Para saltarte esta protección:"
  echo "  TCDX_ALLOW_UNSAFE_DEPLOY=YES ./scripts/deploy-vms.sh"

  if [[ "${TCDX_ALLOW_UNSAFE_DEPLOY:-}" != "YES" ]]; then
    exit 1
  fi

  echo "ADVERTENCIA: TCDX_ALLOW_UNSAFE_DEPLOY=YES activo."
fi

if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo ""
  echo "ERROR: deploy bloqueado porque la rama actual no es main."
  echo "Rama actual: ${CURRENT_BRANCH:-no-detectada}"

  if [[ "${TCDX_ALLOW_UNSAFE_DEPLOY:-}" != "YES" ]]; then
    exit 1
  fi

  echo "ADVERTENCIA: continuando desde rama no main por TCDX_ALLOW_UNSAFE_DEPLOY=YES."
fi

if [[ -n "$CURRENT_STATUS" ]]; then
  echo ""
  echo "ERROR: deploy bloqueado porque hay cambios sin commit."
  echo "$CURRENT_STATUS"
  echo ""
  echo "Antes de desplegar:"
  echo "  git status"
  echo "  git add ..."
  echo "  git commit -m \"...\""
  echo "  git push"

  if [[ "${TCDX_ALLOW_UNSAFE_DEPLOY:-}" != "YES" ]]; then
    exit 1
  fi

  echo "ADVERTENCIA: continuando con working tree sucio por TCDX_ALLOW_UNSAFE_DEPLOY=YES."
fi

echo ""
echo "Preflight Git OK."
echo ""

echo "======================================"
echo " VALIDANDO SSH, RUTAS, WRAPPERS Y SERVICIOS"
echo "======================================"

preflight_remote "backend" "$BACKEND_HOST" "$REMOTE_BACKEND_DIR" "$BACKEND_WRAPPER" "tecdex-backend.service"
preflight_remote "AI Engine" "$AI_HOST" "$REMOTE_AI_ENGINE_DIR" "$AI_ENGINE_WRAPPER" "ai-engine.service"
preflight_remote "frontend" "$FRONTEND_HOST" "$REMOTE_FRONTEND_DIR" "$FRONTEND_WRAPPER" "tcdx-frontend.service"

echo ""
echo "======================================"
echo " DEPLOY BACKEND"
echo "======================================"
deploy_remote "backend" "$BACKEND_HOST" "$BACKEND_WRAPPER"

echo ""
echo "======================================"
echo " DEPLOY AI ENGINE"
echo "======================================"
deploy_remote "AI Engine" "$AI_HOST" "$AI_ENGINE_WRAPPER"

echo ""
echo "======================================"
echo " DEPLOY FRONTEND"
echo "======================================"
deploy_remote "frontend" "$FRONTEND_HOST" "$FRONTEND_WRAPPER"

echo ""
echo "======================================"
echo " VALIDACION POST-DEPLOY"
echo "======================================"
validate_backend "$BACKEND_HOST"
validate_ai "$AI_HOST"
validate_frontend "$FRONTEND_HOST"

echo ""
echo "======================================"
echo " DEPLOY V4 FINALIZADO OK"
echo "======================================"
echo "Backend:      ${BACKEND_HOST}"
echo "AI Engine:    ${AI_HOST}"
echo "Frontend:     ${FRONTEND_HOST}"
