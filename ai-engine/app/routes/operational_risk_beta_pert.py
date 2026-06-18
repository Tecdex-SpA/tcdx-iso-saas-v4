import json
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.services.operational_risk_beta_pert_service import (
    OperationalBetaPertError,
    analyze_operational_beta_pert,
    error_response,
)

router = APIRouter(prefix="/api/ai/operational-risk/beta-pert", tags=["Operational Risk Beta-PERT"])


def validate_internal_token(token: Optional[str]) -> None:
    if not settings.AI_INTERNAL_TOKEN:
        raise HTTPException(status_code=503, detail="AI token not configured")
    if token != settings.AI_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized AI internal token")


@router.post("/analyze")
async def analyze(
    request: Request,
    x_ai_token: Optional[str] = Header(default=None),
    x_request_id: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    started_at = time.perf_counter()
    validate_internal_token(x_ai_token)
    payload = await request.json()
    if not isinstance(payload, dict):
        return JSONResponse(status_code=400, content={"success": False, "code": "ai_invalid_payload", "message": "Payload invalido.", "guardable": False})
    payload.setdefault("request_metadata", {})
    if isinstance(payload["request_metadata"], dict) and x_request_id:
        payload["request_metadata"].setdefault("request_id", x_request_id)
    try:
        result = analyze_operational_beta_pert(payload)
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        print(json.dumps({"event": "operational_beta_pert_route", "request_id": x_request_id or payload.get("request_id"), "tenant_id": payload.get("tenant_id"), "duration_ms": duration_ms, "status": "ok"}, ensure_ascii=False, default=str))
        return result
    except OperationalBetaPertError as exc:
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        print(json.dumps({"event": "operational_beta_pert_route", "request_id": x_request_id or payload.get("request_id"), "tenant_id": payload.get("tenant_id"), "duration_ms": duration_ms, "status": exc.code}, ensure_ascii=False, default=str))
        return JSONResponse(status_code=exc.status_code, content=error_response(exc))
    except Exception as exc:
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        print(json.dumps({"event": "operational_beta_pert_route", "request_id": x_request_id or payload.get("request_id"), "tenant_id": payload.get("tenant_id"), "duration_ms": duration_ms, "status": "ai_unknown_error"}, ensure_ascii=False, default=str))
        return JSONResponse(status_code=500, content=error_response(exc))
