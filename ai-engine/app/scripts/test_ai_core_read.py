import json
import sys
from pathlib import Path

BASE_DIR = Path("/home/tecdex/ai-engine")
sys.path.insert(0, str(BASE_DIR))

from app.services.ai_core_db import test_connection
from app.services.context_builder import (
    build_context_pack,
    get_ai_core_summary,
    get_problem_knowledge,
)


def main():
    print("\n=== TEST 1: conexión ai_core ===")
    print(json.dumps(test_connection(), indent=2, default=str, ensure_ascii=False))

    print("\n=== TEST 2: resumen conocimiento ===")
    print(json.dumps(get_ai_core_summary(), indent=2, default=str, ensure_ascii=False))

    print("\n=== TEST 3: conocimiento missing_evidence ===")
    print(json.dumps(get_problem_knowledge("missing_evidence"), indent=2, default=str, ensure_ascii=False))

    print("\n=== TEST 4: contexto general limitado ===")
    context = build_context_pack()
    print(json.dumps(context, indent=2, default=str, ensure_ascii=False))


if __name__ == "__main__":
    main()
