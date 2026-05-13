from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Request

from app.core.config import settings
from app.services.senior_auditor_orchestrator import analyze_with_senior_auditor_v2

router = APIRouter(prefix="/api/ai/senior-auditor", tags=["Senior Auditor V2"])


def validate_internal_token(token: Optional[str]) -> None:
    if not settings.AI_INTERNAL_TOKEN:
        raise HTTPException(status_code=503, detail="AI token not configured")
    if token != settings.AI_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized AI internal token")


@router.post("/analyze")
async def analyze(request: Request, x_ai_token: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    validate_internal_token(x_ai_token)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload inválido")
    if not payload.get("tenant_id"):
        raise HTTPException(status_code=400, detail="tenant_id requerido")
    if payload.get("locale") not in (None, "", "es"):
        payload["locale"] = "es"
    try:
        return analyze_with_senior_auditor_v2(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"senior-auditor-v2 error: {str(exc)[:180]}")
