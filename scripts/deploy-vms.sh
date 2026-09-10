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
REMOTE_BACKEND_ENV_FILE="${TCDX_BACKEND_ENV_FILE:-${REMOTE_BACKEND_DIR}/.env}"

DB_DEPLOY_STRATEGY="${TCDX_DB_DEPLOY_STRATEGY:-}"
FRESH_PRODUCTION_DB_NAME="${TCDX_FRESH_PRODUCTION_DB_NAME:-tcdx_saasv2}"

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

validate_db_deploy_strategy() {
  if [[ -z "$DB_DEPLOY_STRATEGY" ]]; then
    echo "ERROR: TCDX_DB_DEPLOY_STRATEGY no definida."
    echo "Valores permitidos: fresh-baseline, historical-upgrade."
    exit 1
  fi

  case "$DB_DEPLOY_STRATEGY" in
    fresh-baseline|historical-upgrade)
      ;;
    *)
      echo "ERROR: TCDX_DB_DEPLOY_STRATEGY invalida: ${DB_DEPLOY_STRATEGY}"
      echo "Valores permitidos: fresh-baseline, historical-upgrade"
      exit 1
      ;;
  esac
}

assert_database_strategy_identity() {
  local source_label="$1"
  local database_name="$2"

  if [[ -z "$database_name" ]]; then
    echo "ERROR: no se pudo resolver current_database() para ${source_label}."
    exit 1
  fi

  case "$DB_DEPLOY_STRATEGY" in
    fresh-baseline)
      if [[ "$database_name" != "$FRESH_PRODUCTION_DB_NAME" ]]; then
        echo "ERROR: estrategia fresh-baseline requiere database=${FRESH_PRODUCTION_DB_NAME}."
        echo "${source_label} actual: ${database_name}"
        echo "Accion humana requerida: corrige el archivo protegido de migracion y/o backend .env para apuntar a ${FRESH_PRODUCTION_DB_NAME}; este deploy no modifica secretos."
        exit 1
      fi
      ;;
    historical-upgrade)
      if [[ "$database_name" == "$FRESH_PRODUCTION_DB_NAME" ]]; then
        echo "ERROR: ${FRESH_PRODUCTION_DB_NAME} no puede usar estrategia historical-upgrade."
        echo "Usa TCDX_DB_DEPLOY_STRATEGY=fresh-baseline para esa base."
        exit 1
      fi
      ;;
  esac
}

assert_backend_runtime_identity() {
  local configured_db="$1"
  local database_name="$2"

  if [[ -z "$configured_db" || -z "$database_name" ]]; then
    echo "ERROR: no se pudo resolver identidad DB runtime backend."
    exit 1
  fi

  if [[ "$configured_db" != "$database_name" ]]; then
    echo "ERROR: backend .env DB_NAME=${configured_db}, pero current_database()=${database_name}."
    exit 1
  fi

  assert_database_strategy_identity "backend runtime DB_NAME" "$database_name"
}

build_backend_runtime_identity_node() {
  cat <<'NODE'
const { Pool } = require('./backend/node_modules/pg');
const dotenv = require('./backend/node_modules/dotenv');

const envFile = process.env.TCDX_BACKEND_ENV_FILE_TO_VALIDATE;
if (!envFile) {
  console.error('ERROR: TCDX_BACKEND_ENV_FILE_TO_VALIDATE no esta definido.');
  process.exit(1);
}

const parsed = dotenv.config({ path: envFile, quiet: true });
if (parsed.error) {
  console.error('ERROR: backend .env no pudo leerse: ' + parsed.error.message);
  process.exit(1);
}

const env = parsed.parsed || {};
if (!env.DB_NAME || !env.DB_USER) {
  console.error('ERROR: backend .env no define DB_NAME/DB_USER.');
  process.exit(1);
}

const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  max: 1,
  connectionTimeoutMillis: Number(env.DB_CONNECTION_TIMEOUT_MS || 5000),
  ssl: String(env.DB_SSL || '').toLowerCase() === 'true'
    ? { rejectUnauthorized: String(env.DB_SSL_REJECT_UNAUTHORIZED || '').toLowerCase() !== 'false' }
    : undefined,
});

