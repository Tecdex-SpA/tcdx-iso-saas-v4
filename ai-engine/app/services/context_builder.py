from typing import Any, Dict, List, Optional

from app.services.ai_core_db import fetch_all, fetch_one
from app.services.canonical_knowledge_service import (
    CANONICAL_KNOWLEDGE_CONTRACT_VERSION,
    build_knowledge_bundle,
)

CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION = "canonical-intelligence-context-v1"

CONTROL_IMPLEMENTATION_CRITICAL_STATUSES = {
    "not_implemented",
    "no_implementado",
    "not implemented",
    "failed",
    "failure",
    "non_compliant",
    "non-compliant",
    "no_conforme",
    "incumplido",
    "deteriorado",
    "critical",
}

CONTROL_IMPLEMENTATION_ATTENTION_STATUSES = {
    "partial",
    "partially_implemented",
    "parcial",
    "in_progress",
    "in progress",
    "en_progreso",
    "pendiente",
    "pending",
    "atencion",
    "atención",
    "warning",
    "requires_review",
}


def _canonical_int_limit(limit: int, default: int = 20, maximum: int = 100) -> int:
    try:
        normalized = int(limit)
    except (TypeError, ValueError):
        normalized = default
    return max(1, min(normalized, maximum))


def _normalize_status(value: Any) -> str:
    return str(value or "").strip().lower()


def _control_context_bucket(row: Dict[str, Any]) -> str:
    status = _normalize_status(row.get("implementation_status"))
    if status in CONTROL_IMPLEMENTATION_CRITICAL_STATUSES:
        return "implementation_gap"
    if status in CONTROL_IMPLEMENTATION_ATTENTION_STATUSES:
        return "implementation_attention"
    return "implementation_context"


