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

DEPLOY_USER="${TCDX_DEPLOY_USER:-tecdex}"

# Antiguas VMs UTM/local. No se definen hosts legacy por defecto:
# si se necesita operar un ambiente histórico, debe declararse explícitamente
# mediante TCDX_LEGACY_BACKEND_HOST/TCDX_LEGACY_FRONTEND_HOST/TCDX_LEGACY_AI_HOST.
LEGACY_BACKEND_HOST="${TCDX_LEGACY_BACKEND_HOST:-}"
LEGACY_FRONTEND_HOST="${TCDX_LEGACY_FRONTEND_HOST:-}"
LEGACY_AI_HOST="${TCDX_LEGACY_AI_HOST:-}"

# Nuevas VMs ESXi/VPN
NEW_BACKEND_HOST="${TCDX_NEW_BACKEND_HOST:-bk.tcdx.int}"
NEW_FRONTEND_HOST="${TCDX_NEW_FRONTEND_HOST:-www.tcdx.int}"
NEW_AI_HOST="${TCDX_NEW_AI_HOST:-ai.tcdx.int}"

ask_deploy_target() {
  local legacy_available=false
  if [[ -n "$LEGACY_BACKEND_HOST" && -n "$LEGACY_FRONTEND_HOST" && -n "$LEGACY_AI_HOST" ]]; then
    legacy_available=true
  fi

  if [[ -n "${TCDX_DEPLOY_TARGET:-}" ]]; then
    case "$TCDX_DEPLOY_TARGET" in
      legacy|new|all)
        if [[ "$TCDX_DEPLOY_TARGET" != "new" && "$legacy_available" != "true" ]]; then
          echo "ERROR: target legacy/all requiere hosts legacy explícitos por entorno." >&2
          exit 1
        fi
        echo "$TCDX_DEPLOY_TARGET"
        return 0
        ;;
      *)
        echo "ERROR: TCDX_DEPLOY_TARGET inválido: $TCDX_DEPLOY_TARGET" >&2
        echo "Valores permitidos: legacy, new, all" >&2
        exit 1
        ;;
    esac
  fi

  echo "" >&2
  echo "======================================" >&2
  echo " SELECCIONAR AMBIENTE DE DEPLOY" >&2
  echo "======================================" >&2
  echo "" >&2
  if [[ "$legacy_available" == "true" ]]; then
    echo "1) Solo VMs antiguas UTM/local" >&2
    echo "   Backend:   ${LEGACY_BACKEND_HOST}" >&2
    echo "   AI Engine: ${LEGACY_AI_HOST}" >&2
    echo "   Frontend:  ${LEGACY_FRONTEND_HOST}" >&2
    echo "" >&2
  else
    echo "1) VMs antiguas UTM/local no configuradas en este entorno" >&2
    echo "" >&2
  fi
  echo "2) Solo nuevas VMs ESXi/VPN" >&2
  echo "   Backend:   ${NEW_BACKEND_HOST}" >&2
  echo "   AI Engine: ${NEW_AI_HOST}" >&2
  echo "   Frontend:  ${NEW_FRONTEND_HOST}" >&2
  echo "" >&2
  echo "3) Ambos ambientes: UTM/local + ESXi/VPN" >&2
  echo "   Backend:   ${LEGACY_BACKEND_HOST} + ${NEW_BACKEND_HOST}" >&2
  echo "   AI Engine: ${LEGACY_AI_HOST} + ${NEW_AI_HOST}" >&2
  echo "   Frontend:  ${LEGACY_FRONTEND_HOST} + ${NEW_FRONTEND_HOST}" >&2
  echo "" >&2

  while true; do
    read -r -p "Elige ambiente de deploy [1=UTM, 2=ESXi, 3=Ambos]: " choice

    case "$choice" in
      1)
        if [[ "$legacy_available" != "true" ]]; then
          echo "Ambiente legacy no configurado. Define hosts legacy explícitos si realmente lo necesitas." >&2
          continue
        fi
        read -r -p "Confirmar deploy SOLO en VMs antiguas UTM/local? [s/N]: " confirm
        case "$confirm" in
          s|S|si|SI|sí|SÍ)
            echo "legacy"
            return 0
            ;;
          *)
            echo "Operación cancelada." >&2
            exit 1
            ;;
        esac
        ;;
      2)
        read -r -p "Confirmar deploy SOLO en nuevas VMs ESXi/VPN? [s/N]: " confirm
        case "$confirm" in
          s|S|si|SI|sí|SÍ)
            echo "new"
            return 0
            ;;
          *)
            echo "Operación cancelada." >&2
            exit 1
            ;;
        esac
        ;;
      3)
        if [[ "$legacy_available" != "true" ]]; then
          echo "Deploy combinado no disponible sin hosts legacy explícitos." >&2
          continue
        fi
        read -r -p "Confirmar deploy en AMBOS ambientes? [s/N]: " confirm
        case "$confirm" in
          s|S|si|SI|sí|SÍ)
            echo "all"
            return 0
            ;;
          *)
            echo "Operación cancelada." >&2
            exit 1
            ;;
        esac
        ;;
      *)
        echo "Opción inválida. Usa 1, 2 o 3." >&2
        ;;
    esac
  done
}

