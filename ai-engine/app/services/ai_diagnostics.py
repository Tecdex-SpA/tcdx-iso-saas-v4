from typing import Any, Dict, Optional

from app.services.context_builder import build_context_pack, get_problem_knowledge
from app.services.domain_knowledge import infer_domain_code, get_domain_knowledge
from app.services.problem_classifier import classify_problem
from app.services.solution_engine import generate_guided_solution
from app.services.explicit_intent import detect_explicit_problem_and_domain


def _limit_list(value: Any, limit: int = 5):
    if isinstance(value, list):
        return value[:limit]
    return []


def _count(value: Any) -> int:
    if isinstance(value, list):
        return len(value)
    return 0


def build_ai_context_diagnostic(
    tenant_id: Optional[str] = None,
    standard_code: Optional[str] = None,
    user_text: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    forced_problem_type: Optional[str] = None,
    forced_domain_code: Optional[str] = None,
    include_raw_context: bool = False,
    include_guided_preview: bool = True,
) -> Dict[str, Any]:
    """
    Diagnóstico interno del motor IA.

    No escribe en BD.
    No cambia estados.
    No cierra hallazgos.
    Solo muestra el contexto y razonamiento técnico usado por la IA.
    """

    context = build_context_pack(
        tenant_id=tenant_id,
        entity_type=entity_type,
        entity_id=entity_id,
        standard_code=standard_code,
    )

    explicit_problem_type, explicit_domain_code = detect_explicit_problem_and_domain(
        user_text=user_text,
        standard_code=standard_code,
    )

    effective_problem_type = forced_problem_type or explicit_problem_type
    effective_domain_code = forced_domain_code or explicit_domain_code

    if effective_problem_type:
        classification = {
            "problem_type_code": effective_problem_type,
            "confidence": 1.0,
            "matched_terms": [
                "forced_problem_type" if forced_problem_type else "explicit_intent"
            ],
            "alternatives": [],
        }
    else:
        classification = classify_problem(
            text=user_text,
            context=context,
        )

    problem_type_code = classification.get("problem_type_code")

    if effective_domain_code:
        domain_detection = {
            "domain_code": effective_domain_code,
            "confidence": 1.0,
            "matched_terms": [
                "forced_domain_code" if forced_domain_code else "explicit_intent"
            ],
            "alternatives": [],
            "source": "forced" if forced_domain_code else "explicit_intent",
            "applies_to_standard": True,
        }
    else:
        domain_detection = infer_domain_code(
            user_text=user_text,
            standard_code=standard_code,
            problem_type_code=problem_type_code,
            context=context,
        )

    domain_code = domain_detection.get("domain_code")

    base_knowledge = get_problem_knowledge(problem_type_code)

    domain_knowledge = get_domain_knowledge(
        domain_code=domain_code,
        problem_type_code=problem_type_code,
        standard_code=standard_code,
    )

    diagnostic: Dict[str, Any] = {
        "ok": True,
        "diagnostic_type": "ai_context_diagnostic",
        "engine": "tcdx_ai_internal_diagnostic_v1",
        "input": {
            "tenant_id": tenant_id,
            "standard_code": standard_code,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "user_text": user_text,
            "forced_problem_type": forced_problem_type,
            "forced_domain_code": forced_domain_code,
        },
        "context_counts": {
            "tenant_health": _count(context.get("tenant_health")),
            "critical_controls": _count(context.get("critical_controls")),
            "attention_controls": _count(context.get("attention_controls")),
            "recent_findings": _count(context.get("recent_findings")),
            "recent_kpis": _count(context.get("recent_kpis")),
            "selected_control": _count(context.get("selected_control")),
        },
        "classification": classification,
        "domain_detection": domain_detection,
        "knowledge": {
            "base_problem_knowledge": bool(base_knowledge.get("ok")),
            "domain_knowledge": bool(domain_knowledge.get("ok")),
            "domain_playbooks_count": len(domain_knowledge.get("playbooks") or []),
            "domain_evidence_expectations_count": len(domain_knowledge.get("evidence_expectations") or []),
            "domain_closure_criteria_count": len(domain_knowledge.get("closure_criteria") or []),
            "standard_overrides_count": len(domain_knowledge.get("overrides") or []),
        },
        "domain": domain_knowledge.get("domain"),
        "standard_domain": domain_knowledge.get("standard_domain"),
        "samples": {
            "tenant_health": _limit_list(context.get("tenant_health"), 10),
            "critical_controls": _limit_list(context.get("critical_controls"), 5),
            "attention_controls": _limit_list(context.get("attention_controls"), 5),
            "recent_findings": _limit_list(context.get("recent_findings"), 5),
            "recent_kpis": _limit_list(context.get("recent_kpis"), 5),
            "selected_control": _limit_list(context.get("selected_control"), 1),
            "domain_playbooks": _limit_list(domain_knowledge.get("playbooks"), 3),
            "domain_evidence_expectations": _limit_list(domain_knowledge.get("evidence_expectations"), 3),
            "domain_closure_criteria": _limit_list(domain_knowledge.get("closure_criteria"), 3),
            "standard_overrides": _limit_list(domain_knowledge.get("overrides"), 5),
        },
        "warnings": [],
    }

    if not context.get("tenant_health"):
        diagnostic["warnings"].append(
            "No se encontró contexto de salud para el tenant/norma consultado."
        )

    if not domain_knowledge.get("ok"):
        diagnostic["warnings"].append(
            "No se encontró conocimiento por dominio para el dominio detectado."
        )

    if not domain_knowledge.get("playbooks"):
        diagnostic["warnings"].append(
            "No se encontraron playbooks por dominio para este caso."
        )

    if not domain_knowledge.get("evidence_expectations"):
        diagnostic["warnings"].append(
            "No se encontraron expectativas de evidencia por dominio para este caso."
        )

    if not domain_knowledge.get("closure_criteria"):
        diagnostic["warnings"].append(
            "No se encontraron criterios de cierre por dominio para este caso."
        )

    if include_guided_preview:
        guided = generate_guided_solution(
            user_text=user_text,
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            standard_code=standard_code,
            forced_problem_type=forced_problem_type,
            forced_domain_code=forced_domain_code,
        )

        diagnostic["guided_preview"] = {
            "engine": guided.get("engine"),
            "problem": guided.get("problem"),
            "domain": guided.get("domain"),
            "context_summary": guided.get("context_summary"),
            "solution_summary": (guided.get("solution") or {}).get("solution_summary"),
            "next_best_action": (guided.get("solution") or {}).get("next_best_action"),
            "expected_deliverables": (guided.get("solution") or {}).get("expected_deliverables", [])[:8],
            "minimum_content": (guided.get("solution") or {}).get("minimum_content", [])[:8],
            "closure_conditions": (guided.get("solution") or {}).get("closure_conditions", [])[:8],
            "knowledge_sources": guided.get("knowledge_sources"),
        }

    if include_raw_context:
        diagnostic["raw_context"] = context

    return diagnostic
