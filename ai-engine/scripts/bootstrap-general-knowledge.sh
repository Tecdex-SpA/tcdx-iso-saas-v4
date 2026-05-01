#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_ENGINE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODE="${1:---dry-run}"

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

python3 - "$AI_ENGINE_DIR" "$MODE" <<'PY'
import json
import sys
from pathlib import Path

ai_engine_dir = Path(sys.argv[1])
mode = sys.argv[2]
bootstrap_dir = ai_engine_dir / "knowledge" / "bootstrap"
topics = json.loads((bootstrap_dir / "topics" / "bootstrap_topics.json").read_text(encoding="utf-8"))
seed_files = sorted((bootstrap_dir / "seeds").glob("*.json"))
seed_items = []
for seed_file in seed_files:
    seed_items.extend(json.loads(seed_file.read_text(encoding="utf-8")))

print("AI General Knowledge Bootstrap - fase 1")
print(f"mode={mode}")
print(f"topics_available={len(topics)}")
print(f"seed_files={len(seed_files)}")
print(f"seed_items_available={len(seed_items)}")
print("db_writes=disabled")
print("brave_search=disabled")
print("next_phase=Fase 2 habilitara persistencia en base de datos.")
PY