DEPLOY_TARGET="$(ask_deploy_target)"

declare -a BACKEND_HOSTS=()
declare -a AI_HOSTS=()
declare -a FRONTEND_HOSTS=()

case "$DEPLOY_TARGET" in
  all)
    BACKEND_HOSTS=("$LEGACY_BACKEND_HOST" "$NEW_BACKEND_HOST")
    AI_HOSTS=("$LEGACY_AI_HOST" "$NEW_AI_HOST")
    FRONTEND_HOSTS=("$LEGACY_FRONTEND_HOST" "$NEW_FRONTEND_HOST")
    ;;
  legacy)
    BACKEND_HOSTS=("$LEGACY_BACKEND_HOST")
    AI_HOSTS=("$LEGACY_AI_HOST")
    FRONTEND_HOSTS=("$LEGACY_FRONTEND_HOST")
    ;;
  new)
    BACKEND_HOSTS=("$NEW_BACKEND_HOST")
    AI_HOSTS=("$NEW_AI_HOST")
    FRONTEND_HOSTS=("$NEW_FRONTEND_HOST")
    ;;
  *)
    echo "ERROR: target inválido: $DEPLOY_TARGET"
    exit 1
    ;;
esac

run_ssh() {
  local host="$1"
  shift

  ssh \
    -o BatchMode=yes \
    -o ConnectTimeout=10 \
    "${DEPLOY_USER}@${host}" \
    "$@"
}

deploy_remote() {
  local label="$1"
  local host="$2"
  local script="$3"

  echo ""
  echo "--------------------------------------"
  echo "Deploy ${label}: ${host}"
  echo "Script: ${script}"
  echo "--------------------------------------"

  ssh "${DEPLOY_USER}@${host}" "${script}"
}

validate_backend() {
  local host="$1"

  echo ""
  echo "Validando backend: ${host}"

  ssh "${DEPLOY_USER}@${host}" '
    systemctl is-active tecdex-backend &&
    for i in {1..25}; do
      if curl -fsS http://localhost:3000 >/dev/null; then
        echo "backend OK"
        exit 0
      fi
      echo "esperando backend... $i/25"
      sleep 1
    done
    echo "ERROR: backend no responde"
    sudo systemctl status tecdex-backend --no-pager || true
    sudo journalctl -u tecdex-backend -n 80 --no-pager || true
    exit 1
  '
}

validate_ai() {
  local host="$1"

  echo ""
  echo "Validando AI Engine: ${host}"

  ssh "${DEPLOY_USER}@${host}" '
    systemctl is-active ai-engine &&
    for i in {1..25}; do
      if curl -fsS http://localhost:8001/health >/dev/null; then
        echo "ai-engine OK"
        exit 0
      fi
      echo "esperando ai-engine... $i/25"
      sleep 1
    done
    echo "ERROR: ai-engine no responde"
    sudo systemctl status ai-engine --no-pager || true
    sudo journalctl -u ai-engine -n 80 --no-pager || true
    exit 1
  '
}

