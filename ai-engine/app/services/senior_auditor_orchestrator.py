import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from app.services.drive_context_service import build_drive_context
from app.services.guardrails_service import apply_post_analysis_guardrails, apply_pre_analysis_guardrails
from app.services.llm_client import call_llm_json, get_llm_metadata, get_ollama_generation_options, is_llm_available
from app.services.rag_context_service import build_rag_context
from app.services.source_trace_service import make_source_trace_item, normalize_source_trace
from app.services.structured_result_service import (
    build_fallback_structured_result,
    normalize_ai_structured_result,
)
from app.services.web_context_service import build_external_context

PROMPT_VERSION = "1.0.0"
CONTEXT_VERSION = "ai_context_v2.0.0"
BASE_DIR = Path(__file__).resolve().parents[2]
PROMPT_PATH = BASE_DIR / "prompts" / "iso_senior_auditor.md"
COMPACT_PROMPT_PATH = BASE_DIR / "prompts" / "iso_senior_auditor_compact.md"


def _number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _int(value: Any) -> int:
    return int(_number(value))


def _load_master_prompt() -> str:
    try:
        return PROMPT_PATH.read_text(encoding="utf-8")
    except OSError:
        return "Prompt Maestro — Auditor ISO Senior no disponible en disco."


def _load_prompt(local_compact: bool) -> str:
    if local_compact:
        try:
            return COMPACT_PROMPT_PATH.read_text(encoding="utf-8")
        except OSError:
            return _load_master_prompt()
    return _load_master_prompt()


def _env_bool(name: str, default: bool = False) -> bool:
    value = str(os.getenv(name, str(default))).lower().strip()
    return value in {"1", "true", "yes", "on", "si", "sí"}


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)) or default)
    except (TypeError, ValueError):
        return default


def is_local_compact_mode(payload: dict, settings: dict = None) -> bool:
    options = payload.get("options") if isinstance(payload.get("options"), dict) else {}
    if options.get("local_compact") is True:
        return True
    if options.get("local_compact") is False:
        return False
    provider = str((settings or {}).get("provider") or os.getenv("LLM_PROVIDER") or os.getenv("MODEL_PROVIDER") or "").lower()
    return provider == "ollama" or _env_bool("AI_ENGINE_LOCAL_COMPACT", False)


def _compact_limits() -> Dict[str, int]:
    return {
        "max_controls": _env_int("AI_ENGINE_LOCAL_COMPACT_MAX_CONTROLS", 8),
        "max_evidences": _env_int("AI_ENGINE_LOCAL_COMPACT_MAX_EVIDENCES", 5),
        "max_findings": _env_int("AI_ENGINE_LOCAL_COMPACT_MAX_FINDINGS", 5),
        "max_actions": _env_int("AI_ENGINE_LOCAL_COMPACT_MAX_ACTIONS", 5),
    }


def _compact_limits_from_options(options: Dict[str, Any]) -> Dict[str, int]:
    limits = _compact_limits()
    for option_key, limit_key in [
        ("max_controls", "max_controls"),
        ("max_evidences", "max_evidences"),
        ("max_findings", "max_findings"),
        ("max_actions", "max_actions"),
    ]:
        value = options.get(option_key)
        if value is not None:
            limits[limit_key] = max(1, min(_int(value), limits[limit_key]))
    return limits


def _normalize_model_mode(options: Dict[str, Any]) -> str:
    value = str(options.get("model_mode") or os.getenv("AI_AUDITOR_MODEL_MODE") or "fast").strip().lower()
    return value if value in {"fast", "balanced", "deep"} else "fast"


def _estimated_mode_cost(model_mode: str) -> str:
    if model_mode == "deep":
        return "high"
    if model_mode == "balanced":
        return "moderate"
    return "fast"


def resolve_source_policy(payload: dict, local_compact: bool, depth: str) -> dict:
    options = payload.get("options") if isinstance(payload.get("options"), dict) else {}
    if not local_compact:
        return {
            "use_rag": options.get("use_rag") is not False,
            "use_drive": options.get("use_drive") is not False,
            "use_web": options.get("use_web") is not False,
            "rag_limit": int(options.get("rag_limit") or 5),
            "limitations": [],
        }

    force_web = options.get("force_web") is True
    drive_option = options.get("use_drive", "auto")
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    scope = context.get("scope") if isinstance(context.get("scope"), dict) else {}
    has_direct_entity = bool(scope.get("tenant_control_id") or scope.get("evidence_id") or scope.get("action_plan_id"))
    has_documents = bool(context.get("documents"))
    use_drive = drive_option is True or (drive_option != False and has_documents and (has_direct_entity or depth in {"standard", "deep"}))
    use_web = bool(force_web or (depth == "deep" and options.get("use_web") is not False))
    limitations = []
    if not use_web:
        limitations.append("Brave/internet omitido por modo local_compact para reducir latencia.")
    if not use_drive and options.get("use_drive") is not False:
        limitations.append("Google Drive/documentos omitidos por modo local_compact salvo coincidencia directa relevante.")
    return {
        "use_rag": options.get("use_rag") is not False,
        "use_drive": use_drive,
        "use_web": use_web,
        "rag_limit": {"executive": 2, "standard": 3, "deep": 5}.get(depth, 3),
        "limitations": limitations,
    }


def _readiness(summary_rows: List[Dict[str, Any]], controls: List[Dict[str, Any]]) -> Dict[str, str]:
    active = sum(_int(row.get("active_scope_controls")) for row in summary_rows)
    official = sum(_int(row.get("controls_with_official_evidence")) for row in summary_rows)
    overdue = sum(_int(row.get("overdue_action_plans_count")) for row in summary_rows)
    open_nc = sum(_int(row.get("open_nonconformities_count")) for row in summary_rows)
    pct = (official / active * 100) if active else 0

    if not active and not controls:
        return {"status": "sin_datos", "reason": "Sin controles activos ni resumen efectivo disponible."}
    if pct >= 80 and overdue == 0 and open_nc == 0:
        return {"status": "listo", "reason": "Cobertura de evidencia oficial alta y sin planes vencidos ni NC abiertas."}
    if pct >= 50:
        return {"status": "parcial", "reason": "Cobertura de evidencia parcial o existen brechas abiertas por tratar."}
    return {"status": "no_listo", "reason": "Menos de 50% de controles activos con evidencia oficial o brechas críticas activas."}


