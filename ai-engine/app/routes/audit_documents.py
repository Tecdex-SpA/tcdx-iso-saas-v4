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


def markdown_table(headers: List[str], rows: List[List[Any]]) -> str:
    clean_headers = [to_text(h).replace("|", "/") for h in headers]
    lines = [
        "| " + " | ".join(clean_headers) + " |",
        "| " + " | ".join(["---"] * len(clean_headers)) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(to_text(cell).replace("|", "/") or "-" for cell in row) + " |")
    return "\n".join(lines)


def evidence_name(evidence: Dict[str, Any]) -> str:
    return (
        evidence.get("title")
        or evidence.get("name")
        or evidence.get("file_name")
        or evidence.get("file_url")
        or evidence.get("file_path")
        or evidence.get("description")
        or "Evidencia registrada"
    )


def compact_control_lines(context: Dict[str, Any], max_items: int = 8) -> str:
    control_summary = safe_dict(context.get("control_summary"))
    controls = safe_list(control_summary.get("top_relevant_controls")) or safe_list(context.get("controls"))
    lines = []
    for control in controls[:max_items]:
        if not isinstance(control, dict):
            continue
        scope_note = ""
        if control.get("is_in_active_operational_scope") is False:
            scope_note = " - revisar alcance activo"
        lines.append(
            f"- {control.get('clause') or 'cláusula pendiente'}: "
            f"{control.get('description') or control.get('control_description') or '[PENDIENTE DE VALIDACIÓN]'} "
            f"(salud: {control.get('effective_health_status') or control.get('effective_health_score') or 'sin dato'}{scope_note})"
        )
    return "\n".join(lines) or "- [REQUIERE COMPLETAR CON DATO REAL] No hay controles suficientes para esta sección."


def compact_evidence_lines(context: Dict[str, Any], max_items: int = 10) -> str:
    evidence_summary = safe_dict(context.get("evidence_summary"))
    evidences = safe_list(evidence_summary.get("likely_iso9001_evidences")) or safe_list(context.get("evidences"))
    lines = []
    for evidence in evidences[:max_items]:
        if not isinstance(evidence, dict):
            continue
        lines.append(
            f"- {evidence_name(evidence)} (estado: {evidence.get('status') or 'requiere validación'}, tipo: {evidence.get('evidence_type') or evidence.get('file_mime_type') or 'sin clasificar'})"
        )
    return "\n".join(lines) or "- [REQUIERE EVIDENCIA] No hay evidencias ISO 9001 suficientes vinculadas en plataforma."


def source_summary(context: Dict[str, Any]) -> str:
    trace = safe_dict(context.get("source_trace"))
    available = [key for key, item in trace.items() if isinstance(item, dict) and item.get("available")]
    unavailable = [key for key, item in trace.items() if isinstance(item, dict) and item.get("available") is False]
    return (
        f"Fuentes disponibles: {', '.join(available[:12]) or '[PENDIENTE DE VALIDACIÓN]'}\n"
        f"Fuentes no disponibles: {', '.join(unavailable[:12]) or 'ninguna crítica registrada'}"
    )


