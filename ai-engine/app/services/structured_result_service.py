import json
from copy import deepcopy
from typing import Any, Dict, List, Optional


def _list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def _string(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def _confidence(value: Any) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = 0.0
    return max(0.0, min(1.0, numeric))


def build_empty_structured_result() -> dict:
    """Returns a complete empty shell with all required fields. No nulls."""
    return {
        "executive_summary": "",
        "diagnosis": "",
        "confirmed_facts": [],
        "inferences": [],
        "gaps": [],
        "evidence_assessment": {
            "available_evidence": [],
            "official_evidence": [],
            "weak_evidence": [],
            "missing_evidence": [],
        },
        "risk_impact": "",
        "audit_readiness": {
            "status": "sin_datos",
            "reason": "",
            "auditor_concerns": [],
        },
        "recommended_actions": [],
        "executive_narrative": "",
        "auditor_opinion": "",
        "root_cause_analysis": [],
        "corrective_actions": [],
        "evidence_requests": [],
        "audit_questions": [],
        "management_focus": [],
        "auditor_questions": [],
        "documents_to_request": [],
        "web_context_used": [],
        "drive_context_used": [],
        "rag_context_used": [],
        "source_trace": [],
        "confidence": 0.0,
        "limitations": [],
    }


def _sanitize_gap(item: Any) -> dict:
    item = item if isinstance(item, dict) else {"title": _string(item)}
    return {
        "title": _string(item.get("title")),
        "description": _string(item.get("description")),
        "iso": _string(item.get("iso")),
        "clause": _string(item.get("clause")),
        "severity": _string(item.get("severity") or "media"),
        "evidence_status": _string(item.get("evidence_status") or "sin_evidencia"),
        "business_impact": _string(item.get("business_impact")),
    }


def _sanitize_action(item: Any) -> dict:
    item = item if isinstance(item, dict) else {"title": _string(item)}
    try:
        due_days = int(item.get("due_days") or 30)
    except (TypeError, ValueError):
        due_days = 30
    return {
        "title": _string(item.get("title")),
        "description": _string(item.get("description") or item.get("recommended_action")),
        "priority": _string(item.get("priority") or "media"),
        "target_module": _string(item.get("target_module") or "plan-accion"),
        "suggested_owner_role": _string(item.get("suggested_owner_role") or "Responsable del proceso"),
        "due_days": due_days,
        "acceptance_criteria": [_string(value) for value in _list(item.get("acceptance_criteria"))],
        "related_control_id": _string(item.get("related_control_id")),
        "related_iso": _string(item.get("related_iso") or item.get("iso")),
        "related_clause": _string(item.get("related_clause") or item.get("clause")),
    }

def _sanitize_root_cause(item: Any) -> dict:
    item = item if isinstance(item, dict) else {"issue": _string(item)}
    try:
        due_days = int(item.get("due_days") or 15)
    except (TypeError, ValueError):
        due_days = 15
    return {
        "issue": _string(item.get("issue") or item.get("title")),
        "probable_cause": _string(item.get("probable_cause") or item.get("cause")),
        "evidence_basis": _string(item.get("evidence_basis") or item.get("evidence_status")),
        "risk_if_not_corrected": _string(item.get("risk_if_not_corrected") or item.get("business_impact")),
        "recommended_corrective_action": _string(item.get("recommended_corrective_action") or item.get("recommendation") or item.get("description")),
        "owner_role": _string(item.get("owner_role") or item.get("suggested_owner_role") or "Responsable del proceso"),
        "due_days": due_days,
        "effectiveness_criteria": _string(item.get("effectiveness_criteria") or item.get("effectiveness_check")),
    }


def _sanitize_corrective_action(item: Any) -> dict:
    item = item if isinstance(item, dict) else {"title": _string(item)}
    try:
        due_days = int(item.get("due_days") or 15)
    except (TypeError, ValueError):
        due_days = 15
    return {
        "title": _string(item.get("title") or item.get("issue")),
        "priority": _string(item.get("priority") or "media"),
        "description": _string(item.get("description") or item.get("recommended_action") or item.get("recommended_corrective_action")),
        "owner_role": _string(item.get("owner_role") or item.get("suggested_owner_role") or "Responsable del proceso"),
        "due_days": due_days,
        "required_evidence": [_string(value) for value in _list(item.get("required_evidence"))],
        "closure_criteria": [_string(value) for value in _list(item.get("closure_criteria") or item.get("acceptance_criteria"))],
        "effectiveness_check": _string(item.get("effectiveness_check") or item.get("effectiveness_criteria")),
    }


def _sanitize_evidence_request(item: Any) -> dict:
    item = item if isinstance(item, dict) else {"title": _string(item)}
    return {
        "title": _string(item.get("title") or item.get("evidence")),
        "reason": _string(item.get("reason") or item.get("description")),
        "priority": _string(item.get("priority") or "media"),
        "related_clause": _string(item.get("related_clause") or item.get("clause")),
        "related_control": _string(item.get("related_control") or item.get("control") or item.get("control_name")),
    }


def _sanitize_audit_question(item: Any) -> dict:
    item = item if isinstance(item, dict) else {"question": _string(item)}
    return {
        "question": _string(item.get("question")),
        "why_it_matters": _string(item.get("why_it_matters")),
        "expected_answer_or_evidence": _string(item.get("expected_answer_or_evidence")),
    }


def _sanitize_source_trace(item: Any) -> dict:
    item = item if isinstance(item, dict) else {"reference": _string(item)}
    source = _string(item.get("source") or "prompt_inference")
    if source not in {"internal_db", "rag", "drive", "web", "prompt_inference"}:
        source = "prompt_inference"
    return {
        "source": source,
        "reference": _string(item.get("reference")),
        "used_for": _string(item.get("used_for")),
    }


def normalize_ai_structured_result(raw: Any, defaults: Optional[dict] = None) -> dict:
    """
    Parses LLM output (JSON string, dict, or plain text) into the canonical contract.
    Never raises. Always returns a valid structured_result.
    """
    try:
      base = build_empty_structured_result()
      defaults = defaults if isinstance(defaults, dict) else {}
      if defaults:
          base.update({key: deepcopy(value) for key, value in defaults.items() if key in base})

      data: Dict[str, Any]
      if raw is None:
          data = {}
      elif isinstance(raw, dict):
          data = raw.get("structured_result") if isinstance(raw.get("structured_result"), dict) else raw
      elif isinstance(raw, str):
          try:
              parsed = json.loads(raw)
              data = parsed.get("structured_result") if isinstance(parsed, dict) and isinstance(parsed.get("structured_result"), dict) else parsed
              if not isinstance(data, dict):
                  data = {"diagnosis": raw, "executive_summary": raw[:420]}
          except Exception:
              data = {"diagnosis": raw, "executive_summary": raw[:420]}
      else:
          data = {"diagnosis": _string(raw), "executive_summary": _string(raw)[:420]}

      if not isinstance(data, dict):
          data = {}

      result = deepcopy(base)
      result["executive_summary"] = _string(data.get("executive_summary") or result["executive_summary"])
      result["executive_narrative"] = _string(data.get("executive_narrative") or data.get("executive_summary") or result.get("executive_narrative"))
      result["auditor_opinion"] = _string(data.get("auditor_opinion") or data.get("diagnosis") or result.get("auditor_opinion"))
      result["diagnosis"] = _string(data.get("diagnosis") or result["diagnosis"])
      result["confirmed_facts"] = [_string(value) for value in _list(data.get("confirmed_facts"))]
      result["inferences"] = [_string(value) for value in _list(data.get("inferences"))]
      result["gaps"] = [_sanitize_gap(item) for item in _list(data.get("gaps"))]

      evidence = data.get("evidence_assessment") if isinstance(data.get("evidence_assessment"), dict) else {}
      result["evidence_assessment"] = {
          "available_evidence": [_string(value) for value in _list(evidence.get("available_evidence"))],
          "official_evidence": [_string(value) for value in _list(evidence.get("official_evidence"))],
          "weak_evidence": [_string(value) for value in _list(evidence.get("weak_evidence"))],
          "missing_evidence": [_string(value) for value in _list(evidence.get("missing_evidence"))],
      }

      result["risk_impact"] = _string(data.get("risk_impact") or result["risk_impact"])
      readiness = data.get("audit_readiness") if isinstance(data.get("audit_readiness"), dict) else {}
      result["audit_readiness"] = {
          "status": _string(readiness.get("status") or result["audit_readiness"]["status"]),
          "reason": _string(readiness.get("reason")),
          "auditor_concerns": [_string(value) for value in _list(readiness.get("auditor_concerns"))],
      }
      result["recommended_actions"] = [_sanitize_action(item) for item in _list(data.get("recommended_actions"))]
      result["root_cause_analysis"] = [_sanitize_root_cause(item) for item in _list(data.get("root_cause_analysis"))]
      result["corrective_actions"] = [_sanitize_corrective_action(item) for item in _list(data.get("corrective_actions"))]
      result["evidence_requests"] = [_sanitize_evidence_request(item) for item in _list(data.get("evidence_requests"))]
      result["audit_questions"] = [_sanitize_audit_question(item) for item in _list(data.get("audit_questions"))]
      result["management_focus"] = [_string(value) for value in _list(data.get("management_focus"))]
      result["auditor_questions"] = [_string(value) for value in _list(data.get("auditor_questions"))]
      result["documents_to_request"] = [_string(value) for value in _list(data.get("documents_to_request"))]
      result["web_context_used"] = [_string(value) for value in _list(data.get("web_context_used"))]
      result["drive_context_used"] = [_string(value) for value in _list(data.get("drive_context_used"))]
      result["rag_context_used"] = [_string(value) for value in _list(data.get("rag_context_used"))]
      result["source_trace"] = [_sanitize_source_trace(item) for item in _list(data.get("source_trace"))]
      result["confidence"] = _confidence(data.get("confidence", result.get("confidence", 0.0)))
      result["limitations"] = [_string(value) for value in _list(data.get("limitations"))]
      return result
    except Exception:
      return build_empty_structured_result()


def build_fallback_structured_result(answer: str, context: dict, limitations: list) -> dict:
    """
    Returns a safe fallback structured_result when ai-engine fails or data is insufficient.
    Uses internal context to populate what it can.
    """
    context = context if isinstance(context, dict) else {}
    limitations = limitations if isinstance(limitations, list) else []
    controls = context.get("priority_controls") if isinstance(context.get("priority_controls"), list) else []
    summaries = context.get("effective_health_summary") if isinstance(context.get("effective_health_summary"), list) else []
    source_trace = context.get("source_trace") if isinstance(context.get("source_trace"), list) else []

    result = build_empty_structured_result()
    result["executive_summary"] = _string(answer)[:420] or "No hay evidencia suficiente para concluir cumplimiento."
    result["diagnosis"] = _string(answer)
    result["confirmed_facts"] = [
        f"Según datos internos: se recibieron {len(summaries)} resúmenes efectivos y {len(controls)} controles prioritarios."
    ]
    result["audit_readiness"] = {
        "status": "sin_datos" if not controls and not summaries else "parcial",
        "reason": "Resultado fallback generado desde contexto interno disponible.",
        "auditor_concerns": [],
    }
    result["source_trace"] = [_sanitize_source_trace(item) for item in source_trace]
    result["confidence"] = 0.15 if controls or summaries else 0.05
    result["limitations"] = [_string(value) for value in limitations]
    return result