def _with_control_bucket(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    enriched: List[Dict[str, Any]] = []
    for row in rows:
        enriched.append({
            **row,
            "context_bucket": _control_context_bucket(row),
            "context_bucket_source": "implementation_status",
        })
    return enriched


def _filter_controls_by_context_bucket(
    rows: List[Dict[str, Any]],
    context_bucket_filter: Optional[str],
    limit: int,
) -> List[Dict[str, Any]]:
    if not context_bucket_filter:
        return rows[:limit]

    normalized = _normalize_status(context_bucket_filter)
    if normalized in {"implementation_gap", "deteriorado", "red", "critical", "critico", "crítico"}:
        expected = "implementation_gap"
    elif normalized in {"implementation_attention", "atencion", "atención", "warning", "yellow"}:
        expected = "implementation_attention"
    else:
        expected = None

    if not expected:
        return rows[:limit]

    return [row for row in rows if row.get("context_bucket") == expected][:limit]


def _empty_tenant_scoped_context(
    tenant_id: Optional[str],
    entity_type: Optional[str],
    entity_id: Optional[str],
    standard_code: Optional[str],
    reason: str,
) -> Dict[str, Any]:
    return {
        "contract_version": CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
        "tenant_id": tenant_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "standard_code": standard_code,
        "scope_status": "insufficient_data",
        "tenant_scope_authorized": bool(tenant_id),
        "tenant_health": [],
        "critical_controls": [],
        "attention_controls": [],
        "recent_findings": [],
        "recent_kpis": [],
        "selected_control": [],
        "warnings": [reason],
        "provenance": {
            "contract_version": CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
            "tenant_id": tenant_id,
            "backend_authorized_scope_required": True,
            "no_cross_tenant_fallback": True,
            "missing_is_not_zero": True,
        },
    }


def get_ai_core_summary() -> Dict[str, Any]:
    """
    Resumen de contratos canónicos usados por AI Engine.
    """
    rows = fetch_all(
        """
        SELECT 'knowledge_items' AS source, COUNT(*)::int AS total FROM public.knowledge_items WHERE is_active IS DISTINCT FROM false
        UNION ALL
        SELECT 'knowledge_mappings', COUNT(*)::int FROM public.knowledge_mappings
        UNION ALL
        SELECT 'knowledge_recommended_actions', COUNT(*)::int FROM public.knowledge_recommended_actions
        UNION ALL
        SELECT 'knowledge_evidence_expectations', COUNT(*)::int FROM public.knowledge_evidence_expectations
        UNION ALL
        SELECT 'knowledge_common_gaps', COUNT(*)::int FROM public.knowledge_common_gaps
        UNION ALL
        SELECT 'knowledge_rules', COUNT(*)::int FROM public.knowledge_rules
        UNION ALL
        SELECT 'iso_evidence_expectations', COUNT(*)::int FROM public.iso_evidence_expectations
        ORDER BY source
        """
    )

    return {
        "ok": True,
        "summary": rows,
    }


def get_problem_knowledge(problem_type_code: str) -> Dict[str, Any]:
    """
    Devuelve conocimiento canónico para un tipo de problema.

    El modelo experto legacy retirado ya no es
    runtime. El bundle se arma desde public.knowledge_* e ISO evidence; cuando
    no hay match exacto, devuelve listas vacías con provenance.
    """
    bundle = build_knowledge_bundle(
        problem_type_code=problem_type_code,
        query_text=problem_type_code,
        limit=5,
    )
    first_item = (bundle.get("items") or [{}])[0] if bundle.get("items") else {}

    problem = {
        "code": problem_type_code,
        "name": first_item.get("title") or problem_type_code,
        "description": first_item.get("intent_summary") or first_item.get("implementation_guidance"),
        "category": first_item.get("item_type"),
        "default_severity": first_item.get("severity_default"),
        "default_priority_weight": None,
        "applies_to": first_item.get("applicability"),
        "metadata": {
            "canonical_knowledge": True,
            "contract_version": CANONICAL_KNOWLEDGE_CONTRACT_VERSION,
            "item_key": first_item.get("item_key"),
            "provenance": bundle.get("provenance"),
        },
    } if first_item else None

    playbooks = []
    for item in bundle.get("recommended_actions") or []:
        playbooks.append({
            "problem_type_code": problem_type_code,
            "standard_code": first_item.get("standard_code"),
            "control_code": first_item.get("clause_or_control"),
            "title": item.get("description") or item.get("action_key") or "Acción recomendada",
            "diagnosis_template": (bundle.get("gaps") or [{}])[0].get("gap_text") if bundle.get("gaps") else None,
            "solution_summary": item.get("description") or item.get("action_text"),
            "solution_steps": [item.get("action_text")] if item.get("action_text") else [],
            "corrective_actions": [item.get("action_text")] if item.get("action_text") else [],
            "preventive_actions": [],
            "closure_conditions": [],
            "health_impact_notes": None,
            "kpi_impact_notes": None,
            "metadata": {
                "source": "knowledge_recommended_actions",
                "item_key": item.get("item_key"),
                "action_key": item.get("action_key"),
                "action_basis": item.get("action_basis"),
                "priority_hint": item.get("priority_hint") or item.get("priority_default"),
            },
        })

    evidence = []
    for item in bundle.get("evidence_expectations") or []:
        expectation_text = item.get("expectation_text") or item.get("description")
        evidence.append({
            "problem_type_code": problem_type_code,
            "standard_code": first_item.get("standard_code"),
            "control_code": first_item.get("clause_or_control"),
            "evidence_context": item.get("description"),
            "expected_deliverables": [expectation_text] if expectation_text else [],
            "minimum_content": [],
            "accepted_formats": [item.get("evidence_type")] if item.get("evidence_type") else [],
            "invalid_evidence": [],
            "validation_criteria": [],
            "metadata": {
                "source": "knowledge_evidence_expectations",
                "item_key": item.get("item_key"),
                "expectation_key": item.get("expectation_key"),
                "required_level": item.get("required_level"),
            },
        })

    closure = []
    audit_questions = bundle.get("audit_questions") or []
    rules = bundle.get("rules") or []
    if audit_questions or rules:
        closure.append({
            "problem_type_code": problem_type_code,
            "standard_code": first_item.get("standard_code"),
            "control_code": first_item.get("clause_or_control"),
            "title": "Validación humana requerida",
            "required_conditions": [],
            "validation_questions": [
                row.get("question_text") or row.get("question")
                for row in audit_questions
                if row.get("question_text") or row.get("question")
            ],
            "rejection_reasons": [],
            "closure_summary_template": None,
            "requires_effectiveness_validation": None,
            "metadata": {
                "source": "knowledge_audit_questions_and_rules",
                "rule_keys": [row.get("rule_key") for row in rules if row.get("rule_key")],
                "missing_is_not_zero": True,
            },
        })

    return {
        "ok": bundle.get("ok"),
        "problem": problem,
        "playbooks": playbooks,
        "evidence_expectations": evidence,
        "closure_criteria": closure,
        "canonical_bundle": bundle,
    }


def get_tenant_health_context(
    tenant_id: Optional[str] = None,
    standard_code: Optional[str] = None,
    metric_code: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Lee métricas publicadas tenant-scoped desde ai_core.v_tenant_health_context.

    La vista canonica actual es metric-based y no expone agregados por control.
    standard_code se conserva sólo por compatibilidad de firma.
    """
    where = []
    params = []

    if tenant_id:
        where.append("tenant_id = %s::uuid")
        params.append(tenant_id)

    if metric_code:
        where.append("metric_code = %s")
        params.append(metric_code)

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    safe_limit = _canonical_int_limit(limit, default=50)

    return fetch_all(
        f"""
        SELECT
          tenant_id::text AS tenant_id,
          metric_code,
          numeric_value,
          publication_state,
          coverage,
          effective_at
        FROM ai_core.v_tenant_health_context
        {where_sql}
        ORDER BY tenant_id, metric_code, effective_at DESC NULLS LAST
        LIMIT %s
        """,
        [*params, safe_limit],
    )


def get_control_context(
    tenant_id: Optional[str] = None,
    tenant_control_id: Optional[str] = None,
    standard_code: Optional[str] = None,
    context_bucket_filter: Optional[str] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Lee controles tenant-scoped desde ai_core.v_control_context.

    La vista canonica expone identidad operacional/catalogo, codigo, titulo,
    norma e implementation_status. Los buckets de contexto se derivan en
    aplicacion desde implementation_status; no se consulta estado Health legacy.
    """
    where = []
    params = []

    if tenant_id:
        where.append("tenant_id = %s::uuid")
        params.append(tenant_id)

    if tenant_control_id:
        where.append("tenant_control_id = %s::uuid")
        params.append(tenant_control_id)

    if standard_code:
        where.append("standard_code = %s")
        params.append(standard_code)

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    requested_limit = _canonical_int_limit(limit, default=20)
    sql_limit = requested_limit
    if context_bucket_filter:
        sql_limit = max(requested_limit, min(requested_limit * 5, 100))

    rows = fetch_all(
        f"""
        SELECT
          tenant_id::text AS tenant_id,
          tenant_control_id::text AS tenant_control_id,
          catalog_control_id::text AS catalog_control_id,
          code,
          title,
          standard_code,
          implementation_status
        FROM ai_core.v_control_context
        {where_sql}
        ORDER BY tenant_id, standard_code, code
        LIMIT %s
        """,
        [*params, sql_limit],
    )
    return _filter_controls_by_context_bucket(
        _with_control_bucket(rows),
        context_bucket_filter,
        requested_limit,
    )


def get_finding_context(
    tenant_id: Optional[str] = None,
    finding_id: Optional[str] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Lee hallazgos para análisis IA.
    """
    where = []
    params = []

    if tenant_id:
        where.append("tenant_id = %s::uuid")
        params.append(tenant_id)

    if finding_id:
        where.append("finding_id = %s::uuid")
        params.append(finding_id)

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    safe_limit = _canonical_int_limit(limit, default=20)

    return fetch_all(
        f"""
        SELECT
          tenant_id::text AS tenant_id,
          finding_id::text AS finding_id,
          tenant_control_id::text AS tenant_control_id,
          title,
          severity,
          status,
          created_at
        FROM ai_core.v_finding_context
        {where_sql}
        ORDER BY created_at DESC NULLS LAST
        LIMIT %s
        """,
        [*params, safe_limit],
    )


def get_kpi_context(
    tenant_id: Optional[str] = None,
    standard_code: Optional[str] = None,
    metric_code: Optional[str] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Lee metric_snapshots publicados desde ai_core.v_kpi_context.

    La vista canonica actual no expone standard_code ni campos legacy kpi_*.
    standard_code se conserva sólo por compatibilidad de firma.
    """
    where = []
    params = []

    if tenant_id:
        where.append("tenant_id = %s::uuid")
        params.append(tenant_id)

    if metric_code:
        where.append("metric_code = %s")
        params.append(metric_code)

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    safe_limit = _canonical_int_limit(limit, default=20)

    return fetch_all(
        f"""
        SELECT
          tenant_id::text AS tenant_id,
          metric_code,
          numeric_value,
          publication_state,
          coverage,
          effective_at
        FROM ai_core.v_kpi_context
        {where_sql}
        ORDER BY tenant_id, metric_code, effective_at DESC NULLS LAST
        LIMIT %s
        """,
        [*params, safe_limit],
    )


def build_context_pack(
    tenant_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    standard_code: Optional[str] = None,
    allow_standard_fallback: bool = False,
) -> Dict[str, Any]:
    """
    Paquete de contexto general para que la IA deje de responder genérico.
    El scope tenant debe venir autorizado por backend. Sin tenant no consulta vistas.
    """
    if not tenant_id:
        return _empty_tenant_scoped_context(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            standard_code=standard_code,
            reason="tenant_scope_required",
        )

    tenant_health = get_tenant_health_context(
        tenant_id=tenant_id,
        standard_code=standard_code,
        limit=20,
    )

    if allow_standard_fallback and tenant_id and standard_code and not tenant_health:
        tenant_health = get_tenant_health_context(
            tenant_id=tenant_id,
            standard_code=None,
            limit=20,
        )

    critical_controls = get_control_context(
        tenant_id=tenant_id,
        standard_code=standard_code,
        context_bucket_filter="implementation_gap",
        limit=10,
    )

    if allow_standard_fallback and tenant_id and standard_code and not critical_controls:
        critical_controls = get_control_context(
            tenant_id=tenant_id,
            standard_code=None,
            context_bucket_filter="implementation_gap",
            limit=10,
        )

    attention_controls = get_control_context(
        tenant_id=tenant_id,
        standard_code=standard_code,
        context_bucket_filter="implementation_attention",
        limit=10,
    )

    if allow_standard_fallback and tenant_id and standard_code and not attention_controls:
        attention_controls = get_control_context(
            tenant_id=tenant_id,
            standard_code=None,
            context_bucket_filter="implementation_attention",
            limit=10,
        )

    recent_kpis = get_kpi_context(
        tenant_id=tenant_id,
        standard_code=standard_code,
        limit=10,
    )

    if allow_standard_fallback and tenant_id and standard_code and not recent_kpis:
        recent_kpis = get_kpi_context(
            tenant_id=tenant_id,
            standard_code=None,
            limit=10,
        )

    context: Dict[str, Any] = {
        "contract_version": CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
        "tenant_id": tenant_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "standard_code": standard_code,
        "scope_status": "tenant_scoped",
        "tenant_scope_authorized": True,
        "tenant_health": tenant_health,
        "critical_controls": critical_controls,
        "attention_controls": attention_controls,
        "recent_findings": get_finding_context(
            tenant_id=tenant_id,
            finding_id=entity_id if entity_type == "finding" else None,
            limit=10,
        ),
        "recent_kpis": recent_kpis,
        "warnings": [],
        "provenance": {
            "contract_version": CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION,
            "tenant_id": tenant_id,
            "backend_authorized_scope_required": True,
            "health_context_source": "ai_core.v_tenant_health_context",
            "control_context_source": "ai_core.v_control_context",
            "control_context_bucket_source": "implementation_status",
            "standard_fallback_allowed": allow_standard_fallback,
            "no_cross_tenant_fallback": True,
            "missing_is_not_zero": True,
        },
    }

    if entity_type == "control" and entity_id:
        selected_control = get_control_context(
            tenant_id=tenant_id,
            tenant_control_id=entity_id,
            limit=1,
        )

        if not selected_control:
            selected_control = get_control_context(
                tenant_id=tenant_id,
                tenant_control_id=entity_id,
                standard_code=None,
                limit=1,
            )

        context["selected_control"] = selected_control

    return context
