#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_DEPLOY_DIR="${TCDX_DEPLOY_MAIN_DIR:-$HOME/repos/tcdx-iso-saas-v4}"
EXPECTED_ORIGIN_URL="${TCDX_EXPECTED_ORIGIN_URL:-https://github.com/Tecdex-SpA/tcdx-iso-saas-v4.git}"

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
REMOTE_MIGRATION_ENV_FILE="${TCDX_MIGRATION_ENV_FILE:-/home/tecdex/.config/tcdx/migration.env}"

BACKEND_WRAPPER="/home/tecdex/deploy-backend.sh"
FRONTEND_WRAPPER="/home/tecdex/deploy-frontend.sh"
AI_ENGINE_WRAPPER="/home/tecdex/deploy-ai-engine.sh"

normalize_git_url() {
  local url="${1:-}"

  url="${url%/}"
  url="${url%.git}"

  case "$url" in
    git@github.com:*)
      url="https://github.com/${url#git@github.com:}"
      ;;
    git@github-tcdx-forwarded:*)
      url="https://github.com/${url#git@github-tcdx-forwarded:}"
      ;;
    git@github.com-tcdx-v4:*)
      url="https://github.com/${url#git@github.com-tcdx-v4:}"
      ;;
    ssh://git@github.com/*)
      url="https://github.com/${url#ssh://git@github.com/}"
      ;;
    ssh://git@ssh.github.com:443/*)
      url="https://github.com/${url#ssh://git@ssh.github.com:443/}"
      ;;
  esac

  printf '%s' "$url"
}

EXPECTED_ORIGIN_NORMALIZED="$(normalize_git_url "$EXPECTED_ORIGIN_URL")"
ORIGIN_URL_NORMALIZED="$(normalize_git_url "$ORIGIN_URL")"

