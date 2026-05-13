import os
import re
from typing import Any, Dict, List

from app.services.source_trace_service import make_source_trace_item


def _normalize(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").lower()).strip()


def _context_terms(context: Dict[str, Any]) -> List[str]:
    terms = []
    scope = context.get("scope") if isinstance(context.get("scope"), dict) else {}
    for value in [scope.get("standard_code"), scope.get("iso"), scope.get("clause"), scope.get("operation_name")]:
        if value:
            terms.append(str(value))

    for control in (context.get("priority_controls") or [])[:8]:
        if not isinstance(control, dict):
            continue
        for value in [
            control.get("iso"),
            control.get("clause"),
            control.get("category"),
            control.get("control_description"),
        ]:
            if value:
                terms.append(str(value))

    for evidence in (context.get("recent_evidences") or [])[:6]:
        if not isinstance(evidence, dict):
            continue
        for value in [evidence.get("title"), evidence.get("name"), evidence.get("file_name"), evidence.get("description")]:
            if value:
                terms.append(str(value))

    doc_type_terms = ["política", "procedimiento", "informe", "registro", "evidencia", "plan", "matriz"]
    terms.extend(doc_type_terms)

    seen = set()
    result = []
    for term in terms:
        normalized = _normalize(term)
        if normalized and len(normalized) >= 3 and normalized not in seen:
            seen.add(normalized)
            result.append(normalized[:120])
    return result[:24]


def _document_relation(item: Dict[str, Any], terms: List[str]) -> Dict[str, Any]:
    haystack = _normalize(
        " ".join([
            str(item.get("title") or ""),
            str(item.get("name") or ""),
            str(item.get("file_name") or ""),
            str(item.get("mime_type") or ""),
            str(item.get("type") or ""),
            str(item.get("summary") or ""),
            str(item.get("relation") or ""),
            str(item.get("metadata_json") or ""),
        ])
    )
    matched = [term for term in terms if term in haystack][:8]
    return {
        "document_id": str(item.get("document_id") or item.get("id") or ""),
        "title": str(item.get("title") or item.get("name") or item.get("file_name") or item.get("filename") or "Documento"),
        "type": str(item.get("type") or item.get("file_extension") or item.get("mime_type") or "documento"),
        "date": str(item.get("date") or item.get("modified_at") or item.get("indexed_at") or item.get("created_at") or ""),
        "relation": str(item.get("relation") or ("Coincidencia documental por " + ", ".join(matched) if matched else "Documento Google Drive indexado del tenant")),
        "matched_by": matched or list(item.get("matched_by") or []),
        "summary": str(item.get("summary") or item.get("description") or ""),
    }


def _extract_drive_documents(context: Dict[str, Any]) -> Dict[str, Any]:
    documents = []
    terms = _context_terms(context)
    for key in ["documents", "drive_documents", "recent_evidences"]:
        values = context.get(key) if isinstance(context.get(key), list) else []
        for item in values:
            if not isinstance(item, dict):
                continue
            provider = str(item.get("provider") or item.get("storage_provider") or item.get("source") or "").lower()
            url = str(item.get("url") or item.get("drive_url") or item.get("external_url") or "")
            name = item.get("name") or item.get("title") or item.get("file_name") or item.get("filename") or "Documento"
            status = item.get("status") or item.get("approval_status") or ""
            if "google" in provider or "drive" in provider or "drive.google" in url:
                relation = _document_relation(item, terms)
                documents.append({
                    **relation,
                    "text": f"Según documentos disponibles: {name} ({status or 'sin estado'}), {relation['relation']}",
                })
    documents = sorted(documents, key=lambda item: len(item.get("matched_by") or []), reverse=True)
    return {
        "documents": documents[:10],
        "terms": terms,
    }


def build_drive_context(payload: Dict[str, Any]) -> Dict[str, Any]:
    options = payload.get("options") if isinstance(payload.get("options"), dict) else {}
    if options.get("use_drive") is False:
        return {
            "used": False,
            "drive_context_used": [],
            "source_trace": [],
            "limitations": ["Google Drive deshabilitado por opciones de la solicitud"],
        }

    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    doc_result = _extract_drive_documents(context)
    docs = doc_result["documents"]
    configured = bool(os.getenv("GOOGLE_CLIENT_ID") or os.getenv("GOOGLE_DRIVE_CLIENT_ID") or os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON"))

    if docs:
        return {
            "used": True,
            "context": [
                {
                    "document_id": item["document_id"],
                    "title": item["title"],
                    "type": item["type"],
                    "date": item["date"],
                    "relation": item["relation"],
                    "matched_by": item["matched_by"],
                    "summary": item["summary"],
                }
                for item in docs
            ],
            "drive_context_used": [item["text"] for item in docs],
            "source_trace": [
                make_source_trace_item("drive", "document_index/context.documents", "documentos Google Drive filtrados por norma, cláusula y control")
            ],
            "limitations": [
                "El documento analizado desde Google Drive debe ser validado por el responsable formal antes de considerarse evidencia oficial."
            ],
        }

    if configured:
        limitation = "Google Drive configurado en variables de entorno, pero no se recibieron documentos indexados en el contexto backend"
    else:
        limitation = "Google Drive no conectado — documentos del cliente no disponibles"

    return {
        "used": False,
        "drive_context_used": [],
        "source_trace": [],
        "limitations": [limitation],
    }
