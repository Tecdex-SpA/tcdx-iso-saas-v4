import os
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
from app.services.bootstrap_knowledge_service import (
    approve_bootstrap_knowledge_item,
    get_bootstrap_status,
    list_pending_bootstrap_knowledge,
    load_seed_knowledge,
    reject_bootstrap_knowledge_item,
    search_bootstrap_knowledge,
)
from app.core.config import settings

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


def validate_internal_token(token: Optional[str]) -> None:
    if not settings.AI_INTERNAL_TOKEN:
        raise HTTPException(status_code=503, detail="AI token not configured")

    if token != settings.AI_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized AI internal token")


@router.post("/suggest/health-summary")
def suggest_health_summary(
    payload: HealthSummaryRequest,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    try:
        payload_dict = _payload_to_dict(payload)
        return generate_health_summary(payload_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"health-summary error: {e}")


@router.post("/suggest/finding-analysis")
def suggest_finding_analysis(
    payload: FindingAnalysisRequest,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    try:
        payload_dict = _payload_to_dict(payload)
        result = generate_finding_analysis(payload_dict)
        return enrich_ai_response_with_scenario(
            payload_dict,
            result,
            mode="finding_analysis",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"finding-analysis error: {e}")


@router.post("/suggest/nonconformity-draft")
def suggest_nonconformity_draft(
    payload: NonconformityDraftRequest,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    try:
        payload_dict = _payload_to_dict(payload)
        return generate_nonconformity_draft(payload_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"nonconformity-draft error: {e}")


@router.post("/suggest/action-plan")
def suggest_action_plan(
    payload: ActionPlanSuggestionRequest,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    try:
        payload_dict = _payload_to_dict(payload)
        result = generate_action_plan(payload_dict)
        return enrich_ai_response_with_scenario(
            payload_dict,
            result,
            mode="action_plan",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"action-plan error: {e}")


@router.post("/suggest/executive-brief")
def suggest_executive_brief(
    payload: ExecutiveBriefRequest,
    x_ai_token: Optional[str] = Header(default=None),
):
    validate_internal_token(x_ai_token)
    try:
        payload_dict = _payload_to_dict(payload)
        return generate_executive_brief(payload_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"executive-brief error: {e}")


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
        if mode not in {"seeds", "all"}:
            return {
                "ok": False,
                "error": "unsupported_bootstrap_mode",
                "supported_modes": ["seeds", "all"],
                "note": "Brave bootstrap se habilitara en una fase posterior.",
            }

        return load_seed_knowledge(
            dry_run=bool(payload.get("dry_run", False)),
            require_review=payload.get("require_review"),
        )
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
):
    validate_internal_token(x_ai_token)

    try:
        payload_dict = await request.json()
        if not isinstance(payload_dict, dict):
            raise ValueError("payload must be a JSON object")
        return analyze_as_senior_auditor(payload_dict)
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