pool.query('SELECT current_database() AS database_name, current_user AS user_name, inet_server_addr()::text AS server_addr, inet_server_port()::int AS server_port')
  .then(result => {
    const row = result.rows[0];
    console.log([env.DB_NAME, row.database_name, row.user_name, row.server_addr || 'local', row.server_port || ''].join('|'));
  })
  .catch(error => {
    console.error('ERROR: no se pudo validar identidad DB runtime backend: ' + error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
NODE
}

build_backend_env_parse_node() {
  cat <<'NODE'
const dotenv = require('./backend/node_modules/dotenv');

const envFile = process.env.TCDX_BACKEND_ENV_FILE_TO_VALIDATE;
if (!envFile) {
  console.error('ERROR: TCDX_BACKEND_ENV_FILE_TO_VALIDATE no esta definido.');
  process.exit(1);
}

const parsed = dotenv.config({ path: envFile, quiet: true });
if (parsed.error) {
  console.error('ERROR: backend .env no pudo leerse: ' + parsed.error.message);
  process.exit(1);
}

console.log((parsed.parsed || {}).DB_NAME || '');
NODE
}

selected_migration_runners() {
  case "$DB_DEPLOY_STRATEGY" in
    fresh-baseline)
      if [[ "${#FRESH_PRODUCTION_MIGRATION_RUNNERS[@]}" -gt 0 ]]; then
        printf '%s\n' "${FRESH_PRODUCTION_MIGRATION_RUNNERS[@]}"
      fi
      ;;
    historical-upgrade)
      printf '%s\n' "${HISTORICAL_MIGRATION_RUNNERS[@]}"
      ;;
  esac
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

with_remote_migration_env() {
  local remote_body="$1"
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

    ${remote_body}

    unset MIGRATION_DATABASE_URL
  "
}

query_migration_database_identity() {
  with_remote_migration_env "
    node -e \"
      const { Pool } = require('./backend/node_modules/pg');
      const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 1 });
      pool.query('SELECT current_database() AS database_name, current_user AS user_name, inet_server_addr()::text AS server_addr, inet_server_port()::int AS server_port')
        .then(result => {
          const row = result.rows[0];
          console.log([row.database_name, row.user_name, row.server_addr || 'local', row.server_port || ''].join('|'));
        })
        .catch(error => {
          console.error('ERROR: no se pudo validar identidad DB de migracion: ' + error.message);
          process.exitCode = 1;
        })
        .finally(() => pool.end());
    \"
  "
}

validate_migration_database_identity() {
  echo ""
  echo "Validando identidad DB de migracion (${DB_DEPLOY_STRATEGY})"

  local identity
  identity="$(query_migration_database_identity)"
  local database_name="${identity%%|*}"
  local rest="${identity#*|}"
  local user_name="${rest%%|*}"
  rest="${rest#*|}"
  local server_addr="${rest%%|*}"
  local server_port="${rest#*|}"

  assert_database_strategy_identity "MIGRATION_DATABASE_URL" "$database_name"

  echo "Migration DB OK: database=${database_name} user=${user_name} server=${server_addr}:${server_port}"
}

