from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, Request

from app.core.config import settings

router = APIRouter(prefix="/api/ai-compliance/audit-documents", tags=["Audit Documents"])


PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "iso9001_audit_document_generator_v1.md"


def validate_internal_token(token: Optional[str]) -> None:
    if not settings.AI_INTERNAL_TOKEN:
        raise HTTPException(status_code=503, detail="AI token not configured")
    if token != settings.AI_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized AI internal token")


def safe_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def safe_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def to_text(value: Any) -> str:
    return str(value or "").strip()


def load_prompt_version() -> str:
    try:
        text = PROMPT_PATH.read_text(encoding="utf-8")
        return text[:240]
    except Exception:
        return "Prompt documental ISO9001 no disponible en disco."


def normalize_marker(text: str, marker: str = "[PENDIENTE DE VALIDACIÓN]") -> str:
    clean = to_text(text)
    if not clean:
        return marker
    if clean.startswith("["):
        return clean
    return f"{marker} {clean}"


def summarize_records(records: List[Any], label: str, max_items: int = 8) -> List[str]:
    output: List[str] = []
    for record in records[:max_items]:
        if not isinstance(record, dict):
            continue
        title = (
            record.get("title")
            or record.get("name")
            or record.get("document_name")
            or record.get("evidence_name")
            or record.get("control_description")
            or record.get("description")
            or record.get("id")
        )
        status = record.get("status") or record.get("document_status") or record.get("effective_health_status")
        detail = f"{label}: {to_text(title) or '[SIN NOMBRE]'}"
        if status:
            detail += f" (estado: {status})"
        output.append(detail)
    return output


def extract_pending_items(context: Dict[str, Any], template: Dict[str, Any]) -> List[str]:
    pending: List[str] = []

    for item in safe_list(context.get("pending_items")):
        if isinstance(item, str):
            pending.append(normalize_marker(item))
        elif isinstance(item, dict):
            pending.append(normalize_marker(item.get("message") or item.get("source") or "Pendiente de contexto"))

    for gap in safe_list(context.get("gaps")):
        if not isinstance(gap, dict):
            continue
        message = gap.get("message") or gap.get("source") or "Brecha documental pendiente"
        severity = gap.get("severity") or "media"
        pending.append(normalize_marker(f"{message} (severidad: {severity})", "[REQUIERE EVIDENCIA]"))

    source_trace = safe_dict(context.get("source_trace"))
    for source, trace in source_trace.items():
        if isinstance(trace, dict) and trace.get("available") is False:
            pending.append(normalize_marker(f"Fuente no disponible para {source}.", "[REQUIERE COMPLETAR CON DATO REAL]"))

    schema = safe_dict(template.get("template_schema_json"))
    required_inputs = safe_list(schema.get("required_inputs"))
    if required_inputs:
        pending.append(
            normalize_marker(
                "Validar insumos requeridos por plantilla: " + ", ".join(map(str, required_inputs[:8])),
                "[PENDIENTE DE VALIDACIÓN]",
            )
        )

    deduped: List[str] = []
    seen = set()
    for item in pending:
        if item not in seen:
            deduped.append(item)
            seen.add(item)
    return deduped[:25]


def build_evidence_suggestions(context: Dict[str, Any], template: Dict[str, Any]) -> List[Dict[str, Any]]:
    suggestions: List[Dict[str, Any]] = []
    template_key = to_text(template.get("template_key"))
    document_type = to_text(template.get("document_type"))

    for evidence in safe_list(context.get("evidences"))[:10]:
        if not isinstance(evidence, dict):
            continue
        suggestions.append(
            {
                "evidence_name": evidence.get("title") or evidence.get("name") or evidence.get("file_url") or "Evidencia registrada",
                "source_module": "evidences",
                "source_id": evidence.get("id"),
                "suggested_folder": "03_EVIDENCIAS_PARA_VALIDAR",
                "reason": "Evidencia real encontrada en la plataforma; requiere validación de aplicabilidad documental.",
            }
        )

    if not suggestions:
        suggestions.append(
            {
                "evidence_name": f"Evidencia de soporte para {template_key or document_type or 'documento ISO9001'}",
                "source_module": "pending",
                "source_id": None,
                "suggested_folder": "03_EVIDENCIAS_PARA_VALIDAR",
                "reason": "[REQUIERE EVIDENCIA] No se encontraron evidencias reales suficientes en el contexto.",
            }
        )

    return suggestions[:12]


