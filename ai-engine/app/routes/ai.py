import os
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.guided_endpoint_adapter import (
    generate_health_summary,
    generate_finding_analysis,
    generate_nonconformity_draft,
    generate_action_plan,
    generate_executive_brief,
)
from app.services.ai_diagnostics import build_ai_context_diagnostic
from app.services.finding_scenario_detector import detect_finding_scenario
from app.services.scenario_response_enricher import enrich_ai_response_with_scenario
from app.services.external_lookup_service import build_external_lookup_plan
from app.services.external_lookup_service import execute_external_lookup_search
from app.services.external_lookup_service import get_cached_external_lookup
from app.services.knowledge_loader import get_knowledge_module, get_knowledge_status
from app.services.senior_auditor_service import analyze_as_senior_auditor
from app.services.llm_client import call_llm_json, get_llm_metadata, is_llm_available
from app.services.web_context_service import build_external_context
from app.services.bootstrap_knowledge_service import (
    approve_bootstrap_knowledge_item,
    get_bootstrap_status,
    list_pending_bootstrap_knowledge,
    load_brave_knowledge,
    load_seed_knowledge,
    reject_bootstrap_knowledge_item,
    search_bootstrap_knowledge,
)
from app.core.config import settings
from app.services.language_service import localize_ai_response, normalize_locale

router = APIRouter(prefix="/api/ai", tags=["AI"])


def _payload_to_dict(payload):
    if isinstance(payload, dict):
        return payload

    if hasattr(payload, "model_dump"):
        return payload.model_dump()

    if hasattr(payload, "dict"):
        return payload.dict()

    return dict(payload)


class HealthSummaryRequest(BaseModel):
    tenant_id: str
    tenant_name: str
    standards: List[str] = Field(default_factory=list)
    controls_total: int = 0
    controls_warning: int = 0
    controls_critical: int = 0
    evidences_pending: int = 0
    findings_critical: int = 0


class FindingAnalysisRequest(BaseModel):
    tenant_id: str
    finding_id: Optional[str] = None
    iso_code: Optional[str] = None
    title: str
    description: str = ""
    severity: str = "media"
    status: str = "open"
    owner: Optional[str] = None
    due_date: Optional[str] = None


class NonconformityDraftRequest(BaseModel):
    tenant_id: str
    iso_code: str
    title: str
    description: str
    severity: str = "media"


class ActionPlanSuggestionRequest(BaseModel):
    tenant_id: str
    iso_code: Optional[str] = None
    finding_id: Optional[str] = None
    title: str
    description: str = ""
    severity: str = "media"
    status: str = "open"


class ExecutiveBriefRequest(BaseModel):
    tenant_id: str
    tenant_name: str
    period: str = "Periodo actual"
    standards: List[str] = Field(default_factory=list)
    controls_total: int = 0
    controls_warning: int = 0
    controls_critical: int = 0
    evidences_pending: int = 0
    findings_critical: int = 0
    weakest_standards: List[str] = Field(default_factory=list)


def _request_locale(payload: Optional[Dict[str, Any]] = None, header_locale: Optional[str] = None) -> str:
    payload = payload if isinstance(payload, dict) else {}
    return normalize_locale(
        payload.get("locale")
        or payload.get("language")
        or payload.get("response_language")
        or header_locale
    )


def validate_internal_token(token: Optional[str]) -> None:
    if not settings.AI_INTERNAL_TOKEN:
        raise HTTPException(status_code=503, detail="AI token not configured")

    if token != settings.AI_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized AI internal token")


def _with_runtime_metrics(result: Dict[str, Any], *, started_at: float, endpoint: str, mode: str = "deterministic") -> Dict[str, Any]:
    if not isinstance(result, dict):
        result = {"ok": True, "result": result}
    duration_ms = int((time.perf_counter() - started_at) * 1000)
    engine = result.get("engine") if isinstance(result.get("engine"), dict) else {}
    metrics = {
        "duration_ms": duration_ms,
        "endpoint": endpoint,
        "mode": mode,
        "fast_mode": engine.get("fast_mode", mode in {"fast_mode", "deterministic"}),
        "local_compact": engine.get("local_compact", True),
        "used_llm": engine.get("used_llm", False),
        "used_rag": engine.get("used_rag", False),
        "used_drive": engine.get("used_drive", False),
        "used_web": engine.get("used_web", False),
    }
    return {
        **result,
        "engine": {
            "fast_mode": metrics["fast_mode"],
            "used_llm": metrics["used_llm"],
            "local_compact": metrics["local_compact"],
            "used_rag": metrics["used_rag"],
            "used_drive": metrics["used_drive"],
            "used_web": metrics["used_web"],
            "model": engine.get("model") or "deterministic_legacy_guided",
            **engine,
            "duration_ms": duration_ms,
        },
        "metrics": {
            **(result.get("metrics") if isinstance(result.get("metrics"), dict) else {}),
            **metrics,
        },
    }


