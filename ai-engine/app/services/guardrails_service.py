from typing import Any, Dict

from app.services.source_trace_service import make_source_trace_item

GUARDRAILS = {
    "GUARDRAIL_NO_DATA": "No hay evidencia suficiente para concluir cumplimiento. Se requieren datos internos antes de emitir diagnóstico.",
    "GUARDRAIL_OUT_OF_SCOPE": "Este control no está en alcance activo para esta operación/norma. No se incluye en el diagnóstico de cumplimiento.",
    "GUARDRAIL_NO_OFFICIAL_EVIDENCE": "Existe evidencia registrada, pero no tiene categoría oficial computable. No es sustentable ante auditoría formal sin oficialización.",
    "GUARDRAIL_WEB_USED": "La referencia externa consultada no reemplaza la evidencia interna del sistema. Se usa únicamente como contexto normativo.",
    "GUARDRAIL_DRIVE_USED": "El documento analizado desde Google Drive debe ser validado por el responsable formal antes de considerarse evidencia oficial.",
    "GUARDRAIL_CERTIFICATION": "Este sistema apoya la preparación y gestión diaria de cumplimiento. No reemplaza una auditoría de certificación formal realizada por organismo acreditado.",
}


def _ensure_result_shape(result: Dict[str, Any]) -> Dict[str, Any]:
    result.setdefault("limitations", [])
    result.setdefault("source_trace", [])
    structured = result.setdefault("structured_result", {})
    structured.setdefault("limitations", [])
    structured.setdefault("source_trace", [])
    return result


def apply_pre_analysis_guardrails(payload: Dict[str, Any]) -> Dict[str, Any]:
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    controls = context.get("priority_controls") if isinstance(context.get("priority_controls"), list) else []
    summaries = context.get("effective_health_summary") if isinstance(context.get("effective_health_summary"), list) else []
    limitations = []

    if not controls and not summaries:
        limitations.append(GUARDRAILS["GUARDRAIL_NO_DATA"])

    limitations.append(
        f"Análisis restringido estrictamente al tenant {payload.get('tenant_id', '')}. Datos de otros tenants no accesibles ni comparables."
    )

    return {
        "limitations": limitations,
        "source_trace": [
            make_source_trace_item("prompt_inference", "guardrails_service", "validaciones previas de seguridad y alcance")
        ],
    }


def apply_post_analysis_guardrails(result: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    result = _ensure_result_shape(result)
    structured = result["structured_result"]
    controls = context.get("priority_controls") if isinstance(context.get("priority_controls"), list) else []

    if not controls and GUARDRAILS["GUARDRAIL_NO_DATA"] not in structured["limitations"]:
        structured["limitations"].append(GUARDRAILS["GUARDRAIL_NO_DATA"])

    if any(int(control.get("evidence_count") or 0) > 0 and int(control.get("official_evidence_count") or 0) == 0 for control in controls if isinstance(control, dict)):
        structured["limitations"].append(GUARDRAILS["GUARDRAIL_NO_OFFICIAL_EVIDENCE"])

    trace = make_source_trace_item("prompt_inference", "guardrails_service", "guardrails posteriores aplicados")
    structured["source_trace"].append(trace)
    result["source_trace"].append(trace)
    result["limitations"] = list(dict.fromkeys(result.get("limitations", []) + structured.get("limitations", [])))
    return result