def build_sections(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    template = safe_dict(payload.get("document_template"))
    context = safe_dict(payload.get("context"))
    tenant = safe_dict(context.get("tenant"))
    standard = safe_dict(context.get("standard"))
    audit = safe_dict(context.get("audit"))
    completion = safe_dict(context.get("completion_summary"))

    tenant_name = tenant.get("name") or "[PENDIENTE DE VALIDACIÓN]"
    standard_code = payload.get("standard_code") or standard.get("standard_code") or "ISO9001"
    period_year = payload.get("period_year") or safe_dict(context.get("period")).get("year") or "[PENDIENTE DE VALIDACIÓN]"
    audit_reference = audit.get("id") or payload.get("audit_id") or "[PENDIENTE DE VALIDACIÓN]"

    records_summary = []
    records_summary.extend(summarize_records(safe_list(context.get("controls")), "Control"))
    records_summary.extend(summarize_records(safe_list(context.get("risks")), "Riesgo"))
    records_summary.extend(summarize_records(safe_list(context.get("action_plans")), "Plan de acción"))
    records_summary.extend(summarize_records(safe_list(context.get("findings")), "Hallazgo"))
    records_summary.extend(summarize_records(safe_list(context.get("nonconformities")), "No conformidad"))
    records_summary.extend(summarize_records(safe_list(context.get("kpis")), "KPI"))

    readiness = completion.get("readiness_status") or "insufficient"
    score = completion.get("estimated_readiness_score")
    score_text = f"{score}%" if isinstance(score, int) else "[PENDIENTE DE VALIDACIÓN]"

    sections = [
        {
            "title": "Identificación del documento",
            "content": (
                f"Documento: {template.get('document_name') or 'Documento ISO 9001'}\n"
                f"Organización: {tenant_name}\n"
                f"Norma: {standard_code}\n"
                f"Periodo: {period_year}\n"
                f"Auditoría asociada: {audit_reference}\n"
                "Estado: borrador generado para revisión documental."
            ),
        },
        {
            "title": "Base de información real utilizada",
            "content": "\n".join(records_summary[:20]) if records_summary else (
                "[REQUIERE COMPLETAR CON DATO REAL] No se encontraron registros operativos suficientes para completar esta sección."
            ),
        },
        {
            "title": "Contenido documental propuesto",
            "content": (
                "Este documento se genera como borrador auditable con la información disponible en TCDX Compliance. "
                "Toda afirmación debe estar respaldada por evidencia vigente o quedar marcada como pendiente. "
                f"El nivel estimado de preparación documental es {readiness} ({score_text})."
            ),
        },
        {
            "title": "Evidencias requeridas",
            "content": (
                "Las evidencias deben vincularse en la carpeta 03_EVIDENCIAS_PARA_VALIDAR y validarse por el responsable del SGC. "
                "Si una evidencia no existe en la plataforma, debe mantenerse como [REQUIERE EVIDENCIA]."
            ),
        },
        {
            "title": "Pendientes y validaciones",
            "content": "\n".join(f"- {item}" for item in extract_pending_items(context, template)[:12]) or (
                "- [PENDIENTE DE VALIDACIÓN] Confirmar vigencia, responsables y evidencias antes de presentar a auditoría externa."
            ),
        },
    ]

    if payload.get("generation_scope") == "management_review" or template.get("document_type") == "management_review":
        sections.insert(
            2,
            {
                "title": "Entradas para revisión por la dirección",
                "content": (
                    "Incluir estado de objetivos, desempeño de procesos, resultados de auditoría, satisfacción de cliente, "
                    "proveedores, riesgos, no conformidades, acciones correctivas, recursos y oportunidades de mejora. "
                    "Cualquier dato ausente debe quedar marcado como [REQUIERE COMPLETAR CON DATO REAL]."
                ),
            },
        )

    return sections


def sections_to_markdown(title: str, sections: List[Dict[str, Any]]) -> str:
    lines = [f"# {title}", ""]
    for section in sections:
        lines.append(f"## {section.get('title')}")
        lines.append("")
        lines.append(to_text(section.get("content")) or "[PENDIENTE DE VALIDACIÓN]")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def build_document(payload: Dict[str, Any]) -> Dict[str, Any]:
    template = safe_dict(payload.get("document_template"))
    context = safe_dict(payload.get("context"))
    title = template.get("document_name") or "Documento de auditoría ISO 9001"
    sections = build_sections(payload)
    pending_items = extract_pending_items(context, template)
    evidence_suggestions = build_evidence_suggestions(context, template)

    return {
        "title": title,
        "version": template.get("version") or "1.0",
        "period_year": payload.get("period_year"),
        "sections": sections,
        "content_markdown": sections_to_markdown(title, sections),
        "content_json": {
            "template_key": template.get("template_key"),
            "document_type": template.get("document_type"),
            "generation_scope": payload.get("generation_scope") or "general_preparation",
            "prompt_reference": "iso9001_audit_document_generator_v1",
            "rules_applied": safe_dict(payload.get("generation_rules")),
            "prompt_preview": load_prompt_version(),
        },
        "pending_items": pending_items,
        "evidence_suggestions": evidence_suggestions,
        "source_trace": {
            "context_sources": safe_dict(context.get("source_trace")),
            "completion_summary": safe_dict(context.get("completion_summary")),
            "generation_mode": "deterministic_document_generator_v1",
        },
    }


@router.post("/generate")
async def generate_document(request: Request, x_ai_token: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    validate_internal_token(x_ai_token)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload inválido")
    if not payload.get("tenant_id"):
        raise HTTPException(status_code=400, detail="tenant_id requerido")
    if to_text(payload.get("standard_code")).upper() != "ISO9001":
        raise HTTPException(status_code=400, detail="Esta versión documental soporta ISO9001")

    document = build_document(payload)
    return {
        "status": "ok",
        "document": document,
    }
