from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field


class SeniorAuditorOptions(BaseModel):
    use_rag: bool = True
    use_drive: bool = True
    use_web: bool = True
    depth: Literal["executive", "standard", "deep"] = "standard"
    return_structured_result: bool = True


class SeniorAuditorPayload(BaseModel):
    task_type: str
    tenant_id: str
    module_origin: str
    question: str = ""
    locale: Literal["es"] = "es"
    context: Dict[str, Any] = Field(default_factory=dict)
    options: SeniorAuditorOptions = Field(default_factory=SeniorAuditorOptions)


class SourceTraceItem(BaseModel):
    source: Literal["internal_db", "rag", "drive", "web", "prompt_inference"]
    reference: str
    used_for: str


class SeniorAuditorResponse(BaseModel):
    ok: bool = True
    answer: str
    structured_result: Dict[str, Any]
    source_trace: List[SourceTraceItem] = Field(default_factory=list)
    confidence: float = 0.0
    limitations: List[str] = Field(default_factory=list)
    engine: Dict[str, Any] = Field(default_factory=dict)
