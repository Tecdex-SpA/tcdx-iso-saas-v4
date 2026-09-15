import json
import os
import re
from typing import Any, Dict, List, Optional

from app.services.llm_client import call_llm_json, get_llm_metadata, is_llm_available


GUIDED_ENRICHMENT_MODEL_MODE = "guided"
CANONICAL_GUIDED_MODEL = "deterministic_canonical_guided"


def _as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any, limit: int = 8) -> List[Any]:
    if isinstance(value, list):
        return [item for item in value if item not in (None, "")][:limit]
    if value in (None, ""):
        return []
    return [value]


def _dedupe(items: Any, limit: int = 8) -> List[Any]:
    out: List[Any] = []
    seen = set()
    for item in _as_list(items, limit=limit * 2):
        key = json.dumps(item, sort_keys=True, ensure_ascii=False) if isinstance(item, dict) else str(item).strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item)
        if len(out) >= limit:
            break
    return out


def build_guided_solution_facts(
    *,
    endpoint_type: str,
    payload: Dict[str, Any],
    guided: Dict[str, Any],
    deterministic_response: Dict[str, Any],
) -> Dict[str, Any]:
    solution = _as_dict(guided.get("solution"))
    knowledge = _as_dict(guided.get("knowledge_sources"))
    trace_counts = _as_dict(knowledge.get("trace_counts"))
    raw_context = _as_dict(guided.get("raw_context"))
    canonical_bundle = _as_dict(_as_dict(guided.get("problem")).get("metadata")).get("provenance")
    return {
        "problem": {
            **_as_dict(guided.get("problem")),
            "classification": _as_dict(guided.get("classification")),
        },
        "domain": _as_dict(guided.get("domain")),
        "context": {
            "summary": _as_dict(guided.get("context_summary")),
            "raw_context": raw_context,
        },
        "knowledge": {
            **knowledge,
            "provenance": canonical_bundle,
            "match_count": int(trace_counts.get("canonical_knowledge_match_count") or 0),
        },
        "constraints": {
            "language": "es",
            "tenant_filter_enforced": True,
            "can_auto_close": False,
            "no_operational_writes": True,
            "no_health_or_kpi_mutation": True,
            "no_compliance_assertion": True,
        },
        "deterministic_solution": {
            "endpoint_type": endpoint_type,
            "summary": deterministic_response.get("summary"),
            "impact": deterministic_response.get("impact"),
            "priority": deterministic_response.get("priority"),
            "objective": deterministic_response.get("objective"),
            "likely_causes": _as_list(deterministic_response.get("likely_causes"), limit=12),
            "recommended_actions": _as_list(deterministic_response.get("recommended_actions"), limit=12),
            "immediate_actions": _as_list(deterministic_response.get("immediate_actions"), limit=12),
            "action_plan": _as_list(deterministic_response.get("action_plan"), limit=12),
            "success_criteria": _as_list(deterministic_response.get("success_criteria"), limit=12),
            "expected_deliverables": _as_list(solution.get("expected_deliverables"), limit=12),
            "minimum_content": _as_list(solution.get("minimum_content"), limit=12),
            "invalid_evidence": _as_list(solution.get("invalid_evidence"), limit=12),
            "closure_conditions": _as_list(solution.get("closure_conditions"), limit=12),
            "health_impact": solution.get("health_impact"),
            "kpi_impact": solution.get("kpi_impact"),
            "next_best_action": solution.get("next_best_action"),
        },
        "request": {
            "tenant_id_present": bool(payload.get("tenant_id")),
            "standard_code": payload.get("standard_code") or payload.get("iso_code"),
            "finding_id_present": bool(payload.get("finding_id")),
        },
    }


def _fallback(metadata: Dict[str, Any], reason: str) -> Dict[str, Any]:
    return {
        "llm_available": bool(metadata.get("available")),
        "llm_used": False,
        "llm_provider": metadata.get("provider") or "none",
        "selected_model": metadata.get("model") or CANONICAL_GUIDED_MODEL,
        "model_mode": "deterministic",
        "fallback_used": True,
        "fallback_reason": reason,
        "enrichment": {},
    }


def _non_empty_string(value: Any) -> Optional[str]:
    text = str(value or "").strip()
    return text or None


