import re
import unicodedata
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from app.core.db import engine


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
) -> List[Dict[str, Any]]:
    sql = """
      SELECT
        scenario_code,
        scenario_name,
        scenario_description,
        standard_code,
        domain_code,
        domain_name,
        problem_type_code,
        problem_type_name,
        detection_keywords,
        negative_keywords,
        example_titles,
        example_descriptions,
        diagnosis_guidance,
        solution_summary,
        solution_steps,
        expected_evidence,
        minimum_evidence_content,
        invalid_evidence,
        closure_conditions,
        health_impact,
        kpi_impact,
        requires_external_lookup,
        external_lookup_reason,
        external_source_profile,
        priority,
        confidence_boost,
        metadata
      FROM ai_core.v_finding_scenarios_active
      WHERE 1 = 1
        AND (standard_code IS NULL OR standard_code = :standard_code OR :standard_code IS NULL)
        AND (:domain_code IS NULL OR domain_code = :domain_code)
        AND (:problem_type_code IS NULL OR problem_type_code = :problem_type_code)
      ORDER BY priority DESC, scenario_code
    """

    params = {
        "standard_code": standard_code,
        "domain_code": domain_code,
        "problem_type_code": problem_type_code,
    }

    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).mappings().all()

    return [dict(row) for row in rows]


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
    }
