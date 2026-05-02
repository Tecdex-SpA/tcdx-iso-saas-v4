#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_ENGINE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

"${SCRIPT_DIR}/validate-bootstrap-knowledge.sh"

echo "AI General Knowledge Bootstrap - reindex"
PYTHONPATH="${AI_ENGINE_DIR}" python3 -m app.services.bootstrap_knowledge_service --status