run_ssh() {
  local host="$1"
  shift

  ssh \
    -A \
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

  run_ssh "$host" "git -C '${remote_dir}' rev-parse --is-inside-work-tree >/dev/null 2>&1" || {
    echo "ERROR: la ruta remota no pertenece a un repositorio Git para ${label}: ${remote_dir}"
    exit 1
  }

  local remote_origin
  remote_origin="$(run_ssh "$host" "git -C '${remote_dir}' remote get-url origin 2>/dev/null || true")"

  if [[ -z "$remote_origin" ]]; then
    echo "ERROR: no se pudo detectar origin remoto para ${label}: ${remote_dir}"
    exit 1
  fi

  local remote_origin_normalized
  remote_origin_normalized="$(normalize_git_url "$remote_origin")"

  if [[ "$remote_origin_normalized" != "$EXPECTED_ORIGIN_NORMALIZED" ]]; then
    echo "ERROR: origin remoto incorrecto para ${label}."
    echo "Esperado: ${EXPECTED_ORIGIN_URL}"
    echo "Actual:   ${remote_origin}"
    echo ""
    echo "Corrige en ${host}:"
    echo "  git -C '${REMOTE_REPO_DIR}' remote set-url origin '${EXPECTED_ORIGIN_URL}'"
    exit 1
  fi

  run_ssh "$host" "test -x '${wrapper}'" || {
    echo "ERROR: wrapper remoto no existe o no es ejecutable para ${label}: ${wrapper}"
    exit 1
  }

  run_ssh "$host" "systemctl list-unit-files '${service}' >/dev/null" || {
    echo "ERROR: servicio esperado no existe para ${label}: ${service}"
    exit 1
  }

  echo "${label} OK"
  echo "Origin remoto: ${remote_origin}"
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

sync_backend_source_for_migrations() {
  local expected_sha="$1"

  echo ""
  echo "Sincronizando codigo backend para migraciones sin reiniciar servicios"

  run_ssh "$BACKEND_HOST" "
    set -Eeuo pipefail
    cd '${REMOTE_REPO_DIR}'

    if [[ -n \"\$(git status --porcelain)\" ]]; then
      echo 'ERROR: repositorio backend remoto tiene cambios locales.'
      exit 1
    fi

    git fetch origin --prune
    git switch main
    git pull --ff-only origin main

    actual_sha=\"\$(git rev-parse HEAD)\"
    if [[ \"\$actual_sha\" != '${expected_sha}' ]]; then
      echo 'ERROR: SHA backend preparado no coincide con el SHA local validado.'
      exit 1
    fi

    echo \"Backend preparado para migracion: \$actual_sha\"
  "
}

run_phase_migration() {
  local phase="$1"
  local mode="$2"
  local script_path="$3"

  run_ssh "$BACKEND_HOST" "
    set -Eeuo pipefail
    migration_env_file='${REMOTE_MIGRATION_ENV_FILE}'

    if [[ ! -r \"\$migration_env_file\" ]]; then
      echo 'ERROR: archivo protegido de migracion ausente o no legible.'
      echo 'Ruta esperada: ${REMOTE_MIGRATION_ENV_FILE}'
      exit 1
    fi

    file_mode=\"\$(stat -c '%a' \"\$migration_env_file\")\"
    if [[ \"\$file_mode\" != '600' && \"\$file_mode\" != '400' ]]; then
      echo 'ERROR: el archivo de migracion debe tener permisos 600 o 400.'
      exit 1
    fi

    file_owner=\"\$(stat -c '%U' \"\$migration_env_file\")\"
    current_user=\"\$(id -un)\"
    if [[ \"\$file_owner\" != \"\$current_user\" ]]; then
      echo 'ERROR: el archivo de migracion debe pertenecer al usuario de deploy.'
      exit 1
    fi

    set -a
    source \"\$migration_env_file\"
    set +a

    if [[ -z \"\${MIGRATION_DATABASE_URL:-}\" ]]; then
      echo 'ERROR: MIGRATION_DATABASE_URL no esta definida en el entorno protegido.'
      exit 1
    fi

    cd '${REMOTE_REPO_DIR}'

    if [[ ! -f '${script_path}' ]]; then
      echo 'ERROR: script de migracion no encontrado: ${script_path}'
      exit 1
    fi

    echo 'Ejecutando migracion ${phase}: ${script_path} ${mode}'
    node '${script_path}' '${mode}'
    unset MIGRATION_DATABASE_URL
  "
}

MIGRATION_RUNNERS=(
  "Fase 3|scripts/phase3/apply-phase3-migration.js"
  "Fase 4|scripts/phase4/apply-phase4-migration.js"
  "Fase 5|scripts/phase5/apply-phase5-migration.js"
  "Fase 5-C2|scripts/phase5-c2/apply-phase5-c2-migration.js"
  "Fase 5-C3|scripts/phase5-c3/apply-phase5-c3-migration.js"
  "Fase 6.8|scripts/f6-8/apply-f6-8-migration.js"
  "Fase 6.10|scripts/f6-10/apply-f6-10-migration.js"
  "Fase 6.11|scripts/f6-11/apply-f6-11-migration.js"
)

run_registered_migrations() {
  local expected_sha="$1"

  echo ""
  echo "======================================"
  echo " PREPARACION MIGRACIONES REGISTRADAS"
  echo "======================================"
  sync_backend_source_for_migrations "$expected_sha"

  for entry in "${MIGRATION_RUNNERS[@]}"; do
    local phase="${entry%%|*}"
    local script_path="${entry#*|}"

    echo ""
    echo "======================================"
    echo " PREFLIGHT ${phase}"
    echo "======================================"
    run_phase_migration "$phase" "--preflight" "$script_path"

    echo ""
    echo "======================================"
    echo " MIGRACION ${phase}"
    echo "======================================"
    run_phase_migration "$phase" "--apply" "$script_path"
  done
}

validate_backend() {
  local host="$1"

  echo ""
  echo "Validando backend: ${host}"

  ssh -A "${DEPLOY_USER}@${host}" '
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

    echo "ERROR: backend no responde de forma valida"
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
    echo "ERROR: servicio AI Engine no quedo activo o healthcheck no paso."
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
    echo "ERROR: servicio frontend no quedo activo o healthcheck no paso."
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
echo "Origin actual:     ${ORIGIN_URL:-no-detectado}"
echo "Origin esperado:   ${EXPECTED_ORIGIN_URL}"
echo "Usuario deploy:    ${DEPLOY_USER}"
echo "Deploy mode:       v4 only"
echo "Backend host:      ${BACKEND_HOST}"
echo "AI Engine host:    ${AI_HOST}"
echo "Frontend host:     ${FRONTEND_HOST}"
echo "Remote repo dir:   ${REMOTE_REPO_DIR}"
echo "Backend dir:       ${REMOTE_BACKEND_DIR}"
echo "Frontend dir:      ${REMOTE_FRONTEND_DIR}"
echo "AI engine dir:     ${REMOTE_AI_ENGINE_DIR}"
echo "Migration env:     ${REMOTE_MIGRATION_ENV_FILE}"

if [[ ! "$REMOTE_MIGRATION_ENV_FILE" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo ""
  echo "ERROR: TCDX_MIGRATION_ENV_FILE debe ser una ruta absoluta segura."
  exit 1
fi

if [[ ! -d .git && ! -f .git ]]; then
  echo ""
  echo "ERROR: este comando debe ejecutarse desde un worktree Git valido."
  echo "Usa:"
  echo "  cd ${EXPECTED_DEPLOY_DIR}"
  exit 1
fi

if [[ "$CURRENT_DIR" != "$EXPECTED_DIR" ]]; then
  echo ""
  echo "ERROR: deploy bloqueado porque no estas en el worktree estable esperado."
  echo "Worktree permitido:"
  echo "  ${EXPECTED_DIR}"
  echo "Worktree actual:"
  echo "  ${CURRENT_DIR}"
  echo ""
  echo "Para saltarte esta proteccion:"
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

if [[ -z "$ORIGIN_URL" ]]; then
  echo ""
  echo "ERROR: no se pudo detectar el remoto origin local."
  exit 1
fi

if [[ "$ORIGIN_URL_NORMALIZED" != "$EXPECTED_ORIGIN_NORMALIZED" ]]; then
  echo ""
  echo "ERROR: deploy bloqueado porque origin local no corresponde al repositorio oficial."
  echo "Origin esperado:"
  echo "  ${EXPECTED_ORIGIN_URL}"
  echo "Origin actual:"
  echo "  ${ORIGIN_URL}"
  echo ""
  echo "Corrige con:"
  echo "  git remote set-url origin '${EXPECTED_ORIGIN_URL}'"
  exit 1
fi

git fetch origin --prune

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_MAIN="$(git rev-parse origin/main)"

if [[ "$LOCAL_HEAD" != "$REMOTE_MAIN" ]]; then
  echo ""
  echo "ERROR: main local no coincide con origin/main."
  echo "HEAD local:   ${LOCAL_HEAD}"
  echo "origin/main:  ${REMOTE_MAIN}"
  echo ""
  echo "Sincroniza antes de desplegar:"
  echo "  git switch main"
  echo "  git pull --ff-only origin main"
  exit 1
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

run_registered_migrations "$LOCAL_HEAD"
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
validate_ai
validate_frontend

echo ""
echo "======================================"
echo " DEPLOY V4 FINALIZADO OK"
echo "======================================"
echo "Repositorio:  ${EXPECTED_ORIGIN_URL}"
echo "Commit:       $(git rev-parse HEAD)"
echo "Backend:      ${BACKEND_HOST}"
echo "AI Engine:    ${AI_HOST}"
echo "Frontend:     ${FRONTEND_HOST}"
