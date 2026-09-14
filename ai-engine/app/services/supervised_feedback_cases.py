import json
from typing import Any, Dict, List, Optional

from app.services.canonical_knowledge_service import load_supervised_feedback_cases as load_canonical_feedback_cases


def _safe_json(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, (dict, list)):
        return value

    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return value

    return value


def _safe_text(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, str):
        return value.strip()

    try:
        return json.dumps(value, ensure_ascii=False)
    except Exception:
        return str(value)


def _extract_response_summary(preferred_response: Any) -> Dict[str, Any]:
    response = _safe_json(preferred_response)

    if not isinstance(response, dict):
        return {
            "summary": _safe_text(response)[:500],
        }

    ai = response.get("ai") if isinstance(response.get("ai"), dict) else {}
    guided = (
        response.get("structured_guided")
        or ai.get("structured_guided")
        or {}
    )

    solution = guided.get("solution") if isinstance(guided.get("solution"), dict) else {}

    return {
        "scenario_code": (
            response.get("scenario_code")
            or ai.get("scenario_code")
            or guided.get("scenario", {}).get("scenario_code")
        ),
        "summary": (
            response.get("summary")
            or response.get("solution_summary")
            or ai.get("solution_summary")
            or solution.get("solution_summary")
            or response.get("objective")
            or ""
        ),
        "next_best_action": (
            response.get("next_best_action")
            or ai.get("next_best_action")
            or solution.get("next_best_action")
            or ""
        ),
        "recommended_actions": (
            response.get("recommended_actions")
            or response.get("immediate_actions")
            or ai.get("recommended_actions")
            or solution.get("solution_steps")
            or []
        ),
        "expected_deliverables": (
            response.get("expected_deliverables")
            or ai.get("expected_deliverables")
            or solution.get("expected_deliverables")
            or []
        ),
        "closure_conditions": (
            response.get("closure_conditions")
            or response.get("success_criteria")
            or ai.get("closure_conditions")
            or solution.get("closure_conditions")
            or []
        ),
    }


def load_useful_feedback_cases(
    tenant_id: Optional[str] = None,
    standard_code: Optional[str] = None,
    domain_code: Optional[str] = None,
    problem_type_code: Optional[str] = None,
    scenario_code: Optional[str] = None,
    limit: int = 3,
) -> Dict[str, Any]:
    return load_canonical_feedback_cases(
        tenant_id=tenant_id,
        standard_code=standard_code,
        domain_code=domain_code,
        problem_type_code=problem_type_code,
        scenario_code=scenario_code,
        limit=limit,
    )
