#!/usr/bin/env bash
set -euo pipefail
set +x

PROFILE_WAS_DEFAULTED=false
TCDX_ENV_PROFILE="${TCDX_ENV_PROFILE:-}"
TCDX_ENV_LAYER="${TCDX_ENV_LAYER:-all}"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

usage() {
  cat <<'EOF'
TCDX environment fail-fast check

Usage:
  TCDX_ENV_PROFILE=lab|demo|pilot|production \
  TCDX_ENV_LAYER=all|backend|frontend|ai-engine \
  bash scripts/env-check.sh

Options:
  --help    Show this help.

Exit codes:
  0  PASS: no WARN or FAIL
  1  invalid usage or script error
  2  configuration FAIL
  3  WARN only, without FAIL

The script inspects already loaded variables by name. It never loads .env
files and never prints variable values.
EOF
}

usage_error() {
  echo "ERROR: $*" >&2
  echo "Use --help for usage." >&2
  exit 1
}

if [ "$#" -gt 1 ]; then
  usage_error "Too many arguments."
fi

if [ "$#" -eq 1 ]; then
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    *)
      usage_error "Unknown argument: $1"
      ;;
  esac
fi

if [ -z "$TCDX_ENV_PROFILE" ]; then
  TCDX_ENV_PROFILE="demo"
  PROFILE_WAS_DEFAULTED=true
fi

case "$TCDX_ENV_PROFILE" in
  lab|demo|pilot|production) ;;
  *) usage_error "TCDX_ENV_PROFILE must be lab, demo, pilot, or production." ;;
esac

case "$TCDX_ENV_LAYER" in
  all|backend|frontend|ai-engine) ;;
  *) usage_error "TCDX_ENV_LAYER must be all, backend, frontend, or ai-engine." ;;
esac

report() {
  local layer="$1"
  local variable="$2"
  local status="$3"
  local reason="$4"

  case "$status" in
    OK) PASS_COUNT=$((PASS_COUNT + 1)) ;;
    WARN) WARN_COUNT=$((WARN_COUNT + 1)) ;;
    FAIL) FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
    *) usage_error "Internal invalid status for $variable." ;;
  esac

  printf '| %s | %s | %s | %s |\n' "$layer" "$variable" "$status" "$reason"
}

value_of() {
  local variable="$1"
  printf '%s' "${!variable-}"
}

is_strict_profile() {
  [ "$TCDX_ENV_PROFILE" = "pilot" ] ||
    [ "$TCDX_ENV_PROFILE" = "production" ]
}

missing_status() {
  if is_strict_profile; then
    printf 'FAIL'
  else
    printf 'WARN'
  fi
}

security_status() {
  if is_strict_profile; then
    printf 'FAIL'
  else
    printf 'WARN'
  fi
}

check_required() {
  local layer="$1"
  local variable="$2"
  local reason="$3"
  local value

  value="$(value_of "$variable")"
  if [ -z "$value" ]; then
    report "$layer" "$variable" "$(missing_status)" "$reason"
  else
    report "$layer" "$variable" OK "Configurada."
  fi
}

check_optional() {
  local layer="$1"
  local variable="$2"
  local reason="$3"
  local value

  value="$(value_of "$variable")"
  if [ -z "$value" ]; then
    report "$layer" "$variable" WARN "$reason"
  else
    report "$layer" "$variable" OK "Configurada."
  fi
}

check_enum() {
  local layer="$1"
  local variable="$2"
  local allowed="$3"
  local reason="$4"
  local value

  value="$(value_of "$variable")"
  if [ -z "$value" ]; then
    report "$layer" "$variable" "$(missing_status)" "$reason"
    return
  fi

  case "|$allowed|" in
    *"|$value|"*) report "$layer" "$variable" OK "Valor permitido." ;;
    *) report "$layer" "$variable" "$(security_status)" "Valor fuera del contrato permitido." ;;
  esac
}

