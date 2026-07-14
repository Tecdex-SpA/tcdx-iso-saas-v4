import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Header, HTTPException
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.services.convivencia_manual_extractor import extract_convivencia_manual_parameters


router = APIRouter(prefix="/api/convivencia/manual", tags=["TCDX Convivir"])


def _configured_token() -> str:
    return settings.AI_INTERNAL_TOKEN or os.getenv("OWN_AI_SHARED_SECRET", "") or ""


def _require_internal_token(x_ai_token: Optional[str], x_internal_token: Optional[str]) -> None:
    configured = _configured_token()
    if not configured:
        raise HTTPException(status_code=503, detail="AI token not configured")
    provided = x_internal_token or x_ai_token
    if provided != configured:
        raise HTTPException(status_code=401, detail="Invalid AI token")


@router.post("/extract-parameters")
def extract_parameters(
    payload: Dict[str, Any] = Body(default={}),
    x_ai_token: Optional[str] = Header(default=None, alias="x-ai-token"),
    x_internal_token: Optional[str] = Header(default=None, alias="x-internal-token"),
):
    _require_internal_token(x_ai_token=x_ai_token, x_internal_token=x_internal_token)
    result = extract_convivencia_manual_parameters(payload)
    if result.get("status") == "error":
        return JSONResponse(status_code=422, content=result)
    return result
