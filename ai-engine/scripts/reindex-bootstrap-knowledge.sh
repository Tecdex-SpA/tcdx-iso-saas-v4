#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"${SCRIPT_DIR}/validate-bootstrap-knowledge.sh"

echo "AI General Knowledge Bootstrap - reindex"
echo "Fase 1 no tiene indice persistente."
echo "La reindexacion real se habilitara cuando exista persistencia en DB en Fase 2/3."