def _evidence_status(control: Dict[str, Any]) -> str:
    evidence_count = _int(control.get("evidence_count"))
    official_count = _int(control.get("official_evidence_count"))
    quality = str(control.get("evidence_quality_status") or "").lower()
    if evidence_count <= 0:
        return "sin_evidencia"
    if official_count <= 0:
        return "evidencia_aprobada_sin_oficial"
    if "debil" in quality or "weak" in quality:
        return "evidencia_debil"
    return "evidencia_debil" if _number(control.get("effective_health_score")) < 50 else "evidencia_aprobada_sin_oficial"


def _severity(control: Dict[str, Any]) -> str:
    score = _number(control.get("effective_health_score"))
    overdue = _int(control.get("overdue_action_plans_count"))
    nc = _int(control.get("open_nonconformities_count"))
    if score < 40 or overdue > 0 or nc > 0:
        return "alta"
    if score < 70:
        return "media"
    return "baja"


def _truncate_value(value: Any, max_len: int = 500) -> Any:
    if isinstance(value, str):
        return value if len(value) <= max_len else value[:max_len].rstrip() + "..."
    if isinstance(value, dict):
        return {key: _truncate_value(item, max_len) for key, item in value.items()}
    if isinstance(value, list):
        return [_truncate_value(item, max_len) for item in value]
    return value


