import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.services.soa_assessment_service import assess_soa_control


router = APIRouter(prefix="/api/ai/soa", tags=["SoA Assessment"])


def validate_internal_token(token: Optional[str]) -> None:
    if not settings.AI_INTERNAL_TOKEN:
        raise HTTPException(status_code=503, detail="AI token not configured")
    if token != settings.AI_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized AI internal token")


@router.post("/assess-control")
async def assess_control(
    request: Request,
    x_ai_token: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    started = time.perf_counter()
    validate_internal_token(x_ai_token)
    payload = await request.json()
    if not isinstance(payload, dict):
        return JSONResponse(status_code=400, content={"ok": False, "code": "invalid_payload", "message": "Payload inválido"})
    result = assess_soa_control(payload)
    result.setdefault("metrics", {})
    result["metrics"]["duration_ms"] = int((time.perf_counter() - started) * 1000)
    return result
