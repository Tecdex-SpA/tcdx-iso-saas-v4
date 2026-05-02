#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_ENGINE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODE="${1:---dry-run}"
PYTHON_BIN="${AI_ENGINE_DIR}/venv/bin/python3"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  PYTHON_BIN="python3"
fi

case "${MODE}" in
  --dry-run|--seeds|--all)
    ;;
  --brave)
    echo "Brave bootstrap se implementara en una fase posterior."
    echo "Fase 1 solo valida estructura, temas y seeds internos."
    exit 0
    ;;
  *)
    echo "Uso: $0 [--dry-run|--seeds|--all|--brave]"
    exit 2
    ;;
esac

"${SCRIPT_DIR}/validate-bootstrap-knowledge.sh"

case "${MODE}" in
  --dry-run)
    PYTHONPATH="${AI_ENGINE_DIR}" "${PYTHON_BIN}" -m app.services.bootstrap_knowledge_service --dry-run
    ;;
  --seeds|--all)
    PYTHONPATH="${AI_ENGINE_DIR}" "${PYTHON_BIN}" -m app.services.bootstrap_knowledge_service --seeds
    ;;
esac