def _sort_controls_worst_first(controls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(
        [item for item in controls if isinstance(item, dict)],
        key=lambda row: (
            _number(row.get("effective_health_score")),
            -_int(row.get("overdue_action_plans_count")),
            -_int(row.get("open_nonconformities_count")),
            -_int(row.get("open_findings_count")),
        ),
    )


def build_compact_ai_context(context: dict, depth: str = "executive", limits: dict = None) -> dict:
    """
    Takes full backend context and returns compact context for local LLM.
    Must preserve enough data to produce useful answer.
    Must not mutate original context.
    """
    limits = limits or _compact_limits()
    full_controls = context.get("priority_controls") if isinstance(context.get("priority_controls"), list) else []
    full_evidences = context.get("recent_evidences") if isinstance(context.get("recent_evidences"), list) else []
    full_findings = context.get("recent_findings") if isinstance(context.get("recent_findings"), list) else []
    full_nc = context.get("recent_nonconformities") if isinstance(context.get("recent_nonconformities"), list) else []
    full_actions = context.get("recent_action_plans") if isinstance(context.get("recent_action_plans"), list) else []
    controls = _sort_controls_worst_first(full_controls)[: limits["max_controls"]]

    def slim_control(row: Dict[str, Any]) -> Dict[str, Any]:
        return _truncate_value({
            "tenant_control_id": row.get("tenant_control_id"),
            "standard_code": row.get("standard_code") or row.get("iso"),
            "iso": row.get("iso"),
            "clause": row.get("clause"),
            "description": row.get("control_description") or row.get("description"),
            "control_description": row.get("control_description") or row.get("description"),
            "effective_health_score": row.get("effective_health_score"),
            "effective_health_status": row.get("effective_health_status"),
            "compliance_bucket": row.get("compliance_bucket"),
            "evidence_quality_status": row.get("evidence_quality_status"),
            "official_evidence_count": row.get("official_evidence_count"),
            "approved_evidence_count": row.get("approved_evidence_count"),
            "open_findings_count": row.get("open_findings_count"),
            "open_nonconformities_count": row.get("open_nonconformities_count"),
            "open_action_plans_count": row.get("open_action_plans_count"),
            "overdue_action_plans_count": row.get("overdue_action_plans_count"),
            "is_in_active_operational_scope": row.get("is_in_active_operational_scope"),
        })

    def slim_entity(row: Dict[str, Any]) -> Dict[str, Any]:
        return _truncate_value({
            "id": row.get("id"),
            "title": row.get("title") or row.get("name") or row.get("file_name"),
            "name": row.get("name") or row.get("file_name") or row.get("title"),
            "status": row.get("status") or row.get("approval_status"),
            "evidence_type": row.get("evidence_type") or row.get("type"),
            "severity": row.get("severity"),
            "priority": row.get("priority"),
            "due_date": row.get("due_date"),
            "created_at": row.get("created_at"),
            "tenant_control_id": row.get("tenant_control_id"),
            "iso": row.get("iso") or row.get("iso_code") or row.get("standard_code"),
            "clause": row.get("clause"),
        })

    summaries = []
    for row in context.get("effective_health_summary") or []:
        if not isinstance(row, dict) or _int(row.get("active_scope_controls")) <= 0:
            continue
        summaries.append(_truncate_value({
            "iso": row.get("iso"),
            "operation_id": row.get("operation_id"),
            "operation_name": row.get("operation_name"),
            "active_scope_controls": row.get("active_scope_controls"),
            "complies_controls": row.get("complies_controls"),
            "controls_without_evidence": row.get("controls_without_evidence"),
            "controls_with_official_evidence": row.get("controls_with_official_evidence"),
            "open_nonconformities_count": row.get("open_nonconformities_count"),
            "overdue_action_plans_count": row.get("overdue_action_plans_count"),
            "avg_effective_health_score": row.get("avg_effective_health_score"),
            "compliance_percentage": row.get("compliance_percentage"),
            "official_evidence_percentage": row.get("official_evidence_percentage"),
            "kpi_health_status": row.get("kpi_health_status"),
        }))

    open_findings = [item for item in full_findings if str(item.get("status") or "").lower() not in {"cerrado", "closed", "resuelto", "resolved"}]
    open_nc = [item for item in full_nc if str(item.get("status") or "").lower() not in {"cerrada", "cerrado", "closed", "resuelta", "resolved"}]
    open_actions = [item for item in full_actions if str(item.get("status") or "").lower() not in {"cerrado", "closed", "completado", "cancelado"}]
    compact = {
        "tenant": _truncate_value(context.get("tenant") if isinstance(context.get("tenant"), dict) else {}),
        "company_profile": _truncate_value(context.get("company_profile") if isinstance(context.get("company_profile"), dict) else {}),
        "scope": _truncate_value(context.get("scope") if isinstance(context.get("scope"), dict) else {}),
        "effective_health_summary": summaries[:10],
        "priority_controls": [slim_control(item) for item in controls],
        "recent_evidences": [slim_entity(item) for item in full_evidences[: limits["max_evidences"]]],
        "recent_findings": [slim_entity(item) for item in open_findings[: limits["max_findings"]]],
        "recent_nonconformities": [slim_entity(item) for item in open_nc[: limits["max_findings"]]],
        "recent_action_plans": [slim_entity(item) for item in open_actions[: limits["max_actions"]]],
        "kpis": _truncate_value((context.get("kpis") or [])[:5]),
        "documents": [
            _truncate_value({
                "document_id": item.get("document_id") or item.get("id"),
                "title": item.get("title") or item.get("name") or item.get("file_name"),
                "type": item.get("type") or item.get("file_extension") or item.get("mime_type"),
                "date": item.get("date") or item.get("modified_at") or item.get("created_at"),
                "relation": item.get("relation"),
                "matched_by": item.get("matched_by"),
                "summary": item.get("summary"),
            })
            for item in (context.get("documents") or [])[:5]
            if isinstance(item, dict)
        ],
        "source_trace": context.get("source_trace") or [],
        "limitations": context.get("limitations") or [],
        "compact_context_summary": {
            "enabled": True,
            "controls_included": len(controls),
            "controls_omitted": max(0, len(full_controls) - len(controls)),
            "evidences_included": min(len(full_evidences), limits["max_evidences"]),
            "evidences_omitted": max(0, len(full_evidences) - limits["max_evidences"]),
            "findings_included": min(len(open_findings), limits["max_findings"]),
            "action_plans_included": min(len(open_actions), limits["max_actions"]),
            "large_text_truncated": True,
            "depth": depth,
        },
    }
    return compact


def _build_gaps(controls: List[Dict[str, Any]], limit: int = 5) -> List[Dict[str, Any]]:
    gaps = []
    for control in controls[:limit]:
        iso = str(control.get("iso") or "")
        clause = str(control.get("clause") or "")
        title = f"{iso} {clause} con salud efectiva {control.get('effective_health_score', 0)}%"
        desc = (
            f"Según datos internos: el control '{control.get('control_description') or 'sin descripción'}' "
            f"presenta estado {control.get('effective_health_status') or 'sin estado'}, "
            f"{_int(control.get('official_evidence_count'))} evidencias oficiales, "
            f"{_int(control.get('open_findings_count'))} hallazgos abiertos, "
            f"{_int(control.get('open_nonconformities_count'))} no conformidades abiertas y "
            f"{_int(control.get('overdue_action_plans_count'))} planes vencidos."
        )
        gaps.append({
            "title": title,
            "description": desc,
            "iso": iso,
            "clause": clause,
            "severity": _severity(control),
            "evidence_status": _evidence_status(control),
            "business_impact": "Riesgo de observación o no conformidad en auditoría si no se oficializa evidencia y se cierran brechas abiertas.",
        })
    return gaps


def _build_actions(gaps: List[Dict[str, Any]], controls: List[Dict[str, Any]], limit: int = 5) -> List[Dict[str, Any]]:
    actions = []
    for index, gap in enumerate(gaps[:limit]):
        control = controls[index] if index < len(controls) else {}
        actions.append({
            "title": f"Regularizar {gap['iso']} {gap['clause']}",
            "description": "Cargar evidencia oficial, revisar hallazgos/NC vinculadas y actualizar planes de acción vencidos hasta dejar trazabilidad verificable.",
            "priority": gap["severity"],
            "target_module": "evidencias" if gap["evidence_status"] != "evidencia_debil" else "plan-accion",
            "suggested_owner_role": "Responsable del proceso y auditor interno ISO",
            "due_days": 15 if gap["severity"] == "alta" else 30,
            "acceptance_criteria": [
                "Evidencia oficial cargada y validada en el sistema",
                "No existen planes vencidos asociados al control",
                "Hallazgos y no conformidades tienen tratamiento documentado",
                "La vista public.v_iso_control_effective_health refleja mejora verificable",
            ],
            "related_control_id": str(control.get("tenant_control_id") or ""),
            "related_iso": gap["iso"],
            "related_clause": gap["clause"],
        })
    return actions


def _rag_results(rag: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [item for item in (rag.get("results") or []) if isinstance(item, dict)]


def _flatten_rag_values(rag_results: List[Dict[str, Any]], key: str, limit: int = 8) -> List[str]:
    values: List[str] = []
    for item in rag_results:
        for value in item.get(key) or []:
            text = str(value or "").strip()
            if text and text not in values:
                values.append(text)
            if len(values) >= limit:
                return values
    return values


def _depth_limits(depth: str) -> Dict[str, int]:
    return {
        "executive": {"gaps": 3, "actions": 3, "questions": 5},
        "standard": {"gaps": 5, "actions": 5, "questions": 8},
        "deep": {"gaps": 8, "actions": 8, "questions": 12},
    }.get(depth, {"gaps": 5, "actions": 5, "questions": 8})


def is_fast_mode(payload: dict, local_compact: bool, depth: str) -> bool:
    options = payload.get("options") if isinstance(payload.get("options"), dict) else {}
    if options.get("fast_mode") is True:
        return True
    if options.get("fast_mode") is False:
        return False
    return _env_bool("AI_ENGINE_FAST_MODE", False) or (local_compact and depth == "executive")


def _avg_effective_health(summaries: List[Dict[str, Any]]) -> float:
    values = [_number(row.get("avg_effective_health_score")) for row in summaries if row.get("avg_effective_health_score") is not None]
    if not values:
        return 0.0
    return round(sum(values) / len(values), 2)


def build_deterministic_preanalysis(context: dict, rag_results: list = None, depth: str = "executive") -> dict:
    rag_results = [item for item in (rag_results or []) if isinstance(item, dict)]
    limits = _depth_limits(depth)
    summaries = context.get("effective_health_summary") if isinstance(context.get("effective_health_summary"), list) else []
    controls = _sort_controls_worst_first(context.get("priority_controls") or [])
    readiness = _readiness(summaries, controls)
    active = sum(_int(row.get("active_scope_controls")) for row in summaries)
    complies = sum(_int(row.get("complies_controls")) for row in summaries)
    without = sum(_int(row.get("controls_without_evidence")) for row in summaries)
    official = sum(_int(row.get("controls_with_official_evidence")) for row in summaries)
    overdue = sum(_int(row.get("overdue_action_plans_count")) for row in summaries)
    open_nc = sum(_int(row.get("open_nonconformities_count")) for row in summaries)
    compliance = round((complies / active * 100), 2) if active else 0
    official_pct = round((official / active * 100), 2) if active else 0
    avg_health = _avg_effective_health(summaries)
    gaps = _build_gaps(controls, limits["gaps"])
    actions = _build_actions(gaps, controls, limits["actions"])
    expected_evidence = _flatten_rag_values(rag_results, "expected_evidence", 10)
    common_gaps = _flatten_rag_values(rag_results, "common_gaps", 8)
    audit_questions = _flatten_rag_values(rag_results, "audit_questions", limits["questions"])
    documents_to_request = _flatten_rag_values(rag_results, "documents_to_request", 8)
    recommended_from_rag = _flatten_rag_values(rag_results, "recommended_actions", 8)
    closure_criteria = _flatten_rag_values(rag_results, "closure_criteria", 8)

    missing_evidence = [
        f"{item} — requerido como sustento operativo según conocimiento normativo interno"
        for item in expected_evidence[:6]
    ]
    for action, rag_action in zip(actions, recommended_from_rag):
        action["description"] = f"{action['description']} Acción RAG sugerida: {rag_action}."
        action["acceptance_criteria"] = list(dict.fromkeys(action.get("acceptance_criteria", []) + closure_criteria[:3]))

    if recommended_from_rag and len(actions) < limits["actions"]:
        for rag_action in recommended_from_rag[: limits["actions"] - len(actions)]:
            actions.append({
                "title": rag_action,
                "description": f"Ejecutar acción recomendada por conocimiento normativo interno: {rag_action}.",
                "priority": "media",
                "target_module": "evidencias",
                "suggested_owner_role": "Responsable del proceso y auditor interno ISO",
                "due_days": 30,
                "acceptance_criteria": closure_criteria[:4] or ["Evidencia verificable cargada", "Responsable asignado", "Cierre revisado por auditor interno"],
                "related_control_id": "",
                "related_iso": str((rag_results[0] or {}).get("standard_code") or ""),
                "related_clause": str((rag_results[0] or {}).get("clause_or_domain") or ""),
            })

    confirmed_facts = [
        f"Según datos internos: {active} controles activos en alcance evaluados por public.v_iso_effective_kpi_summary.",
        f"Según datos internos: cumplimiento efectivo {compliance}% y evidencia oficial {official_pct}%.",
        f"Según datos internos: {without} controles sin evidencia, {overdue} planes vencidos y {open_nc} no conformidades abiertas.",
    ]
    if not active and not controls:
        confirmed_facts = ["Según datos internos: no se recibieron controles activos suficientes para concluir cumplimiento."]

    inferences = [
        f"Inferencia razonada: la preparación de auditoría es {readiness['status']} porque {readiness['reason']}",
    ]
    if without > 0:
        inferences.append("Inferencia razonada: los controles sin evidencia son candidatos prioritarios a observación auditora.")
    if overdue > 0:
        inferences.append("Inferencia razonada: los planes vencidos elevan el riesgo de no conformidad por falta de tratamiento oportuno.")

    diagnosis = (
        f"Según datos internos, el estado de preparación es {readiness['status']}. "
        f"Hay {active} controles activos en alcance, {compliance}% de cumplimiento efectivo, "
        f"{official_pct}% de evidencia oficial y salud promedio {avg_health}%. "
        f"Se priorizan {len(gaps)} brechas y {len(actions)} acciones usando salud efectiva y conocimiento normativo interno."
    )
    executive_summary = (
        f"Preparación {readiness['status']}: {active} controles activos, {compliance}% cumplimiento efectivo, "
        f"{official_pct}% evidencia oficial, {without} controles sin evidencia, {overdue} planes vencidos."
    )
    source_trace = [
        make_source_trace_item("internal_db", "public.v_iso_effective_kpi_summary", "cálculo determinístico de preparación de auditoría"),
        make_source_trace_item("internal_db", "public.v_iso_control_effective_health", "priorización de controles críticos"),
    ]
    if rag_results:
        source_trace.extend(
            make_source_trace_item("rag", item.get("id") or item.get("topic") or "iso_baseline_knowledge", "evidencia esperada y preguntas auditoras")
            for item in rag_results[: limits["gaps"]]
        )

    structured_result = {
        "executive_summary": executive_summary,
        "executive_narrative": executive_summary,
        "auditor_opinion": diagnosis,
        "diagnosis": diagnosis,
        "confirmed_facts": confirmed_facts,
        "inferences": inferences,
        "gaps": gaps,
        "evidence_assessment": {
            "available_evidence": [f"{_int(control.get('evidence_count'))} evidencias en {control.get('iso')} {control.get('clause')}" for control in controls[:6] if _int(control.get("evidence_count")) > 0],
            "official_evidence": [f"{_int(control.get('official_evidence_count'))} oficiales en {control.get('iso')} {control.get('clause')}" for control in controls[:6] if _int(control.get("official_evidence_count")) > 0],
            "weak_evidence": [gap["title"] for gap in gaps if gap["evidence_status"] == "evidencia_debil"] + common_gaps[:3],
            "missing_evidence": [gap["title"] for gap in gaps if gap["evidence_status"] == "sin_evidencia"] + missing_evidence[:6],
        },
        "risk_impact": "Riesgo de hallazgos de auditoría si los controles críticos no tienen evidencia oficial, planes vigentes y cierre de brechas.",
        "audit_readiness": {
            "status": readiness["status"],
            "reason": readiness["reason"],
            "auditor_concerns": [
                "¿Qué evidencia oficial sustenta los controles críticos?",
                "¿Qué planes vencidos siguen afectando controles en alcance?",
                "¿Qué no conformidades abiertas tienen causa raíz y tratamiento verificable?",
            ] + common_gaps[:3],
        },
        "recommended_actions": actions,
        "root_cause_analysis": [
            {
                "issue": gap.get("title"),
                "probable_cause": "Evidencia objetiva insuficiente, responsable de control no formalizado o trazabilidad de cierre incompleta.",
                "evidence_basis": gap.get("evidence_status") or "sin_evidencia",
                "risk_if_not_corrected": gap.get("business_impact") or "Riesgo de observación o no conformidad si no se demuestra operación efectiva.",
                "recommended_corrective_action": gap.get("recommendation") or "Solicitar evidencia oficial, asignar responsable y cerrar brecha con criterio verificable.",
                "owner_role": "Responsable del proceso y auditor interno ISO",
                "due_days": 15 if gap.get("severity") == "alta" else 30,
                "effectiveness_criteria": "Evidencia vigente aprobada, control operando y mejora verificable en el siguiente ciclo de revisión.",
            }
            for gap in gaps[:5]
        ],
        "corrective_actions": [
            {
                "title": action.get("title"),
                "priority": action.get("priority") or "media",
                "description": action.get("description"),
                "owner_role": action.get("suggested_owner_role") or "Responsable del proceso",
                "due_days": action.get("due_days") or 15,
                "required_evidence": (action.get("acceptance_criteria") or [])[:3],
                "closure_criteria": (action.get("acceptance_criteria") or [])[:3],
                "effectiveness_check": "Validar con revisión humana que la acción eliminó la causa y dejó evidencia objetiva del periodo.",
            }
            for action in actions[:6]
        ],
        "evidence_requests": [
            {
                "title": item,
                "reason": "Necesaria para demostrar ejecución real, responsable, periodo cubierto y resultado verificable.",
                "priority": "alta" if index < 3 else "media",
                "related_clause": "",
                "related_control": "",
            }
            for index, item in enumerate((documents_to_request[: limits["questions"]] or missing_evidence[: limits["questions"]]))
        ],
        "audit_questions": [
            {
                "question": item,
                "why_it_matters": "Permite confirmar suficiencia, trazabilidad y eficacia del control.",
                "expected_answer_or_evidence": "Evidencia objetiva vigente, responsable formal, periodo auditado y criterio de aceptación.",
            }
            for item in (audit_questions[: limits["questions"]] or [
                "¿Cuál es el criterio formal para marcar una evidencia como oficial?",
                "¿Qué controles críticos siguen sin evidencia en alcance activo?",
                "¿Quién es responsable del cierre de planes vencidos?",
            ][: limits["questions"]])
        ],
        "management_focus": [
            "Cerrar controles sin evidencia oficial antes de declarar preparación.",
            "Regularizar planes vencidos con responsable, plazo y evidencia de avance.",
            "Validar eficacia de acciones correctivas mediante revisión humana.",
        ],
        "auditor_questions": audit_questions[: limits["questions"]] or [
            "¿Cuál es el criterio formal para marcar una evidencia como oficial?",
            "¿Qué controles críticos siguen sin evidencia en alcance activo?",
            "¿Quién es responsable del cierre de planes vencidos?",
        ][: limits["questions"]],
        "documents_to_request": documents_to_request[: limits["questions"]] or [
            "Política o procedimiento vigente aplicable al control crítico",
            "Registro operacional reciente que demuestre ejecución del control",
            "Evidencia de revisión/aprobación por responsable formal",
        ][: limits["questions"]],
        "web_context_used": [],
        "drive_context_used": [],
        "rag_context_used": [
            f"Como referencia normativa interna: {item.get('standard_code')} / {item.get('topic')} — evidencia esperada y criterios de cierre usados en el análisis"
            for item in rag_results[: limits["gaps"]]
        ],
        "source_trace": source_trace,
        "confidence": min(1.0, 0.55 + (0.1 if active else 0) + (0.1 if rag_results else 0) - (0.1 if without and active and without / active > 0.5 else 0)),
        "limitations": [] if active or controls else ["No hay evidencia suficiente para concluir cumplimiento. Se requieren datos internos antes de emitir diagnóstico."],
    }

    answer = (
        f"{diagnosis}\n\n"
        f"{' '.join(confirmed_facts)} "
        "La recomendación operativa es cerrar primero las brechas con evidencia faltante, planes vencidos o no conformidades abiertas. "
        "Como referencia normativa interna, las acciones incluyen evidencia esperada, preguntas auditoras y criterios de cierre verificables. "
        "Este análisis es determinístico y puede entregarse sin esperar al modelo LLM; el LLM queda reservado para redacción ampliada o análisis profundo."
    )

    result = {
        "readiness": readiness,
        "active": active,
        "complies": complies,
        "without": without,
        "official": official,
        "overdue": overdue,
        "open_nc": open_nc,
        "compliance": compliance,
        "official_pct": official_pct,
        "avg_effective_health_score": avg_health,
        "gaps": gaps,
        "actions": actions,
        "missing_evidence": missing_evidence,
        "common_gaps": common_gaps,
        "audit_questions": audit_questions,
        "documents_to_request": documents_to_request,
        "closure_criteria": closure_criteria,
        "confidence_seed": 0.15 if rag_results else 0.0,
        "answer": answer,
        "structured_result": normalize_ai_structured_result(structured_result),
    }
    return result


def _calculate_confidence(context: Dict[str, Any], used_rag: bool, used_drive: bool, used_web: bool) -> float:
    summaries = context.get("effective_health_summary") if isinstance(context.get("effective_health_summary"), list) else []
    controls = context.get("priority_controls") if isinstance(context.get("priority_controls"), list) else []
    recent_evidences = context.get("recent_evidences") if isinstance(context.get("recent_evidences"), list) else []
    score = 0.5
    if sum(_int(row.get("active_scope_controls")) for row in summaries) >= 10 or len(controls) >= 10:
        score += 0.2
    if recent_evidences:
        score += 0.1
    if used_rag:
        score += 0.1
    if used_drive:
        score += 0.05
    if used_web:
        score += 0.05
    if not summaries and not controls:
        score -= 0.2
    active = sum(_int(row.get("active_scope_controls")) for row in summaries)
    without = sum(_int(row.get("controls_without_evidence")) for row in summaries)
    if active and without / active > 0.5:
        score -= 0.1
    if not used_rag:
        score -= 0.1
    if not used_drive:
        score -= 0.1
    if not used_web:
        score -= 0.1
    return round(max(0.0, min(1.0, score)), 2)


def _web_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    question = str(payload.get("question") or "")
    depth = str((payload.get("options") or {}).get("depth") or "standard")
    topics = ["iso_best_practices"]
    lowered = question.lower()
    if any(term in lowered for term in ["ciber", "vulnerabilidad", "cloud", "hardening", "privacidad", "regulación", "regulacion", "ia"]):
        topics.extend(["cybersecurity_threats", "cloud_security"])
    return {
        "allow_web_context": bool((payload.get("options") or {}).get("use_web", True)),
        "requested_output": "audit_preparation" if depth in {"standard", "deep"} else "global_analysis",
        "web_context_topics": topics,
        "tenant_context": {"tenant_id": payload.get("tenant_id")},
    }


def _build_llm_user_prompt(
    payload: Dict[str, Any],
    context: Dict[str, Any],
    deterministic_result: Dict[str, Any],
    rag: Dict[str, Any] = None,
    local_compact: bool = False,
) -> str:
    rag_context = "\n".join(rag.get("rag_context_used") or []) if isinstance(rag, dict) else ""
    compact = {
        "task_type": payload.get("task_type"),
        "tenant_id": payload.get("tenant_id"),
        "module_origin": payload.get("module_origin"),
        "question": payload.get("question"),
        "local_compact": local_compact,
        "CONOCIMIENTO NORMATIVO INTERNO DISPONIBLE": rag_context,
        "context": {
            "tenant": context.get("tenant"),
            "scope": context.get("scope"),
            "effective_health_summary": (context.get("effective_health_summary") or [])[:10],
            "priority_controls": (context.get("priority_controls") or [])[:20],
            "recent_evidences": (context.get("recent_evidences") or [])[:10],
            "recent_findings": (context.get("recent_findings") or [])[:10],
            "recent_nonconformities": (context.get("recent_nonconformities") or [])[:10],
            "recent_action_plans": (context.get("recent_action_plans") or [])[:10],
            "documents": (context.get("documents") or [])[:10],
            "company_profile": context.get("company_profile") or {},
            "source_trace": context.get("source_trace") or [],
            "limitations": context.get("limitations") or [],
        },
        "deterministic_baseline": {
            "answer": deterministic_result.get("answer"),
            "structured_result": deterministic_result.get("structured_result"),
            "preanalysis": deterministic_result.get("preanalysis"),
        },
        "required_output": (
            "Devuelve JSON válido con answer y structured_result completo, todo en español. "
            "structured_result debe incluir confirmed_facts, reasoned_inferences, evidence_requested, "
            "auditor_questions, business_risk, action_plan_recommendations y limitations. "
            "No inventes hechos ni evidencias. Los datos internos del tenant son la fuente de verdad. "
            "RAG, web y Drive son solo contexto de apoyo y nunca reemplazan evidencia interna."
        ),
    }
    return json.dumps(compact, ensure_ascii=False, default=str)


def analyze_with_senior_auditor_v2(payload: Dict[str, Any]) -> Dict[str, Any]:
    started_at = time.perf_counter()
    if not isinstance(payload, dict):
        payload = {}
    tenant_id = str(payload.get("tenant_id") or "")
    if not tenant_id:
        raise ValueError("tenant_id requerido")
    payload["locale"] = "es"
    original_context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    options = payload.get("options") if isinstance(payload.get("options"), dict) else {}
    request_metadata = payload.get("request_metadata") if isinstance(payload.get("request_metadata"), dict) else {}
    request_id = str(request_metadata.get("request_id") or payload.get("request_id") or "")
    timings_ms: Dict[str, int] = {}
    depth = str(options.get("depth") or "standard")
    if depth not in {"executive", "standard", "deep"}:
        depth = "standard"
    model_mode = _normalize_model_mode(options)
    llm_metadata = get_llm_metadata(depth=depth, model_mode=model_mode)
    local_compact = is_local_compact_mode(payload, llm_metadata)
    limits = _compact_limits_from_options(options)
    context_started_at = time.perf_counter()
    context = build_compact_ai_context(original_context, depth, limits) if local_compact else original_context
    used_company_profile = bool(
        original_context.get("company_profile")
        or context.get("company_profile")
        or request_metadata.get("used_company_profile")
        or options.get("used_company_profile")
    )
    timings_ms["context_compact_ms"] = int((time.perf_counter() - context_started_at) * 1000)
    payload_for_sources = {**payload, "context": context, "options": dict(options)}
    source_policy = resolve_source_policy(payload_for_sources, local_compact, depth)
    payload_for_sources["options"].update({
        "use_rag": source_policy["use_rag"],
        "use_drive": source_policy["use_drive"],
        "use_web": source_policy["use_web"],
        "rag_limit": source_policy["rag_limit"],
    })
    summaries = context.get("effective_health_summary") if isinstance(context.get("effective_health_summary"), list) else []
    controls = context.get("priority_controls") if isinstance(context.get("priority_controls"), list) else []
    limitations = list(context.get("limitations") or []) + source_policy.get("limitations", [])
    if local_compact and not COMPACT_PROMPT_PATH.exists():
        limitations.append("Prompt compacto no disponible; se usó prompt maestro completo como fallback.")
    source_trace = normalize_source_trace(context.get("source_trace") or [])
    pre = apply_pre_analysis_guardrails(payload)
    limitations.extend(pre.get("limitations") or [])
    source_trace.extend(pre.get("source_trace") or [])

    rag = drive = web = {"used": False, "limitations": []}
    sources_started_at = time.perf_counter()
    for name, fn, args in [
        ("rag", build_rag_context, (payload_for_sources,)),
        ("drive", build_drive_context, (payload_for_sources,)),
        ("web", build_external_context, (_web_payload(payload_for_sources),)),
    ]:
        try:
            if name == "drive" and not source_policy["use_drive"]:
                continue
            if name == "web" and not source_policy["use_web"]:
                continue
            result = fn(*args)
            if name == "rag":
                rag = result
            elif name == "drive":
                drive = result
            else:
                web = result
        except Exception as exc:
            limitations.append(f"{name}: fuente complementaria no disponible ({str(exc)[:120]})")
    timings_ms["sources_ms"] = int((time.perf_counter() - sources_started_at) * 1000)

    limitations.extend(rag.get("limitations") or [])
    limitations.extend(drive.get("limitations") or [])
    limitations.extend(web.get("limitations") or [])
    source_trace.extend(rag.get("source_trace") or [])
    source_trace.extend(drive.get("source_trace") or [])

    if web.get("used"):
        source_trace.append(make_source_trace_item("web", "Brave Search", "buenas prácticas externas actuales"))
    elif web.get("reason"):
        limitations.append(str(web.get("reason")))

    preanalysis_started_at = time.perf_counter()
    preanalysis = build_deterministic_preanalysis(context, _rag_results(rag), depth)
    timings_ms["preanalysis_ms"] = int((time.perf_counter() - preanalysis_started_at) * 1000)
    readiness = preanalysis["readiness"]
    active = preanalysis["active"]
    complies = preanalysis["complies"]
    without = preanalysis["without"]
    official = preanalysis["official"]
    overdue = preanalysis["overdue"]
    open_nc = preanalysis["open_nc"]
    compliance = preanalysis["compliance"]
    official_pct = preanalysis["official_pct"]
    gaps = preanalysis["gaps"]
    actions = preanalysis["actions"]

    facts = [
        f"Según datos internos: {active} controles activos en alcance evaluados por public.v_iso_effective_kpi_summary.",
        f"Según datos internos: cumplimiento efectivo {compliance}% y evidencia oficial {official_pct}%.",
        f"Según datos internos: {without} controles sin evidencia, {overdue} planes vencidos y {open_nc} no conformidades abiertas.",
    ]
    if not active and not controls:
        facts = ["Según datos internos: no se recibieron controles activos, evidencias ni planes suficientes para concluir cumplimiento."]

    inferences = [
        f"Inferencia razonada: la preparación de auditoría es {readiness['status']} porque {readiness['reason']}",
    ]
    if without > 0:
        inferences.append("Inferencia razonada: los controles sin evidencia serán foco probable de preguntas auditoras y deben priorizarse antes de cualquier auditoría formal.")

    diagnosis = (
        f"Según datos internos, el tenant presenta preparación {readiness['status']}. "
        f"El análisis se basa en salud ISO efectiva, controles activos en alcance, evidencia oficial, hallazgos, no conformidades y planes vencidos. "
        f"Se detectaron {len(gaps)} brechas prioritarias y {len(actions)} acciones recomendadas. "
        "La referencia externa o documental se usa solo como complemento y no reemplaza la evidencia interna."
    )

    answer = (
        f"{diagnosis}\n\n"
        f"Según datos internos: existen {active} controles activos evaluables; {complies} cumplen, {without} no tienen evidencia y {official} tienen evidencia oficial computable. "
        f"El cumplimiento efectivo promedio calculado es {compliance}% y la cobertura de evidencia oficial es {official_pct}%. "
        f"Hay {overdue} planes de acción vencidos y {open_nc} no conformidades abiertas que pueden afectar la preparación de auditoría.\n\n"
        "Inferencia razonada: el foco operativo debe estar en cerrar brechas con impacto auditor, no en producir documentación genérica. "
        "Primero deben oficializarse evidencias de controles críticos, actualizar planes vencidos con responsable y fecha futura, y resolver no conformidades abiertas con trazabilidad de causa raíz y criterio de cierre. "
        "Cada acción sugerida debe ejecutarse en el módulo correspondiente y validarse por un responsable humano antes de considerarse cerrada.\n\n"
        "Limitación del análisis: Google Drive, RAG o Brave pueden aportar contraste y mejores prácticas, pero no sustituyen la evidencia interna ni permiten declarar certificación."
    )

    confidence = min(1.0, _calculate_confidence(context, bool(rag.get("used")), bool(drive.get("used")), bool(web.get("used"))) + preanalysis.get("confidence_seed", 0))
    deterministic_structured = preanalysis.get("structured_result") if isinstance(preanalysis.get("structured_result"), dict) else {}
    structured = normalize_ai_structured_result({
        **deterministic_structured,
        "executive_summary": f"Preparación {readiness['status']}: {active} controles activos, {compliance}% cumplimiento efectivo, {official_pct}% evidencia oficial, {without} controles sin evidencia.",
        "diagnosis": diagnosis,
        "confirmed_facts": facts,
        "inferences": inferences,
        "gaps": gaps,
        "evidence_assessment": {
            "available_evidence": [f"{_int(control.get('evidence_count'))} evidencias en {control.get('iso')} {control.get('clause')}" for control in controls[:6] if _int(control.get("evidence_count")) > 0],
            "official_evidence": [f"{_int(control.get('official_evidence_count'))} oficiales en {control.get('iso')} {control.get('clause')}" for control in controls[:6] if _int(control.get("official_evidence_count")) > 0],
            "weak_evidence": [gap["title"] for gap in gaps if gap["evidence_status"] == "evidencia_debil"] + preanalysis["common_gaps"][:3],
            "missing_evidence": [gap["title"] for gap in gaps if gap["evidence_status"] == "sin_evidencia"] + preanalysis["missing_evidence"][:6],
        },
        "risk_impact": "Riesgo de hallazgos mayores si controles críticos carecen de evidencia oficial, planes vigentes y cierre de no conformidades.",
        "audit_readiness": {
            "status": readiness["status"],
            "reason": readiness["reason"],
            "auditor_concerns": [
                "¿Qué evidencia oficial sustenta los controles críticos?",
                "¿Por qué existen planes vencidos y quién aprobó la extensión?",
                "¿Las no conformidades abiertas tienen causa raíz y tratamiento verificable?",
            ] + preanalysis["common_gaps"][:3],
        },
        "recommended_actions": actions,
        "auditor_questions": [
            "¿Cuál es el criterio formal para marcar una evidencia como oficial?",
            "¿Qué controles críticos siguen sin evidencia en alcance activo?",
            "¿Quién es responsable del cierre de planes vencidos?",
            "¿Cómo se verifica la eficacia de las acciones correctivas?",
        ] + preanalysis["audit_questions"][:6],
        "documents_to_request": [
            "Política o procedimiento vigente aplicable al control crítico",
            "Registro operacional reciente que demuestre ejecución del control",
            "Evidencia de revisión/aprobación por responsable formal",
        ] + preanalysis["documents_to_request"][:6],
        "web_context_used": [
            f"Como referencia externa: {item.get('url')} — {item.get('summary')}"
            for item in (web.get("sources") or [])[:5]
        ],
        "drive_context_used": drive.get("drive_context_used") or [],
        "rag_context_used": rag.get("rag_context_used") or [],
        "source_trace": source_trace + [make_source_trace_item("prompt_inference", "iso_senior_auditor.md", "razonamiento auditor determinístico")],
        "confidence": confidence,
        "limitations": list(dict.fromkeys(limitations)),
    })

    if not structured["diagnosis"]:
        structured = build_fallback_structured_result(answer, context, limitations)

    engine_model = "deterministic_senior_auditor_v2"
    llm_used = False
    fast_mode = is_fast_mode(payload, local_compact, depth)
    use_llm_in_fast_mode = options.get("use_llm_in_fast_mode") is True
    llm_skipped_reason = ""
    llm_error_safe = ""
    if fast_mode and not use_llm_in_fast_mode:
        llm_skipped_reason = "fast_mode_deterministic_response"
        structured["limitations"] = list(dict.fromkeys(
            (structured.get("limitations") or []) +
            ["Modo rápido ejecutivo: análisis generado con datos internos, salud efectiva y RAG sin esperar al LLM."]
        ))
    elif is_llm_available():
        try:
            print(json.dumps({
                "event": "OLLAMA REQUEST START" if llm_metadata.get("provider") == "ollama" else "LLM REQUEST START",
                "request_id": request_id or None,
                "tenant_id": tenant_id,
                "model_mode": model_mode,
                "selected_model": llm_metadata.get("model"),
                "provider": llm_metadata.get("provider"),
                "used_company_profile": used_company_profile,
            }, ensure_ascii=False, default=str))
            llm_started_at = time.perf_counter()
            llm_raw = call_llm_json(
                prompt=_build_llm_user_prompt(
                    payload,
                    context,
                    {"answer": answer, "structured_result": structured, "preanalysis": preanalysis},
                    rag,
                    local_compact,
                ),
                system_prompt=_load_prompt(local_compact),
                temperature=0.2,
                timeout=60,
                depth=depth,
                local_compact=local_compact,
                model_mode=model_mode,
            )
            timings_ms["llm_ms"] = int((time.perf_counter() - llm_started_at) * 1000)
            llm_structured = normalize_ai_structured_result(llm_raw, defaults=structured)
            llm_structured["confidence"] = structured["confidence"]
            llm_structured["source_trace"] = normalize_source_trace(
                (llm_structured.get("source_trace") or []) + structured.get("source_trace", [])
            )
            llm_structured["limitations"] = list(dict.fromkeys(
                (llm_structured.get("limitations") or []) + structured.get("limitations", [])
            ))
            answer = str(llm_raw.get("answer") or answer) if isinstance(llm_raw, dict) else answer
            structured = llm_structured
            llm_used = True
            engine_model = f"{llm_metadata.get('provider')}/{llm_metadata.get('model')}"
            print(json.dumps({
                "event": "OLLAMA REQUEST OK" if llm_metadata.get("provider") == "ollama" else "LLM REQUEST OK",
                "request_id": request_id or None,
                "tenant_id": tenant_id,
                "model_mode": model_mode,
                "selected_model": llm_metadata.get("model"),
                "duration_ms": timings_ms.get("llm_ms", 0),
                "used_company_profile": used_company_profile,
            }, ensure_ascii=False, default=str))
        except Exception as exc:
            timings_ms["llm_ms"] = timings_ms.get("llm_ms", 0)
            provider = llm_metadata.get("provider") or "desconocido"
            model = llm_metadata.get("model") or "sin_modelo"
            llm_error_safe = "LLM unavailable, deterministic fallback used"
            structured["limitations"].append(
                f"Proveedor LLM falló — análisis generado por fallback determinístico. Proveedor: {provider}, modelo: {model}."
            )
            limitations.append(f"Proveedor LLM falló — análisis generado por fallback determinístico. Modelo intentado: {model}")
            engine_model = "deterministic_senior_auditor_v2"
            print(json.dumps({
                "event": "OLLAMA REQUEST ERROR" if llm_metadata.get("provider") == "ollama" else "LLM REQUEST ERROR",
                "request_id": request_id or None,
                "tenant_id": tenant_id,
                "model_mode": model_mode,
                "selected_model": model,
                "error": str(exc)[:220],
                "used_company_profile": used_company_profile,
            }, ensure_ascii=False, default=str))
    else:
        timings_ms["llm_ms"] = 0
        structured["limitations"].append(
            "Proveedor LLM no configurado — análisis generado por motor determinístico basado en contexto interno"
        )
        limitations.append("Proveedor LLM no configurado — análisis generado por motor determinístico basado en contexto interno")

    duration_ms = int((time.perf_counter() - started_at) * 1000)
    timings_ms["total_ms"] = duration_ms
    mode = "fast_mode" if fast_mode else ("llm" if llm_used else ("local_compact" if local_compact else "deterministic"))
    result = {
        "ok": True,
        "answer": answer,
        "structured_result": structured,
        "source_trace": structured["source_trace"],
        "confidence": structured["confidence"],
        "limitations": structured["limitations"],
        "engine": {
            "prompt_version": PROMPT_VERSION,
            "context_version": context.get("scope", {}).get("context_version") or CONTEXT_VERSION,
            "model": engine_model,
            "request_id": request_id or None,
            "llm_provider": llm_metadata.get("provider"),
            "model_mode": llm_metadata.get("model_mode"),
            "selected_model": llm_metadata.get("model"),
            "async_mode": bool(options.get("async_mode") is True),
            "estimated_mode_cost": _estimated_mode_cost(model_mode),
            "llm_available": llm_metadata.get("available") is True,
            "used_llm": llm_used,
            "fast_mode": fast_mode,
            "llm_skipped_reason": llm_skipped_reason,
            "llm_error_safe": llm_error_safe,
            "used_internal_context": True,
            "used_rag": bool(rag.get("used")),
            "used_drive": bool(drive.get("used")),
            "used_web": bool(web.get("used")),
            "used_company_profile": used_company_profile,
            "used_documents": bool(drive.get("used")) or bool((context.get("documents") or [])),
            "local_compact": local_compact,
            "compact_reason": "ollama_provider" if local_compact and llm_metadata.get("provider") == "ollama" else ("request_or_env" if local_compact else ""),
            "context_limits": limits if local_compact else {},
            "compact_context_summary": context.get("compact_context_summary") or {},
            "ollama_options": get_ollama_generation_options(depth, local_compact, 0.2) if llm_metadata.get("provider") == "ollama" else {},
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "duration_ms": duration_ms,
            "timings_ms": timings_ms,
        },
        "metrics": {
            "duration_ms": duration_ms,
            "request_id": request_id or None,
            "mode": mode,
            "model_mode": model_mode,
            "async_mode": bool(options.get("async_mode") is True),
            "estimated_mode_cost": _estimated_mode_cost(model_mode),
            "fast_mode": fast_mode,
            "local_compact": local_compact,
            "used_llm": llm_used,
            "used_rag": bool(rag.get("used")),
            "used_drive": bool(drive.get("used")),
            "used_web": bool(web.get("used")),
            "used_company_profile": used_company_profile,
            "used_documents": bool(drive.get("used")) or bool((context.get("documents") or [])),
            "model": engine_model,
            "timings_ms": timings_ms,
        },
    }
    print(json.dumps({
        "event": "senior_auditor_v2_timing",
        "request_id": request_id or None,
        "tenant_id": tenant_id,
        "depth": depth,
        "mode": mode,
        "model": engine_model,
        "timings_ms": timings_ms,
    }, ensure_ascii=False, default=str))
    return apply_post_analysis_guardrails(result, context)
