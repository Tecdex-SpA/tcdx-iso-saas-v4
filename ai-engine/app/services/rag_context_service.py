import json
import re
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

from app.services.knowledge_loader import get_knowledge_module, get_knowledge_status
from app.services.source_trace_service import make_source_trace_item

BASELINE_PATH = Path(__file__).resolve().parents[2] / "knowledge" / "iso_baseline_knowledge.json"


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


def _load_baseline_entries() -> List[Dict[str, Any]]:
    try:
        data = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _tokens(value: Any) -> Set[str]:
    text = str(value or "").lower()
    text = re.sub(r"[^a-z0-9áéíóúñü.]+", " ", text)
    return {part for part in text.split() if len(part) >= 4}


def _payload_search_terms(payload: Dict[str, Any]) -> Tuple[Set[str], Set[str]]:
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    scope = context.get("scope") if isinstance(context.get("scope"), dict) else {}
    standards: Set[str] = set()
    terms: Set[str] = set()

    for value in [
        payload.get("standard_code"),
        scope.get("standard_code"),
        scope.get("iso"),
        payload.get("question"),
        payload.get("module_origin"),
        scope.get("module_origin"),
    ]:
        tokens = _tokens(value)
        terms.update(tokens)
        for token in tokens:
            if token.startswith("iso"):
                standards.add(token.upper().replace(" ", ""))

    for row in context.get("effective_health_summary") or []:
        if isinstance(row, dict):
            iso = str(row.get("iso") or "").upper().replace(" ", "")
            if iso:
                standards.add(iso)
            terms.update(_tokens(row.get("operation_name")))
            terms.update(_tokens(row.get("kpi_health_status")))

    for control in context.get("priority_controls") or []:
        if isinstance(control, dict):
            iso = str(control.get("iso") or "").upper().replace(" ", "")
            if iso:
                standards.add(iso)
            terms.update(_tokens(control.get("clause")))
            terms.update(_tokens(control.get("category")))
            terms.update(_tokens(control.get("control_description")))
            terms.update(_tokens(control.get("evidence_quality_status")))

    return standards, terms


def _score_baseline_entry(entry: Dict[str, Any], standards: Set[str], terms: Set[str]) -> int:
    score = 0
    standard = str(entry.get("standard_code") or "").upper().replace(" ", "")
    if standard in standards:
        score += 8
    searchable = " ".join([
        str(entry.get("standard_code") or ""),
        str(entry.get("clause_or_domain") or ""),
        str(entry.get("topic") or ""),
        " ".join(entry.get("expected_evidence") or []),
        " ".join(entry.get("common_gaps") or []),
        " ".join(entry.get("recommended_actions") or []),
        " ".join(entry.get("audit_questions") or []),
    ]).lower()
    for token in terms:
        if token in searchable:
            score += 1
    return score


def _format_baseline_entry(entry: Dict[str, Any]) -> str:
    evidence = "; ".join((entry.get("expected_evidence") or [])[:3])
    gaps = "; ".join((entry.get("common_gaps") or [])[:2])
    actions = "; ".join((entry.get("recommended_actions") or [])[:2])
    return (
        f"Como referencia normativa (RAG): {entry.get('standard_code')} / {entry.get('clause_or_domain')} — "
        f"{entry.get('topic')}. Evidencia esperada: {evidence}. Brechas comunes: {gaps}. Acciones sugeridas: {actions}."
    )


def build_rag_context(payload: Dict[str, Any]) -> Dict[str, Any]:
    options = payload.get("options") if isinstance(payload.get("options"), dict) else {}
    if options.get("use_rag") is False:
        return {
            "used": False,
            "rag_context_used": [],
            "source_trace": [],
            "limitations": ["RAG deshabilitado por opciones de la solicitud"],
        }

    standards, terms = _payload_search_terms(payload)
    baseline_entries = _load_baseline_entries()
    scored = [
        (entry, _score_baseline_entry(entry, standards, terms))
        for entry in baseline_entries
        if isinstance(entry, dict)
    ]
    ranked = [entry for entry, score in sorted(scored, key=lambda item: item[1], reverse=True) if score > 0][:6]

    if ranked:
        return {
            "used": True,
            "rag_context_used": [_format_baseline_entry(entry) for entry in ranked],
            "source_trace": [
                make_source_trace_item("rag", "ai-engine/knowledge/iso_baseline_knowledge.json", "conocimiento ISO base por norma, dominio y evidencia esperada")
            ],
            "limitations": [],
        }

    status = get_knowledge_status()
    if not status.get("files_loaded"):
        return {
            "used": False,
            "rag_context_used": [],
            "source_trace": [],
            "limitations": ["Base de conocimiento RAG no disponible o sin coincidencias — criterios normativos desde prompt maestro únicamente"],
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