check_positive_integer() {
  local layer="$1"
  local variable="$2"
  local required="$3"
  local value

  value="$(value_of "$variable")"
  if [ -z "$value" ]; then
    if [ "$required" = "true" ]; then
      report "$layer" "$variable" "$(missing_status)" "Variable numerica obligatoria ausente."
    else
      report "$layer" "$variable" WARN "Variable numerica opcional ausente."
    fi
    return
  fi

  case "$value" in
    *[!0-9]*|'') report "$layer" "$variable" "$(security_status)" "Debe ser un entero positivo." ;;
    0) report "$layer" "$variable" "$(security_status)" "Debe ser mayor que cero." ;;
    *) report "$layer" "$variable" OK "Entero positivo configurado." ;;
  esac
}

check_secret() {
  local layer="$1"
  local variable="$2"
  local minimum_length="$3"
  local value
  local normalized

  value="$(value_of "$variable")"
  if [ -z "$value" ]; then
    report "$layer" "$variable" "$(missing_status)" "Secreto obligatorio ausente o vacio."
    return
  fi

  normalized="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  case "$normalized" in
    password|changeme|demo|admin|tecdex|example|secret|test|testing|placeholder|replace_me|replace-me)
      report "$layer" "$variable" "$(security_status)" "Secreto placeholder o trivial."
      return
      ;;
  esac

  if [ "${#value}" -lt "$minimum_length" ]; then
    report "$layer" "$variable" "$(security_status)" "Secreto demasiado corto."
    return
  fi

  report "$layer" "$variable" OK "Secreto presente con longitud minima."
}

check_public_url() {
  local layer="$1"
  local variable="$2"
  local value
  local normalized
  local status

  value="$(value_of "$variable")"
  if [ -z "$value" ]; then
    report "$layer" "$variable" "$(missing_status)" "URL publica obligatoria ausente."
    return
  fi

  normalized="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  case "$normalized" in
    http://localhost*|https://localhost*|http://127.0.0.1*|https://127.0.0.1*|http://0.0.0.0*|https://0.0.0.0*|http://\[::1\]*|https://\[::1\]*)
      status="$(security_status)"
      report "$layer" "$variable" "$status" "URL publica apunta a loopback/local."
      return
      ;;
  esac

  case "$normalized" in
    http://*)
      if [ "$TCDX_ENV_PROFILE" = "production" ]; then
        report "$layer" "$variable" FAIL "URL publica production debe usar HTTPS."
      else
        report "$layer" "$variable" WARN "URL publica usa HTTP; permitido solo fuera de production."
      fi
      ;;
    https://*) report "$layer" "$variable" OK "URL publica HTTPS configurada." ;;
    *) report "$layer" "$variable" "$(security_status)" "Debe ser una URL HTTP(S) absoluta." ;;
  esac
}

check_service_url() {
  local layer="$1"
  local variable="$2"
  local value
  local normalized

  value="$(value_of "$variable")"
  if [ -z "$value" ]; then
    report "$layer" "$variable" "$(missing_status)" "URL de servicio obligatoria ausente."
    return
  fi

  normalized="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  case "$normalized" in
    http://*|https://*) report "$layer" "$variable" OK "URL de servicio configurada." ;;
    *) report "$layer" "$variable" "$(security_status)" "Debe ser una URL HTTP(S) absoluta." ;;
  esac
}

check_alias() {
  local layer="$1"
  local official="$2"
  local alias="$3"
  local alias_value

  alias_value="$(value_of "$alias")"
  if [ -n "$alias_value" ]; then
    report "$layer" "$alias" WARN "Alias deprecado; usar $official."
  fi
}

check_node_environment() {
  local layer="$1"
  local value

  value="$(value_of NODE_ENV)"
  if [ -z "$value" ]; then
    report "$layer" NODE_ENV "$(missing_status)" "Entorno Node obligatorio ausente."
    return
  fi

  if is_strict_profile && [ "$value" != "production" ]; then
    report "$layer" NODE_ENV FAIL "Pilot/production requiere NODE_ENV=production."
    return
  fi

  case "$value" in
    production|development|test) report "$layer" NODE_ENV OK "Entorno Node permitido." ;;
    *) report "$layer" NODE_ENV "$(security_status)" "Entorno Node no reconocido." ;;
  esac
}

