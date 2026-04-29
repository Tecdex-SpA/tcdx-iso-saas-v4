from typing import Any, Dict, List


def normalize_severity(value: str) -> str:
    normalized = str(value or "").strip().lower()

    if normalized in ["critical", "critico", "crítico", "alta", "alto", "high"]:
        return "alta"
    if normalized in ["media", "medio", "medium"]:
        return "media"
    if normalized in ["baja", "bajo", "low"]:
        return "baja"

    return "media"


def build_health_summary(payload: Dict[str, Any]) -> Dict[str, Any]:
    tenant_name = payload.get("tenant_name", "Cliente")
    standards = payload.get("standards", [])
    controls_total = int(payload.get("controls_total", 0) or 0)
    controls_warning = int(payload.get("controls_warning", 0) or 0)
    controls_critical = int(payload.get("controls_critical", 0) or 0)
    evidences_pending = int(payload.get("evidences_pending", 0) or 0)
    findings_critical = int(payload.get("findings_critical", 0) or 0)

    standards_text = ", ".join(standards) if standards else "sin normas activas"

    summary = (
        f"{tenant_name} mantiene {controls_total} controles dentro del alcance activo "
        f"de {standards_text}. Hoy existen {controls_warning} controles en atención, "
        f"{controls_critical} deteriorados, {evidences_pending} evidencias pendientes "
        f"y {findings_critical} hallazgos críticos."
    )

    suggestions = []

    if evidences_pending > 0:
        suggestions.append(
            f"Regularizar {evidences_pending} evidencias pendientes, priorizando controles con mayor impacto."
        )

    if controls_warning > 0:
        suggestions.append(
            f"Revisar {controls_warning} controles en atención y validar responsables y fechas de cierre."
        )

    if controls_critical > 0:
        suggestions.append(
            f"Escalar {controls_critical} controles deteriorados para remediación prioritaria."
        )

    if findings_critical > 0:
        suggestions.append(
            f"Preparar respuesta y tratamiento para {findings_critical} hallazgo(s) crítico(s)."
        )

    if not suggestions:
        suggestions.append("No se detectan alertas críticas inmediatas en el resumen recibido.")

    return {
        "ok": True,
        "type": "health_summary",
        "summary": summary,
        "suggestions": suggestions[:5],
        "confidence": "media",
        "source": "ai-engine-rules-v1",
    }


def build_finding_analysis(payload: Dict[str, Any]) -> Dict[str, Any]:
    iso_code = payload.get("iso_code", "ISO no informada")
    title = payload.get("title", "Hallazgo sin título")
    description = payload.get("description", "Sin descripción")
    severity = normalize_severity(payload.get("severity", "media"))
    status = payload.get("status", "open")
    owner = payload.get("owner", "Responsable no definido")
    due_date = payload.get("due_date", "Sin fecha")

    if severity == "alta":
        impact = (
            "El hallazgo tiene potencial de afectar cumplimiento, trazabilidad o continuidad operativa "
            "si no se trata con prioridad inmediata."
        )
        priority = "Alta"
    elif severity == "media":
        impact = (
            "El hallazgo requiere seguimiento formal porque puede degradar el desempeño del sistema "
            "de gestión y aumentar exposición en auditoría."
        )
        priority = "Media"
    else:
        impact = (
            "El hallazgo parece acotado, pero conviene documentar tratamiento para evitar reincidencia."
        )
        priority = "Baja"

    likely_causes = [
        "Falta de evidencia objetiva o documentación actualizada.",
        "Ejecución inconsistente del control o del procedimiento asociado.",
        "Seguimiento insuficiente por parte del responsable del proceso.",
    ]

    recommended_actions = [
        "Validar causa inmediata y confirmar el estado real del control relacionado.",
        "Reunir evidencia objetiva que permita demostrar cierre o remediación.",
        "Definir responsable, fecha compromiso y criterio verificable de cierre.",
    ]

    summary = (
        f"El hallazgo '{title}' asociado a {iso_code} se encuentra en estado {status}. "
        f"Su severidad estimada es {severity} y su tratamiento debe considerar que {impact.lower()}"
    )

    return {
        "ok": True,
        "type": "finding_analysis",
        "summary": summary,
        "impact": impact,
        "priority": priority,
        "likely_causes": likely_causes,
        "recommended_actions": recommended_actions,
        "owner": owner,
        "due_date": due_date,
        "source": "ai-engine-rules-v1",
        "confidence": "media",
        "input_echo": {
            "iso_code": iso_code,
            "title": title,
            "description": description,
        },
    }


def build_nonconformity_draft(payload: Dict[str, Any]) -> Dict[str, Any]:
    iso_code = payload.get("iso_code", "ISO no informada")
    title = payload.get("title", "No conformidad")
    description = payload.get("description", "Sin descripción")
    severity = normalize_severity(payload.get("severity", "media"))

    statement = (
        f"Se evidenció una desviación respecto de {iso_code}: {title}. "
        f"Durante la revisión se observó que {description.lower().rstrip('.')}, "
        f"sin evidencia suficiente de control efectivo o cierre documentado."
    )

    objective_evidence = (
        f"Revisión documental y/o operativa vinculada a {iso_code}, donde se constató: {description}."
    )

    if severity == "alta":
        risk_statement = (
            "La desviación puede afectar cumplimiento normativo, trazabilidad y preparación de auditoría."
        )
    elif severity == "media":
        risk_statement = (
            "La desviación puede afectar la consistencia del sistema de gestión y generar observaciones futuras."
        )
    else:
        risk_statement = (
            "La desviación es acotada, pero debe corregirse y documentarse para evitar recurrencia."
        )

    immediate_correction = (
        "Regularizar la situación observada, completar la evidencia faltante y confirmar responsable de cierre."
    )

    corrective_action = (
        "Analizar causa raíz, actualizar procedimiento/control relacionado y establecer seguimiento verificable."
    )

    return {
        "ok": True,
        "type": "nonconformity_draft",
        "draft_title": f"No conformidad - {iso_code} - {title}",
        "statement": statement,
        "objective_evidence": objective_evidence,
        "risk_statement": risk_statement,
        "immediate_correction": immediate_correction,
        "corrective_action": corrective_action,
        "source": "ai-engine-rules-v1",
        "confidence": "media",
    }


