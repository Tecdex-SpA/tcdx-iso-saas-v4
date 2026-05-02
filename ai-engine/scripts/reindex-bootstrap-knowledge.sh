#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_ENGINE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${AI_ENGINE_DIR}/venv/bin/python3"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  PYTHON_BIN="python3"
fi

"${SCRIPT_DIR}/validate-bootstrap-knowledge.sh"

echo "AI General Knowledge Bootstrap - reindex"
PYTHONPATH="${AI_ENGINE_DIR}" "${PYTHON_BIN}" -m app.services.bootstrap_knowledge_service --status