def build_specific_sections(payload: Dict[str, Any], base: Dict[str, Any]) -> List[Dict[str, Any]]:
    template = safe_dict(payload.get("document_template"))
    context = safe_dict(payload.get("context"))
    key = to_text(template.get("template_key"))
    doc_type = to_text(template.get("document_type"))
    tenant_name = base["tenant_name"]
    standard_code = base["standard_code"]
    period_year = base["period_year"]
    audit_reference = base["audit_reference"]
    readiness = base["readiness"]
    score_text = base["score_text"]

    identity = {
        "title": "Portada y control del documento",
        "content": (
            f"Organización: {tenant_name}\n"
            f"Documento: {template.get('document_name') or 'Documento ISO 9001'}\n"
            f"Norma: {standard_code}\n"
            f"Periodo: {period_year}\n"
            f"Auditoría asociada: {audit_reference}\n"
            "Versión: 1.0\n"
            "Estado: borrador generado para revisión y aprobación."
        ),
    }

    pending = {
        "title": "Pendientes y validaciones",
        "content": "\n".join(f"- {item}" for item in extract_pending_items(context, template)[:18]) or "- [PENDIENTE DE VALIDACIÓN] Confirmar vigencia, responsables y evidencias.",
    }

    trace_section = {
        "title": "Trazabilidad de fuentes",
        "content": source_summary(context),
    }

    if key == "manual_calidad":
        return [
            identity,
            {"title": "Objetivo del manual", "content": "Establecer una descripción controlada del Sistema de Gestión de Calidad, su alcance, procesos, responsabilidades, evidencias y mecanismos de mejora usando información real disponible en TCDX Compliance."},
            {"title": "Alcance del SGC", "content": f"Alcance documentado para {tenant_name}: [PENDIENTE DE VALIDACIÓN]. La auditoría asociada es {audit_reference}. Cualquier exclusión o límite operativo debe confirmarse con evidencia formal."},
            {"title": "Contexto de la organización", "content": f"Readiness documental actual: {readiness} ({score_text}). Las fuentes disponibles permiten sustentar parcialmente el contexto; los factores externos, FODA formal y partes interesadas deben validarse si no existen registros específicos."},
            {"title": "Partes interesadas", "content": "Clientes, proveedores, colaboradores, reguladores y socios deben registrarse con requisitos verificables. [REQUIERE COMPLETAR CON DATO REAL] si no existe matriz vigente en plataforma."},
            {"title": "Mapa/resumen de procesos", "content": compact_control_lines(context, 10)},
            {"title": "Liderazgo y responsabilidades", "content": "La asignación formal de responsabilidades del SGC debe validarse contra organigrama, actas o documentos vigentes. [REQUIERE EVIDENCIA] cuando no exista responsable explícito."},
            {"title": "Gestión de riesgos y oportunidades", "content": compact_control_lines(context, 8) + "\n\nSi no existe matriz de riesgos formal, usar estos controles y planes de acción como insumo alternativo, no como reemplazo de la matriz aprobada."},
            {"title": "Apoyo, recursos y operación", "content": "La prestación del servicio debe sustentarse con registros operativos, evidencias aprobadas, controles activos y acciones de seguimiento. No presentar controles fuera de alcance como cumplimiento efectivo."},
            {"title": "Evaluación del desempeño", "content": f"KPIs/registros disponibles: {len(safe_list(context.get('kpis')))}. Auditorías disponibles: {len(safe_list(context.get('audits')))}. Hallazgos: {len(safe_list(context.get('findings')))}. No conformidades: {len(safe_list(context.get('nonconformities')))}."},
            {"title": "Mejora continua", "content": "\n".join(summarize_records(safe_list(context.get("action_plans")), "Acción", 10)) or "[REQUIERE COMPLETAR CON DATO REAL] No hay acciones de mejora suficientes."},
            {"title": "Referencias documentales", "content": "\n".join(summarize_records(safe_list(safe_dict(context.get("documents")).get("package_documents")), "Documento", 12)) or "[PENDIENTE DE VALIDACIÓN] Generar o cargar documentos vigentes."},
            {"title": "Evidencias asociadas", "content": compact_evidence_lines(context, 10)},
            trace_section,
            pending,
        ]

    if key == "revision_por_la_direccion" or doc_type == "management_review":
        return [
            identity,
            {"title": "Datos de la revisión", "content": f"Revisión del SGC para {tenant_name}, periodo {period_year}. Responsable y fecha de sesión: [PENDIENTE DE VALIDACIÓN]."},
            {"title": "Entradas obligatorias", "content": "Objetivos, desempeño de procesos, resultados de auditoría, satisfacción cliente, proveedores, riesgos, acciones correctivas, recursos y oportunidades de mejora deben sustentarse con evidencia vigente."},
            {"title": "Estado de acciones previas", "content": "\n".join(summarize_records(safe_list(context.get("action_plans")), "Acción", 10)) or "[REQUIERE COMPLETAR CON DATO REAL] No hay acciones previas registradas."},
            {"title": "Cambios internos/externos", "content": "[PENDIENTE DE VALIDACIÓN] Registrar cambios organizacionales, tecnológicos, comerciales o regulatorios del periodo."},
            {"title": "Desempeño de procesos y KPIs", "content": f"KPIs disponibles: {len(safe_list(context.get('kpis')))}. Controles priorizados:\n{compact_control_lines(context, 8)}"},
            {"title": "Satisfacción cliente", "content": "\n".join(summarize_records(safe_list(context.get("customer_satisfaction")), "Satisfacción", 8)) or "[REQUIERE EVIDENCIA] No hay registros de satisfacción cliente disponibles."},
            {"title": "Proveedores", "content": "\n".join(summarize_records(safe_list(context.get("suppliers")), "Proveedor", 8)) or "[REQUIERE COMPLETAR CON DATO REAL] No hay registro de proveedores disponible."},
            {"title": "Auditorías, hallazgos y no conformidades", "content": "\n".join(summarize_records(safe_list(context.get("audits")), "Auditoría", 6) + summarize_records(safe_list(context.get("findings")), "Hallazgo", 6) + summarize_records(safe_list(context.get("nonconformities")), "No conformidad", 6)) or "[PENDIENTE DE VALIDACIÓN] No hay resultados de auditoría suficientes."},
            {"title": "Riesgos y oportunidades", "content": "\n".join(summarize_records(safe_list(context.get("risks")), "Riesgo", 8)) or "[REQUIERE COMPLETAR CON DATO REAL] Matriz de riesgos no disponible; usar controles y acciones como insumo alternativo."},
            {"title": "Recursos, decisiones y acciones", "content": "[PENDIENTE DE VALIDACIÓN] Registrar decisiones, responsables, recursos aprobados y fechas de seguimiento."},
            {"title": "Conclusión", "content": f"La preparación documental se encuentra en estado {readiness} ({score_text}). El acta no debe aprobarse hasta cerrar pendientes críticos y evidencias faltantes."},
            trace_section,
            pending,
        ]

    if key == "politica_calidad":
        return [
            identity,
            {"title": "Declaración", "content": f"{tenant_name} declara su compromiso con la calidad, el cumplimiento de requisitos aplicables, la satisfacción del cliente y la mejora continua. [PENDIENTE DE VALIDACIÓN] La dirección debe aprobar el texto final."},
            {"title": "Compromisos", "content": "- Cumplir requisitos aplicables.\n- Mantener procesos controlados.\n- Gestionar riesgos y oportunidades.\n- Mejorar continuamente el SGC.\n- Sustentar decisiones con evidencia."},
            {"title": "Enfoque al cliente", "content": "[REQUIERE EVIDENCIA] Vincular mediciones reales de satisfacción, reclamos o feedback del periodo."},
            {"title": "Comunicación y revisión", "content": "[PENDIENTE DE VALIDACIÓN] Registrar fecha de aprobación, responsable de comunicación y evidencia de difusión."},
            trace_section,
            pending,
        ]

    if key == "objetivos_calidad":
        rows = safe_list(context.get("kpis"))[:8]
        table_rows = [
            [item.get("title") or item.get("standard_code") or "Objetivo derivado de KPI", item.get("effective_health_status") or item.get("status_color") or "sin dato", "[PENDIENTE]", "[PENDIENTE]", period_year, item.get("effective_health_score") or item.get("value") or "sin dato", "[REQUIERE EVIDENCIA]", "[PENDIENTE DE VALIDACIÓN]"]
            for item in rows if isinstance(item, dict)
        ] or [["[PENDIENTE]", "[PENDIENTE]", "[PENDIENTE]", "[PENDIENTE]", period_year, "sin dato", "[REQUIERE EVIDENCIA]", "[REQUIERE COMPLETAR CON DATO REAL]"]]
        return [identity, {"title": "Tabla de objetivos de calidad", "content": markdown_table(["Objetivo", "Indicador/KPI", "Meta", "Responsable", "Periodo", "Estado", "Evidencia", "Pendiente"], table_rows)}, trace_section, pending]

    if key == "indice_evidencias" or doc_type == "evidence_index":
        evidences = safe_list(context.get("evidences"))[:20]
        rows = [
            [template.get("document_name") or "Documento ISO 9001", evidence_name(e), "evidences", "03_EVIDENCIAS_PARA_VALIDAR", e.get("status") or "requiere validación", "Validar aplicabilidad"]
            for e in evidences if isinstance(e, dict)
        ] or [["Documento ISO 9001", "[REQUIERE EVIDENCIA]", "pending", "03_EVIDENCIAS_PARA_VALIDAR", "pending", "No hay evidencia suficiente"]]
        return [identity, {"title": "Índice de evidencias", "content": markdown_table(["Documento/requisito", "Evidencia", "Fuente", "Carpeta sugerida", "Estado", "Observación"], rows)}, trace_section, pending]

    if key == "guia_entrevistas_auditoria" or doc_type == "audit_interview_guide":
        return [
            identity,
            {"title": "Preguntas por rol", "content": "- Dirección: ¿Cómo se revisan objetivos, riesgos y recursos del SGC?\n- Responsable de calidad: ¿Cómo se controla la vigencia documental?\n- Operación: ¿Cómo se demuestra control del servicio y tratamiento de incidentes?\n- Dueños de proceso: ¿Qué indicadores y evidencias respaldan el desempeño?"},
            {"title": "Preguntas por proceso", "content": compact_control_lines(context, 8)},
            {"title": "Evidencia esperada", "content": compact_evidence_lines(context, 10)},
            {"title": "Riesgos y señales de alerta", "content": "- Evidencia inexistente o no aprobada.\n- Documentos sin versión o responsable.\n- Acciones vencidas sin cierre.\n- Proveedores o satisfacción cliente sin registros reales."},
            trace_section,
            pending,
        ]

    return []


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
    base = {
        "tenant_name": tenant_name,
        "standard_code": standard_code,
        "period_year": period_year,
        "audit_reference": audit_reference,
        "readiness": readiness,
        "score_text": score_text,
    }

    specific = build_specific_sections(payload, base)
    if specific:
        return specific

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
