import os
from typing import Any, Dict, List

from app.services.source_trace_service import make_source_trace_item


def _extract_drive_documents(context: Dict[str, Any]) -> List[str]:
    documents = []
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
                documents.append(f"Según documentos disponibles: {name} ({status or 'sin estado'}), relacionado con evidencia/documento del tenant")
    return documents[:10]


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
    docs = _extract_drive_documents(context)
    configured = bool(os.getenv("GOOGLE_CLIENT_ID") or os.getenv("GOOGLE_DRIVE_CLIENT_ID") or os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON"))

    if docs:
        return {
            "used": True,
            "drive_context_used": docs,
            "source_trace": [
                make_source_trace_item("drive", "context.documents/recent_evidences", "documentos Google Drive recibidos desde contexto interno")
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