def _normalize_text(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _dict_strings(value: Any) -> List[str]:
    if isinstance(value, dict):
        out: List[str] = []
        for item in value.values():
            out.extend(_dict_strings(item))
        return out
    if isinstance(value, list):
        out: List[str] = []
        for item in value:
            out.extend(_dict_strings(item))
        return out
    if value in (None, ""):
        return []
    return [str(value)]


FORBIDDEN_NARRATIVE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bcumplimiento\s+logrado\b",
        r"\blogrado\s+el\s+cumplimiento\b",
        r"\bcumple\s+totalmente\b",
        r"\bconforme\s+sin\s+observaciones\b",
        r"\bhallazgo\s+cerrado\b",
        r"\bcierre\s+completado\b",
        r"\bcerrad[oa]\s+autom[aá]ticamente\b",
        r"\bhealth\s+(?:mejorad[oa]|actualizad[oa]|modificad[oa])\b",
        r"\bkpi\s+(?:mejorad[oa]|actualizad[oa]|modificad[oa])\b",
        r"\befectividad\s+comprobada\b",
        r"\bacci[oó]n\s+aplicada\b",
        r"\bcorregid[oa]\s+definitivamente\b",
        r"\b20\d{2}-\d{2}-\d{2}\b",
    )
]


def _assert_no_forbidden_claims(value: Any) -> None:
    for text in _dict_strings(value):
        for pattern in FORBIDDEN_NARRATIVE_PATTERNS:
            if pattern.search(text):
                raise ValueError("llm_attempted_operational_fact_claim")


def _assert_same_scalar_if_present(data: Dict[str, Any], deterministic: Dict[str, Any], field: str) -> None:
    if field not in data:
        return
    proposed = _non_empty_string(data.get(field))
    expected = _non_empty_string(deterministic.get(field))
    if proposed and _normalize_text(proposed) != _normalize_text(expected):
        raise ValueError(f"llm_attempted_structural_field_change:{field}")


def _assert_list_subset_if_present(data: Dict[str, Any], deterministic: Dict[str, Any], field: str) -> None:
    if field not in data:
        return
    proposed = [_normalize_text(item) for item in _as_list(data.get(field), limit=40) if _normalize_text(item)]
    expected = {_normalize_text(item) for item in _as_list(deterministic.get(field), limit=80) if _normalize_text(item)}
    invented = [item for item in proposed if item not in expected]
    if invented:
        raise ValueError(f"llm_attempted_list_fact_invention:{field}")


def _assert_action_plan_preserved(data: Dict[str, Any], deterministic: Dict[str, Any]) -> None:
    if "action_plan" not in data:
        return
    proposed = [item for item in _as_list(data.get("action_plan"), limit=40) if isinstance(item, dict)]
    expected = [item for item in _as_list(deterministic.get("action_plan"), limit=40) if isinstance(item, dict)]
    if len(proposed) > len(expected):
        raise ValueError("llm_attempted_action_plan_extra_step")

    expected_by_step = {
        str(item.get("step")): item
        for item in expected
        if item.get("step") not in (None, "")
    }
    for index, item in enumerate(proposed):
        reference = expected_by_step.get(str(item.get("step"))) or (expected[index] if index < len(expected) else {})
        for field in ("owner_role", "target_days", "step"):
            if field in item and _normalize_text(item.get(field)) != _normalize_text(reference.get(field)):
                raise ValueError(f"llm_attempted_action_plan_structural_change:{field}")


def _assert_no_governed_objects(data: Dict[str, Any]) -> None:
    governed_keys = {
        "problem",
        "classification",
        "domain",
        "standard_applicability",
        "tenant_id",
        "tenant_scope",
        "evidence_exists",
        "existing_evidence",
        "health",
        "kpi",
        "effectiveness",
        "was_useful",
        "was_corrected",
        "was_applied",
        "human_decision",
        "success_state",
    }
    present = governed_keys.intersection(data.keys())
    if present:
        raise ValueError(f"llm_attempted_governed_object_change:{','.join(sorted(present))}")


