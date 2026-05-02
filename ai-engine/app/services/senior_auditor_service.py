from datetime import datetime, timezone
from typing import Any, Dict, List

from app.services.knowledge_loader import get_knowledge_module
from app.services.web_context_service import build_external_context
from app.services.bootstrap_knowledge_service import get_bootstrap_context_for_auditor


def _num(value: Any) -> int:
    try:
        return int(float(value or 0))
    except Exception:
        return 0


def _section(payload: Dict[str, Any], key: str) -> Dict[str, Any]:
    value = payload.get(key)
    return value if isinstance(value, dict) else {}


def _related(entity_type: str, label: str, entity_id: str = "") -> List[Dict[str, str]]:
    return [{"entity_type": entity_type, "entity_id": entity_id, "label": label}]


def _priority(score: int) -> str:
    if score >= 80:
        return "critica"
    if score >= 60:
        return "alta"
    if score >= 40:
        return "media"
    return "baja"


def _confidence(payload: Dict[str, Any]) -> str:
    present = sum(
        1
        for key in [
            "controls_summary",
            "evidence_summary",
            "risks_summary",
            "findings_summary",
            "action_plans_summary",
            "kpi_summary",
            "audit_context",
        ]
        if isinstance(payload.get(key), dict) and payload.get(key)
    )

    if present >= 5:
        return "high"
    if present >= 3:
        return "medium"
    return "low"


def _build_insight(
    insight_type: str,
    title: str,
    summary: str,
    priority: str,
    reason: str,
    action: str,
    entity_type: str,
    label: str,
) -> Dict[str, Any]:
    return {
        "type": insight_type,
        "title": title,
        "summary": summary,
        "priority": priority,
        "confidence": "medium",
        "reason": reason,
        "recommended_action": action,
        "related_entities": _related(entity_type, label),
        "suggested_owner_role": "auditor interno",
        "due_date_suggestion": "Definir segun criticidad y proximidad de auditoria.",
        "should_create_task": insight_type in {"task", "risk_alert", "evidence_gap"},
    }


