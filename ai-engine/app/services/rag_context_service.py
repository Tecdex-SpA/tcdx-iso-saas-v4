import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

from app.services.knowledge_loader import get_knowledge_module, get_knowledge_status
from app.services.source_trace_service import make_source_trace_item

BASELINE_PATH = Path(__file__).resolve().parents[1] / "knowledge" / "iso_baseline_knowledge.json"
LEGACY_BASELINE_PATH = Path(__file__).resolve().parents[2] / "knowledge" / "iso_baseline_knowledge.json"
EMPTY_KNOWLEDGE = {"version": "", "language": "es", "source_type": "internal_baseline", "records": []}


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


def load_baseline_knowledge() -> dict:
    """
    Load ai-engine/app/knowledge/iso_baseline_knowledge.json.
    Must never raise. Return empty structure on error.
    """
    for path in [BASELINE_PATH, LEGACY_BASELINE_PATH]:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("records"), list):
                return data
            if isinstance(data, list):
                return {
                    **EMPTY_KNOWLEDGE,
                    "version": "legacy",
                    "records": data,
                }
        except Exception:
            continue
    return dict(EMPTY_KNOWLEDGE)


def _load_baseline_entries() -> List[Dict[str, Any]]:
    try:
        return list(load_baseline_knowledge().get("records") or [])
    except Exception:
        return []


def _normalize(value: Any) -> str:
    text = str(value or "").lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9.]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _tokens(value: Any) -> Set[str]:
    text = _normalize(value)
    return {part for part in text.split() if len(part) >= 4}


def _record_text(record: Dict[str, Any]) -> str:
    return _normalize(" ".join([
        str(record.get("id") or ""),
        str(record.get("standard_code") or ""),
        str(record.get("clause_or_domain") or ""),
        str(record.get("topic") or ""),
        " ".join(record.get("keywords") or []),
        " ".join(record.get("expected_evidence") or []),
        " ".join(record.get("common_gaps") or []),
        " ".join(record.get("audit_questions") or []),
        " ".join(record.get("recommended_actions") or []),
        " ".join(record.get("closure_criteria") or []),
        " ".join(record.get("documents_to_request") or []),
    ]))


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


def search_baseline_knowledge(
    standard_code: str = "",
    clause: str = "",
    topic: str = "",
    control_description: str = "",
    module_origin: str = "",
    limit: int = 5,
) -> dict:
    """
    Deterministic search over baseline JSON.
    """
    records = _load_baseline_entries()
    if not records:
        return {
            "used": False,
            "results": [],
            "rag_context_used": [],
            "source_trace": [],
            "limitations": ["RAG baseline no disponible: archivo JSON vacío o inválido"],
        }

    standard_norm = _normalize(standard_code).replace(" ", "").upper()
    clause_norm = _normalize(clause)
    topic_norm = _normalize(topic)
    description_tokens = _tokens(control_description)
    module_tokens = _tokens(module_origin)
    ranked = []

    for record in records:
        if not isinstance(record, dict):
            continue
        score = 0
        matched_by = []
        record_standard = _normalize(record.get("standard_code")).replace(" ", "").upper()
        record_clause = _normalize(record.get("clause_or_domain"))
        record_topic = _normalize(record.get("topic"))
        record_keywords = {_normalize(item) for item in record.get("keywords") or []}
        searchable = _record_text(record)

        if standard_norm and record_standard == standard_norm:
            score += 5
            matched_by.append("standard_code")
        if clause_norm and (clause_norm in record_clause or clause_norm in searchable):
            score += 4
            matched_by.append("clause")
        if topic_norm and (topic_norm in record_topic or topic_norm in searchable):
            score += 3
            matched_by.append("topic")

        for token in description_tokens:
            if token in record_keywords or token in searchable:
                score += 2
                if "keyword" not in matched_by:
                    matched_by.append("keyword")

        for token in module_tokens:
            if token in searchable:
                score += 1
                if "module_origin" not in matched_by:
                    matched_by.append("module_origin")

        if score <= 0:
            continue

        result = {
            "id": str(record.get("id") or ""),
            "standard_code": str(record.get("standard_code") or ""),
            "clause_or_domain": str(record.get("clause_or_domain") or ""),
            "topic": str(record.get("topic") or ""),
            "expected_evidence": list(record.get("expected_evidence") or []),
            "common_gaps": list(record.get("common_gaps") or []),
            "audit_questions": list(record.get("audit_questions") or []),
            "recommended_actions": list(record.get("recommended_actions") or []),
            "closure_criteria": list(record.get("closure_criteria") or []),
            "documents_to_request": list(record.get("documents_to_request") or []),
            "score": score,
            "matched_by": matched_by,
        }
        ranked.append(result)

    ranked = sorted(ranked, key=lambda item: item["score"], reverse=True)[: max(1, int(limit or 5))]
    if not ranked:
        return {
            "used": False,
            "results": [],
            "rag_context_used": [],
            "source_trace": [],
            "limitations": ["No se encontraron registros RAG baseline relevantes para la consulta"],
        }

    return {
        "used": True,
        "results": ranked,
        "rag_context_used": [build_rag_prompt_context([item]) for item in ranked],
        "source_trace": [
            make_source_trace_item(
                "rag",
                "ai-engine/app/knowledge/iso_baseline_knowledge.json",
                "conocimiento normativo interno por norma, dominio, evidencia esperada y preguntas auditoras",
            )
        ],
        "limitations": [],
    }


def build_rag_prompt_context(results: list) -> str:
    """
    Convert RAG records into compact Spanish prompt context.
    """
    parts = []
    for item in results or []:
        if not isinstance(item, dict):
            continue
        evidence = "; ".join((item.get("expected_evidence") or [])[:4])
        gaps = "; ".join((item.get("common_gaps") or [])[:3])
        questions = "; ".join((item.get("audit_questions") or [])[:3])
        actions = "; ".join((item.get("recommended_actions") or [])[:3])
        docs = "; ".join((item.get("documents_to_request") or [])[:3])
        parts.append(
            "Como referencia normativa interna: "
            f"{item.get('standard_code')} / {item.get('clause_or_domain')} — {item.get('topic')}. "
            f"Evidencia esperada: {evidence}. Brechas comunes: {gaps}. "
            f"Preguntas auditoras: {questions}. Acciones sugeridas: {actions}. Documentos a solicitar: {docs}."
        )
    return "\n".join(parts)


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

    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    scope = context.get("scope") if isinstance(context.get("scope"), dict) else {}
    controls = context.get("priority_controls") if isinstance(context.get("priority_controls"), list) else []
    first_control = next((item for item in controls if isinstance(item, dict)), {})
    limit = int(options.get("rag_limit") or 5)
    baseline = search_baseline_knowledge(
        standard_code=payload.get("standard_code") or scope.get("standard_code") or first_control.get("iso") or "",
        clause=scope.get("clause") or first_control.get("clause") or "",
        topic=payload.get("question") or scope.get("operation_name") or "",
        control_description=first_control.get("control_description") or payload.get("question") or "",
        module_origin=payload.get("module_origin") or scope.get("module_origin") or "",
        limit=limit,
    )

    if baseline.get("used"):
        return baseline

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
