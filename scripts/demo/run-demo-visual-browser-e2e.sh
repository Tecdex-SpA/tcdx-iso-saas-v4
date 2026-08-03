#!/usr/bin/env bash
set -Eeuo pipefail

: "${DEMO_WEB_BASE_URL:?DEMO_WEB_BASE_URL is required}"
: "${DEMO_API_BASE_URL:?DEMO_API_BASE_URL is required}"

if [[ "$DEMO_WEB_BASE_URL" =~ [Pp]rod|[Pp]roduction || "$DEMO_API_BASE_URL" =~ [Pp]rod|[Pp]roduction ]]; then
  echo "Use a controlled QA environment, not production" >&2
  exit 1
fi

npm --prefix frontend run test:e2e:demo-visual
node scripts/demo/write-demo-browser-evidence.js