check_db_ssl() {
  local layer="$1"
  local value

  value="$(value_of DB_SSL)"
  if [ -z "$value" ]; then
    report "$layer" DB_SSL "$(missing_status)" "Politica SSL de base de datos no definida."
    return
  fi

  case "$value" in
    true)
      report "$layer" DB_SSL OK "SSL de base de datos habilitado."
      ;;
    false)
      if [ "$TCDX_ENV_PROFILE" = "production" ]; then
        report "$layer" DB_SSL FAIL "Production requiere DB_SSL=true."
      else
        report "$layer" DB_SSL WARN "DB_SSL=false solo es aceptable en redes controladas."
      fi
      ;;
    *)
      report "$layer" DB_SSL "$(security_status)" "Usar true o false."
      ;;
  esac
}

check_app_environment() {
  local value

  value="$(value_of APP_ENV)"
  if [ -z "$value" ]; then
    report ai-engine APP_ENV "$(missing_status)" "Entorno AI obligatorio ausente."
    return
  fi

  if [ "$TCDX_ENV_PROFILE" = "production" ] && [ "$value" != "production" ]; then
    report ai-engine APP_ENV FAIL "Production requiere APP_ENV=production."
    return
  fi

  if [ "$TCDX_ENV_PROFILE" = "pilot" ] &&
     [ "$value" != "pilot" ] &&
     [ "$value" != "production" ]; then
    report ai-engine APP_ENV FAIL "Pilot requiere APP_ENV=pilot o production."
    return
  fi

  case "$value" in
    lab|demo|pilot|production|development|test)
      report ai-engine APP_ENV OK "Entorno AI permitido."
      ;;
    *)
      report ai-engine APP_ENV "$(security_status)" "Entorno AI no reconocido."
      ;;
  esac
}

check_backend() {
  check_node_environment backend
  check_positive_integer backend PORT true

  check_required backend DB_HOST "Host DB obligatorio ausente."
  check_positive_integer backend DB_PORT true
  check_required backend DB_NAME "Nombre DB obligatorio ausente."
  check_required backend DB_USER "Usuario DB obligatorio ausente."
  check_secret backend DB_PASSWORD 12
  check_db_ssl backend
  check_optional backend DB_POOL_MIN "No consumida por el pool actual; reservada para contrato operativo."
  check_positive_integer backend DB_POOL_MAX true
  check_positive_integer backend DB_CONNECTION_TIMEOUT_MS true
  check_positive_integer backend DB_IDLE_TIMEOUT_MS true
  check_optional backend DB_STATEMENT_TIMEOUT_MS "Timeout SQL opcional no definido."
  check_optional backend DB_QUERY_TIMEOUT_MS "Timeout de query opcional no definido."

  check_secret backend JWT_SECRET 32
  check_required backend JWT_ISSUER "Issuer JWT obligatorio ausente."
  check_required backend JWT_AUDIENCE "Audience JWT obligatorio ausente."
  check_required backend JWT_EXPIRES_IN "Expiracion JWT obligatoria ausente."
  check_secret backend AI_INTERNAL_TOKEN 24

  check_public_url backend FRONTEND_URL
  check_public_url backend API_PUBLIC_URL
  check_service_url backend AI_ENGINE_URL

  check_positive_integer backend EVIDENCE_UPLOAD_MAX_BYTES true
  check_positive_integer backend EVIDENCE_LIBRARY_UPLOAD_MAX_FILE_BYTES true
  check_required backend UPLOADS_DIR "Directorio de uploads obligatorio ausente."
  check_enum backend LOG_LEVEL "debug|info|warn|error" "Nivel de log obligatorio ausente."
}

