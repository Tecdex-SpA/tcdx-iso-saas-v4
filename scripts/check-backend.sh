#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-https://181.212.166.187:8443}"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

expect_http() {
  local method="$1"
  local path="$2"
  local expected="$3"
  local code

  code="$(curl -sS -o /tmp/tcdx_backend_check_body.txt -w "%{http_code}" -X "$method" "${BACKEND_URL}${path}")"

  if [[ ",${expected}," == *",${code},"* ]]; then
    echo "OK ${method} ${path} => HTTP ${code}"
    return
  fi

  echo "Respuesta:"
  cat /tmp/tcdx_backend_check_body.txt || true
  echo ""
  fail "${method} ${path} => HTTP ${code}, esperado ${expected}"
}

echo "BACKEND_URL=${BACKEND_URL}"
expect_http "HEAD" "/" "200"
expect_http "GET" "/" "200"
expect_http "GET" "/api/__rbac_should_block__" "401,403"