validate_backend_runtime_database() {
  local phase="$1"

  echo ""
  echo "Validando runtime DB backend (${phase})"

  local identity
  identity="$(run_ssh "$BACKEND_HOST" "
    set -Eeuo pipefail
    backend_env_file='${REMOTE_BACKEND_ENV_FILE}'

    if [[ ! -r \"\$backend_env_file\" ]]; then
      echo 'ERROR: backend .env ausente o no legible.'
      echo 'Ruta esperada: ${REMOTE_BACKEND_ENV_FILE}'
      exit 1
    fi

    cd '${REMOTE_REPO_DIR}'
    TCDX_BACKEND_ENV_FILE_TO_VALIDATE=\"\$backend_env_file\" node <<'NODE'
$(build_backend_runtime_identity_node)
NODE
  ")"

  local configured_db="${identity%%|*}"
  local rest="${identity#*|}"
  local database_name="${rest%%|*}"
  rest="${rest#*|}"
  local user_name="${rest%%|*}"
  rest="${rest#*|}"
  local server_addr="${rest%%|*}"
  local server_port="${rest#*|}"

  assert_backend_runtime_identity "$configured_db" "$database_name"

  echo "Backend runtime DB OK: database=${database_name} user=${user_name} server=${server_addr}:${server_port}"
}

run_phase_migration() {
  local phase="$1"
  local mode="$2"
  local script_path="$3"

  with_remote_migration_env "
    if [[ ! -f '${script_path}' ]]; then
      echo 'ERROR: script de migracion no encontrado: ${script_path}'
      exit 1
    fi

    echo 'Ejecutando migracion ${phase}: ${script_path} ${mode}'
    node '${script_path}' '${mode}'
  "
}

FRESH_PRODUCTION_MIGRATION_RUNNERS=(
  "Fresh runtime contract closeout|scripts/normalization/apply-tcdx-saasv2-fresh-runtime-contract-closeout.js"
  "Release RBAC capability systemic closeout|scripts/release-rbac/apply-release-rbac-capability-closeout.js"
)

HISTORICAL_MIGRATION_RUNNERS=(
  "Fase 3|scripts/phase3/apply-phase3-migration.js"
  "Fase 4|scripts/phase4/apply-phase4-migration.js"
  "Fase 5|scripts/phase5/apply-phase5-migration.js"
  "Fase 5-C2|scripts/phase5-c2/apply-phase5-c2-migration.js"
  "Fase 5-C3|scripts/phase5-c3/apply-phase5-c3-migration.js"
  "Fase 6.8|scripts/f6-8/apply-f6-8-migration.js"
  "Fase 6.10|scripts/f6-10/apply-f6-10-migration.js"
  "Fase 6.11|scripts/f6-11/apply-f6-11-migration.js"
  "Fase 6.13|scripts/f6-13/apply-f6-13-migration.js"
  "RBAC-01|scripts/rbac01/apply-rbac01-migration.js"
  "RBAC-02|scripts/rbac02/apply-rbac02-migration.js"
  "Commercial Plan Matrix|scripts/commercial-plan/apply-commercial-plan-matrix-migration.js"
  "AI Add-on|scripts/ai-addon/apply-ai-addon-migration.js"
  "AI Add-on Reconciliation|scripts/normalization/apply-ai-addon-reconciliation-migration.js"
  "NORMALIZATION-01|scripts/normalization/apply-normalization-01-migration.js"
  "NORMALIZATION-02|scripts/normalization/apply-normalization-02-migration.js"
  "HOTFIX-POSTDEPLOY-01|scripts/normalization/apply-hotfix-postdeploy-01-migration.js"
)

run_registered_migrations() {
  local expected_sha="$1"

  echo ""
  echo "======================================"
  echo " PREPARACION MIGRACIONES REGISTRADAS"
  echo "======================================"
  sync_backend_source_for_migrations "$expected_sha"

  local selected_runners=()
  local entry
  while IFS= read -r entry; do
    [[ -n "$entry" ]] && selected_runners+=("$entry")
  done < <(selected_migration_runners)

  if [[ "${#selected_runners[@]}" -eq 0 ]]; then
    echo "Estrategia ${DB_DEPLOY_STRATEGY}: no hay migraciones forward-only pendientes registradas."
    echo "No se ejecuta baseline, seed, loader ni cadena historica en deploy normal."
    return 0
  fi

  for entry in "${selected_runners[@]}"; do
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

run_deploy_guard_self_test() {
  local output
  local temp_dir
  local fixture_env

  temp_dir="$(mktemp -d)"
  fixture_env="${temp_dir}/backend.env"
  trap 'rm -rf "$temp_dir"' RETURN

  if (DB_DEPLOY_STRATEGY="" validate_db_deploy_strategy) >/dev/null 2>&1; then
    echo "STRATEGY_MISSING_ABORTS=FAIL"
    exit 1
  fi
  echo "STRATEGY_MISSING_ABORTS=PASS"

  DB_DEPLOY_STRATEGY="fresh-baseline"
  FRESH_PRODUCTION_DB_NAME="tcdx_saasv2"
  assert_database_strategy_identity "test" "tcdx_saasv2"
  echo "FRESH_MODE_ACCEPTS_TCDX_SAASV2=PASS"

  output="$(selected_migration_runners)"
  [[ "$output" != *"scripts/phase"* ]] || { echo "FRESH_DB_DOES_NOT_RUN_HISTORICAL_MIGRATIONS=FAIL"; exit 1; }
  [[ "$output" != *"scripts/rbac"* ]] || { echo "FRESH_DB_DOES_NOT_RUN_HISTORICAL_MIGRATIONS=FAIL"; exit 1; }
  [[ "$output" != *"scripts/commercial-plan"* ]] || { echo "FRESH_DB_DOES_NOT_RUN_HISTORICAL_MIGRATIONS=FAIL"; exit 1; }
  [[ "$output" != *"scripts/ai-addon"* ]] || { echo "FRESH_DB_DOES_NOT_RUN_HISTORICAL_MIGRATIONS=FAIL"; exit 1; }
  [[ "$output" != *"apply-normalization"* ]] || { echo "FRESH_DB_DOES_NOT_RUN_HISTORICAL_MIGRATIONS=FAIL"; exit 1; }
  [[ "$output" != *"hotfix"* ]] || { echo "FRESH_DB_DOES_NOT_RUN_HISTORICAL_MIGRATIONS=FAIL"; exit 1; }
  echo "FRESH_DB_DOES_NOT_RUN_HISTORICAL_MIGRATIONS=PASS"

  DB_DEPLOY_STRATEGY="historical-upgrade"
  assert_database_strategy_identity "test" "tecdex_saas"
  echo "HISTORICAL_MODE_ACCEPTS_LEGACY_DB=PASS"

  if (assert_database_strategy_identity "test" "tcdx_saasv2") >/dev/null 2>&1; then
    echo "TCDX_SAASV2_REJECTS_HISTORICAL_UPGRADE=FAIL"
    exit 1
  fi
  echo "TCDX_SAASV2_REJECTS_HISTORICAL_UPGRADE=PASS"

  DB_DEPLOY_STRATEGY="fresh-baseline"
  if (assert_database_strategy_identity "test" "tecdex_saas") >/dev/null 2>&1; then
    echo "FRESH_MODE_REQUIRES_TCDX_SAASV2=FAIL"
    exit 1
  fi
  echo "FRESH_MODE_REQUIRES_TCDX_SAASV2=PASS"

  if (assert_database_strategy_identity "MIGRATION_DATABASE_URL" "tecdex_saas") >/dev/null 2>&1; then
    echo "WRONG_MIGRATION_DATABASE_ABORTS=FAIL"
    exit 1
  fi
  echo "WRONG_MIGRATION_DATABASE_ABORTS=PASS"

  if (assert_backend_runtime_identity "tecdex_saas" "tecdex_saas") >/dev/null 2>&1; then
    echo "WRONG_BACKEND_RUNTIME_DATABASE_ABORTS=FAIL"
    exit 1
  fi
  echo "WRONG_BACKEND_RUNTIME_DATABASE_ABORTS=PASS"

  cat >"$fixture_env" <<'EOF'
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=tcdx_saasv2
DB_USER=test_user
DB_PASSWORD=test_password
DB_APPLICATION_NAME=TCDX ISO SAAS backend
GOOGLE_DRIVE_SCOPES=https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email
EOF
  output="$(TCDX_BACKEND_ENV_FILE_TO_VALIDATE="$fixture_env" node -e "$(build_backend_env_parse_node)")"
  if [[ "$output" != "tcdx_saasv2" ]]; then
    echo "BACKEND_DOTENV_PARSER_SPACES=FAIL"
    exit 1
  fi
  echo "BACKEND_DOTENV_PARSER_SPACES=PASS"

  DB_DEPLOY_STRATEGY="fresh-baseline"
  output="$( (assert_database_strategy_identity "MIGRATION_DATABASE_URL" "tecdex_saas") 2>&1 || true)"
  output="${output}
$( (assert_backend_runtime_identity "tecdex_saas" "tcdx_saasv2") 2>&1 || true)"
  if [[ "$output" == *"DB_PASSWORD"* || "$output" == *"test_password"* || "$output" == *"postgres://"* || "$output" == *"postgresql://"* || "$output" == *"MIGRATION_DATABASE_URL="* || "$output" == *"JWT_SECRET"* || "$output" == *"CLIENT_SECRET"* || "$output" == *"TOKEN_ENCRYPTION_KEY"* ]]; then
    echo "SECRETS_NOT_PRINTED=FAIL"
    exit 1
  fi
  echo "SECRETS_NOT_PRINTED=PASS"

  [[ "$(selected_migration_runners)" != *"production_schema_v1.sql"* ]] || { echo "NO_BOOTSTRAP_ON_NORMAL_DEPLOY=FAIL"; exit 1; }
  [[ "$(selected_migration_runners)" != *"production_seed_v1.sql"* ]] || { echo "NO_BOOTSTRAP_ON_NORMAL_DEPLOY=FAIL"; exit 1; }
  [[ "$(selected_migration_runners)" != *"load-production-reference-catalogs.js"* ]] || { echo "NO_BOOTSTRAP_ON_NORMAL_DEPLOY=FAIL"; exit 1; }
  echo "NO_BOOTSTRAP_ON_NORMAL_DEPLOY=PASS"

  output="$(selected_migration_runners)"
  [[ "$output" != *"scripts/phase"* ]] || { echo "NO_HISTORICAL_PHASE_RUNNER_ON_FRESH_DEPLOY=FAIL"; exit 1; }
  echo "NO_HISTORICAL_PHASE_RUNNER_ON_FRESH_DEPLOY=PASS"

  [[ "$output" == *"apply-tcdx-saasv2-fresh-runtime-contract-closeout.js"* ]] || { echo "DEPLOY_ACCEPTS_FRESH_FORWARD_MIGRATIONS=FAIL"; exit 1; }
  echo "DEPLOY_ACCEPTS_FRESH_FORWARD_MIGRATIONS=PASS"
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

if [[ "${TCDX_DEPLOY_GUARD_SELF_TEST:-}" == "1" ]]; then
  run_deploy_guard_self_test
  exit 0
fi

validate_db_deploy_strategy

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
echo "DB strategy:       ${DB_DEPLOY_STRATEGY}"
echo "Fresh DB guard:    ${FRESH_PRODUCTION_DB_NAME}"
echo "Backend host:      ${BACKEND_HOST}"
echo "AI Engine host:    ${AI_HOST}"
echo "Frontend host:     ${FRONTEND_HOST}"
echo "Remote repo dir:   ${REMOTE_REPO_DIR}"
echo "Backend dir:       ${REMOTE_BACKEND_DIR}"
echo "Frontend dir:      ${REMOTE_FRONTEND_DIR}"
echo "AI engine dir:     ${REMOTE_AI_ENGINE_DIR}"
echo "Migration env:     ${REMOTE_MIGRATION_ENV_FILE}"
echo "Backend env:       ${REMOTE_BACKEND_ENV_FILE}"

if [[ ! "$REMOTE_MIGRATION_ENV_FILE" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo ""
  echo "ERROR: TCDX_MIGRATION_ENV_FILE debe ser una ruta absoluta segura."
  exit 1
fi

if [[ ! "$REMOTE_BACKEND_ENV_FILE" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo ""
  echo "ERROR: TCDX_BACKEND_ENV_FILE debe ser una ruta absoluta segura."
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

validate_migration_database_identity
validate_backend_runtime_database "pre-deploy"

run_registered_migrations "$LOCAL_HEAD"
echo ""
echo "======================================"
echo " DEPLOY BACKEND"
echo "======================================"
deploy_remote "backend" "$BACKEND_HOST" "$BACKEND_WRAPPER"
validate_backend_runtime_database "post-backend-deploy"

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
