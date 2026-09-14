from typing import Any, Dict, List, Optional

from app.services.ai_core_db import fetch_all, fetch_one

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
    Resumen de conocimiento cargado en ai_core.
    """
    rows = fetch_all(
        """
        SELECT 'problem_types' AS source, COUNT(*)::int AS total FROM ai_core.problem_types
        UNION ALL
        SELECT 'priority_rules', COUNT(*)::int FROM ai_core.priority_rules
        UNION ALL
        SELECT 'solution_playbooks', COUNT(*)::int FROM ai_core.solution_playbooks
        UNION ALL
        SELECT 'evidence_expectations', COUNT(*)::int FROM ai_core.evidence_expectations
        UNION ALL
        SELECT 'closure_criteria', COUNT(*)::int FROM ai_core.closure_criteria
        UNION ALL
        SELECT 'invalid_evidence_patterns', COUNT(*)::int FROM ai_core.invalid_evidence_patterns
        UNION ALL
        SELECT 'response_templates', COUNT(*)::int FROM ai_core.response_templates
        ORDER BY source
        """
    )

    return {
        "ok": True,
        "summary": rows,
    }


def get_problem_knowledge(problem_type_code: str) -> Dict[str, Any]:
    """
    Devuelve el conocimiento experto para un tipo de problema:
    tipo, playbook, evidencia esperada y criterios de cierre.
    """
    problem = fetch_one(
        """
        SELECT
          code,
          name,
          description,
          category,
          default_severity,
          default_priority_weight,
          applies_to,
          metadata
        FROM ai_core.problem_types
        WHERE code = %s
          AND is_active = true
        """,
        [problem_type_code],
    )

    playbooks = fetch_all(
        """
        SELECT
          problem_type_code,
          standard_code,
          control_code,
          title,
          diagnosis_template,
          solution_summary,
          solution_steps,
          corrective_actions,
          preventive_actions,
          closure_conditions,
          health_impact_notes,
          kpi_impact_notes,
          metadata
        FROM ai_core.solution_playbooks
        WHERE problem_type_code = %s
          AND is_active = true
        ORDER BY
          CASE WHEN metadata->>'generic' = 'true' THEN 2 ELSE 1 END,
          id
        LIMIT 5
        """,
        [problem_type_code],
    )

    evidence = fetch_all(
        """
        SELECT
          problem_type_code,
          standard_code,
          control_code,
          evidence_context,
          expected_deliverables,
          minimum_content,
          accepted_formats,
          invalid_evidence,
          validation_criteria,
          metadata
        FROM ai_core.evidence_expectations
        WHERE problem_type_code = %s
          AND is_active = true
        ORDER BY
          CASE WHEN metadata->>'generic' = 'true' THEN 2 ELSE 1 END,
          id
        LIMIT 5
        """,
        [problem_type_code],
    )

    closure = fetch_all(
        """
        SELECT
          problem_type_code,
          standard_code,
          control_code,
          title,
          required_conditions,
          validation_questions,
          rejection_reasons,
          closure_summary_template,
          requires_effectiveness_validation,
          metadata
        FROM ai_core.closure_criteria
        WHERE problem_type_code = %s
          AND is_active = true
        ORDER BY
          CASE WHEN metadata->>'generic' = 'true' THEN 2 ELSE 1 END,
          id
        LIMIT 5
        """,
        [problem_type_code],
    )

    return {
        "ok": problem is not None,
        "problem": problem,
        "playbooks": playbooks,
        "evidence_expectations": evidence,
        "closure_criteria": closure,
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
