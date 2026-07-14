import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.convivencia_manual_extractor import extract_convivencia_manual_parameters


router = APIRouter(prefix="/api/convivencia/manual", tags=["TCDX Convivir"])


class ConvivenciaManualExtractionRequest(BaseModel):
    job_type: Optional[str] = Field(default="extract_convivencia_manual_parameters")
    payload_version: Optional[int] = Field(default=1)
    request_meta: Dict[str, Any] = Field(default_factory=dict)
    evidence: Dict[str, Any] = Field(default_factory=dict)
    control: Dict[str, Any] = Field(default_factory=dict)
    operation: Dict[str, Any] = Field(default_factory=dict)
    extraction_schema: Dict[str, Any] = Field(default_factory=dict)
    classification_rules: Dict[str, Any] = Field(default_factory=dict)
    safety_rules: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        extra = "allow"


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
    payload: ConvivenciaManualExtractionRequest,
    x_ai_token: Optional[str] = Header(default=None, alias="x-ai-token"),
    x_internal_token: Optional[str] = Header(default=None, alias="x-internal-token"),
):
    _require_internal_token(x_ai_token=x_ai_token, x_internal_token=x_internal_token)
    result = extract_convivencia_manual_parameters(payload.model_dump())
    if result.get("status") == "error":
        return JSONResponse(status_code=422, content=result)
    return result