validate_frontend() {
  local host="$1"

  echo ""
  echo "Validando frontend: ${host}"

  ssh "${DEPLOY_USER}@${host}" '
    systemctl is-active tcdx-frontend &&
    for i in {1..35}; do
      if curl -fsS http://localhost:8080 >/dev/null; then
        echo "frontend OK en 8080"
        exit 0
      fi

      if curl -fsS http://localhost:3000 >/dev/null; then
        echo "frontend OK en 3000"
        exit 0
      fi

      echo "esperando frontend... $i/35"
      sleep 1
    done
    echo "ERROR: frontend no responde ni en 8080 ni en 3000"
    sudo systemctl status tcdx-frontend --no-pager || true
    sudo journalctl -u tcdx-frontend -n 80 --no-pager || true
    exit 1
  '
}

echo ""
echo "======================================"
echo " PREFLIGHT DEPLOY TCDX ISO SAAS"
echo "======================================"
echo "Fecha/hora:       ${DEPLOY_TS}"
echo "Carpeta actual:   ${CURRENT_DIR}"
echo "Carpeta esperada: ${EXPECTED_DIR}"
echo "Rama actual:      ${CURRENT_BRANCH:-no-detectada}"
echo "Ultimo commit:    ${CURRENT_COMMIT:-no-detectado}"
echo "Origin:           ${ORIGIN_URL:-no-detectado}"
echo "Usuario deploy:   ${DEPLOY_USER}"
echo "Target:           ${DEPLOY_TARGET}"
echo ""
echo "Backends:         ${BACKEND_HOSTS[*]}"
echo "AI Engines:       ${AI_HOSTS[*]}"
echo "Frontends:        ${FRONTEND_HOSTS[*]}"

if [[ ! -d .git && ! -f .git ]]; then
  echo ""
  echo "ERROR: este comando debe ejecutarse desde un worktree Git válido."
  echo "Usa:"
  echo "  cd ${EXPECTED_DEPLOY_DIR}"
  exit 1
fi

if [[ "$CURRENT_DIR" != "$EXPECTED_DIR" ]]; then
  echo ""
  echo "ERROR: deploy bloqueado porque no estás en el worktree main estable."
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
echo " VALIDANDO SSH Y SCRIPTS REMOTOS"
echo "======================================"

for host in "${BACKEND_HOSTS[@]}"; do
  echo ""
  echo "Backend host: $host"
  run_ssh "$host" "hostname && test -x /home/tecdex/deploy-backend.sh && echo 'deploy-backend.sh OK'"
done

for host in "${AI_HOSTS[@]}"; do
  echo ""
  echo "AI host: $host"
  run_ssh "$host" "hostname && test -x /home/tecdex/deploy-ai-engine.sh && echo 'deploy-ai-engine.sh OK'"
done

for host in "${FRONTEND_HOSTS[@]}"; do
  echo ""
  echo "Frontend host: $host"
  run_ssh "$host" "hostname && test -x /home/tecdex/deploy-frontend.sh && echo 'deploy-frontend.sh OK'"
done

echo ""
echo "======================================"
echo " DEPLOY GLOBAL BACKEND"
echo "======================================"

for host in "${BACKEND_HOSTS[@]}"; do
  deploy_remote "backend" "$host" "/home/tecdex/deploy-backend.sh"
done

echo ""
echo "======================================"
echo " DEPLOY GLOBAL AI ENGINE"
echo "======================================"

for host in "${AI_HOSTS[@]}"; do
  deploy_remote "ai-engine" "$host" "/home/tecdex/deploy-ai-engine.sh"
done

echo ""
echo "======================================"
echo " DEPLOY GLOBAL FRONTEND"
echo "======================================"

for host in "${FRONTEND_HOSTS[@]}"; do
  deploy_remote "frontend" "$host" "/home/tecdex/deploy-frontend.sh"
done

echo ""
echo "======================================"
echo " VALIDACION POST-DEPLOY"
echo "======================================"

for host in "${BACKEND_HOSTS[@]}"; do
  validate_backend "$host"
done

for host in "${AI_HOSTS[@]}"; do
  validate_ai "$host"
done

for host in "${FRONTEND_HOSTS[@]}"; do
  validate_frontend "$host"
done

echo ""
echo "======================================"
echo " DEPLOY GLOBAL FINALIZADO OK"
echo "======================================"
echo "Target desplegado: ${DEPLOY_TARGET}"
echo "Backends:          ${BACKEND_HOSTS[*]}"
echo "AI Engines:        ${AI_HOSTS[*]}"
echo "Frontends:         ${FRONTEND_HOSTS[*]}"
