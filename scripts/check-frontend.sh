#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-https://181.212.166.187:8443}"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

expect_head() {
  local path="$1"
  local code

  code="$(curl -sS -o /dev/null -I -w "%{http_code}" "${FRONTEND_URL}${path}")"

  if [[ "$code" =~ ^(200|307|308)$ ]]; then
    echo "OK HEAD ${path} => HTTP ${code}"
    return
  fi

  fail "HEAD ${path} => HTTP ${code}, esperado 200/307/308"
}

echo "FRONTEND_URL=${FRONTEND_URL}"
expect_head "/login"
expect_head "/dashboard"
expect_head "/auditorias"
expect_head "/evidencias"
expect_head "/prefacturacion"
