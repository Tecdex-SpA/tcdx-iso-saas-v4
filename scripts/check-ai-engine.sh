#!/usr/bin/env bash
set -euo pipefail

AI_ENGINE_URL="${AI_ENGINE_URL:-http://192.168.100.140:8001}"
AI_INTERNAL_TOKEN="${AI_INTERNAL_TOKEN:-${AI_TOKEN:-}}"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

expect_head_200() {
  local path="$1"
  local code

  code="$(curl -sS -o /dev/null -I -w "%{http_code}" "${AI_ENGINE_URL}${path}")"
  [[ "$code" == "200" ]] || fail "HEAD ${path} => HTTP ${code}, esperado 200"
  echo "OK HEAD ${path} => HTTP ${code}"
}

expect_health() {
  local body

  body="$(curl -sS "${AI_ENGINE_URL}/health")"
  echo "$body" | python3 -c '
import json
import sys

data = json.load(sys.stdin)
assert data.get("ok") is True
assert data.get("service") == "AI Compliance Engine"
assert data.get("status") == "running"
'
  echo "OK GET /health"
}

expect_deep_health() {
  local body

  if [[ -z "$AI_INTERNAL_TOKEN" ]]; then
    echo "SKIP GET /health/deep: AI_INTERNAL_TOKEN o AI_TOKEN no configurado localmente"
    return
  fi

  body="$(curl -sS "${AI_ENGINE_URL}/health/deep" -H "x-ai-token: ${AI_INTERNAL_TOKEN}")"
  echo "$body" | python3 -c '
import json
import sys

data = json.load(sys.stdin)
assert data.get("ok") is True
assert data.get("service") == "AI Compliance Engine"
assert data.get("status") == "running"
assert data.get("ai_token_configured") is True
assert isinstance(data.get("db_ok"), bool)
'
  echo "OK GET /health/deep"
}

echo "AI_ENGINE_URL=${AI_ENGINE_URL}"
expect_head_200 "/"
expect_head_200 "/health"
expect_health
expect_deep_health
