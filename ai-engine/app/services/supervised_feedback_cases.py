import json
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from app.core.db import engine


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
    conditions = ["1 = 1"]
    params = {
        "tenant_id": tenant_id,
        "standard_code": standard_code,
        "domain_code": domain_code,
        "problem_type_code": problem_type_code,
        "scenario_code": scenario_code,
        "limit": max(1, min(int(limit or 3), 10)),
    }

    if tenant_id:
        conditions.append("tenant_id = :tenant_id")

    if scenario_code:
        conditions.append("scenario_code = :scenario_code")

    if standard_code:
        conditions.append("(standard_code = :standard_code OR standard_code IS NULL)")

    if domain_code:
        conditions.append("domain_code = :domain_code")

    if problem_type_code:
        conditions.append("problem_type_code = :problem_type_code")

    sql = f"""
      SELECT
        id,
        tenant_id,
        source_entity_type,
        source_entity_id,
        standard_code,
        domain_code,
        problem_type_code,
        scenario_code,
        user_rating,
        user_comment,
        was_useful,
        was_applied,
        was_corrected,
        usefulness_score,
        preferred_response,
        metadata,
        created_at
      FROM ai_core.v_ai_useful_feedback_cases
      WHERE {' AND '.join(conditions)}
      ORDER BY usefulness_score DESC, created_at DESC
      LIMIT :limit
    """

    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).mappings().all()

    cases: List[Dict[str, Any]] = []

    for row in rows:
        preferred_response = _safe_json(row.get("preferred_response"))

        cases.append({
            "id": str(row.get("id")),
            "source_entity_type": row.get("source_entity_type"),
            "source_entity_id": str(row.get("source_entity_id")) if row.get("source_entity_id") else None,
            "standard_code": row.get("standard_code"),
            "domain_code": row.get("domain_code"),
            "problem_type_code": row.get("problem_type_code"),
            "scenario_code": row.get("scenario_code"),
            "user_rating": row.get("user_rating"),
            "user_comment": row.get("user_comment"),
            "was_useful": row.get("was_useful"),
            "was_applied": row.get("was_applied"),
            "was_corrected": row.get("was_corrected"),
            "usefulness_score": row.get("usefulness_score"),
            "created_at": str(row.get("created_at")) if row.get("created_at") else None,
            "response_summary": _extract_response_summary(preferred_response),
        })

    return {
        "cases_found": len(cases),
        "cases": cases,
        "filters": {
            "tenant_id": tenant_id,
            "standard_code": standard_code,
            "domain_code": domain_code,
            "problem_type_code": problem_type_code,
            "scenario_code": scenario_code,
            "limit": params["limit"],
        },
    }