check_frontend() {
  check_node_environment frontend
  check_public_url frontend NEXT_PUBLIC_API_URL
  check_public_url frontend NEXT_PUBLIC_APP_URL
  check_optional frontend NEXT_PUBLIC_DEFAULT_TENANT_ID "Tenant por defecto opcional no definido."
  check_optional frontend NEXT_PUBLIC_ENABLE_DEMO_MODE "Flag demo opcional sin consumidor runtime actual."
  check_optional frontend NEXT_PUBLIC_TCDX_LOGO_URL "Logo principal usa asset local por defecto."
  check_optional frontend NEXT_PUBLIC_TECDX_POWERED_LOGO_URL "Logo powered-by usa asset local por defecto."

  check_alias frontend NEXT_PUBLIC_API_URL NEXT_PUBLIC_API_BASE_URL
  check_alias frontend NEXT_PUBLIC_API_URL NEXT_PUBLIC_BACKEND_URL
  check_alias frontend NEXT_PUBLIC_TCDX_LOGO_URL NEXT_PUBLIC_LOGO_URL
}

check_ai_provider() {
  local provider

  provider="$(value_of LLM_PROVIDER)"
  if [ -z "$provider" ]; then
    report ai-engine LLM_PROVIDER "$(missing_status)" "Proveedor IA obligatorio ausente."
    return
  fi

  case "$provider" in
    openai|openai_compatible|azure_openai)
      report ai-engine LLM_PROVIDER OK "Proveedor cloud reconocido."
      check_secret ai-engine OPENAI_API_KEY 20
      ;;
    ollama)
      report ai-engine LLM_PROVIDER OK "Proveedor local reconocido."
      check_service_url ai-engine OLLAMA_HOST
      check_required ai-engine OLLAMA_MODEL "Modelo Ollama obligatorio ausente."
      ;;
    none|disabled|off)
      if is_strict_profile; then
        report ai-engine LLM_PROVIDER FAIL "Pilot/production requiere proveedor IA habilitado."
      else
        report ai-engine LLM_PROVIDER WARN "Proveedor IA deshabilitado."
      fi
      ;;
    *)
      report ai-engine LLM_PROVIDER "$(security_status)" "Proveedor IA no reconocido."
      ;;
  esac
}

check_ai_engine() {
  check_app_environment
  check_positive_integer ai-engine APP_PORT true
  check_service_url ai-engine BACKEND_API_URL

  check_required ai-engine DB_HOST "Host DB obligatorio ausente."
  check_positive_integer ai-engine DB_PORT true
  check_required ai-engine DB_NAME "Nombre DB obligatorio ausente."
  check_required ai-engine DB_USER "Usuario DB obligatorio ausente."
  check_secret ai-engine DB_PASSWORD 12
  check_secret ai-engine AI_INTERNAL_TOKEN 24
  check_ai_provider
  check_enum ai-engine LOG_LEVEL "debug|info|warn|error" "Nivel de log obligatorio ausente."

  check_optional ai-engine BRAVE_SEARCH_API_KEY "Busqueda web opcional no configurada."
  check_alias ai-engine BRAVE_SEARCH_API_KEY BRAVE_API_KEY
  check_alias ai-engine APP_PORT AI_ENGINE_PORT
  check_alias ai-engine LLM_PROVIDER AI_PROVIDER
  check_alias ai-engine LLM_PROVIDER MODEL_PROVIDER
}

echo "# TCDX environment check"
echo
echo "- Profile: $TCDX_ENV_PROFILE"
echo "- Layer: $TCDX_ENV_LAYER"
echo
echo "| Capa | Variable | Estado | Motivo |"
echo "|---|---|---|---|"

if [ "$PROFILE_WAS_DEFAULTED" = "true" ]; then
  report global TCDX_ENV_PROFILE WARN "No definida; se aplico el perfil demo."
else
  report global TCDX_ENV_PROFILE OK "Perfil explicito valido."
fi
report global TCDX_ENV_LAYER OK "Capa valida."

case "$TCDX_ENV_LAYER" in
  all)
    check_backend
    check_frontend
    check_ai_engine
    ;;
  backend) check_backend ;;
  frontend) check_frontend ;;
  ai-engine) check_ai_engine ;;
esac

echo
echo "## Resumen"
echo
echo "- OK: $PASS_COUNT"
echo "- WARN: $WARN_COUNT"
echo "- FAIL: $FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "- Resultado: FAIL"
  exit 2
fi

if [ "$WARN_COUNT" -gt 0 ]; then
  echo "- Resultado: WARN"
  exit 3
fi

echo "- Resultado: PASS"
exit 0
