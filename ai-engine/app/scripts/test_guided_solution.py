import json
import sys
from pathlib import Path

BASE_DIR = Path("/home/tecdex/ai-engine")
sys.path.insert(0, str(BASE_DIR))

from app.services.response_adapter import (
    executive_recommendations_to_legacy_response,
    guided_solution_to_legacy_response,
)
from app.services.solution_engine import (
    generate_executive_recommendations,
    generate_guided_solution,
)


def print_case(title, payload):
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)
    print(json.dumps(payload, indent=2, default=str, ensure_ascii=False))


def main():
    case_1 = generate_guided_solution(
        user_text="No tenemos evidencia de revisión de accesos privilegiados del periodo actual.",
        standard_code="ISO27001",
    )

    print_case("CASO 1 - Respuesta estructurada revisión de accesos", case_1)
    print_case("CASO 1 - Respuesta compatible legacy", guided_solution_to_legacy_response(case_1))

    case_2 = generate_guided_solution(
        user_text="El KPI de cumplimiento está bajo y hay controles deteriorados sin respaldo.",
        standard_code="ISO27001",
    )

    print_case("CASO 2 - KPI deteriorado", guided_solution_to_legacy_response(case_2))

    case_3 = generate_guided_solution(
        user_text="La evidencia cargada es una captura sin fecha ni responsable.",
    )

    print_case("CASO 3 - Evidencia débil", guided_solution_to_legacy_response(case_3))

    executive = generate_executive_recommendations(
        standard_code="ISO27001",
    )

    print_case("CASO 4 - Recomendaciones ejecutivas", executive_recommendations_to_legacy_response(executive))


if __name__ == "__main__":
    main()