def _truthy(value: Any, fallback: bool = False) -> bool:
    if value is None or value == "":
        return fallback
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "si", "sí", "on"}


def _as_list(value: Any, limit: int = 8) -> List[Any]:
    if isinstance(value, list):
        return value[:limit]
    if isinstance(value, str):
        return [item.strip() for item in value.replace("\n", ",").split(",") if item.strip()][:limit]
    return []


def _safe_text(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    if isinstance(value, (str, int, float, bool)):
        text = str(value).strip()
        return text or fallback
    if isinstance(value, dict):
        return _safe_text(value.get("title") or value.get("name") or value.get("summary") or value.get("description"), fallback)
    return fallback


def _context_stats(payload: Dict[str, Any]) -> Dict[str, Any]:
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    return {
        "controls": payload.get("controls") or context.get("controls") or context.get("control_health") or [],
        "evidences": payload.get("evidences") or context.get("evidences") or [],
        "findings": payload.get("findings") or context.get("findings") or [],
        "action_plans": payload.get("action_plans") or context.get("action_plans") or [],
        "risks": payload.get("risks") or context.get("risks") or [],
        "kpis": payload.get("kpis") or context.get("kpis") or [],
        "stats": payload.get("stats") or context.get("stats") or {},
    }


def _external_context_payload(payload: Dict[str, Any], *, query: str = "") -> Dict[str, Any]:
    options = payload.get("options") if isinstance(payload.get("options"), dict) else {}
    metadata = payload.get("request_metadata") if isinstance(payload.get("request_metadata"), dict) else {}
    company_profile = payload.get("company_profile") or payload.get("profile") or payload.get("context", {}).get("company_profile", {})
    if not isinstance(company_profile, dict):
        company_profile = {}
    return {
        "tenant_context": {
            "tenant_id": payload.get("tenant_id"),
            "tenant_name": company_profile.get("company_name") or company_profile.get("legal_name") or "",
        },
        "allow_web_context": _truthy(payload.get("allow_web_research"), _truthy(payload.get("use_web"), _truthy(options.get("use_web")))),
        "use_web": _truthy(payload.get("use_web"), _truthy(options.get("use_web"))),
        "allow_web_research": _truthy(payload.get("allow_web_research"), _truthy(company_profile.get("allow_web_research"))),
        "requested_output": payload.get("requested_output") or "report",
        "query": query or payload.get("query") or payload.get("question") or "",
        "industry": payload.get("industry") or company_profile.get("industry") or company_profile.get("profile_json", {}).get("industry"),
        "subindustry": payload.get("subindustry") or company_profile.get("subindustry") or company_profile.get("profile_json", {}).get("subindustry"),
        "standards": payload.get("active_standards") or payload.get("standards") or payload.get("context", {}).get("active_standards") or [],
        "request_metadata": {"use_web": _truthy(metadata.get("use_web"), False)},
        "company_profile": company_profile,
        "web_context_topics": payload.get("web_context_topics") or ["iso_best_practices", "risk_management"],
    }


def _build_report_fallback(payload: Dict[str, Any], external_context: Dict[str, Any]) -> Dict[str, Any]:
    stats = _context_stats(payload)
    controls = _as_list(stats["controls"], 5)
    findings = _as_list(stats["findings"], 5)
    risks = _as_list(stats["risks"], 5)
    actions = _as_list(stats["action_plans"], 5)
    title = _safe_text(payload.get("report_type_code"), "reporte ISO")
    executive_summary = (
        f"Análisis ejecutivo generado con datos internos para {title}. "
        "Se priorizan brechas de evidencia, riesgos, hallazgos y acciones abiertas para revisión humana."
    )
    gaps = [
        {
            "title": _safe_text(item, f"Brecha prioritaria {idx + 1}"),
            "severity": _safe_text(item.get("severity") if isinstance(item, dict) else "", "media"),
            "description": _safe_text(item.get("description") if isinstance(item, dict) else item, "Requiere revisión y evidencia objetiva."),
        }
        for idx, item in enumerate(findings or controls)
    ][:5]
    corrective_actions = [
        {
            "title": _safe_text(item.get("title") if isinstance(item, dict) else item, f"Acción correctiva {idx + 1}"),
            "priority": _safe_text(item.get("priority") if isinstance(item, dict) else "", "alta" if idx < 2 else "media"),
            "description": "Asignar responsable, completar evidencia, cerrar la brecha y verificar eficacia.",
            "owner_role": _safe_text(item.get("owner") if isinstance(item, dict) else "", "Responsable del proceso"),
            "due_days": 15 if idx < 3 else 30,
            "required_evidence": ["Evidencia objetiva vigente", "Aprobación del responsable", "Registro de verificación"],
            "closure_criteria": ["Brecha cerrada", "Evidencia validada", "Eficacia revisada"],
            "effectiveness_check": "Validar que la causa no se repite en el siguiente ciclo de control.",
        }
        for idx, item in enumerate(actions or gaps or risks or [1, 2, 3])
    ][:6]
    evidence_requests = [
        {
            "title": _safe_text(item.get("title") if isinstance(item, dict) else item, f"Evidencia requerida {idx + 1}"),
            "reason": "Demostrar ejecución real, periodo cubierto, responsable y resultado.",
            "priority": "alta" if idx < 3 else "media",
            "related_clause": _safe_text(item.get("clause") if isinstance(item, dict) else ""),
            "related_control": _safe_text(item.get("control") if isinstance(item, dict) else ""),
        }
        for idx, item in enumerate(controls or findings or [1, 2, 3])
    ][:6]
    return {
        "executive_summary": executive_summary,
        "diagnosis": "La lectura debe validarse contra evidencia interna y revisión humana.",
        "root_cause_analysis": [
            {
                "issue": gap.get("title"),
                "probable_cause": "Evidencia insuficiente, trazabilidad incompleta o responsable no formalizado.",
                "evidence_basis": "Datos internos TCDX disponibles para el tenant.",
                "risk_if_not_corrected": "Riesgo de observación o no conformidad en auditoría.",
                "recommended_corrective_action": "Formalizar evidencia y verificar eficacia.",
                "owner_role": "Responsable del proceso",
                "due_days": 15,
                "effectiveness_criteria": "Control operando con evidencia aprobada en el siguiente ciclo.",
            }
            for gap in gaps[:5]
        ],
        "corrective_actions": corrective_actions,
        "evidence_requests": evidence_requests,
        "audit_questions": [
            {
                "question": "¿Qué evidencia objetiva demuestra la operación del control?",
                "why_it_matters": "Permite confirmar trazabilidad y suficiencia.",
                "expected_answer_or_evidence": "Registro vigente, responsable, periodo y aprobación.",
            }
        ],
        "management_focus": ["Cerrar evidencias críticas", "Revisar planes vencidos", "Priorizar riesgos residuales altos"],
        "improvement_roadmap": ["30 días: cerrar brechas críticas", "60 días: validar eficacia", "90 días: consolidar revisión gerencial"],
        "proposed_objectives": [],
        "proposed_kpis": [],
        "suggested_controls": [],
        "industry_references": (external_context.get("sources") or [])[:6],
        "external_context": external_context,
    }


def _build_company_profile_fallback(payload: Dict[str, Any], external_context: Dict[str, Any]) -> Dict[str, Any]:
    profile = payload.get("company_profile") or payload.get("profile") or {}
    if not isinstance(profile, dict):
        profile = {}
    profile_json = profile.get("profile_json") if isinstance(profile.get("profile_json"), dict) else profile
    industry = payload.get("industry") or profile.get("industry") or profile_json.get("industry") or "industria no informada"
    return {
        "normalized_company_profile": profile_json,
        "executive_narrative": f"Perfil empresa registrado para contexto ISO en {industry}. El análisis prioriza alcance, procesos críticos, riesgos y evidencia esperada.",
        "industry_assumptions": [f"Contexto sectorial: {industry}"],
        "industry_references": (external_context.get("sources") or [])[:6],
        "iso_scope_recommendations": [_safe_text(profile_json.get("audit_scope"), "Definir alcance formal, exclusiones justificadas, procesos críticos y sedes incluidas.")],
        "proposed_objectives": _as_list(profile_json.get("quality_objectives") or profile_json.get("strategic_objectives"), 6),
        "proposed_kpis": ["Cumplimiento de evidencias críticas", "Cierre de acciones en plazo", "Eficacia de controles clave"],
        "suggested_controls": ["Control documental", "Gestión de acciones correctivas", "Revisión gerencial", "Gestión de riesgos"],
        "typical_industry_risks": _as_list(profile_json.get("known_weaknesses") or profile_json.get("pain_points"), 6),
        "suggested_evidence_baseline": ["Alcance aprobado", "Matriz de riesgos", "Planes de acción", "Registros operacionales", "Revisión gerencial"],
        "maturity_baseline": _safe_text(payload.get("maturity_level") or profile.get("maturity_level") or profile_json.get("current_maturity_level"), "Requiere evaluación"),
        "audit_focus_areas": ["Evidencia objetiva", "Trazabilidad de decisiones", "Cierre y eficacia de acciones"],
        "corrective_action_themes": ["Formalización documental", "Responsables y plazos", "Validación de eficacia"],
        "improvement_roadmap": ["30 días: completar perfil y evidencias base", "60 días: cerrar brechas críticas", "90 días: revisión gerencial y KPIs"],
        "limits_and_assumptions": ["La información externa apoya contexto; la evidencia interna es fuente de verdad."],
        "external_context": external_context,
    }


def _llm_structured_enrichment(payload: Dict[str, Any], base: Dict[str, Any], *, model_mode: str, depth: str, request_id: str, endpoint: str) -> Dict[str, Any]:
    if not _truthy(payload.get("use_llm"), model_mode != "fast"):
        return {"used": False, "data": {}, "error": "", "metadata": get_llm_metadata(depth=depth, model_mode=model_mode)}
    metadata = get_llm_metadata(depth=depth, model_mode=model_mode)
    if not is_llm_available():
        return {"used": False, "data": {}, "error": "llm_unavailable", "metadata": metadata}
    prompt = {
        "instruction": "Devuelve exclusivamente JSON válido. No inventes hechos. Usa datos internos como fuente de verdad.",
        "endpoint": endpoint,
        "request_id": request_id,
        "payload_summary": {
            "tenant_id": payload.get("tenant_id"),
            "report_type_code": payload.get("report_type_code"),
            "period": payload.get("period"),
            "company_profile": payload.get("company_profile") or payload.get("profile") or payload.get("context", {}).get("company_profile"),
            "context_keys": list((payload.get("context") or {}).keys())[:30] if isinstance(payload.get("context"), dict) else [],
        },
        "base_result": base,
        "required_shape": [
            "executive_summary/executive_narrative",
            "diagnosis/auditor_opinion",
            "root_cause_analysis",
            "corrective_actions",
            "evidence_requests",
            "audit_questions",
            "management_focus",
            "improvement_roadmap",
            "proposed_objectives",
            "proposed_kpis",
            "suggested_controls",
            "limitations",
        ],
    }
    try:
        started = time.perf_counter()
        print({
            "event": "OLLAMA REQUEST START",
            "request_id": request_id,
            "endpoint": endpoint,
            "model_mode": model_mode,
            "selected_model": metadata.get("model"),
            "timeout_ms": payload.get("timeout_ms"),
        })
        data = call_llm_json(
            prompt=str(prompt),
            system_prompt="Eres un auditor ISO senior. Responde solo JSON estructurado en español.",
            temperature=0.2,
            timeout=int(int(payload.get("timeout_ms") or 420000) / 1000),
            depth=depth,
            local_compact=True,
            model_mode=model_mode,
        )
        print({
            "event": "OLLAMA REQUEST OK",
            "request_id": request_id,
            "endpoint": endpoint,
            "model_mode": model_mode,
            "selected_model": metadata.get("model"),
            "duration_ms": int((time.perf_counter() - started) * 1000),
        })
        return {"used": True, "data": data if isinstance(data, dict) else {}, "error": "", "metadata": metadata}
    except Exception as exc:
        print({
            "event": "OLLAMA REQUEST ERROR",
            "request_id": request_id,
            "endpoint": endpoint,
            "model_mode": model_mode,
            "selected_model": metadata.get("model"),
            "error_type": type(exc).__name__,
            "error_message": str(exc)[:240],
        })
        return {"used": False, "data": {}, "error": str(exc)[:500], "metadata": metadata}


@router.post("/suggest/health-summary")
def suggest_health_summary(
    payload: HealthSummaryRequest,
    x_ai_token: Optional[str] = Header(default=None),
    x_tcdx_locale: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    started_at = time.perf_counter()
    try:
        payload_dict = _payload_to_dict(payload)
        locale = _request_locale(payload_dict, x_tcdx_locale)
        payload_dict.update({'locale': locale, 'language': locale, 'response_language': locale})
        result = localize_ai_response(generate_health_summary(payload_dict), locale)
        return _with_runtime_metrics(result, started_at=started_at, endpoint="/api/ai/suggest/health-summary")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"health-summary error: {e}")


@router.post("/suggest/finding-analysis")
def suggest_finding_analysis(
    payload: FindingAnalysisRequest,
    x_ai_token: Optional[str] = Header(default=None),
    x_tcdx_locale: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    try:
        payload_dict = _payload_to_dict(payload)
        locale = _request_locale(payload_dict, x_tcdx_locale)
        payload_dict.update({'locale': locale, 'language': locale, 'response_language': locale})
        result = generate_finding_analysis(payload_dict)
        return localize_ai_response(enrich_ai_response_with_scenario(
            payload_dict,
            result,
            mode="finding_analysis",
        ), locale)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"finding-analysis error: {e}")


@router.post("/suggest/nonconformity-draft")
def suggest_nonconformity_draft(
    payload: NonconformityDraftRequest,
    x_ai_token: Optional[str] = Header(default=None),
    x_tcdx_locale: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    try:
        payload_dict = _payload_to_dict(payload)
        locale = _request_locale(payload_dict, x_tcdx_locale)
        payload_dict.update({'locale': locale, 'language': locale, 'response_language': locale})
        return localize_ai_response(generate_nonconformity_draft(payload_dict), locale)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"nonconformity-draft error: {e}")


@router.post("/suggest/action-plan")
def suggest_action_plan(
    payload: ActionPlanSuggestionRequest,
    x_ai_token: Optional[str] = Header(default=None),
    x_tcdx_locale: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    try:
        payload_dict = _payload_to_dict(payload)
        locale = _request_locale(payload_dict, x_tcdx_locale)
        payload_dict.update({'locale': locale, 'language': locale, 'response_language': locale})
        result = generate_action_plan(payload_dict)
        return localize_ai_response(enrich_ai_response_with_scenario(
            payload_dict,
            result,
            mode="action_plan",
        ), locale)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"action-plan error: {e}")


@router.post("/suggest/executive-brief")
def suggest_executive_brief(
    payload: ExecutiveBriefRequest,
    x_ai_token: Optional[str] = Header(default=None),
    x_tcdx_locale: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    started_at = time.perf_counter()
    try:
        payload_dict = _payload_to_dict(payload)
        locale = _request_locale(payload_dict, x_tcdx_locale)
        payload_dict.update({'locale': locale, 'language': locale, 'response_language': locale})
        result = localize_ai_response(generate_executive_brief(payload_dict), locale)
        return _with_runtime_metrics(result, started_at=started_at, endpoint="/api/ai/suggest/executive-brief")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"executive-brief error: {e}")


@router.post("/report-ai-enrichment")
async def report_ai_enrichment(
    request: Request,
    x_ai_token: Optional[str] = Header(default=None),
    x_tcdx_locale: Optional[str] = Header(default=None),
    x_request_id: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    started_at = time.perf_counter()
    payload = await request.json()
    if not isinstance(payload, dict):
        payload = {}
    locale = _request_locale(payload, x_tcdx_locale)
    request_id = x_request_id or payload.get("request_id") or (payload.get("request_metadata") or {}).get("request_id")
    model_mode = str(payload.get("model_mode") or (payload.get("options") or {}).get("model_mode") or "fast").lower()
    if model_mode not in {"fast", "balanced", "deep"}:
        model_mode = "fast"
    depth = str(payload.get("depth") or (payload.get("options") or {}).get("depth") or ("deep" if model_mode == "deep" else "standard"))
    use_web = _truthy(payload.get("use_web"), _truthy((payload.get("options") or {}).get("use_web")))
    allow_web = _truthy(payload.get("allow_web_research"), use_web)
    metadata = get_llm_metadata(depth=depth, model_mode=model_mode)

    print({
        "event": "REPORT AI ENRICHMENT START",
        "request_id": request_id,
        "tenant_id": payload.get("tenant_id"),
        "endpoint": "/api/ai/report-ai-enrichment",
        "model_mode": model_mode,
        "selected_model": metadata.get("model"),
        "used_web": use_web or allow_web,
        "used_rag": _truthy(payload.get("use_rag"), _truthy((payload.get("options") or {}).get("use_rag"), True)),
        "used_company_profile": _truthy(payload.get("used_company_profile"), bool(payload.get("company_profile") or payload.get("context", {}).get("company_profile"))),
    })

    external_context = build_external_context(_external_context_payload(
        {
            **payload,
            "use_web": use_web,
            "allow_web_research": allow_web,
            "requested_output": "report",
        },
        query=f"{payload.get('report_type_code') or 'ISO report'} {payload.get('standard_code') or ''} {payload.get('period') or ''} audit evidence risks best practices",
    ))
    base = _build_report_fallback(payload, external_context)
    llm = _llm_structured_enrichment(payload, base, model_mode=model_mode, depth=depth, request_id=request_id, endpoint="/api/ai/report-ai-enrichment")
    structured = {**base, **(llm.get("data") or {}).get("structured_result", {}), **{k: v for k, v in (llm.get("data") or {}).items() if k not in {"trace", "engine", "metrics"}}}
    duration_ms = int((time.perf_counter() - started_at) * 1000)
    fallback_used = bool(_truthy(payload.get("use_llm"), model_mode != "fast") and not llm.get("used"))
    trace = {
        "ai_engine_used": True,
        "llm_used": bool(llm.get("used")),
        "used_rag": _truthy(payload.get("use_rag"), _truthy((payload.get("options") or {}).get("use_rag"), True)),
        "used_web": bool(external_context.get("used")),
        "used_drive": _truthy(payload.get("use_drive"), _truthy((payload.get("options") or {}).get("use_drive"))),
        "used_company_profile": _truthy(payload.get("used_company_profile"), bool(payload.get("company_profile") or payload.get("context", {}).get("company_profile"))),
        "fallback_used": fallback_used,
        "ai_enrichment_failed": fallback_used,
        "model_mode": model_mode,
        "selected_model": metadata.get("model"),
        "model": metadata.get("model"),
        "llm_provider": metadata.get("provider"),
        "duration_ms": duration_ms,
        "request_id": request_id,
        "web_results_count": int(external_context.get("raw_results_count") or len(external_context.get("sources") or [])),
        "trusted_results_count": int(external_context.get("trusted_results_count") or 0),
        "error_message": llm.get("error") or None,
    }
    result = {
        "ok": not fallback_used,
        "source": "ai-engine-report-ai-enrichment",
        "executive_summary": structured.get("executive_summary") or structured.get("executive_narrative") or base["executive_summary"],
        "diagnosis": structured.get("diagnosis") or structured.get("auditor_opinion") or base["diagnosis"],
        "root_cause_analysis": _as_list(structured.get("root_cause_analysis"), 8) or base["root_cause_analysis"],
        "corrective_actions": _as_list(structured.get("corrective_actions") or structured.get("recommended_actions"), 8) or base["corrective_actions"],
        "evidence_requests": _as_list(structured.get("evidence_requests"), 8) or base["evidence_requests"],
        "audit_questions": _as_list(structured.get("audit_questions"), 8) or base["audit_questions"],
        "management_focus": _as_list(structured.get("management_focus"), 8) or base["management_focus"],
        "improvement_roadmap": _as_list(structured.get("improvement_roadmap"), 8) or base["improvement_roadmap"],
        "proposed_objectives": _as_list(structured.get("proposed_objectives"), 8) or base["proposed_objectives"],
        "proposed_kpis": _as_list(structured.get("proposed_kpis"), 8) or base["proposed_kpis"],
        "suggested_controls": _as_list(structured.get("suggested_controls"), 8) or base["suggested_controls"],
        "industry_references": _as_list(structured.get("industry_references"), 8) or base["industry_references"],
        "external_context": external_context,
        "structured_result": structured,
        "trace": trace,
        "engine": trace,
        "metrics": trace,
        "limitations": _as_list(structured.get("limitations"), 8) or external_context.get("limitations") or [],
    }
    print({
        "event": "REPORT AI ENRICHMENT OK" if not fallback_used else "REPORT AI ENRICHMENT FALLBACK",
        "request_id": request_id,
        "tenant_id": payload.get("tenant_id"),
        "endpoint": "/api/ai/report-ai-enrichment",
        "model_mode": model_mode,
        "selected_model": metadata.get("model"),
        "llm_used": trace["llm_used"],
        "used_web": trace["used_web"],
        "fallback_used": fallback_used,
        "ai_enrichment_failed": fallback_used,
        "duration_ms": duration_ms,
        "timeout_ms": payload.get("timeout_ms"),
    })
    return localize_ai_response(result, locale)


@router.post("/company-profile/analyze")
async def company_profile_analyze(
    request: Request,
    x_ai_token: Optional[str] = Header(default=None),
    x_tcdx_locale: Optional[str] = Header(default=None),
    x_request_id: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    started_at = time.perf_counter()
    payload = await request.json()
    if not isinstance(payload, dict):
        payload = {}
    locale = _request_locale(payload, x_tcdx_locale)
    request_id = x_request_id or payload.get("request_id") or (payload.get("request_metadata") or {}).get("request_id")
    model_mode = str(payload.get("model_mode") or (payload.get("options") or {}).get("model_mode") or "balanced").lower()
    if model_mode not in {"fast", "balanced", "deep"}:
        model_mode = "balanced"
    depth = "deep" if model_mode == "deep" else "standard"
    metadata = get_llm_metadata(depth=depth, model_mode=model_mode)
    profile = payload.get("company_profile") or payload.get("profile") or {}
    external_context = build_external_context(_external_context_payload(payload, query=f"{payload.get('industry') or ''} {payload.get('subindustry') or ''} ISO management system risks evidence benchmark"))
    base = _build_company_profile_fallback(payload, external_context)

    print({
        "event": "COMPANY PROFILE ANALYZE START",
        "request_id": request_id,
        "tenant_id": payload.get("tenant_id"),
        "endpoint": "/api/ai/company-profile/analyze",
        "model_mode": model_mode,
        "selected_model": metadata.get("model"),
        "used_web": _truthy(payload.get("use_web"), _truthy(payload.get("allow_web_research"))),
        "used_rag": _truthy(payload.get("use_rag"), True),
        "used_company_profile": True,
    })
    llm = _llm_structured_enrichment(
        {**payload, "use_llm": _truthy(payload.get("use_llm"), True), "company_profile": profile},
        base,
        model_mode=model_mode,
        depth=depth,
        request_id=request_id,
        endpoint="/api/ai/company-profile/analyze",
    )
    llm_data = llm.get("data") or {}
    structured = {**base, **(llm_data.get("structured_result") if isinstance(llm_data.get("structured_result"), dict) else {}), **{k: v for k, v in llm_data.items() if k not in {"trace", "engine", "metrics"}}}
    duration_ms = int((time.perf_counter() - started_at) * 1000)
    fallback_used = not bool(llm.get("used"))
    trace = {
        "ai_engine_used": True,
        "llm_used": bool(llm.get("used")),
        "used_web": bool(external_context.get("used")),
        "used_rag": _truthy(payload.get("use_rag"), True),
        "used_drive": _truthy(payload.get("use_drive"), _truthy(payload.get("allow_document_context"))),
        "used_company_profile": True,
        "fallback_used": fallback_used,
        "ai_enrichment_failed": fallback_used,
        "selected_model": metadata.get("model"),
        "model": metadata.get("model"),
        "model_mode": model_mode,
        "llm_provider": metadata.get("provider"),
        "duration_ms": duration_ms,
        "request_id": request_id,
        "web_results_count": int(external_context.get("raw_results_count") or len(external_context.get("sources") or [])),
        "trusted_results_count": int(external_context.get("trusted_results_count") or 0),
        "error_message": llm.get("error") or None,
    }
    result = {
        "ok": True,
        "source": "ai-engine-company-profile-analyze",
        "normalized_company_profile": structured.get("normalized_company_profile") or base["normalized_company_profile"],
        "executive_narrative": structured.get("executive_narrative") or structured.get("summary") or base["executive_narrative"],
        "industry_assumptions": _as_list(structured.get("industry_assumptions"), 8) or base["industry_assumptions"],
        "industry_references": _as_list(structured.get("industry_references"), 8) or base["industry_references"],
        "iso_scope_recommendations": _as_list(structured.get("iso_scope_recommendations"), 8) or base["iso_scope_recommendations"],
        "proposed_objectives": _as_list(structured.get("proposed_objectives"), 8) or base["proposed_objectives"],
        "proposed_kpis": _as_list(structured.get("proposed_kpis"), 8) or base["proposed_kpis"],
        "suggested_controls": _as_list(structured.get("suggested_controls"), 8) or base["suggested_controls"],
        "typical_industry_risks": _as_list(structured.get("typical_industry_risks"), 8) or base["typical_industry_risks"],
        "suggested_evidence_baseline": _as_list(structured.get("suggested_evidence_baseline"), 8) or base["suggested_evidence_baseline"],
        "maturity_baseline": structured.get("maturity_baseline") or base["maturity_baseline"],
        "audit_focus_areas": _as_list(structured.get("audit_focus_areas"), 8) or base["audit_focus_areas"],
        "corrective_action_themes": _as_list(structured.get("corrective_action_themes"), 8) or base["corrective_action_themes"],
        "improvement_roadmap": _as_list(structured.get("improvement_roadmap"), 8) or base["improvement_roadmap"],
        "limits_and_assumptions": _as_list(structured.get("limits_and_assumptions") or structured.get("limitations"), 8) or base["limits_and_assumptions"],
        "external_context": external_context,
        "structured_result": structured,
        "trace": trace,
        "engine": trace,
        "metrics": trace,
        "limitations": _as_list(structured.get("limitations"), 8) or base["limits_and_assumptions"],
    }
    print({
        "event": "COMPANY PROFILE ANALYZE OK" if not fallback_used else "COMPANY PROFILE ANALYZE FALLBACK",
        "request_id": request_id,
        "tenant_id": payload.get("tenant_id"),
        "endpoint": "/api/ai/company-profile/analyze",
        "model_mode": model_mode,
        "selected_model": metadata.get("model"),
        "llm_used": trace["llm_used"],
        "used_web": trace["used_web"],
        "fallback_used": fallback_used,
        "ai_enrichment_failed": fallback_used,
        "duration_ms": duration_ms,
    })
    return localize_ai_response(result, locale)


@router.get("/knowledge/status")
def knowledge_status(
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    return get_knowledge_status()


@router.get("/knowledge/module/{module_name}")
def knowledge_module(
    module_name: str,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    return {
        "ok": True,
        "module": module_name,
        "knowledge": get_knowledge_module(module_name),
    }


@router.get("/knowledge/bootstrap/status")
def bootstrap_knowledge_status(
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    return get_bootstrap_status()


@router.post("/knowledge/bootstrap/run")
async def bootstrap_knowledge_run(
    request: Request,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)

    try:
        payload = await request.json()
        if not isinstance(payload, dict):
            payload = {}

        mode = str(payload.get("mode") or "seeds").strip().lower()
        if mode not in {"seeds", "brave", "all"}:
            return {
                "ok": False,
                "error": "unsupported_bootstrap_mode",
                "supported_modes": ["seeds", "brave", "all"],
            }

        dry_run = bool(payload.get("dry_run", False))
        require_review = payload.get("require_review")

        if mode == "seeds":
            return load_seed_knowledge(
                dry_run=dry_run,
                require_review=require_review,
            )

        if mode == "brave":
            return load_brave_knowledge(
                topic_codes=payload.get("topic_codes") or [],
                max_topics=payload.get("max_topics"),
                max_results_per_topic=payload.get("max_results_per_topic"),
                dry_run=dry_run,
                require_review=require_review,
            )

        seed_result = load_seed_knowledge(
            dry_run=dry_run,
            require_review=require_review,
        )
        brave_result = load_brave_knowledge(
            topic_codes=payload.get("topic_codes") or [],
            max_topics=payload.get("max_topics"),
            max_results_per_topic=payload.get("max_results_per_topic"),
            dry_run=dry_run,
            require_review=require_review,
        )
        return {
            "ok": bool(seed_result.get("ok")) and bool(brave_result.get("ok")),
            "mode": "all",
            "seeds": seed_result,
            "brave": brave_result,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"bootstrap-run error: {exc}")


@router.get("/knowledge/bootstrap/pending")
def bootstrap_knowledge_pending(
    limit: int = 20,
    offset: int = 0,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    return list_pending_bootstrap_knowledge(limit=limit, offset=offset)


@router.get("/knowledge/bootstrap/search")
def bootstrap_knowledge_search(
    q: Optional[str] = None,
    module: Optional[str] = None,
    domain: Optional[str] = None,
    standard_code: Optional[str] = None,
    knowledge_type: Optional[str] = None,
    approved_only: bool = True,
    limit: int = 20,
    offset: int = 0,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    return search_bootstrap_knowledge(
        q=q,
        module=module,
        domain=domain,
        standard_code=standard_code,
        knowledge_type=knowledge_type,
        approved_only=approved_only,
        limit=limit,
        offset=offset,
    )


@router.post("/knowledge/bootstrap/{item_id}/approve")
def bootstrap_knowledge_approve(
    item_id: str,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    result = approve_bootstrap_knowledge_item(item_id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result)
    return result


@router.post("/knowledge/bootstrap/{item_id}/reject")
async def bootstrap_knowledge_reject(
    item_id: str,
    request: Request,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    payload = await request.json()
    reason = payload.get("reason") if isinstance(payload, dict) else None
    result = reject_bootstrap_knowledge_item(item_id, reason=reason)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result)
    return result


@router.post("/auditor/analyze")
async def auditor_analyze(
    request: Request,
    x_ai_token: Optional[str] = Header(default=None),
    x_tcdx_locale: Optional[str] = Header(default=None),
    x_request_id: Optional[str] = Header(default=None),
):
    started_at = time.perf_counter()
    validate_internal_token(x_ai_token)

    try:
        payload_dict = await request.json()
        if not isinstance(payload_dict, dict):
            raise ValueError("payload must be a JSON object")
        locale = _request_locale(payload_dict, x_tcdx_locale)
        payload_dict.update({'locale': locale, 'language': locale, 'response_language': locale})
        result = localize_ai_response(analyze_as_senior_auditor(payload_dict), locale)
        if isinstance(result, dict):
            result.setdefault("request_id", x_request_id)
            result.setdefault("metrics", {})
            if isinstance(result["metrics"], dict):
                result["metrics"].update({
                    "request_id": x_request_id,
                    "duration_ms": int((time.perf_counter() - started_at) * 1000),
                    "mode": payload_dict.get("depth") or payload_dict.get("mode") or "deterministic",
                })
        print({
            "event": "legacy_auditor_analyze_timing",
            "request_id": x_request_id,
            "tenant_id": payload_dict.get("tenant_id"),
            "duration_ms": int((time.perf_counter() - started_at) * 1000),
        })
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"auditor-analyze error: {exc}")


@router.post("/internal/diagnostic/context")
async def internal_ai_context_diagnostic(
    payload: Dict[str, Any],
    x_ai_token: Optional[str] = Header(default=None),
):
    """
    Endpoint interno de diagnóstico IA.

    No modifica datos.
    No cierra hallazgos.
    No cambia salud/KPIs.
    Solo expone contexto y razonamiento técnico.
    """
    expected_token = os.getenv("AI_INTERNAL_TOKEN") or os.getenv("AI_TOKEN")

    if not expected_token:
        raise HTTPException(status_code=503, detail="AI token not configured")

    if x_ai_token != expected_token:
        raise HTTPException(status_code=401, detail="Invalid AI token")

    try:
        return build_ai_context_diagnostic(
            tenant_id=payload.get("tenant_id"),
            standard_code=payload.get("standard_code") or payload.get("iso_code"),
            user_text=payload.get("user_text") or " ".join([
                str(payload.get("title") or ""),
                str(payload.get("description") or ""),
            ]).strip(),
            entity_type=payload.get("entity_type"),
            entity_id=payload.get("entity_id") or payload.get("finding_id") or payload.get("tenant_control_id"),
            forced_problem_type=payload.get("forced_problem_type"),
            forced_domain_code=payload.get("forced_domain_code"),
            include_raw_context=bool(payload.get("include_raw_context", False)),
            include_guided_preview=bool(payload.get("include_guided_preview", True)),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"internal diagnostic error: {str(exc)}",
        )

@router.post("/internal/diagnostic/scenario")
async def diagnostic_scenario(
    request: Request,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)

    try:
        payload_dict = await request.json()
        return detect_finding_scenario(payload_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"diagnostic-scenario error: {e}")

@router.post("/internal/external-lookup/plan")
async def external_lookup_plan(
    request: Request,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)

    try:
        payload_dict = await request.json()
        return build_external_lookup_plan(payload_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"external-lookup-plan error: {e}")

@router.post("/internal/external-lookup/search")
async def external_lookup_search(
    request: Request,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)

    try:
        payload_dict = await request.json()
        return execute_external_lookup_search(payload_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"external-lookup-search error: {e}")

@router.post("/internal/external-lookup/cache")
async def external_lookup_cache(
    request: Request,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)

    try:
        payload_dict = await request.json()
        return get_cached_external_lookup(payload_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"external-lookup-cache error: {e}")
