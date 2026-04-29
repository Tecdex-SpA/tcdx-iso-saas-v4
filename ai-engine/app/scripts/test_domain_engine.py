import json
import sys
from pathlib import Path

BASE_DIR = Path("/home/tecdex/ai-engine")
sys.path.insert(0, str(BASE_DIR))

from app.services.solution_engine import generate_guided_solution
from app.services.response_adapter import guided_solution_to_legacy_response


def run_case(title, **kwargs):
    print("\n" + "=" * 90)
    print(title)
    print("=" * 90)

    payload = generate_guided_solution(**kwargs)
    legacy = guided_solution_to_legacy_response(payload)

    print(json.dumps({
        "engine": payload.get("engine"),
        "classification": payload.get("classification"),
        "domain_detection": payload.get("domain_detection"),
        "domain": payload.get("domain"),
        "knowledge_sources": payload.get("knowledge_sources"),
        "summary": legacy.get("summary"),
        "expected_deliverables": legacy.get("expected_deliverables"),
        "minimum_content": legacy.get("minimum_content"),
        "closure_conditions": legacy.get("closure_conditions"),
        "guided_recommendation_preview": legacy.get("recommendation", "")[:1200],
    }, indent=2, ensure_ascii=False, default=str))


def main():
    run_case(
        "CASO 1 - ISO27001 accesos",
        user_text="No existe evidencia de revisión de accesos privilegiados del periodo actual.",
        standard_code="ISO27001",
        forced_problem_type="access_review_missing",
    )

    run_case(
        "CASO 2 - ISO9001 proveedor sin evaluación",
        user_text="No se evidencia evaluación periódica del proveedor crítico de servicios externos.",
        standard_code="ISO9001",
        forced_problem_type="supplier_without_evaluation",
    )

    run_case(
        "CASO 3 - ISO17025 calibración vencida",
        user_text="El certificado de calibración del equipo está vencido y no hay evaluación de impacto.",
        standard_code="ISO17025",
        forced_problem_type="expired_evidence",
    )

    run_case(
        "CASO 4 - ISO14001 evidencia ambiental vencida",
        user_text="El permiso ambiental está vencido y la matriz legal no fue actualizada.",
        standard_code="ISO14001",
        forced_problem_type="expired_evidence",
    )

    run_case(
        "CASO 5 - ISO22000 control de inocuidad no ejecutado",
        user_text="No existe registro de monitoreo del PCC y no se documentaron acciones por desviaciones.",
        standard_code="ISO22000",
        forced_problem_type="control_not_executed",
    )


if __name__ == "__main__":
    main()
