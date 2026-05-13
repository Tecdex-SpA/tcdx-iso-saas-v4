from typing import Any, Dict, List

ALLOWED_SOURCES = {"internal_db", "rag", "drive", "web", "prompt_inference"}


def make_source_trace_item(source: str, reference: str, used_for: str) -> Dict[str, str]:
    normalized = str(source or "prompt_inference")
    if normalized not in ALLOWED_SOURCES:
        normalized = "prompt_inference"
    return {
        "source": normalized,
        "reference": str(reference or ""),
        "used_for": str(used_for or ""),
    }


def normalize_source_trace(items: Any) -> List[Dict[str, str]]:
    if not isinstance(items, list):
        return []
    return [
        make_source_trace_item(
            item.get("source") if isinstance(item, dict) else "prompt_inference",
            item.get("reference") if isinstance(item, dict) else str(item),
            item.get("used_for") if isinstance(item, dict) else "fuente informada por texto",
        )
        for item in items
    ]
