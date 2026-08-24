from typing import Any, Dict, List, Optional

from app.services.ai_core_db import fetch_all, fetch_one

CANONICAL_INTELLIGENCE_CONTEXT_CONTRACT_VERSION = "canonical-intelligence-context-v1"


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
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Lee resumen de salud por tenant/norma desde vista ai_core.
    """
    where = []
    params = []

    if tenant_id:
        where.append("tenant_id = %s")
        params.append(tenant_id)

    if standard_code:
        where.append("standard_code = %s")
        params.append(standard_code)

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    return fetch_all(
        f"""
        SELECT
          tenant_id,
          tenant_name,
          standard_code,
          total_controls,
          healthy_controls,
          attention_controls,
          deteriorated_controls,
          total_evidences,
          total_findings,
          total_action_plans,
          healthy_percentage
        FROM ai_core.v_tenant_health_context
        {where_sql}
        ORDER BY tenant_name, standard_code
        LIMIT %s
        """,
        [*params, limit],
    )


def get_control_context(
    tenant_id: Optional[str] = None,
    tenant_control_id: Optional[str] = None,
    standard_code: Optional[str] = None,
    health_status: Optional[str] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Lee controles enriquecidos para análisis IA.
    """
    where = []
    params = []

    if tenant_id:
        where.append("tenant_id = %s")
        params.append(tenant_id)

    if tenant_control_id:
        where.append("tenant_control_id = %s")
        params.append(tenant_control_id)

    if standard_code:
        where.append("standard_code = %s")
        params.append(standard_code)

    if health_status:
        where.append("lower(coalesce(health_status, '')) = lower(%s)")
        params.append(health_status)

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    return fetch_all(
        f"""
        SELECT
          tenant_control_id,
          tenant_id,
          tenant_name,
          standard_code,
          control_code,
          control_title,
          control_description,
          control_category,
          status,
          score,
          health_status,
          responsible_user_id,
          last_reviewed_at,
          due_date,
          priority,
          applicability,
          evidence_count,
          finding_count,
          action_plan_count
        FROM ai_core.v_control_context
        {where_sql}
        ORDER BY
          CASE
            WHEN lower(coalesce(health_status, '')) IN ('deteriorado', 'red', 'critical') THEN 1
            WHEN lower(coalesce(health_status, '')) IN ('atencion', 'atención', 'warning', 'yellow') THEN 2
            ELSE 3
          END,
          evidence_count ASC,
          finding_count DESC
        LIMIT %s
        """,
        [*params, limit],
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
        where.append("tenant_id = %s")
        params.append(tenant_id)

    if finding_id:
        where.append("finding_id = %s")
        params.append(finding_id)

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    return fetch_all(
        f"""
        SELECT
          finding_id,
          tenant_id,
          tenant_control_id,
          control_id,
          title,
          description,
          severity,
          status,
          finding_type,
          responsible_user_id,
          due_date,
          closed_at,
          created_at
        FROM ai_core.v_finding_context
        {where_sql}
        ORDER BY created_at DESC NULLS LAST
        LIMIT %s
        """,
        [*params, limit],
    )


def get_kpi_context(
    tenant_id: Optional[str] = None,
    standard_code: Optional[str] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Lee KPIs para análisis IA.
    """
    where = []
    params = []

    if tenant_id:
        where.append("tenant_id = %s")
        params.append(tenant_id)

    if standard_code:
        where.append("standard_code = %s")
        params.append(standard_code)

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    return fetch_all(
        f"""
        SELECT
          kpi_snapshot_id,
          tenant_id,
          standard_code,
          kpi_code,
          kpi_name,
          kpi_category,
          period_type,
          period_start,
          period_end,
          value,
          calculated_value,
          score,
          status_color,
          calculated_at
        FROM ai_core.v_kpi_context
        {where_sql}
        ORDER BY calculated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT %s
        """,
        [*params, limit],
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
        health_status="deteriorado",
        limit=10,
    )

    if allow_standard_fallback and tenant_id and standard_code and not critical_controls:
        critical_controls = get_control_context(
            tenant_id=tenant_id,
            standard_code=None,
            health_status="deteriorado",
            limit=10,
        )

    attention_controls = get_control_context(
        tenant_id=tenant_id,
        standard_code=standard_code,
        health_status="atencion",
        limit=10,
    )

    if allow_standard_fallback and tenant_id and standard_code and not attention_controls:
        attention_controls = get_control_context(
            tenant_id=tenant_id,
            standard_code=None,
            health_status="atencion",
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
