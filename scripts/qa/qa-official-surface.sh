#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR" || exit 1

failures=0

fail() {
  failures=$((failures + 1))
  printf 'FAIL: %s\n' "$1"
}

pass() {
  printf 'PASS: %s\n' "$1"
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

files_contain_fixed_string() {
  local pattern="$1"
  shift

  if has_command rg; then
    rg -q --fixed-strings -- "$pattern" "$@"
    return $?
  fi

  grep -F -q -- "$pattern" "$@"
}

array_block_contains() {
  local array_name="$1"
  local needle="$2"

  awk -v array_name="$array_name" -v needle="$needle" '
    BEGIN {
      in_block = 0
      block_found = 0
      needle_found = 0
    }
    $0 ~ ("^export const " array_name) {
      in_block = 1
      block_found = 1
    }
    in_block && index($0, needle) {
      needle_found = 1
    }
    in_block && /\];/ {
      in_block = 0
    }
    END {
      if (!block_found) {
        exit 2
      }
      exit needle_found ? 0 : 1
    }
  ' frontend/src/utils/mvpPermissions.ts
}

route_in_client_nav() {
  local route="$1"
  array_block_contains CLIENT_MVP_NAV_ITEMS "href: '$route'"
}

route_in_array_block() {
  local route="$1"
  local array_name="$2"
  array_block_contains "$array_name" "'$route'"
}

route_in_mvp_rules() {
  local route="$1"
  array_block_contains MVP_ROUTE_RULES "'$route'"
}

is_b2_redirect_route() {
  case "$1" in
    /dashboard-kpi|/centro-control-iso|/command-center-iso|/auditor-iso)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

app_page_exists() {
  local route="${1#/}"
  [ -f "frontend/src/app/$route/page.tsx" ]
}

archived_page_exists() {
  local route="${1#/}"
  [ -f "frontend/legacy-pages-archive/$route/page.tsx" ]
}

printf '## Official surface QA\n'

required_surface_arrays=(
  CLIENT_MVP_NAV_ITEMS
  MVP_ROUTE_RULES
  INTERNAL_CLIENT_HIDDEN_ROUTES
  PLATFORM_ROUTES
  DEALER_ROUTES
)

for array_name in "${required_surface_arrays[@]}"; do
  if grep -F -q -- "export const $array_name" frontend/src/utils/mvpPermissions.ts; then
    pass "$array_name declaration exists"
  else
    fail "$array_name declaration is missing"
  fi
done

if find frontend/src/app -path '*/page.tsx' -type f | grep -q .; then
  pass "frontend app pages can be listed"
else
  fail "frontend app pages could not be listed"
fi

official_mvp_routes=(
  /dashboard
  /cumplimiento-auditoria
  /evidencias
  /riesgos
  /planes-accion
  /exportes
  /ia-compliance
  /configuracion
  /perfil-empresa
  /usuarios
)

for route in "${official_mvp_routes[@]}"; do
  if route_in_client_nav "$route" || route_in_mvp_rules "$route"; then
    pass "$route is allowed by client MVP surface"
  else
    fail "$route is missing from CLIENT_MVP_NAV_ITEMS or MVP_ROUTE_RULES"
  fi

  if route_in_array_block "$route" INTERNAL_CLIENT_HIDDEN_ROUTES; then
    fail "$route must not be in INTERNAL_CLIENT_HIDDEN_ROUTES"
  else
    pass "$route is not in INTERNAL_CLIENT_HIDDEN_ROUTES"
  fi

  if route_in_array_block "$route" PLATFORM_ROUTES; then
    fail "$route must not be in PLATFORM_ROUTES"
  else
    pass "$route is not in PLATFORM_ROUTES"
  fi

  if route_in_array_block "$route" DEALER_ROUTES; then
    fail "$route must not be in DEALER_ROUTES"
  else
    pass "$route is not in DEALER_ROUTES"
  fi
done

non_mvp_client_routes=(
  /dashboard-v2
  /dashboard-kpi
  /ia
  /ia-auditor
  /auditorias/ia
  /auditor-iso
  /centro-control-iso
  /command-center-iso
  /ejecucion-iso
  /documentos
  /administrar-kpis
  /health
  /soa
  /activos
  /ciclo-vida
  /acciones-recomendadas
  /auditorias
  /auditorias/ejecucion
  /controles
  /diagnostico
  /hallazgos
  /matriz-riesgo
  /no-conformidades
  /plan-accion
)

