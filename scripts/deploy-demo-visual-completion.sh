#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_DEPLOY_DIR="${TCDX_DEPLOY_MAIN_DIR:-$HOME/repos/tcdx-iso-saas-v4}"
EXPECTED_ORIGIN_URL="${TCDX_EXPECTED_ORIGIN_URL:-https://github.com/Tecdex-SpA/tcdx-iso-saas-v4.git}"
DEPLOY_USER="${TCDX_DEPLOY_USER:-tecdex}"
BACKEND_HOST="${TCDX_BACKEND_HOST:-${TCDX_NEW_BACKEND_HOST:-bk-v4.tcdx.int}}"
REMOTE_REPO_DIR="${TCDX_REMOTE_REPO_DIR:-/home/tecdex/tcdx-iso-saas-v4}"
REMOTE_MIGRATION_ENV_FILE="${TCDX_MIGRATION_ENV_FILE:-/home/tecdex/.config/tcdx/migration.env}"
REMOTE_ATTESTATION_FILE="${TCDX_DEMO_VISUAL_ATTESTATION_FILE:-/home/tecdex/.config/tcdx/demo-visual-completion-attestation.json}"
RUNNER_PATH="scripts/demo/apply-demo-visual-completion.js"

normalize_git_url() {
  local url="${1:-}"
  url="${url%/}"
  url="${url%.git}"
  case "$url" in
    git@github.com:*) url="https://github.com/${url#git@github.com:}" ;;
    ssh://git@github.com/*) url="https://github.com/${url#ssh://git@github.com/}" ;;
    ssh://git@ssh.github.com:443/*) url="https://github.com/${url#ssh://git@ssh.github.com:443/}" ;;
  esac
  printf '%s' "$url"
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ "${TCDX_APPLY_DEMO_VISUAL_COMPLETION:-}" == "YES" ]] || fail "define TCDX_APPLY_DEMO_VISUAL_COMPLETION=YES para ejecutar esta migracion"
[[ "$REMOTE_MIGRATION_ENV_FILE" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "ruta de entorno de migracion invalida"
[[ "$REMOTE_ATTESTATION_FILE" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "ruta de attestation invalida"

CURRENT_DIR="$(pwd -P)"
EXPECTED_DIR="$(cd "$EXPECTED_DEPLOY_DIR" 2>/dev/null && pwd -P || printf '%s' "$EXPECTED_DEPLOY_DIR")"
[[ "$CURRENT_DIR" == "$EXPECTED_DIR" ]] || fail "ejecuta desde el worktree estable: $EXPECTED_DIR"
[[ "$(git branch --show-current)" == "main" ]] || fail "la rama local debe ser main"
[[ -z "$(git status --porcelain)" ]] || fail "el working tree debe estar limpio"

ORIGIN_URL="$(git remote get-url origin)"
[[ "$(normalize_git_url "$ORIGIN_URL")" == "$(normalize_git_url "$EXPECTED_ORIGIN_URL")" ]] || fail "origin local no corresponde al repositorio oficial"

git fetch origin --prune
LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_MAIN="$(git rev-parse origin/main)"
[[ "$LOCAL_HEAD" == "$REMOTE_MAIN" ]] || fail "main local no coincide con origin/main"

echo "======================================"
echo " DEMO VISUAL COMPLETION - PREFLIGHT"
echo "======================================"
echo "Commit:  $LOCAL_HEAD"
echo "Backend: $BACKEND_HOST"
echo "Runner:  $RUNNER_PATH"

ssh -A -o BatchMode=yes -o ConnectTimeout=10 "${DEPLOY_USER}@${BACKEND_HOST}" "
  set -Eeuo pipefail
  cd '${REMOTE_REPO_DIR}'

  if [[ -n \"\$(git status --porcelain)\" ]]; then
    echo 'ERROR: repositorio remoto tiene cambios locales.' >&2
    exit 1
  fi

  remote_origin=\"\$(git remote get-url origin)\"
  git fetch origin --prune
  git switch main
  git pull --ff-only origin main

  actual_sha=\"\$(git rev-parse HEAD)\"
  if [[ \"\$actual_sha\" != '${LOCAL_HEAD}' ]]; then
    echo 'ERROR: SHA remoto no coincide con el SHA local validado.' >&2
    exit 1
  fi

  migration_env_file='${REMOTE_MIGRATION_ENV_FILE}'
  if [[ ! -r \"\$migration_env_file\" ]]; then
    echo 'ERROR: archivo protegido de migracion ausente o no legible.' >&2
    exit 1
  fi

  file_mode=\"\$(stat -c '%a' \"\$migration_env_file\")\"
  if [[ \"\$file_mode\" != '600' && \"\$file_mode\" != '400' ]]; then
    echo 'ERROR: el archivo de migracion debe tener permisos 600 o 400.' >&2
    exit 1
  fi

  file_owner=\"\$(stat -c '%U' \"\$migration_env_file\")\"
  current_user=\"\$(id -un)\"
  if [[ \"\$file_owner\" != \"\$current_user\" ]]; then
    echo 'ERROR: el archivo de migracion debe pertenecer al usuario de deploy.' >&2
    exit 1
  fi

  if [[ ! -f '${RUNNER_PATH}' ]]; then
    echo 'ERROR: runner de demo visual no encontrado.' >&2
    exit 1
  fi

  set -a
  source \"\$migration_env_file\"
  set +a

  if [[ -z \"\${MIGRATION_DATABASE_URL:-}\" ]]; then
    echo 'ERROR: MIGRATION_DATABASE_URL no esta definida.' >&2
    exit 1
  fi

  export ALLOW_DEMO_PRODUCTION_WRITE='I_UNDERSTAND'
  export DEMO_VISUAL_ATTESTATION_FILE='${REMOTE_ATTESTATION_FILE}'

  mkdir -p \"\$(dirname \"\$DEMO_VISUAL_ATTESTATION_FILE\")\"
  chmod 700 \"\$(dirname \"\$DEMO_VISUAL_ATTESTATION_FILE\")\"
  rm -f \"\$DEMO_VISUAL_ATTESTATION_FILE\"

  echo 'Ejecutando preflight de demo visual...'
  node '${RUNNER_PATH}' --preflight

  echo 'Ejecutando dry-run transaccional de demo visual...'
  node '${RUNNER_PATH}' --dry-run

  echo 'Aplicando demo visual completion...'
  node '${RUNNER_PATH}' --apply

  unset MIGRATION_DATABASE_URL ALLOW_DEMO_PRODUCTION_WRITE DEMO_VISUAL_ATTESTATION_FILE
"

echo ""
echo "======================================"
echo " DEMO VISUAL COMPLETION FINALIZADO OK"
echo "======================================"
echo "Commit:  $LOCAL_HEAD"
echo "Backend: $BACKEND_HOST"
