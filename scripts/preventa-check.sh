#!/usr/bin/env bash
set -Eeuo pipefail

ERRORS=0
WARNINGS=0

info() {
  printf '%s\n' "$*"
}

warn() {
  WARNINGS=$((WARNINGS + 1))
  printf 'WARN: %s\n' "$*"
}

fail() {
  ERRORS=$((ERRORS + 1))
  printf 'ERROR: %s\n' "$*"
}

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    fail "falta archivo requerido: $path"
  fi
}

check_forbidden_path() {
  local path="$1"

  case "$path" in
    .git/*|*/.git/*)
      return 0
      ;;
    database/migrations/*.sql|database/seeds/*.sql|database/scripts/*.sql|database/*.sql)
      return 0
      ;;
    frontend/src/components/evidences/*)
      return 0
      ;;
    *.env.example|*/.env.example)
      return 0
      ;;
  esac

  case "$path" in
    .env|*/.env|.env.*|*/.env.*)
      fail "archivo de entorno real detectado: $path"
      ;;
    *.dump|*.tar.gz)
      fail "backup/dump no permitido detectado: $path"
      ;;
    *.sql)
      fail "SQL fuera de database/ permitido detectado: $path"
      ;;
    uploads/*|*/uploads/*|storage/uploads/*|*/storage/uploads/*|evidences/*|*/evidences/*)
      fail "archivo de cliente/evidencia detectado: $path"
      ;;
  esac
}

info "======================================"
info " PREVENTA CHECK TCDX COMPLIANCE"
info "======================================"
info "Fecha:   $(date '+%Y-%m-%d %H:%M:%S %Z')"
info "Host:    $(hostname)"
info "Usuario: $(whoami)"
info "Carpeta: $(pwd)"
info ""

require_file "backend/package.json"
require_file "frontend/package.json"
require_file "backend/src/app.js"
require_file "scripts/deploy-vms.sh"

if [[ ! -x "scripts/deploy-vms.sh" ]]; then
  fail "scripts/deploy-vms.sh existe pero no es ejecutable"
fi

if [[ -f "frontend/src/app/page.tsx" ]]; then
  if grep -Eiq "To get started|Deploy Now|vercel\.com|nextjs\.org|next\.org" "frontend/src/app/page.tsx"; then
    fail "frontend/src/app/page.tsx contiene textos o links de plantilla Next/Vercel"
  fi
else
  fail "falta frontend/src/app/page.tsx"
fi

if grep -Eq '"test"[[:space:]]*:[[:space:]]*"echo \\"Error: no test specified' "backend/package.json"; then
  fail "backend/package.json mantiene test placeholder que falla"
fi

if ! grep -Eq '"check"[[:space:]]*:' "backend/package.json"; then
  warn "backend/package.json no define script check"
fi

if ! grep -Eq '"check"[[:space:]]*:' "frontend/package.json"; then
  warn "frontend/package.json no define script check"
fi

for local_dir in node_modules frontend/node_modules backend/node_modules ai-engine/venv frontend/.next .next; do
  if [[ -e "$local_dir" ]]; then
    warn "artefacto local ignorado por git presente: $local_dir"
  fi
done

while IFS= read -r path; do
  [[ -n "$path" ]] && check_forbidden_path "$path"
done < <(
  find . \
    -path './.git' -prune -o \
    -path './node_modules' -prune -o \
    -path './backend/node_modules' -prune -o \
    -path './frontend/node_modules' -prune -o \
    -path './frontend/.next' -prune -o \
    -path './.next' -prune -o \
    -path './ai-engine/venv' -prune -o \
    -type f -print | sed 's#^\./##'
)

info ""
info "Resumen: ${ERRORS} error(es), ${WARNINGS} advertencia(s)."

if [[ "$ERRORS" -gt 0 ]]; then
  info "BLOQUEADO: revisar errores"
  exit 1
fi

info "OK PARA PILOTO CONTROLADO"