for route in "${non_mvp_client_routes[@]}"; do
  if route_in_client_nav "$route"; then
    fail "$route must not be in CLIENT_MVP_NAV_ITEMS"
  else
    pass "$route is not in CLIENT_MVP_NAV_ITEMS"
  fi

  if is_b2_redirect_route "$route"; then
    if route_in_array_block "$route" INTERNAL_CLIENT_HIDDEN_ROUTES; then
      fail "$route must not remain in INTERNAL_CLIENT_HIDDEN_ROUTES"
    else
      pass "$route is absent from INTERNAL_CLIENT_HIDDEN_ROUTES"
    fi

    if route_in_array_block "$route" PLATFORM_ROUTES; then
      fail "$route must not remain in PLATFORM_ROUTES"
    else
      pass "$route is absent from PLATFORM_ROUTES"
    fi

    if route_in_array_block "$route" DEALER_ROUTES; then
      fail "$route must not remain in DEALER_ROUTES"
    else
      pass "$route is absent from DEALER_ROUTES"
    fi

    if app_page_exists "$route"; then
      fail "$route must not remain active in app router"
    elif archived_page_exists "$route"; then
      pass "$route is archived outside frontend src"
    else
      fail "$route is absent from app router but missing from legacy-pages archive"
    fi
    continue
  fi

  if route_in_array_block "$route" INTERNAL_CLIENT_HIDDEN_ROUTES || \
     route_in_array_block "$route" PLATFORM_ROUTES || \
     route_in_array_block "$route" DEALER_ROUTES; then
    if is_b2_redirect_route "$route"; then
      pass "$route remains in app router and is controlled by hidden/platform/dealer routes"
    else
      pass "$route is controlled by hidden/platform/dealer routes"
    fi
  else
    fail "$route is not controlled by hidden/platform/dealer routes"
  fi
done

b7_retained_active_routes=(
  /dashboard-v2
  /ia
  /ejecucion-iso
  /documentos
)

for route in "${b7_retained_active_routes[@]}"; do
  if app_page_exists "$route"; then
    pass "$route remains active after B.7 review"
  else
    fail "$route must remain active until its B.7 blocker is resolved"
  fi

  if route_in_array_block "$route" INTERNAL_CLIENT_HIDDEN_ROUTES || \
     route_in_array_block "$route" PLATFORM_ROUTES || \
     route_in_array_block "$route" DEALER_ROUTES; then
    pass "$route remains controlled outside the client MVP surface"
  else
    fail "$route must remain controlled by hidden/platform/dealer routes"
  fi
done

b3_live_reference_files=(
  backend/src/services/isoCommandCenter.service.js
  scripts/qa-bilingual-full.sh
  scripts/qa-i18n-db-display.sh
  scripts/validate-iso-unified-command-center.sh
  scripts/validate-iso-command-center.sh
  scripts/validate-iso-auditor.sh
  docs/demo/official-demo-routes.md
  docs/qa-effective-health-sources.md
)

for route in /dashboard-kpi /centro-control-iso /command-center-iso /auditor-iso; do
  files_contain_fixed_string "$route" "${b3_live_reference_files[@]}"
  search_status=$?

  case "$search_status" in
    0)
      fail "$route still has a live B.3 QA/backend/demo reference"
      ;;
    1)
      pass "$route has no live B.3 QA/backend/demo references"
      ;;
    *)
      fail "$route live-reference search failed with status $search_status"
      ;;
  esac
done

for route in /health /dashboard-v2 /dashboard-kpi /ia-auditor /auditorias/ia /auditor-iso /command-center-iso /centro-control-iso /ejecucion-iso /documentos; do
  if route_in_mvp_rules "$route"; then
    fail "$route must not be in MVP_ROUTE_RULES"
  else
    pass "$route is absent from MVP_ROUTE_RULES"
  fi
done

if route_in_client_nav /ia-compliance && route_in_mvp_rules /ia-compliance; then
  pass "/ia-compliance is allowed as client AI surface"
else
  fail "/ia-compliance must remain allowed as client AI surface"
fi

if [ -f backend/src/routes/_legacy/2evidences.routes.js ]; then
  pass "legacy quarantined 2evidences route exists"
else
  fail "backend/src/routes/_legacy/2evidences.routes.js is missing"
fi

if git ls-files qa-results | grep -q .; then
  fail "qa-results has versioned files"
else
  pass "qa-results has no versioned files"
fi

if [ -d qa-results ]; then
  fail "qa-results directory exists in working tree"
else
  pass "qa-results directory is absent from working tree"
fi

ds_store_count="$(find . -name '.DS_Store' \
  -not -path './node_modules/*' \
  -not -path './frontend/node_modules/*' \
  -not -path './backend/node_modules/*' \
  -not -path './frontend/.next/*' | wc -l | tr -d ' ')"

if [ "$ds_store_count" = "0" ]; then
  pass "no .DS_Store files detected"
else
  fail ".DS_Store files detected: $ds_store_count"
fi

if [ "$failures" -eq 0 ]; then
  printf 'Official surface QA completed successfully.\n'
  exit 0
fi

printf 'Official surface QA failed with %s issue(s).\n' "$failures"
exit 1
