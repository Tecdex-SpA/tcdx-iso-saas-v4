#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KNOWLEDGE_DIR="${AI_KNOWLEDGE_DIR:-${ROOT_DIR}/ai-engine/knowledge}"

EXPECTED_FILES=(
  "tcdx_ai_knowledge_seed.json"
  "senior_auditor_reasoning_rules.json"
  "report_generation_rules.json"
  "task_generation_rules.json"
  "audit_intelligence_rules.json"
  "evidence_quality_rules.json"
  "risk_analysis_rules.json"
  "kpi_interpretation_rules.json"
  "ai_output_schemas.json"
  "web_context_rules.json"
)

fail() {
  echo "FAIL $1" >&2
  exit 1
}

[[ -d "$KNOWLEDGE_DIR" ]] || fail "No existe knowledge dir: ${KNOWLEDGE_DIR}"

for file in "${EXPECTED_FILES[@]}"; do
  [[ -f "${KNOWLEDGE_DIR}/${file}" ]] || fail "Falta ${file}"
done

python3 - "$KNOWLEDGE_DIR" <<'PY'
import json
import pathlib
import sys

knowledge_dir = pathlib.Path(sys.argv[1])
errors = []

for path in sorted(knowledge_dir.glob("*.json")):
    try:
        with path.open("r", encoding="utf-8") as handle:
            json.load(handle)
    except Exception as exc:
        errors.append(f"{path.name}: {exc}")

if errors:
    for error in errors:
        print(f"FAIL {error}", file=sys.stderr)
    sys.exit(1)

print(f"OK JSON validos: {knowledge_dir}")
PY

echo "OK archivos esperados presentes: ${#EXPECTED_FILES[@]}"