def build_action_plan(payload: Dict[str, Any]) -> Dict[str, Any]:
    iso_code = payload.get("iso_code", "ISO no informada")
    title = payload.get("title", "Brecha sin título")
    description = payload.get("description", "Sin descripción")
    severity = normalize_severity(payload.get("severity", "media"))

    if severity == "alta":
        target_days = [2, 5, 15]
        priority = "Alta"
    elif severity == "media":
        target_days = [5, 10, 20]
        priority = "Media"
    else:
        target_days = [7, 15, 30]
        priority = "Baja"

    objective = (
        f"Restablecer el control o proceso asociado a {iso_code} respecto de '{title}', "
        f"asegurando evidencia objetiva, responsable y seguimiento."
    )

    immediate_actions = [
        "Validar el estado real de la brecha con el responsable del proceso.",
        "Levantar evidencia disponible y confirmar faltantes.",
        "Definir fecha compromiso y criterio verificable de cierre.",
    ]

    action_plan = [
        {
            "step": 1,
            "title": "Contención inicial",
            "owner_role": "Responsable del proceso",
            "target_days": target_days[0],
            "description": "Detener el impacto inmediato, validar alcance y registrar situación actual."
        },
        {
            "step": 2,
            "title": "Corrección documentada",
            "owner_role": "Dueño del control",
            "target_days": target_days[1],
            "description": "Ejecutar la corrección, adjuntar evidencia y actualizar estado del hallazgo/control."
        },
        {
            "step": 3,
            "title": "Acción correctiva",
            "owner_role": "Administrador de cumplimiento",
            "target_days": target_days[2],
            "description": "Analizar causa raíz, ajustar procedimiento o control y validar eficacia."
        },
    ]

    success_criteria = [
        "Existe evidencia objetiva suficiente del tratamiento realizado.",
        "El responsable y la fecha de cierre quedaron formalmente definidos.",
        "El control o proceso vuelve a un estado verificable y trazable.",
    ]

    return {
        "ok": True,
        "type": "action_plan_suggestion",
        "priority": priority,
        "objective": objective,
        "immediate_actions": immediate_actions,
        "action_plan": action_plan,
        "success_criteria": success_criteria,
        "source": "ai-engine-rules-v1",
        "confidence": "media",
        "input_echo": {
            "iso_code": iso_code,
            "title": title,
            "description": description,
        },
    }


def build_executive_brief(payload: Dict[str, Any]) -> Dict[str, Any]:
    tenant_name = payload.get("tenant_name", "Cliente")
    period = payload.get("period", "Periodo actual")
    standards = payload.get("standards", [])
    controls_total = int(payload.get("controls_total", 0) or 0)
    controls_warning = int(payload.get("controls_warning", 0) or 0)
    controls_critical = int(payload.get("controls_critical", 0) or 0)
    evidences_pending = int(payload.get("evidences_pending", 0) or 0)
    findings_critical = int(payload.get("findings_critical", 0) or 0)
    weakest_standards = payload.get("weakest_standards", [])

    standards_text = ", ".join(standards) if standards else "sin normas activas"
    weakest_text = ", ".join(weakest_standards) if weakest_standards else "sin brechas destacadas por norma"

    headline = f"Resumen gerencial {period} - {tenant_name}"

    executive_summary = (
        f"Durante {period}, {tenant_name} mantuvo {controls_total} controles dentro del alcance activo "
        f"de {standards_text}. El foco principal está en {controls_warning} controles en atención, "
        f"{controls_critical} deteriorados, {evidences_pending} evidencias pendientes y {findings_critical} "
        f"hallazgos críticos. Las normas con mayor atención requerida son: {weakest_text}."
    )

    top_priorities: List[str] = []

    if controls_warning > 0:
        top_priorities.append(
            f"Reducir el backlog de {controls_warning} controles en atención con seguimiento por responsable."
        )

    if evidences_pending > 0:
        top_priorities.append(
            f"Regularizar {evidences_pending} evidencias pendientes para sostener trazabilidad y auditoría."
        )

    if findings_critical > 0:
        top_priorities.append(
            f"Asegurar tratamiento y cierre de {findings_critical} hallazgo(s) crítico(s)."
        )

    if controls_critical > 0:
        top_priorities.append(
            f"Escalar {controls_critical} controles deteriorados con plan de remediación prioritario."
        )

    if not top_priorities:
        top_priorities.append(
            "Mantener monitoreo y revisión mensual del sistema para evitar deterioro futuro."
        )

    management_actions = [
        "Revisar el estado del sistema en comité mensual.",
        "Confirmar responsables, fechas y evidencia de cierre para brechas relevantes.",
        "Priorizar recursos sobre normas con menor salud o mayor exposición documental.",
    ]

    return {
        "ok": True,
        "type": "executive_brief",
        "headline": headline,
        "executive_summary": executive_summary,
        "top_priorities": top_priorities[:5],
        "management_actions": management_actions,
        "source": "ai-engine-rules-v1",
        "confidence": "media",
    }