def analyze_as_senior_auditor(payload: Dict[str, Any]) -> Dict[str, Any]:
    controls = _section(payload, "controls_summary")
    evidence = _section(payload, "evidence_summary")
    risks = _section(payload, "risks_summary")
    findings = _section(payload, "findings_summary")
    action_plans = _section(payload, "action_plans_summary")
    kpis = _section(payload, "kpi_summary")
    audit = _section(payload, "audit_context")

    deteriorated_controls = _num(controls.get("deteriorated_controls"))
    controls_without_evidence = _num(controls.get("controls_without_evidence"))
    old_evidence_count = _num(evidence.get("old_evidence_count"))
    high_residual_risks = _num(risks.get("high_residual_risks"))
    critical_findings = _num(findings.get("critical_findings") or findings.get("open_critical_findings"))
    overdue_actions = _num(action_plans.get("overdue_action_plans") or action_plans.get("overdue"))
    red_kpis = _num(kpis.get("red") or kpis.get("red_kpis"))
    upcoming_audits = _num(audit.get("upcoming_audits") or audit.get("audits_within_30_days"))

    risk_score = min(
        100,
        deteriorated_controls * 18
        + controls_without_evidence * 14
        + old_evidence_count * 8
        + high_residual_risks * 20
        + critical_findings * 16
        + overdue_actions * 12
        + red_kpis * 14
        + upcoming_audits * 6,
    )

    confidence = _confidence(payload)

    if not any([deteriorated_controls, controls_without_evidence, old_evidence_count, high_residual_risks, critical_findings, overdue_actions, red_kpis]):
        overall_status = "sin_datos" if confidence == "low" else "saludable"
    elif risk_score >= 65:
        overall_status = "deteriorado"
    else:
        overall_status = "atencion"

    insights: List[Dict[str, Any]] = []
    suggested_tasks: List[Dict[str, Any]] = []
    audit_observations: List[Dict[str, Any]] = []
    limitations: List[str] = []

    if deteriorated_controls:
        item = _build_insight(
            "report_insight",
            "Controles deteriorados requieren seguimiento",
            f"Se informan {deteriorated_controls} controles deteriorados en el contexto interno.",
            _priority(55 + deteriorated_controls * 10),
            "El estado de salud del control es una senal interna directa de deterioro operativo.",
            "Revisar causa, responsable, evidencia disponible y necesidad de plan de accion.",
            "tenant_control",
            "Controles deteriorados",
        )
        insights.append(item)
        audit_observations.append({
            "type": "brecha",
            "title": "Controles deteriorados",
            "observation": "La auditoria debe revisar diseno, implementacion, operacion y evidencia de los controles deteriorados.",
            "related_entities": item["related_entities"],
        })

    if controls_without_evidence:
        item = _build_insight(
            "evidence_gap",
            "Controles sin evidencia objetiva",
            f"Se detectan {controls_without_evidence} controles sin evidencia asociada.",
            _priority(60 + controls_without_evidence * 10),
            "Un control sin evidencia no permite confirmar operacion efectiva.",
            "Solicitar evidencia objetiva, vigente y trazable para cada control afectado.",
            "evidence",
            "Brecha de evidencia",
        )
        insights.append(item)
        suggested_tasks.append(item)
        audit_observations.append({
            "type": "evidencia_insuficiente",
            "title": "Evidencia insuficiente",
            "observation": "La ausencia de evidencia limita cualquier conclusion de cumplimiento.",
            "related_entities": item["related_entities"],
        })

    if old_evidence_count:
        item = _build_insight(
            "evidence_gap",
            "Evidencias antiguas o con vigencia debil",
            f"Se informan {old_evidence_count} evidencias antiguas.",
            _priority(40 + old_evidence_count * 7),
            "La evidencia antigua puede no demostrar vigencia actual del control.",
            "Actualizar evidencia indicando periodo cubierto, responsable y control respaldado.",
            "evidence",
            "Evidencia antigua",
        )
        insights.append(item)
        suggested_tasks.append(item)

    if high_residual_risks:
        item = _build_insight(
            "risk_alert",
            "Riesgos residuales altos",
            f"Se detectan {high_residual_risks} riesgos residuales altos.",
            _priority(70 + high_residual_risks * 10),
            "Un riesgo residual alto requiere tratamiento, controles efectivos y seguimiento ejecutivo.",
            "Validar controles asociados, tratamiento, responsable, fecha objetivo y evidencias de avance.",
            "risk",
            "Riesgos residuales altos",
        )
        insights.append(item)
        suggested_tasks.append(item)
        audit_observations.append({
            "type": "riesgo_relevante",
            "title": "Riesgo alto con potencial impacto",
            "observation": "El auditor debe cruzar estos riesgos con controles, hallazgos y planes de accion abiertos.",
            "related_entities": item["related_entities"],
        })

    if overdue_actions:
        item = _build_insight(
            "task",
            "Planes de accion vencidos",
            f"Existen {overdue_actions} planes de accion vencidos o atrasados.",
            _priority(65 + overdue_actions * 8),
            "Un plan vencido puede evidenciar debilidad de seguimiento o cierre de brechas.",
            "Regularizar estado, definir nuevo compromiso y adjuntar evidencia de avance o cierre.",
            "action_plan",
            "Planes vencidos",
        )
        insights.append(item)
        suggested_tasks.append(item)

    if red_kpis:
        item = _build_insight(
            "report_insight",
            "KPIs criticos",
            f"Se informan {red_kpis} KPIs en estado critico.",
            _priority(55 + red_kpis * 10),
            "Los KPIs criticos reflejan deterioro o insuficiencia de datos frente al umbral definido.",
            "Revisar fuente, periodo, tendencia, responsable y accion correctiva asociada.",
            "kpi",
            "KPIs criticos",
        )
        insights.append(item)

    if upcoming_audits and (deteriorated_controls or controls_without_evidence or high_residual_risks):
        suggested_tasks.append(_build_insight(
            "task",
            "Preparar auditoria con foco en brechas criticas",
            "Existen senales internas relevantes y auditorias proximas.",
            "alta",
            "La proximidad de auditoria aumenta la urgencia de controles deteriorados, evidencias faltantes y riesgos altos.",
            "Preparar paquete de evidencia, responsables y estado de planes antes de la auditoria.",
            "audit",
            "Preparacion de auditoria",
        ))

    for key, label in [
        ("controls_summary", "No se recibio resumen de controles."),
        ("evidence_summary", "No se recibio resumen de evidencias."),
        ("risks_summary", "No se recibio resumen de riesgos."),
        ("findings_summary", "No se recibio resumen de hallazgos."),
        ("action_plans_summary", "No se recibio resumen de planes de accion."),
        ("kpi_summary", "No se recibio resumen de KPIs."),
        ("audit_context", "No se recibio contexto de auditoria."),
    ]:
        if not isinstance(payload.get(key), dict) or not payload.get(key):
            limitations.append(label)

    if not insights:
        insights.append({
            "type": "report_insight",
            "title": "Sin senales criticas suficientes",
            "summary": "Con los datos recibidos no se identifican brechas criticas concretas.",
            "priority": "baja",
            "confidence": confidence,
            "reason": "La salida depende estrictamente de los resumenes internos recibidos.",
            "recommended_action": "Completar datos internos si se requiere una conclusion de auditoria mas robusta.",
            "related_entities": [],
            "suggested_owner_role": "auditor interno",
            "due_date_suggestion": "No aplica.",
            "should_create_task": False,
        })

    bootstrap_knowledge_context = get_bootstrap_context_for_auditor(payload)
    external_context = build_external_context(payload)

    knowledge_modules = {
        "audit": list(get_knowledge_module("audit").keys()),
        "evidence": list(get_knowledge_module("evidence").keys()),
        "risk": list(get_knowledge_module("risk").keys()),
        "tasks": list(get_knowledge_module("tasks").keys()),
        "web_context": list(get_knowledge_module("web_context").keys()),
    }

    return {
        "tenant_id": (_section(payload, "tenant_context").get("tenant_id") or payload.get("tenant_id") or ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "module": payload.get("requested_output") or "global",
        "summary": {
            "overall_status": overall_status,
            "executive_message": (
                "El analisis se basa en datos internos del tenant. "
                f"Estado estimado: {overall_status}. "
                "Las conclusiones deben validarse contra evidencias, riesgos, hallazgos, planes y KPIs disponibles."
            ),
            "confidence": confidence,
        },
        "insights": insights,
        "suggested_tasks": suggested_tasks,
        "audit_observations": audit_observations,
        "limitations": limitations,
        "bootstrap_knowledge_context": bootstrap_knowledge_context,
        "external_context": external_context,
        "knowledge": {
            "used": True,
            "modules": knowledge_modules,
            "bootstrap_used": bool(bootstrap_knowledge_context.get("used")),
        },
        "guardrails": [
            "No se declara cumplimiento total sin evidencia suficiente.",
            "El conocimiento bootstrap aprobado es contexto general y no reemplaza evidencia interna.",
            "La informacion externa no reemplaza los datos internos del tenant.",
            "Las posibles no conformidades requieren validacion de auditor humano.",
        ],
    }
