#!/usr/bin/env bash
set -euo pipefail

BACKEND_HOST="${BACKEND_HOST:-bk.tcdx.int}"
AI_ENGINE_HOST="${AI_ENGINE_HOST:-ai.tcdx.int}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-/etc/tecdex/backend.env}"
AI_ENGINE_ENV_FILE="${AI_ENGINE_ENV_FILE:-/etc/tecdex/ai-engine.env}"
SSH_USER="${SSH_USER:-tecdex}"

print_header() {
  echo ""
  echo "======================================"
  echo " $1"
  echo "======================================"
}

check_remote_env() {
  local host="$1"
  local file="$2"
  shift 2

  ssh "${SSH_USER}@${host}" "sudo test -r '${file}' && sudo awk -F= '
    BEGIN {
      split(\"$*\", wanted, \" \")
      for (i in wanted) required[wanted[i]] = 1
    }
    /^[A-Za-z_][A-Za-z0-9_]*=/ {
      key = \$1
      if (key in required) {
        value = substr(\$0, length(key) + 2)
        print key \" LEN=\" length(value)
        seen[key] = 1
      }
    }
    END {
      for (key in required) {
        if (!(key in seen)) {
          print key \" MISSING\"
          missing = 1
        }
      }
      exit missing
    }
  ' '${file}'"
}

print_header "BACKEND ENV"
check_remote_env \
  "$BACKEND_HOST" \
  "$BACKEND_ENV_FILE" \
  NODE_ENV PORT DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD JWT_SECRET OWN_AI_SHARED_SECRET

print_header "AI ENGINE ENV"
check_remote_env \
  "$AI_ENGINE_HOST" \
  "$AI_ENGINE_ENV_FILE" \
  APP_ENV DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD AI_INTERNAL_TOKEN BACKEND_API_URL FRONTEND_URL

print_header "TOKEN ALIGNMENT"
ssh "${SSH_USER}@${BACKEND_HOST}" "sudo awk -F= '/^(OWN_AI_SHARED_SECRET|AI_INTERNAL_TOKEN|AI_TOKEN)=/ { print \$1 \" LEN=\" length(substr(\$0, length(\$1) + 2)) }' '${BACKEND_ENV_FILE}'"
ssh "${SSH_USER}@${AI_ENGINE_HOST}" "sudo awk -F= '/^(AI_INTERNAL_TOKEN|AI_TOKEN)=/ { print \$1 \" LEN=\" length(substr(\$0, length(\$1) + 2)) }' '${AI_ENGINE_ENV_FILE}'"

echo ""
echo "OK: validacion completada sin imprimir secretos."
