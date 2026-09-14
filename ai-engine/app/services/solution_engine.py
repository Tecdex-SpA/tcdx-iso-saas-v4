from typing import Any, Dict, List, Optional

from app.services.context_builder import build_context_pack, get_problem_knowledge
from app.services.domain_knowledge import get_domain_knowledge, infer_domain_code
from app.services.problem_classifier import classify_problem
from app.services.explicit_intent import detect_explicit_problem_and_domain


def _first(items: Optional[List[Dict[str, Any]]]) -> Dict[str, Any]:
    if not items:
        return {}
    return items[0] or {}


def _as_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return [value]


def _merge_lists(primary: Any, secondary: Any, max_items: int = 12) -> List[Any]:
    out = []
    seen = set()

    for source in [_as_list(primary), _as_list(secondary)]:
        for item in source:
            key = str(item).strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(item)
            if len(out) >= max_items:
                return out

    return out


def _number_or_none(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None




def _override_content(domain_knowledge: Dict[str, Any]) -> Dict[str, Any]:
    """
    Combina overrides específicos por norma.
    Los overrides no reemplazan todo el motor; enriquecen y priorizan listas/textos.
    """
    merged: Dict[str, Any] = {}

    overrides = domain_knowledge.get("overrides") or []

    for item in overrides:
        content = item.get("content") or {}

        if not isinstance(content, dict):
            continue

        for key, value in content.items():
            if isinstance(value, list):
                current = merged.get(key, [])
                merged[key] = _merge_lists(current, value, max_items=20)
            elif value not in [None, ""]:
                merged[key] = value

    return merged


def _summarize_tenant_health(context: Dict[str, Any]) -> str:
    health_rows = context.get("tenant_health") or []

    if not health_rows:
        return "No se encontraron métricas publicadas del tenant en el contexto disponible."

    parts = []

    for row in health_rows[:5]:
        metric_code = row.get("metric_code") or "métrica no informada"
        numeric_value = row.get("numeric_value")
        publication_state = row.get("publication_state") or "estado no informado"
        coverage = row.get("coverage")

        value_text = "valor no informado" if numeric_value is None else f"valor {numeric_value}"
        coverage_text = "" if coverage is None else f", cobertura {coverage}"
        parts.append(f"{metric_code}: {value_text}, publicación {publication_state}{coverage_text}.")

    return " ".join(parts)


def _detect_contextual_signals(context: Dict[str, Any]) -> List[str]:
    signals = []

    critical_controls = context.get("critical_controls") or []
    attention_controls = context.get("attention_controls") or []
    recent_findings = context.get("recent_findings") or []
    recent_kpis = context.get("recent_kpis") or []

    if critical_controls:
        signals.append(
            f"Existen {len(critical_controls)} controles con estado de implementación crítico o no implementado en el contexto consultado."
        )

    if attention_controls:
        signals.append(
            f"Existen {len(attention_controls)} controles con implementación parcial, pendiente o en revisión."
        )

    if recent_findings:
        signals.append(
            f"El contexto contiene {len(recent_findings)} hallazgos recientes o relacionados."
        )

    partial_coverage_metrics = [
        k for k in recent_kpis
        if (coverage := _number_or_none(k.get("coverage"))) is not None and coverage < 1
    ]

    if partial_coverage_metrics:
        signals.append(
            f"Se detectaron {len(partial_coverage_metrics)} métricas publicadas con cobertura parcial."
        )

    return signals


def generate_guided_solution(
    user_text: Optional[str] = None,
    tenant_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    standard_code: Optional[str] = None,
    forced_problem_type: Optional[str] = None,
    forced_domain_code: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Genera solución guiada usando:
    - tipo de problema
    - dominio operativo
    - norma ISO
    - contexto real del tenant

    No escribe en BD.
    No cierra hallazgos.
    No cambia salud ni KPIs.
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

    classification = (
        {
            "problem_type_code": effective_problem_type,
            "confidence": 1.0,
            "matched_terms": [
                "forced_problem_type" if forced_problem_type else "explicit_intent"
            ],
            "alternatives": [],
        }
        if effective_problem_type
        else classify_problem(text=user_text, context=context)
    )

    problem_type_code = classification["problem_type_code"]

    domain_detection = (
        {
            "domain_code": effective_domain_code,
            "confidence": 1.0,
            "matched_terms": [
                "forced_domain_code" if forced_domain_code else "explicit_intent"
            ],
            "alternatives": [],
            "source": "forced" if forced_domain_code else "explicit_intent",
            "applies_to_standard": True,
        }
        if effective_domain_code
        else infer_domain_code(
            user_text=user_text,
            standard_code=standard_code,
            problem_type_code=problem_type_code,
            context=context,
        )
    )

    domain_code = domain_detection.get("domain_code")

    base_knowledge = get_problem_knowledge(problem_type_code)
    domain_knowledge = get_domain_knowledge(
        domain_code=domain_code,
        problem_type_code=problem_type_code,
        standard_code=standard_code,
    )

    override_content = _override_content(domain_knowledge)

    problem = base_knowledge.get("problem") or {}

    base_playbook = _first(base_knowledge.get("playbooks"))
    base_evidence = _first(base_knowledge.get("evidence_expectations"))
    base_closure = _first(base_knowledge.get("closure_criteria"))

    domain_playbook = _first(domain_knowledge.get("playbooks"))
    domain_evidence = _first(domain_knowledge.get("evidence_expectations"))
    domain_closure = _first(domain_knowledge.get("closure_criteria"))

    # Preferencia: conocimiento por dominio si existe; si no, conocimiento base.
    playbook = domain_playbook or base_playbook
    evidence = domain_evidence or base_evidence
    closure = domain_closure or base_closure

    contextual_signals = _detect_contextual_signals(context)

    diagnosis_template = (
        playbook.get("diagnosis_template")
        or problem.get("description")
        or "Se detectó una brecha que requiere tratamiento documentado, evidencia objetiva y validación."
    )

    solution_summary = override_content.get("solution_summary") or playbook.get("solution_summary") or (
        "Ejecutar una acción concreta, adjuntar evidencia objetiva y validar que el problema quedó resuelto."
    )

    solution_steps = _merge_lists(
        override_content.get("solution_steps"),
        _merge_lists(playbook.get("solution_steps"), base_playbook.get("solution_steps"), max_items=12),
        max_items=12,
    )

    corrective_actions = _merge_lists(
        override_content.get("corrective_actions"),
        _merge_lists(playbook.get("corrective_actions"), base_playbook.get("corrective_actions"), max_items=10),
        max_items=10,
    )

    preventive_actions = _merge_lists(
        override_content.get("preventive_actions"),
        _merge_lists(playbook.get("preventive_actions"), base_playbook.get("preventive_actions"), max_items=10),
        max_items=10,
    )

    expected_deliverables = _merge_lists(
        override_content.get("expected_deliverables"),
        _merge_lists(evidence.get("expected_deliverables"), base_evidence.get("expected_deliverables"), max_items=12),
        max_items=12,
    )

    minimum_content = _merge_lists(
        override_content.get("minimum_content"),
        _merge_lists(evidence.get("minimum_content"), base_evidence.get("minimum_content"), max_items=14),
        max_items=14,
    )

    accepted_formats = _merge_lists(
        evidence.get("accepted_formats"),
        base_evidence.get("accepted_formats"),
        max_items=10,
    )

    invalid_evidence = _merge_lists(
        override_content.get("invalid_evidence"),
        _merge_lists(evidence.get("invalid_evidence"), base_evidence.get("invalid_evidence"), max_items=12),
        max_items=12,
    )

    validation_criteria = _merge_lists(
        override_content.get("validation_criteria"),
        _merge_lists(evidence.get("validation_criteria"), base_evidence.get("validation_criteria"), max_items=12),
        max_items=12,
    )

    closure_conditions = _merge_lists(
        override_content.get("closure_conditions"),
        _merge_lists(
            closure.get("required_conditions") or playbook.get("closure_conditions"),
            base_closure.get("required_conditions") or base_playbook.get("closure_conditions"),
            max_items=12,
        ),
        max_items=12,
    )

    validation_questions = _merge_lists(
        closure.get("validation_questions"),
        base_closure.get("validation_questions"),
        max_items=10,
    )

    rejection_reasons = _merge_lists(
        closure.get("rejection_reasons"),
        base_closure.get("rejection_reasons"),
        max_items=10,
    )

    health_impact = override_content.get("health_impact_notes") or playbook.get("health_impact_notes") or base_playbook.get("health_impact_notes") or (
        "La salud solo debe mejorar cuando exista evidencia suficiente y validación objetiva."
    )

    kpi_impact = override_content.get("kpi_impact_notes") or playbook.get("kpi_impact_notes") or base_playbook.get("kpi_impact_notes") or (
        "El KPI solo debería mejorar cuando la causa real esté corregida y exista trazabilidad."
    )

    next_best_action = solution_steps[0] if solution_steps else (
        "Identificar responsable, definir acción concreta y solicitar evidencia objetiva."
    )

    standard_domain = domain_knowledge.get("standard_domain") or {}
    domain = domain_knowledge.get("domain") or {}

    guided_solution = {
        "ok": True,
        "engine": "tcdx_guided_solution_v2_domain_aware",
        "input": {
            "tenant_id": tenant_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "standard_code": standard_code,
            "domain_code": domain_code,
        },
        "classification": classification,
        "domain_detection": domain_detection,
        "problem": {
            "code": problem.get("code") or problem_type_code,
            "name": problem.get("name") or problem_type_code,
            "category": problem.get("category"),
            "severity": problem.get("default_severity"),
            "priority_weight": problem.get("default_priority_weight"),
            "description": problem.get("description"),
        },
        "domain": {
            "code": domain.get("domain_code") or domain_code,
            "name": domain.get("domain_name"),
            "category": domain.get("domain_category"),
            "description": domain.get("description"),
            "standard_focus": standard_domain.get("standard_focus"),
            "relevance_level": standard_domain.get("relevance_level"),
            "applies_to_standard": domain_detection.get("applies_to_standard"),
        },
        "context_summary": {
            "tenant_health": _summarize_tenant_health(context),
            "signals": contextual_signals,
        },
        "solution": {
            "problem_detected": diagnosis_template,
            "compliance_impact": (
                "Esta situación afecta la capacidad de demostrar cumplimiento, "
                "debilita la trazabilidad del sistema de gestión y puede impactar hallazgos, salud de controles o KPIs."
            ),
            "solution_summary": solution_summary,
            "concrete_actions": solution_steps,
            "corrective_actions": corrective_actions,
            "preventive_actions": preventive_actions,
            "expected_deliverables": expected_deliverables,
            "minimum_content": minimum_content,
            "accepted_formats": accepted_formats,
            "invalid_evidence": invalid_evidence,
            "validation_criteria": validation_criteria,
            "closure_conditions": closure_conditions,
            "validation_questions": validation_questions,
            "rejection_reasons": rejection_reasons,
            "health_impact": health_impact,
            "kpi_impact": kpi_impact,
            "next_best_action": next_best_action,
            "can_auto_close": False,
            "auto_close_reason": (
                "No se debe cerrar automáticamente. Primero debe existir evidencia objetiva, "
                "revisión del responsable y validación del criterio de cierre."
            ),
        },
        "knowledge_sources": {
            "base_problem_knowledge": bool(base_knowledge.get("ok")),
            "domain_knowledge": bool(domain_knowledge.get("ok")),
            "domain_playbook_used": bool(domain_playbook),
            "domain_evidence_used": bool(domain_evidence),
            "domain_closure_used": bool(domain_closure),
            "standard_overrides_count": len(domain_knowledge.get("overrides") or []),
            "standard_overrides_used": bool(override_content),
        },
        "raw_context": {
            "tenant_health": context.get("tenant_health", [])[:5],
            "critical_controls": context.get("critical_controls", [])[:5],
            "attention_controls": context.get("attention_controls", [])[:5],
            "recent_findings": context.get("recent_findings", [])[:5],
            "recent_kpis": context.get("recent_kpis", [])[:5],
            "selected_control": context.get("selected_control", [])[:1],
        },
    }

    return guided_solution


def generate_executive_recommendations(
    tenant_id: Optional[str] = None,
    standard_code: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Genera recomendaciones ejecutivas simples basadas en contexto.
    """
    context = build_context_pack(
        tenant_id=tenant_id,
        standard_code=standard_code,
    )

    critical_controls = context.get("critical_controls") or []
    attention_controls = context.get("attention_controls") or []
    recent_kpis = context.get("recent_kpis") or []

    priorities = []

    for control in critical_controls[:5]:
        priorities.append({
            "type": "control",
            "priority": "alta",
            "title": control.get("title") or control.get("code") or "Control con brecha de implementación",
            "reason": (
                "El contexto canónico informa un estado de implementación crítico "
                f"o no implementado: {control.get('implementation_status') or 'sin estado informado'}."
            ),
            "recommended_action": "Revisar la causa, definir responsable y solicitar evidencia objetiva antes de cerrar la brecha.",
        })

    for kpi in recent_kpis[:5]:
        coverage = _number_or_none(kpi.get("coverage"))
        if coverage is not None and coverage < 1:
            priorities.append({
                "type": "kpi",
                "priority": "media",
                "title": kpi.get("metric_code") or "Métrica con cobertura parcial",
                "reason": "La métrica publicada informa cobertura parcial en el contexto autorizado.",
                "recommended_action": "Validar cobertura, fuente y periodo antes de usar la métrica como base de decisión.",
            })

    if not priorities and attention_controls:
        priorities.append({
            "type": "health",
            "priority": "media",
            "title": "Controles en atención",
            "reason": "Existen controles con implementación parcial, pendiente o en revisión.",
            "recommended_action": "Priorizar revisión de estado, responsable, causa y evidencia disponible antes de tomar decisiones de cierre.",
        })

    if not priorities:
        priorities.append({
            "type": "general",
            "priority": "baja",
            "title": "Mantener seguimiento preventivo",
            "reason": "No se detectaron señales críticas en el contexto consultado.",
            "recommended_action": "Mantener revisión periódica de evidencias, hallazgos, acciones y KPIs.",
        })

    return {
        "ok": True,
        "engine": "tcdx_executive_recommendations_v1",
        "tenant_id": tenant_id,
        "standard_code": standard_code,
        "context_summary": {
            "tenant_health": _summarize_tenant_health(context),
            "signals": _detect_contextual_signals(context),
        },
        "top_priorities": priorities[:10],
    }
