import json
from pathlib import Path
from typing import Any, Dict

from app.services.llm_client import call_llm_json, get_llm_metadata, is_llm_available


PROMPT_VERSION = "soa-assessment-v1"
PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "soa_assessment_v1.md"
ALLOWED_STATUSES = {"pendiente", "implementado", "parcial", "no implementado", "no aplica"}
ALLOWED_LEVELS = {"alta", "media", "baja"}


def _safe_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _system_suggestion(payload: Dict[str, Any]) -> Dict[str, Any]:
    suggestion = _safe_dict(payload.get("system_suggestion"))
    return {
        "suggested_applicable": bool(suggestion.get("suggested_applicable", True)),
        "suggested_implementation_status": suggestion.get("suggested_implementation_status") or "pendiente",
        "suggested_justification": suggestion.get("suggested_justification") or "Sugerencia determinística pendiente de revisión humana.",
        "confidence_score": int(suggestion.get("confidence_score") or 35),
        "confidence_level": suggestion.get("confidence_level") or "baja",
        "reasons": [suggestion.get("suggested_justification") or "Fallback determinístico usado."],
        "recommended_actions": _safe_list(suggestion.get("recommended_actions")),
        "limitations": ["La recomendación requiere revisión humana antes de modificar el SoA oficial."],
    }


def _normalize(result: Dict[str, Any], fallback: Dict[str, Any]) -> Dict[str, Any]:
    status = str(result.get("suggested_implementation_status") or fallback["suggested_implementation_status"]).strip().lower()
    if status not in ALLOWED_STATUSES:
        status = fallback["suggested_implementation_status"]
    score = result.get("confidence_score", fallback["confidence_score"])
    try:
        score = max(0, min(100, int(round(float(score)))))
    except Exception:
        score = fallback["confidence_score"]
    level = str(result.get("confidence_level") or "").strip().lower()
    if level not in ALLOWED_LEVELS:
        level = "alta" if score >= 80 else "media" if score >= 50 else "baja"
    return {
        "suggested_applicable": result.get("suggested_applicable") if isinstance(result.get("suggested_applicable"), bool) else fallback["suggested_applicable"],
        "suggested_implementation_status": status,
        "suggested_justification": str(result.get("suggested_justification") or fallback["suggested_justification"])[:1600],
        "confidence_score": score,
        "confidence_level": level,
        "reasons": _safe_list(result.get("reasons")) or fallback["reasons"],
        "recommended_actions": _safe_list(result.get("recommended_actions")) or fallback["recommended_actions"],
        "limitations": _safe_list(result.get("limitations")) or fallback["limitations"],
    }


def assess_soa_control(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = _safe_dict(payload)
    fallback = _system_suggestion(payload)
    metadata = get_llm_metadata(depth="executive", local_compact=True, model_mode="fast")
    if not is_llm_available():
        return {
            "ok": False,
            "status": "fallback",
            "structured_result": fallback,
            "prompt_version": PROMPT_VERSION,
            "model": "system_fallback",
            "engine": {"llm_used": False, "fallback_used": True, "prompt_version": PROMPT_VERSION},
        }

    prompt_text = PROMPT_PATH.read_text(encoding="utf-8") if PROMPT_PATH.exists() else "Devuelve JSON válido de evaluación SoA."
    compact_payload = {
        "iso": payload.get("iso"),
        "control": payload.get("control"),
        "official_soa": payload.get("official_soa"),
        "signals": payload.get("signals"),
        "system_suggestion": payload.get("system_suggestion"),
    }
    try:
        raw = call_llm_json(
            json.dumps(compact_payload, ensure_ascii=False, default=str),
            system_prompt=prompt_text,
            temperature=0.1,
            timeout=60,
            depth="executive",
            local_compact=True,
            model_mode="fast",
            response_contract_instruction="Devuelve solo el JSON solicitado, sin markdown.",
            generation_options_override={"num_predict": 420, "num_ctx": 2048},
            enforce_timeout_cap=True,
        )
        structured = _normalize(_safe_dict(raw), fallback)
        return {
            "ok": True,
            "status": "ok",
            "structured_result": structured,
            "prompt_version": PROMPT_VERSION,
            "model": metadata.get("model") or "llm",
            "engine": {"llm_used": True, "fallback_used": False, "prompt_version": PROMPT_VERSION, "model": metadata.get("model")},
        }
    except Exception as exc:
        fallback["limitations"].append(f"Fallback por error IA controlado: {str(exc)[:180]}")
        return {
            "ok": False,
            "status": "fallback",
            "structured_result": fallback,
            "prompt_version": PROMPT_VERSION,
            "model": "system_fallback",
            "engine": {"llm_used": False, "fallback_used": True, "prompt_version": PROMPT_VERSION, "error_type": type(exc).__name__},
        }