def validate_guided_llm_output(data: Dict[str, Any], facts: Dict[str, Any], endpoint_type: str) -> Dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError("llm_output_not_object")

    deterministic = _as_dict(facts.get("deterministic_solution"))
    _assert_no_forbidden_claims(data)
    _assert_no_governed_objects(data)

    if data.get("can_auto_close") not in (None, False, "false", "False", "FALSE", 0):
        raise ValueError("llm_attempted_auto_close")

    for field in ("priority", "health_impact", "kpi_impact", "next_best_action"):
        _assert_same_scalar_if_present(data, deterministic, field)

    for field in (
        "likely_causes",
        "recommended_actions",
        "expected_deliverables",
        "minimum_content",
        "invalid_evidence",
        "closure_conditions",
        "immediate_actions",
        "success_criteria",
    ):
        _assert_list_subset_if_present(data, deterministic, field)

    _assert_action_plan_preserved(data, deterministic)

    enriched: Dict[str, Any] = {}
    summary = _non_empty_string(data.get("summary"))
    if summary:
        enriched["summary"] = summary

    impact_explanation = _non_empty_string(data.get("impact_explanation") or data.get("impact"))
    if impact_explanation:
        enriched["impact_explanation"] = impact_explanation

    objective_explanation = _non_empty_string(data.get("objective_explanation") or data.get("objective"))
    if objective_explanation:
        enriched["objective_explanation"] = objective_explanation

    rationale = _non_empty_string(data.get("rationale"))
    if rationale:
        enriched["rationale"] = rationale

    enriched["can_auto_close"] = False
    enriched["llm_contract_version"] = "ai-guided-dgx-enrichment-v1"
    return enriched


def enrich_guided_solution_with_llm(
    *,
    endpoint_type: str,
    payload: Dict[str, Any],
    guided: Dict[str, Any],
    deterministic_response: Dict[str, Any],
) -> Dict[str, Any]:
    metadata = get_llm_metadata(depth="standard", local_compact=True, model_mode=GUIDED_ENRICHMENT_MODEL_MODE)
    if str(os.getenv("AI_DISABLED") or "").strip().lower() in {"1", "true", "yes", "on"}:
        return _fallback(metadata, "llm_disabled")
    if not is_llm_available():
        return _fallback(metadata, "llm_unavailable")

    facts = build_guided_solution_facts(
        endpoint_type=endpoint_type,
        payload=payload,
        guided=guided,
        deterministic_response=deterministic_response,
    )
    prompt = {
        "task": "Enriquecer una recomendación AI Guided para TCDX ISO/GRC.",
        "facts": facts,
        "output_schema": {
            "summary": "string",
            "impact_explanation": "string",
            "objective_explanation": "string",
            "rationale": "string",
            "can_auto_close": False,
        },
    }
    try:
        raw = call_llm_json(
            prompt=json.dumps(prompt, ensure_ascii=False, default=str),
            system_prompt=(
                "Eres un asistente gobernado para AI Guided en una plataforma GRC multi-tenant. "
                "Responde siempre JSON válido en español. Usa sólo los facts suministrados. "
                "No inventes evidencia, cumplimiento, cierre, Health, KPI, efectividad, decisión humana, severidad, fechas, responsables, normas aplicables ni datos de otros tenants. "
                "No auto-cierres hallazgos ni acciones. El resultado es recomendación, no hecho operacional."
            ),
            temperature=0.0,
            timeout=int(os.getenv("AI_GUIDED_LLM_TIMEOUT_SECONDS", "30") or "30"),
            depth="standard",
            local_compact=True,
            model_mode=GUIDED_ENRICHMENT_MODEL_MODE,
            response_contract_instruction=(
                "Devuelve exclusivamente JSON válido con campos narrativos del output_schema. "
                "No devuelvas ni cambies priority, problem, classification, domain, standard_applicability, "
                "expected_deliverables, minimum_content, closure_conditions, health_impact, kpi_impact, "
                "action_plan, owner_role ni target_days. can_auto_close debe ser false."
            ),
            enforce_timeout_cap=True,
        )
        enrichment = validate_guided_llm_output(raw, facts, endpoint_type)
    except Exception as exc:
        return _fallback(metadata, f"llm_enrichment_failed:{type(exc).__name__}")

    return {
        "llm_available": True,
        "llm_used": True,
        "llm_provider": metadata.get("provider"),
        "selected_model": metadata.get("model"),
        "model_mode": metadata.get("model_mode") or GUIDED_ENRICHMENT_MODEL_MODE,
        "fallback_used": False,
        "fallback_reason": None,
        "enrichment": enrichment,
    }
