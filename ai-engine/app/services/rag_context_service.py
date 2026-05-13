from typing import Any, Dict, List

from app.services.knowledge_loader import get_knowledge_module, get_knowledge_status
from app.services.source_trace_service import make_source_trace_item


def _summarize_entries(module_payload: Dict[str, Any], limit: int = 6) -> List[str]:
    entries = []
    for filename, payload in module_payload.items():
        if len(entries) >= limit:
            break
        if isinstance(payload, dict):
            title = payload.get("title") or payload.get("name") or filename
            entries.append(f"{title}: conocimiento cargado desde {filename}")
        elif isinstance(payload, list):
            entries.append(f"{filename}: {len(payload)} entradas de conocimiento disponibles")
    return entries[:limit]


def build_rag_context(payload: Dict[str, Any]) -> Dict[str, Any]:
    options = payload.get("options") if isinstance(payload.get("options"), dict) else {}
    if options.get("use_rag") is False:
        return {
            "used": False,
            "rag_context_used": [],
            "source_trace": [],
            "limitations": ["RAG deshabilitado por opciones de la solicitud"],
        }

    status = get_knowledge_status()
    if not status.get("files_loaded"):
        return {
            "used": False,
            "rag_context_used": [],
            "source_trace": [],
            "limitations": ["Base de conocimiento RAG no disponible — criterios normativos desde prompt maestro únicamente"],
        }

    module_payload = get_knowledge_module("audit")
    entries = _summarize_entries(module_payload)
    if not entries:
        return {
            "used": False,
            "rag_context_used": [],
            "source_trace": [],
            "limitations": ["Base de conocimiento RAG disponible pero sin entradas aplicables al análisis auditor"],
        }

    return {
        "used": True,
        "rag_context_used": [f"Como referencia normativa (RAG): {entry}" for entry in entries],
        "source_trace": [
            make_source_trace_item("rag", "ai-engine/knowledge", "criterios normativos y reglas de auditoría")
        ],
        "limitations": [],
    }
