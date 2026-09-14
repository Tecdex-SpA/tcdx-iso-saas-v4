import re
import unicodedata
from typing import Any, Dict, List, Optional

from app.services.canonical_knowledge_service import build_knowledge_bundle


def _normalize(value: Any) -> str:
    raw = str(value or "").lower().strip()
    raw = unicodedata.normalize("NFKD", raw)
    raw = "".join(ch for ch in raw if not unicodedata.combining(ch))
    raw = re.sub(r"[^a-z0-9áéíóúñü_\-/\s\.]", " ", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    return raw


def _as_list(value: Any) -> List[str]:
    if value is None:
        return []

    if isinstance(value, list):
        return [str(item) for item in value if item is not None and str(item).strip()]

    if isinstance(value, tuple):
        return [str(item) for item in value if item is not None and str(item).strip()]

    return [str(value)] if str(value).strip() else []


def _json_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return _as_list(value)

    return []


def _contains_keyword(text_value: str, keyword: str) -> bool:
    keyword_norm = _normalize(keyword)

    if not keyword_norm:
        return False

    # Frases completas tienen prioridad.
    if " " in keyword_norm or "/" in keyword_norm or "-" in keyword_norm:
        return keyword_norm in text_value

    # Para términos simples, evitar falsos positivos muy agresivos.
    return bool(re.search(rf"(^|\s){re.escape(keyword_norm)}($|\s)", text_value))


def _score_scenario(
    payload_text: str,
    scenario: Dict[str, Any],
    standard_code: Optional[str],
    domain_code: Optional[str],
    problem_type_code: Optional[str],
) -> Dict[str, Any]:
    detection_keywords = _json_list(scenario.get("detection_keywords"))
    negative_keywords = _json_list(scenario.get("negative_keywords"))
    example_titles = _json_list(scenario.get("example_titles"))
    example_descriptions = _json_list(scenario.get("example_descriptions"))

    matched_keywords = []
    matched_examples = []
    matched_negative = []

    score = 0.0

    for kw in detection_keywords:
        if _contains_keyword(payload_text, kw):
            matched_keywords.append(kw)
            # Frases tienen más peso que palabras sueltas.
            score += 12 if len(_normalize(kw).split()) >= 2 else 7

    for ex in example_titles + example_descriptions:
        ex_norm = _normalize(ex)
        if not ex_norm:
            continue

        # No exige match exacto completo; busca coincidencias relevantes.
        ex_terms = [t for t in ex_norm.split() if len(t) >= 5]
        if not ex_terms:
            continue

        hits = sum(1 for t in ex_terms if _contains_keyword(payload_text, t))
        ratio = hits / max(len(ex_terms), 1)

        if ratio >= 0.35:
            matched_examples.append(ex[:160])
            score += 8

    for nkw in negative_keywords:
        if _contains_keyword(payload_text, nkw):
            matched_negative.append(nkw)
            score -= 20

    scenario_standard = scenario.get("standard_code")
    scenario_domain = scenario.get("domain_code")
    scenario_problem = scenario.get("problem_type_code")

    if standard_code and scenario_standard and _normalize(standard_code) == _normalize(scenario_standard):
        score += 15

    # Si el escenario es transversal standard_code NULL, no se penaliza.
    if domain_code and scenario_domain and _normalize(domain_code) == _normalize(scenario_domain):
        score += 18

    if problem_type_code and scenario_problem and _normalize(problem_type_code) == _normalize(scenario_problem):
        score += 18

    priority = float(scenario.get("priority") or 50)
    score += min(priority / 20, 6)

    confidence_boost = float(scenario.get("confidence_boost") or 0)
    score += confidence_boost * 10

    return {
        "score": round(score, 2),
        "matched_keywords": matched_keywords,
        "matched_examples": matched_examples,
        "matched_negative": matched_negative,
    }


def _load_scenarios(
    standard_code: Optional[str] = None,
    domain_code: Optional[str] = None,
    problem_type_code: Optional[str] = None,
    query_text: Optional[str] = None,
) -> List[Dict[str, Any]]:
    bundle = build_knowledge_bundle(
        standard_code=standard_code,
        domain=domain_code,
        problem_type_code=problem_type_code,
        query_text=query_text,
        limit=8,
    )

    items_by_key = {
        item.get("item_key"): item
        for item in bundle.get("items") or []
        if item.get("item_key")
    }
    actions_by_key: Dict[str, List[Dict[str, Any]]] = {}
    evidence_by_key: Dict[str, List[Dict[str, Any]]] = {}
    questions_by_key: Dict[str, List[Dict[str, Any]]] = {}

    for action in bundle.get("recommended_actions") or []:
        actions_by_key.setdefault(action.get("item_key"), []).append(action)
    for evidence in bundle.get("evidence_expectations") or []:
        evidence_by_key.setdefault(evidence.get("item_key"), []).append(evidence)
    for question in bundle.get("audit_questions") or []:
        questions_by_key.setdefault(question.get("item_key"), []).append(question)

    scenarios: List[Dict[str, Any]] = []
    for gap in bundle.get("gaps") or []:
        item = items_by_key.get(gap.get("item_key")) or {}
        item_actions = actions_by_key.get(gap.get("item_key"), [])
        item_evidence = evidence_by_key.get(gap.get("item_key"), [])
        item_questions = questions_by_key.get(gap.get("item_key"), [])
        detection_text = " ".join([
            gap.get("gap_text") or "",
            gap.get("description") or "",
            item.get("title") or "",
            item.get("intent_summary") or "",
            item.get("search_text") or "",
        ])
        keywords = [
            term
            for term in _normalize(detection_text).split()
            if len(term) >= 5
        ][:12]
        solution_steps = [
            row.get("action_text")
            for row in item_actions
            if row.get("action_text")
        ]
        expected_evidence = [
            row.get("expectation_text") or row.get("description")
            for row in item_evidence
            if row.get("expectation_text") or row.get("description")
        ]
        scenarios.append({
            "scenario_code": gap.get("gap_key") or item.get("item_key") or "canonical_knowledge_gap",
            "scenario_name": gap.get("description") or item.get("title") or "Brecha canónica",
            "scenario_description": gap.get("gap_text") or gap.get("description"),
            "standard_code": item.get("standard_code") or standard_code,
            "domain_code": item.get("domain") or domain_code,
            "domain_name": item.get("domain") or domain_code,
            "problem_type_code": problem_type_code,
            "problem_type_name": problem_type_code,
            "detection_keywords": keywords,
            "negative_keywords": [],
            "example_titles": [item.get("title")] if item.get("title") else [],
            "example_descriptions": [item.get("intent_summary")] if item.get("intent_summary") else [],
            "diagnosis_guidance": gap.get("gap_text") or gap.get("description"),
            "solution_summary": (item_actions[0].get("description") or item_actions[0].get("action_text")) if item_actions else None,
            "solution_steps": solution_steps,
            "expected_evidence": expected_evidence,
            "minimum_evidence_content": [
                row.get("question_text") or row.get("question")
                for row in item_questions
                if row.get("question_text") or row.get("question")
            ],
            "invalid_evidence": [],
            "closure_conditions": [],
            "health_impact": None,
            "kpi_impact": None,
            "requires_external_lookup": False,
            "external_lookup_reason": None,
            "external_source_profile": None,
            "priority": 50,
            "confidence_boost": 0.0,
            "metadata": {
                "source": "canonical_knowledge",
                "item_key": item.get("item_key"),
                "provenance": bundle.get("provenance"),
                "missing_closure_is_not_auto_close": True,
            },
        })

    return scenarios


def detect_finding_scenario(payload: Dict[str, Any]) -> Dict[str, Any]:
    standard_code = (
        payload.get("standard_code")
        or payload.get("iso_code")
        or payload.get("iso")
        or None
    )

    domain_code = payload.get("domain_code") or None
    problem_type_code = payload.get("problem_type_code") or None

    title = payload.get("title") or ""
    description = payload.get("description") or ""
    extra_context = payload.get("extra_context") or ""

    text_value = _normalize(" ".join([title, description, extra_context]))

    scenarios = _load_scenarios(
        standard_code=standard_code,
        domain_code=domain_code,
        problem_type_code=problem_type_code,
        query_text=text_value,
    )

    scored = []

    for scenario in scenarios:
        score_data = _score_scenario(
            payload_text=text_value,
            scenario=scenario,
            standard_code=standard_code,
            domain_code=domain_code,
            problem_type_code=problem_type_code,
        )

        if score_data["score"] > 0:
            scored.append({
                **scenario,
                **score_data,
            })

    scored.sort(key=lambda item: item.get("score", 0), reverse=True)

    best = scored[0] if scored else None
    threshold = 28

    if not best or float(best.get("score") or 0) < threshold:
        return {
            "ok": True,
            "detected": False,
            "threshold": threshold,
            "input": {
                "standard_code": standard_code,
                "domain_code": domain_code,
                "problem_type_code": problem_type_code,
                "title": title,
                "description": description,
            },
            "best_candidate": {
                "scenario_code": best.get("scenario_code") if best else None,
                "scenario_name": best.get("scenario_name") if best else None,
                "score": best.get("score") if best else 0,
                "matched_keywords": best.get("matched_keywords") if best else [],
            } if best else None,
            "alternatives": [
                {
                    "scenario_code": item.get("scenario_code"),
                    "scenario_name": item.get("scenario_name"),
                    "domain_code": item.get("domain_code"),
                    "problem_type_code": item.get("problem_type_code"),
                    "score": item.get("score"),
                    "matched_keywords": item.get("matched_keywords"),
                }
                for item in scored[:5]
            ],
            "scenario_availability": "canonical_knowledge_no_match",
            "provenance": {
                "source": "canonical_knowledge",
                "legacy_ai_core_used": False,
                "v_finding_scenarios_active_used": False,
            },
        }

    return {
        "ok": True,
        "detected": True,
        "threshold": threshold,
        "input": {
            "standard_code": standard_code,
            "domain_code": domain_code,
            "problem_type_code": problem_type_code,
            "title": title,
            "description": description,
        },
        "scenario": {
            "scenario_code": best.get("scenario_code"),
            "scenario_name": best.get("scenario_name"),
            "scenario_description": best.get("scenario_description"),
            "standard_code": best.get("standard_code"),
            "domain_code": best.get("domain_code"),
            "domain_name": best.get("domain_name"),
            "problem_type_code": best.get("problem_type_code"),
            "problem_type_name": best.get("problem_type_name"),
            "score": best.get("score"),
            "matched_keywords": best.get("matched_keywords"),
            "matched_examples": best.get("matched_examples"),
            "matched_negative": best.get("matched_negative"),
            "diagnosis_guidance": best.get("diagnosis_guidance"),
            "solution_summary": best.get("solution_summary"),
            "solution_steps": best.get("solution_steps") or [],
            "expected_evidence": best.get("expected_evidence") or [],
            "minimum_evidence_content": best.get("minimum_evidence_content") or [],
            "invalid_evidence": best.get("invalid_evidence") or [],
            "closure_conditions": best.get("closure_conditions") or [],
            "health_impact": best.get("health_impact"),
            "kpi_impact": best.get("kpi_impact"),
            "requires_external_lookup": best.get("requires_external_lookup"),
            "external_lookup_reason": best.get("external_lookup_reason"),
            "external_source_profile": best.get("external_source_profile"),
            "metadata": best.get("metadata") or {},
        },
        "alternatives": [
            {
                "scenario_code": item.get("scenario_code"),
                "scenario_name": item.get("scenario_name"),
                "domain_code": item.get("domain_code"),
                "problem_type_code": item.get("problem_type_code"),
                "score": item.get("score"),
                "matched_keywords": item.get("matched_keywords"),
            }
            for item in scored[1:6]
        ],
        "provenance": {
            "source": "canonical_knowledge",
            "legacy_ai_core_used": False,
            "v_finding_scenarios_active_used": False,
        },
    }
