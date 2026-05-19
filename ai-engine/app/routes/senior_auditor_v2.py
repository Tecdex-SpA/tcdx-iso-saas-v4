import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.services.senior_auditor_orchestrator import analyze_with_senior_auditor_v2

router = APIRouter(prefix="/api/ai/senior-auditor", tags=["Senior Auditor V2"])


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
        raise HTTPException(status_code=400, detail="Payload inválido")
    if not payload.get("tenant_id"):
        raise HTTPException(status_code=400, detail="tenant_id requerido")
    if payload.get("locale") not in (None, "", "es"):
        payload["locale"] = "es"
    payload.setdefault("request_metadata", {})
    if isinstance(payload["request_metadata"], dict) and x_request_id:
        payload["request_metadata"].setdefault("request_id", x_request_id)
    try:
        result = analyze_with_senior_auditor_v2(payload)
        if isinstance(result, dict) and x_request_id:
            result.setdefault("request_id", x_request_id)
            result.setdefault("engine", {})
            if isinstance(result["engine"], dict):
                result["engine"].setdefault("request_id", x_request_id)
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        print({
            "event": "senior_auditor_v2_route",
            "request_id": x_request_id,
            "tenant_id": payload.get("tenant_id"),
            "depth": (payload.get("options") or {}).get("depth") if isinstance(payload.get("options"), dict) else None,
            "duration_ms": duration_ms,
        })
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "code": "SENIOR_AUDITOR_ERROR",
                "message": "No fue posible ejecutar el Auditor Senior en ai-engine.",
                "request_id": x_request_id,
                "detail": str(exc)[:180] if settings.APP_ENV != "production" else None,
            },
        )
