from typing import Any, Dict, List, Optional

try:
    import knowledge_client as legacy_knowledge
except Exception:
    legacy_knowledge = None

from app.services.response_adapter import (
    executive_recommendations_to_legacy_response,
    guided_solution_to_legacy_response,
    guided_solution_to_text,
)
from app.services.solution_engine import (
    generate_executive_recommendations,
    generate_guided_solution,
)


def _safe_legacy_call(function_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ejecuta la lógica antigua si está disponible.
    Si falla, no rompe el endpoint: devuelve estructura mínima.
    """
    if legacy_knowledge is None:
        return {
            "ok": True,
            "source": "legacy_unavailable",
        }

    try:
        fn = getattr(legacy_knowledge, function_name, None)

        if not callable(fn):
            return {
                "ok": True,
                "source": "legacy_function_unavailable",
            }

        result = fn(payload)

        if isinstance(result, dict):
            return result

        return {
            "ok": True,
            "legacy_result": result,
            "source": "legacy_non_dict",
        }
    except Exception as error:
        return {
            "ok": True,
            "source": "legacy_error_fallback",
            "legacy_error": str(error),
        }


def _first_standard(payload: Dict[str, Any]) -> Optional[str]:
    if payload.get("iso_code"):
        return payload.get("iso_code")

    if payload.get("standard_code"):
        return payload.get("standard_code")

    standards = payload.get("standards") or []

    if isinstance(standards, list) and standards:
        return standards[0]

    return None


def _join_text(*values: Any) -> str:
    parts = []

    for value in values:
        if value is None:
            continue

        if isinstance(value, list):
            parts.extend([str(item) for item in value if item])
            continue

        if isinstance(value, dict):
            parts.extend([str(item) for item in value.values() if item])
            continue

        value_str = str(value).strip()

        if value_str:
            parts.append(value_str)

    return " | ".join(parts)





def _infer_forced_problem_type(user_text: str, endpoint_type: str = "") -> Optional[str]:
    """
    Regla de negocio:
    El texto explícito del usuario debe pesar más que señales globales del tenant.
    Esto evita que la IA caiga en evidence_management cuando hay señales claras
    de proveedor, calibración, ambiente, inocuidad, SLA, privacidad, etc.
    """
    t = (user_text or "").lower()

    access_terms = [
        "revisión de accesos", "revision de accesos", "accesos privilegiados",
        "usuarios privilegiados", "matriz de accesos", "perfiles", "privilegios"
    ]

    supplier_terms = [
        "proveedor", "proveedores", "proveedor crítico", "proveedor critico",
        "evaluación del proveedor", "evaluacion del proveedor",
        "evaluación periódica del proveedor", "evaluacion periodica del proveedor",
        "reevaluación", "reevaluacion", "homologación", "homologacion"
    ]

    calibration_terms = [
        "calibración", "calibracion", "certificado de calibración",
        "certificado de calibracion", "trazabilidad metrológica",
        "trazabilidad metrologica", "metrología", "metrologia",
        "equipo crítico", "equipo critico"
    ]

    environmental_terms = [
        "ambiental", "permiso ambiental", "matriz legal ambiental",
        "aspecto ambiental", "impacto ambiental", "residuo",
        "monitoreo ambiental"
    ]

    food_terms = [
        "inocuidad", "pcc", "oprp", "haccp", "prerrequisito",
        "monitoreo del pcc", "desviaciones", "lote", "trazabilidad de lote"
    ]

    energy_terms = [
        "energético", "energetico", "energía", "energia",
        "desempeño energético", "desempeno energetico",
        "consumo", "uso significativo de energía"
    ]

    sla_terms = [
        "sla", "ola", "nivel de servicio", "niveles de servicio",
        "tiempo de respuesta", "tickets fuera de plazo",
        "disponibilidad"
    ]

    privacy_terms = [
        "privacidad", "datos personales", "tratamiento de datos",
        "titular", "consentimiento", "pii"
    ]

    emergency_terms = [
        "simulacro", "emergencia", "plan de emergencia",
        "evacuación", "evacuacion", "respuesta ante emergencias"
    ]

    legal_terms = [
        "obligación legal", "obligacion legal", "obligación regulatoria",
        "obligacion regulatoria", "matriz legal", "requisito legal",
        "cumplimiento legal", "regulatoria", "regulatorio"
    ]

    weak_evidence_terms = [
        "captura sin fecha", "sin fecha", "sin responsable", "sin resultado",
        "evidencia insuficiente", "evidencia débil", "evidencia debil",
        "captura", "pantallazo"
    ]

    expired_terms = [
        "vencida", "vencido", "desactualizada", "desactualizado",
        "no vigente", "periodo anterior", "caducado", "caducada"
    ]

    missing_evidence_terms = [
        "no existe evidencia", "sin evidencia", "falta evidencia",
        "no hay evidencia", "sin respaldo", "falta respaldo",
        "no se evidencia"
    ]

    procedure_terms = [
        "procedimiento inexistente", "no existe procedimiento",
        "sin procedimiento", "no está documentado", "no esta documentado"
    ]

    kpi_terms = [
        "kpi", "indicador", "métrica", "metrica", "indicadores",
        "deteriorado", "bajo", "incumplimiento"
    ]

    risk_terms = [
        "riesgo sin tratamiento", "sin tratamiento", "evaluación de riesgo",
        "evaluacion de riesgo", "riesgo de privacidad", "controles definidos"
    ]

    control_not_executed_terms = [
        "control no ejecutado", "no ejecutado", "no se ejecutó",
        "no se ejecuto", "no existe registro de monitoreo",
        "no existe registro", "sin monitoreo"
    ]

    if any(term in t for term in access_terms):
        return "access_review_missing"

    if any(term in t for term in supplier_terms):
        return "supplier_without_evaluation"

    if any(term in t for term in sla_terms):
        return "kpi_deteriorated"

    if any(term in t for term in energy_terms) and any(term in t for term in kpi_terms):
        return "kpi_deteriorated"

    if any(term in t for term in privacy_terms) and any(term in t for term in risk_terms):
        return "risk_without_treatment"

    if any(term in t for term in emergency_terms):
        return "procedure_not_implemented"

    if any(term in t for term in food_terms) and any(term in t for term in control_not_executed_terms):
        return "control_not_executed"

    if any(term in t for term in calibration_terms) and any(term in t for term in expired_terms):
        return "expired_evidence"

    if any(term in t for term in environmental_terms) and any(term in t for term in expired_terms):
        return "expired_evidence"

    if any(term in t for term in legal_terms) and any(term in t for term in expired_terms + missing_evidence_terms):
        return "expired_evidence"

    if any(term in t for term in control_not_executed_terms):
        return "control_not_executed"

    if any(term in t for term in weak_evidence_terms):
        return "weak_evidence"

    if any(term in t for term in expired_terms):
        return "expired_evidence"

    if any(term in t for term in procedure_terms):
        return "procedure_missing"

    if any(term in t for term in kpi_terms):
        return "kpi_deteriorated"

    if any(term in t for term in missing_evidence_terms):
        return "missing_evidence"

    return None


def _infer_forced_domain_code(
    user_text: str,
    standard_code: Optional[str] = None,
    problem_type_code: Optional[str] = None,
) -> Optional[str]:
    """
    Fuerza dominio cuando el texto del caso es explícito.
    Esto evita que el contexto global del tenant arrastre el caso hacia accesos,
    evidencia genérica o KPI genérico.
    """
    t = (user_text or "").lower()
    standard = (standard_code or "").upper()

    if any(term in t for term in [
        "revisión de accesos", "revision de accesos", "accesos privilegiados",
        "usuarios privilegiados", "matriz de accesos", "privilegios"
    ]):
        return "access_management"

    if any(term in t for term in [
        "proveedor", "proveedores", "proveedor crítico", "proveedor critico",
        "evaluación periódica del proveedor", "evaluacion periodica del proveedor",
        "reevaluación", "reevaluacion", "homologación", "homologacion"
    ]):
        return "supplier_management"

    if any(term in t for term in [
        "calibración", "calibracion", "certificado de calibración",
        "certificado de calibracion", "trazabilidad metrológica",
        "trazabilidad metrologica", "metrología", "metrologia"
    ]):
        return "calibration_metrological_traceability"

    if any(term in t for term in [
        "permiso ambiental", "matriz legal ambiental", "ambiental",
        "aspecto ambiental", "impacto ambiental", "monitoreo ambiental"
    ]):
        return "environmental_management"

    if any(term in t for term in [
        "inocuidad", "pcc", "oprp", "haccp", "monitoreo del pcc",
        "trazabilidad de lote", "prerrequisito"
    ]):
        return "food_safety"

    if any(term in t for term in [
        "desempeño energético", "desempeno energetico", "energético",
        "energetico", "energía", "energia", "consumo"
    ]):
        return "energy_asset_performance"

    if any(term in t for term in [
        "sla", "ola", "nivel de servicio", "niveles de servicio",
        "tiempo de respuesta", "tickets fuera de plazo", "disponibilidad"
    ]):
        return "service_level_management"

    if any(term in t for term in [
        "privacidad", "datos personales", "tratamiento de datos",
        "titular", "pii", "consentimiento"
    ]):
        return "privacy_personal_data"

    if any(term in t for term in [
        "simulacro", "emergencia", "plan de emergencia",
        "evacuación", "evacuacion", "respuesta ante emergencias"
    ]):
        return "emergency_preparedness"

    if any(term in t for term in [
        "obligación legal", "obligacion legal", "obligación regulatoria",
        "obligacion regulatoria", "matriz legal", "requisito legal",
        "cumplimiento legal", "regulatoria", "regulatorio"
    ]):
        return "legal_regulatory_compliance"

    if problem_type_code == "supplier_without_evaluation":
        return "supplier_management"

    if problem_type_code == "access_review_missing":
        return "access_management"

    if problem_type_code == "backup_restore_test_missing":
        return "backup_restore"

    if problem_type_code == "risk_without_treatment":
        if standard in {"ISO27701", "ISO27018"}:
            return "privacy_personal_data"
        return "risk_management"

    if problem_type_code == "kpi_deteriorated":
        if standard == "ISO50001":
            return "energy_asset_performance"
        if standard == "ISO20000-1":
            return "service_level_management"
        return "kpi_management"

    if problem_type_code == "expired_evidence":
        if standard in {"ISO17025", "ISO15189"}:
            return "calibration_metrological_traceability"
        if standard in {"ISO14001", "ISO14025"}:
            return "environmental_management"
        if standard in {"ISO37301", "ISO37001"}:
            return "legal_regulatory_compliance"

    if problem_type_code == "control_not_executed":
        if standard in {"ISO22000", "ISO22002"}:
            return "food_safety"
        return "operational_control"

    if problem_type_code == "procedure_not_implemented":
        if standard == "ISO45001":
            return "emergency_preparedness"
        return "operational_control"

    return None



def _dedupe(items: List[Any], limit: int = 10) -> List[str]:
    out: List[str] = []
    seen = set()

    for item in items:
        if item is None:
            continue

        value = str(item).strip()

        if not value:
            continue

        key = value.lower()

        if key in seen:
            continue

        seen.add(key)
        out.append(value)

        if len(out) >= limit:
            break

    return out


def _priority_from_guided(guided: Dict[str, Any], fallback: str = "Media") -> str:
    severity = str((guided.get("problem") or {}).get("severity") or "").lower()

    if severity in {"critica", "crítica", "alta", "high", "critical"}:
        return "Alta"

    if severity in {"baja", "low"}:
        return "Baja"

    return fallback or "Media"


def _make_action_plan_steps(solution: Dict[str, Any]) -> List[Dict[str, Any]]:
    actions = solution.get("concrete_actions") or []
    deliverables = solution.get("expected_deliverables") or []
    minimum = solution.get("minimum_content") or []
    closure = solution.get("closure_conditions") or []

    steps: List[Dict[str, Any]] = []

    if actions:
        for index, action in enumerate(actions[:5], start=1):
            steps.append({
                "step": index,
                "title": f"Ejecutar acción {index}",
                "owner_role": "Responsable del proceso",
                "target_days": 5 if index <= 2 else 10,
                "description": str(action),
            })

    if not steps:
        steps = [
            {
                "step": 1,
                "title": "Confirmar brecha y alcance",
                "owner_role": "Responsable del proceso",
                "target_days": 3,
                "description": "Confirmar el problema, el control afectado, el periodo aplicable y el responsable de tratamiento.",
            },
            {
                "step": 2,
                "title": "Ejecutar corrección",
                "owner_role": "Dueño del control",
                "target_days": 7,
                "description": "Ejecutar la corrección necesaria y documentar el resultado.",
            },
            {
                "step": 3,
                "title": "Adjuntar evidencia objetiva",
                "owner_role": "Administrador de cumplimiento",
                "target_days": 10,
                "description": "Cargar evidencia suficiente con fecha, responsable, periodo, resultado y aprobación.",
            },
        ]

    if deliverables:
        steps.append({
            "step": len(steps) + 1,
            "title": "Preparar entregables de cierre",
            "owner_role": "Responsable documental",
            "target_days": 10,
            "description": "Preparar y cargar: " + ", ".join([str(x) for x in deliverables[:6]]) + ".",
        })

    if minimum:
        steps.append({
            "step": len(steps) + 1,
            "title": "Validar contenido mínimo",
            "owner_role": "Administrador de cumplimiento",
            "target_days": 12,
            "description": "Verificar que la evidencia incluya: " + ", ".join([str(x) for x in minimum[:8]]) + ".",
        })

    if closure:
        steps.append({
            "step": len(steps) + 1,
            "title": "Validar criterio de cierre",
            "owner_role": "Auditor interno / administrador",
            "target_days": 15,
            "description": "Confirmar criterio de cierre: " + ", ".join([str(x) for x in closure[:6]]) + ".",
        })

    return steps[:8]




def _clean_public_response(response: Dict[str, Any]) -> Dict[str, Any]:
    """
    Limpieza final de salida pública:
    - conserva compatibilidad
    - conserva structured_guided
    - evita que knowledge_context legacy domine visualmente
    - deduplica listas principales
    """
    def norm(value: Any) -> str:
        text = str(value or "").strip().lower()
        replacements = {
            "acta de revisión de accesos": "acta de revisión",
            "registro de accesos modificados o eliminados": "registro de accesos corregidos",
            "registro de accesos eliminados o corregidos": "registro de accesos corregidos",
            "aprobación del dueño del sistema": "aprobación del responsable",
            "matriz de accesos vigente": "matriz vigente",
            "no hay cambios documentados": "sin cambios documentados",
            "no hay aprobación": "sin aprobación",
        }

        for old, new in replacements.items():
            text = text.replace(old, new)

        return " ".join(text.split())

    def dedupe(items: Any, limit: int = 10) -> List[Any]:
        out = []
        seen = set()

        if not isinstance(items, list):
            return items

        for item in items:
            key = norm(item)

            if not key or key in seen:
                continue

            seen.add(key)
            out.append(item)

            if len(out) >= limit:
                break

        return out

    for key, limit in {
        "likely_causes": 6,
        "recommended_actions": 7,
        "expected_deliverables": 8,
        "minimum_content": 10,
        "invalid_evidence": 8,
        "closure_conditions": 7,
    }.items():
        if key in response:
            response[key] = dedupe(response.get(key), limit)

    # Mantener trazabilidad legacy pero no sobreexponerla como bloque principal.
    if response.get("source") == "ai-engine-guided-v2" and response.get("structured_guided"):
        response["legacy_knowledge_sources"] = response.pop("knowledge_sources", [])
        response["legacy_knowledge_context"] = response.pop("knowledge_context", None)

    return response


def generate_health_summary(payload: Dict[str, Any]) -> Dict[str, Any]:
    legacy = _safe_legacy_call("generate_health_summary", payload)

    tenant_id = payload.get("tenant_id")
    standard_code = _first_standard(payload)

    executive = generate_executive_recommendations(
        tenant_id=tenant_id,
        standard_code=standard_code,
    )

    executive_legacy = executive_recommendations_to_legacy_response(executive)

    priorities = executive.get("top_priorities") or []
    guided_suggestions = _dedupe(
        [
            item.get("recommended_action")
            for item in priorities
            if isinstance(item, dict)
        ],
        limit=5,
    )

    fallback_suggestions = legacy.get("suggestions") or []

    response = {
        **legacy,
        "ok": True,
        "type": "health_summary",
        "summary": legacy.get("summary") or executive_legacy.get("summary"),
        "suggestions": guided_suggestions or fallback_suggestions,
        "confidence": "alta",
        "source": "ai-engine-guided-v2",
        "guided_recommendation": executive_legacy.get("recommendation"),
        "top_priorities": priorities,
        "structured_guided": executive,
        "legacy_source": legacy.get("source"),
    }

    return _clean_public_response(response)


def generate_finding_analysis(payload: Dict[str, Any]) -> Dict[str, Any]:
    legacy = _safe_legacy_call("generate_finding_analysis", payload)

    tenant_id = payload.get("tenant_id")
    finding_id = payload.get("finding_id")
    standard_code = _first_standard(payload)

    user_text = _join_text(
        payload.get("title"),
        payload.get("description"),
        payload.get("severity"),
        payload.get("status"),
        payload.get("owner"),
        payload.get("due_date"),
    )

    guided = generate_guided_solution(
        user_text=user_text,
        tenant_id=tenant_id,
        entity_type="finding",
        entity_id=finding_id,
        standard_code=standard_code,
        forced_problem_type=_infer_forced_problem_type(user_text, "finding"),
        forced_domain_code=_infer_forced_domain_code(user_text, standard_code, _infer_forced_problem_type(user_text, "finding")),
    )

    adapted = guided_solution_to_legacy_response(guided)
    solution = guided.get("solution") or {}

    recommended_actions = _dedupe(
        (solution.get("concrete_actions") or [])
        + (solution.get("corrective_actions") or []),
        limit=8,
    )

    likely_causes = _dedupe(
        (solution.get("rejection_reasons") or []),
        limit=6,
    )

    response = {
        **legacy,
        "ok": True,
        "type": "finding_analysis",
        "summary": adapted.get("summary") or legacy.get("summary"),
        "impact": solution.get("compliance_impact") or legacy.get("impact"),
        "priority": _priority_from_guided(guided, legacy.get("priority", "Media")),
        "likely_causes": likely_causes,
        "recommended_actions": recommended_actions,
        "expected_deliverables": solution.get("expected_deliverables") or [],
        "minimum_content": solution.get("minimum_content") or [],
        "invalid_evidence": solution.get("invalid_evidence") or [],
        "closure_conditions": solution.get("closure_conditions") or [],
        "health_impact": solution.get("health_impact"),
        "kpi_impact": solution.get("kpi_impact"),
        "next_best_action": solution.get("next_best_action"),
        "guided_recommendation": adapted.get("recommendation"),
        "confidence": adapted.get("confidence") or "alta",
        "source": "ai-engine-guided-v2",
        "structured_guided": guided,
        "legacy_source": legacy.get("source"),
    }

    return _clean_public_response(response)


def generate_nonconformity_draft(payload: Dict[str, Any]) -> Dict[str, Any]:
    legacy = _safe_legacy_call("generate_nonconformity_draft", payload)

    tenant_id = payload.get("tenant_id")
    standard_code = _first_standard(payload)

    user_text = _join_text(
        payload.get("title"),
        payload.get("description"),
        payload.get("severity"),
        payload.get("clause"),
        payload.get("category"),
        payload.get("control_description"),
        "no conformidad",
    )

    guided = generate_guided_solution(
        user_text=user_text,
        tenant_id=tenant_id,
        entity_type="nonconformity",
        entity_id=payload.get("finding_id"),
        standard_code=standard_code,
        forced_problem_type=_infer_forced_problem_type(user_text, "nonconformity"),
        forced_domain_code=_infer_forced_domain_code(user_text, standard_code, _infer_forced_problem_type(user_text, "nonconformity")),
    )

    adapted = guided_solution_to_legacy_response(guided)
    solution = guided.get("solution") or {}
    problem = guided.get("problem") or {}

    expected = solution.get("expected_deliverables") or []
    minimum = solution.get("minimum_content") or []
    closure = solution.get("closure_conditions") or []

    objective_evidence = (
        "Para cerrar correctamente se espera entregar: "
        + ", ".join([str(x) for x in expected[:8]])
        + ". La evidencia debe contener: "
        + ", ".join([str(x) for x in minimum[:10]])
        + "."
        if expected or minimum
        else legacy.get("objective_evidence")
    )

    immediate_correction = (
        solution.get("next_best_action")
        or legacy.get("immediate_correction")
        or "Corregir la desviación y adjuntar evidencia objetiva suficiente."
    )

    corrective_actions = solution.get("corrective_actions") or solution.get("concrete_actions") or []
    corrective_action = " | ".join([str(x) for x in corrective_actions[:5]]) or legacy.get("corrective_action")

    response = {
        **legacy,
        "ok": True,
        "type": "nonconformity_draft",
        "draft_title": legacy.get("draft_title") or f"No conformidad - {standard_code or 'Norma'} - {payload.get('title', 'Sin título')}",
        "statement": (
            legacy.get("statement")
            or f"Se evidencia una desviación relacionada con {problem.get('name') or 'el requisito evaluado'}."
        ),
        "objective_evidence": objective_evidence,
        "risk_statement": solution.get("compliance_impact") or legacy.get("risk_statement"),
        "immediate_correction": immediate_correction,
        "corrective_action": corrective_action,
        "expected_deliverables": expected,
        "minimum_content": minimum,
        "invalid_evidence": solution.get("invalid_evidence") or [],
        "closure_conditions": closure,
        "guided_recommendation": adapted.get("recommendation"),
        "confidence": adapted.get("confidence") or "alta",
        "source": "ai-engine-guided-v2",
        "structured_guided": guided,
        "legacy_source": legacy.get("source"),
    }

    return _clean_public_response(response)


def generate_action_plan(payload: Dict[str, Any]) -> Dict[str, Any]:
    legacy = _safe_legacy_call("generate_action_plan", payload)

    tenant_id = payload.get("tenant_id")
    standard_code = _first_standard(payload)

    user_text = _join_text(
        payload.get("title"),
        payload.get("description"),
        payload.get("severity"),
        payload.get("status"),
        "plan de acción",
    )

    guided = generate_guided_solution(
        user_text=user_text,
        tenant_id=tenant_id,
        entity_type="action_plan",
        entity_id=payload.get("finding_id"),
        standard_code=standard_code,
        forced_problem_type=_infer_forced_problem_type(user_text, "action_plan"),
        forced_domain_code=_infer_forced_domain_code(user_text, standard_code, _infer_forced_problem_type(user_text, "action_plan")),
    )

    adapted = guided_solution_to_legacy_response(guided)
    solution = guided.get("solution") or {}

    action_plan = _make_action_plan_steps(solution)

    immediate_actions = _dedupe(
        (solution.get("concrete_actions") or [])
        + (legacy.get("immediate_actions") or []),
        limit=8,
    )

    success_criteria = _dedupe(
        (solution.get("closure_conditions") or [])
        + (solution.get("validation_criteria") or [])
        + (legacy.get("success_criteria") or []),
        limit=10,
    )

    objective = (
        solution.get("solution_summary")
        or legacy.get("objective")
        or "Resolver la brecha con acción, responsable, evidencia objetiva y validación de cierre."
    )

    response = {
        **legacy,
        "ok": True,
        "type": "action_plan_suggestion",
        "priority": _priority_from_guided(guided, legacy.get("priority", "Media")),
        "objective": objective,
        "immediate_actions": immediate_actions,
        "action_plan": action_plan,
        "success_criteria": success_criteria,
        "expected_deliverables": solution.get("expected_deliverables") or [],
        "minimum_content": solution.get("minimum_content") or [],
        "invalid_evidence": solution.get("invalid_evidence") or [],
        "closure_conditions": solution.get("closure_conditions") or [],
        "health_impact": solution.get("health_impact"),
        "kpi_impact": solution.get("kpi_impact"),
        "guided_recommendation": adapted.get("recommendation"),
        "confidence": adapted.get("confidence") or "alta",
        "source": "ai-engine-guided-v2",
        "structured_guided": guided,
        "legacy_source": legacy.get("source"),
    }

    return _clean_public_response(response)


def generate_executive_brief(payload: Dict[str, Any]) -> Dict[str, Any]:
    legacy = _safe_legacy_call("generate_executive_brief", payload)

    tenant_id = payload.get("tenant_id")
    standard_code = _first_standard(payload)

    executive = generate_executive_recommendations(
        tenant_id=tenant_id,
        standard_code=standard_code,
    )

    adapted = executive_recommendations_to_legacy_response(executive)

    priorities = executive.get("top_priorities") or []

    top_priorities = _dedupe(
        [
            item.get("recommended_action") or item.get("title")
            for item in priorities
            if isinstance(item, dict)
        ],
        limit=8,
    )

    management_actions = _dedupe(
        [
            item.get("reason")
            for item in priorities
            if isinstance(item, dict) and item.get("reason")
        ],
        limit=8,
    )

    response = {
        **legacy,
        "ok": True,
        "type": "executive_brief",
        "headline": legacy.get("headline") or f"Resumen ejecutivo IA - {payload.get('tenant_name', 'Cliente')}",
        "executive_summary": legacy.get("executive_summary") or adapted.get("summary"),
        "top_priorities": top_priorities,
        "management_actions": management_actions,
        "guided_recommendation": adapted.get("recommendation"),
        "structured_guided": executive,
        "confidence": "alta",
        "source": "ai-engine-guided-v2",
        "legacy_source": legacy.get("source"),
    }

    return response
