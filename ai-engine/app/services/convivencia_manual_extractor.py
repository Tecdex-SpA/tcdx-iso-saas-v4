import base64
import concurrent.futures
import json
import logging
import os
import re
import time
import unicodedata
import warnings as warning_module
import zipfile
from dataclasses import dataclass
from tempfile import NamedTemporaryFile
from typing import Any, Dict, List, Optional, Tuple
from xml.etree import ElementTree

from app.services.llm_client import call_llm_json, is_llm_available


logger = logging.getLogger(__name__)

MAX_INLINE_FILE_BYTES = int(os.getenv("AI_CONVIVENCIA_MAX_FILE_BYTES", str(30 * 1024 * 1024)))
MAX_PDF_PAGES = int(os.getenv("CONVIVENCIA_MANUAL_MAX_PAGES", "120"))
MAX_RAW_TEXT_CHARS = int(os.getenv("CONVIVENCIA_MANUAL_MAX_CHARS", "80000"))
MAX_LLM_CONTEXT_CHARS = int(os.getenv("CONVIVENCIA_MANUAL_MAX_LLM_CONTEXT_CHARS", "60000"))
LLM_TIMEOUT_SECONDS = int(os.getenv("CONVIVENCIA_MANUAL_LLM_TIMEOUT_SECONDS", "15"))
TOTAL_TIMEOUT_SECONDS = int(os.getenv("CONVIVENCIA_MANUAL_TOTAL_TIMEOUT_SECONDS", "45"))


@dataclass
class ExtractedManualText:
    text: str
    raw_text_length: int
    pages_processed: Optional[int]
    truncated: bool
    extraction_status: str
    warnings: List[str]
    parser: Optional[str] = None
    file_type: str = "unknown"
    error_reason: Optional[str] = None
    source_shape: str = ""
    file_name: str = ""
    mime_type: str = ""
    base64_length: int = 0
    received_top_level_keys: Optional[List[str]] = None
    received_evidence_keys: Optional[List[str]] = None
    received_file_keys: Optional[List[str]] = None
    received_document_keys: Optional[List[str]] = None


@dataclass
class ConvivenciaInput:
    file_name: str
    mime_type: str
    size_bytes: Optional[int]
    base64_content: str
    raw_text: str
    file_content_encoding: str
    source_shape: str
    received_top_level_keys: List[str]
    received_evidence_keys: List[str]
    received_file_keys: List[str]
    received_document_keys: List[str]


PROTOCOL_CATALOG = [
    ("debido_proceso", "Debido proceso", ["debido proceso"]),
    ("maltrato_abuso_sexual_infantil", "Maltrato y abuso sexual infantil", ["abuso sexual", "maltrato infantil"]),
    ("vulneracion_derechos", "Vulneración de derechos", ["vulneracion de derechos", "vulneración de derechos"]),
    ("maltrato_acoso_violencia", "Maltrato, acoso o violencia", ["maltrato", "acoso", "violencia escolar"]),
    ("bullying", "Bullying", ["bullying", "ciberbullying"]),
    ("alcohol_drogas", "Alcohol y drogas", ["alcohol", "drogas"]),
    ("embarazo_maternidad_paternidad", "Embarazo, maternidad y paternidad", ["embarazo", "maternidad", "paternidad"]),
    ("identidad_genero", "Identidad de género", ["identidad de genero", "identidad de género"]),
    ("accidentes_escolares", "Accidentes escolares", ["accidentes escolares", "accidente escolar"]),
    ("seguridad_escolar", "Seguridad escolar", ["seguridad escolar", "pise", "plan integral de seguridad"]),
    ("dec", "Desregulación emocional y conductual", ["desregulacion emocional", "desregulación emocional", "dec"]),
    ("derivacion", "Derivación", ["derivacion", "derivación"]),
    ("reclamos_apoderados", "Reclamos de apoderados", ["reclamos", "apoderados"]),
    ("camaras", "Cámaras", ["camaras", "cámaras"]),
    ("nee", "Necesidades educativas especiales", ["nee", "necesidades educativas especiales"]),
    ("celulares", "Celulares", ["celulares", "telefono celular", "teléfono celular"]),
]

PRINCIPLES = [
    "Buen Trato",
    "Disciplina",
    "Responsabilidad",
    "Solidaridad",
    "Tolerancia",
    "Diálogo y participación",
    "Resolución pacífica de controversias y conflictos",
]


def _as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str:
    return str(value or "").strip()


def _safe_keys(value: Any) -> List[str]:
    if not isinstance(value, dict):
        return []
    return sorted(str(key) for key in value.keys())


def _first_text(container: Dict[str, Any], names: List[str]) -> Tuple[str, str]:
    for name in names:
        if name in container:
            value = _text(container.get(name))
            if value:
                return value, name
    return "", ""


def _first_size(container: Dict[str, Any], names: List[str]) -> Tuple[Optional[int], str]:
    for name in names:
        if name not in container:
            continue
        value = container.get(name)
        if value in (None, ""):
            continue
        try:
            parsed = int(value)
            if parsed >= 0:
                return parsed, name
        except Exception:
            continue
    return None, ""


def _strip_accents(value: str) -> str:
    return "".join(
        char for char in unicodedata.normalize("NFD", value)
        if unicodedata.category(char) != "Mn"
    )


def _norm(value: str) -> str:
    value = _strip_accents(value).lower()
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def _clean(value: str, limit: int = 600) -> str:
    value = re.sub(r"[ \t]+", " ", value or "")
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()[:limit].strip()


def _first_match(text: str, patterns: List[str], flags: int = re.IGNORECASE) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, flags)
        if match:
            for group in match.groups():
                if group:
                    return _clean(group, 300)
            return _clean(match.group(0), 300)
    return ""


def _infer_file_type(file_name: str, mime_type: str) -> str:
    name = file_name.lower()
    mime = mime_type.lower()
    if name.endswith(".pdf") or mime == "application/pdf":
        return "pdf"
    if name.endswith(".docx") or "wordprocessingml" in mime:
        return "docx"
    if name.endswith(".txt") or mime.startswith("text/"):
        return "txt"
    return "unknown"


def _infer_file_type_from_content(file_name: str, mime_type: str, content: bytes) -> str:
    file_type = _infer_file_type(file_name, mime_type)
    if file_type != "unknown":
        return file_type
    if content.startswith(b"%PDF-"):
        return "pdf"
    if content.startswith(b"PK"):
        return "docx"
    if mime_type.lower() in {"application/octet-stream", ""}:
        decoded = _decode_text_bytes(content)
        if decoded and "\x00" not in decoded[:2000]:
            return "txt"
    return "unknown"


def extract_convivencia_input(payload: Dict[str, Any]) -> ConvivenciaInput:
    payload = payload if isinstance(payload, dict) else {}
    evidence = _as_dict(payload.get("evidence"))
    file_payload = _as_dict(payload.get("file"))
    document = _as_dict(payload.get("document"))

    containers = [
        ("top_level", payload),
        ("evidence", evidence),
        ("file", file_payload),
        ("document", document),
    ]

    raw_text_names = ["raw_text", "text", "rawText", "document_text", "documentText"]
    base64_names = ["file_content_base64", "contentBase64", "content_base64", "base64"]
    name_names = ["file_name", "filename", "fileName", "name"]
    mime_names = ["file_mime_type", "mimeType", "mime_type", "contentType", "type"]
    size_names = ["file_size_bytes", "sizeBytes", "size_bytes", "size"]
    encoding_names = ["file_content_encoding", "contentEncoding", "content_encoding", "encoding"]

    raw_text = ""
    raw_source = ""
    for label, container in containers:
        raw_text, matched = _first_text(container, raw_text_names)
        if raw_text:
            raw_source = f"{label}.{matched}"
            break

    base64_content = ""
    base64_source = ""
    for label, container in containers:
        base64_content, matched = _first_text(container, base64_names)
        if base64_content:
            base64_source = f"{label}.{matched}"
            break

    file_name = ""
    name_source = ""
    for label, container in containers:
        file_name, matched = _first_text(container, name_names)
        if file_name:
            name_source = f"{label}.{matched}"
            break

    mime_type = ""
    for _, container in containers:
        mime_type, _ = _first_text(container, mime_names)
        if mime_type:
            break

    size_bytes: Optional[int] = None
    for _, container in containers:
        size_bytes, _ = _first_size(container, size_names)
        if size_bytes is not None:
            break

    file_content_encoding = ""
    for _, container in containers:
        file_content_encoding, _ = _first_text(container, encoding_names)
        if file_content_encoding:
            break

    source_shape = raw_source or base64_source or name_source or "none"
    return ConvivenciaInput(
        file_name=file_name,
        mime_type=mime_type,
        size_bytes=size_bytes,
        base64_content=base64_content,
        raw_text=raw_text,
        file_content_encoding=file_content_encoding,
        source_shape=source_shape,
        received_top_level_keys=_safe_keys(payload),
        received_evidence_keys=_safe_keys(evidence),
        received_file_keys=_safe_keys(file_payload),
        received_document_keys=_safe_keys(document),
    )


def _with_input_metadata(extracted: ExtractedManualText, normalized: ConvivenciaInput) -> ExtractedManualText:
    extracted.source_shape = normalized.source_shape
    extracted.file_name = normalized.file_name
    extracted.mime_type = normalized.mime_type
    extracted.base64_length = len(normalized.base64_content or "")
    extracted.received_top_level_keys = normalized.received_top_level_keys
    extracted.received_evidence_keys = normalized.received_evidence_keys
    extracted.received_file_keys = normalized.received_file_keys
    extracted.received_document_keys = normalized.received_document_keys
    return extracted


def _decode_inline_file(normalized: ConvivenciaInput) -> Tuple[Optional[bytes], Optional[Dict[str, Any]]]:
    encoded = normalized.base64_content
    encoding = _text(normalized.file_content_encoding).lower()
    if not encoded:
        return None, {
            "status": "error",
            "error": "missing_file_content",
            "message": "No se recibió contenido de documento en un campo compatible.",
            "warnings": ["El endpoint Convivir requiere contenido inline en base64 o texto bruto explícito."],
            "error_reason": "missing_content",
        }
    if encoding not in ("", "base64"):
        return None, {
            "status": "error",
            "error": "unsupported_file_encoding",
            "message": f"Codificación no soportada: {encoding}",
            "warnings": [],
            "error_reason": "unsupported_file_encoding",
        }
    try:
        content = base64.b64decode(encoded, validate=True)
    except Exception:
        return None, {
            "status": "error",
            "error": "invalid_base64",
            "message": "file_content_base64 no es base64 válido.",
            "warnings": [],
            "error_reason": "invalid_base64",
        }
    if len(content) > MAX_INLINE_FILE_BYTES:
        return None, {
            "status": "error",
            "error": "file_too_large",
            "message": "El archivo excede el tamaño máximo permitido para extracción Convivir.",
            "warnings": [f"Límite actual: {MAX_INLINE_FILE_BYTES} bytes."],
            "error_reason": "file_too_large",
        }
    return content, None


def _decode_text_bytes(content: bytes) -> str:
    for encoding in ("utf-8", "latin-1", "cp1252"):
        try:
            return content.decode(encoding)
        except Exception:
            continue
    return ""


def _elapsed_seconds(started_at: Optional[float]) -> float:
    return time.monotonic() - started_at if started_at else 0.0


def _manual_signal_count(text: str) -> int:
    text_norm = _norm(text)
    groups = [
        ["reglamento interno", "rice", "manual de convivencia"],
        ["vision", "visión", "mision", "misión", "enfoque de convivencia"],
        ["buen trato", "disciplina", "responsabilidad", "solidaridad", "tolerancia"],
        ["faltas leves", "faltas graves", "faltas gravisimas", "faltas gravísimas"],
        ["medidas disciplinarias", "medidas formativas", "medidas reparatorias", "medidas cautelares"],
        ["procedimiento", "debido proceso", "descargos", "reconsideracion", "reconsideración"],
        ["protocolos", "abuso sexual", "vulneracion de derechos", "bullying", "alcohol", "drogas"],
        ["aula segura", "afectacion grave", "afectación grave"],
    ]
    return sum(1 for terms in groups if any(_norm(term) in text_norm for term in terms))


def _extract_pdf_text(content: bytes, started_at: Optional[float] = None) -> ExtractedManualText:
    if not content.startswith(b"%PDF-"):
        return ExtractedManualText("", 0, None, False, "failed", ["El archivo no parece ser PDF válido."], file_type="pdf", error_reason="invalid_pdf")
    try:
        from pypdf import PdfReader  # type: ignore
    except Exception:
        return ExtractedManualText("", 0, None, False, "failed", ["pypdf no está instalado."], file_type="pdf", error_reason="pdf_parser_unavailable")

    warnings: List[str] = []
    pages: List[str] = []
    pages_processed = 0
    truncated = False
    try:
        with NamedTemporaryFile(suffix=".pdf", delete=True) as tmp:
            tmp.write(content)
            tmp.flush()
            pypdf_logger = logging.getLogger("pypdf")
            previous_pypdf_level = pypdf_logger.level
            try:
                pypdf_logger.setLevel(logging.ERROR)
                with warning_module.catch_warnings():
                    warning_module.simplefilter("ignore")
                    reader = PdfReader(tmp.name)
            finally:
                pypdf_logger.setLevel(previous_pypdf_level)
            total_pages = len(reader.pages)
            for page in reader.pages[:MAX_PDF_PAGES]:
                if started_at and _elapsed_seconds(started_at) >= max(1, TOTAL_TIMEOUT_SECONDS - 3):
                    truncated = True
                    warnings.append("Extracción PDF truncada por límite total de tiempo del endpoint.")
                    break
                pages_processed += 1
                try:
                    with warning_module.catch_warnings():
                        warning_module.simplefilter("ignore")
                        page_text = page.extract_text() or ""
                except Exception as exc:
                    warnings.append(f"No se pudo extraer texto de una página: {exc}")
                    page_text = ""
                if page_text:
                    pages.append(page_text)
                if sum(len(part) for part in pages) >= MAX_RAW_TEXT_CHARS:
                    truncated = True
                    break
                if pages_processed >= 10 and pages_processed % 5 == 0:
                    current_text = "\n".join(pages)
                    if len(current_text) >= 12000 and _manual_signal_count(current_text) >= 5:
                        truncated = total_pages > pages_processed
                        warnings.append(f"Documento PDF priorizado: {pages_processed}/{total_pages} páginas procesadas con estructura suficiente.")
                        break
            if total_pages > pages_processed:
                truncated = True
                warnings.append(f"Documento PDF truncado: {pages_processed}/{total_pages} páginas procesadas.")
    except Exception as exc:
        return ExtractedManualText("", 0, pages_processed or None, False, "failed", [str(exc)], parser="pypdf", file_type="pdf", error_reason="pdf_parse_failed")

    text = "\n".join(pages).strip()
    if len(text) > MAX_RAW_TEXT_CHARS:
        text = text[:MAX_RAW_TEXT_CHARS]
        truncated = True
    status = "partial" if text and truncated else ("ok" if text else "failed")
    error_reason = "pdf_text_insufficient" if not text else None
    return ExtractedManualText(text, len(text), pages_processed, truncated, status, warnings, parser="pypdf", file_type="pdf", error_reason=error_reason)


def _extract_docx_text(content: bytes) -> ExtractedManualText:
    if not content.startswith(b"PK"):
        return ExtractedManualText("", 0, None, False, "failed", ["El archivo no parece ser DOCX/ZIP válido."], file_type="docx", error_reason="invalid_docx")
    warnings: List[str] = []
    try:
        from io import BytesIO
        with zipfile.ZipFile(BytesIO(content)) as archive:
            if "word/document.xml" not in archive.namelist():
                return ExtractedManualText("", 0, None, False, "failed", ["DOCX sin word/document.xml."], file_type="docx", error_reason="invalid_docx")
            xml = archive.read("word/document.xml")
    except Exception as exc:
        return ExtractedManualText("", 0, None, False, "failed", [f"No se pudo abrir DOCX: {exc}"], file_type="docx", error_reason="docx_parse_failed")

    try:
        root = ElementTree.fromstring(xml)
        namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
        paragraphs: List[str] = []
        for para in root.iter(f"{namespace}p"):
            parts: List[str] = []
            for node in para.iter():
                if node.tag == f"{namespace}t" and node.text:
                    parts.append(node.text)
                elif node.tag in {f"{namespace}tab", f"{namespace}br"}:
                    parts.append(" ")
            line = _clean("".join(parts), 2000)
            if line:
                paragraphs.append(line)
        text = "\n".join(paragraphs)
    except Exception as exc:
        return ExtractedManualText("", 0, None, False, "failed", [f"No se pudo parsear document.xml: {exc}"], file_type="docx", error_reason="docx_parse_failed")

    truncated = len(text) > MAX_RAW_TEXT_CHARS
    if truncated:
        text = text[:MAX_RAW_TEXT_CHARS]
        warnings.append("Texto DOCX truncado por límite de contexto.")
    status = "partial" if text and truncated else ("ok" if text else "failed")
    error_reason = "docx_text_insufficient" if not text else None
    return ExtractedManualText(text, len(text), None, truncated, status, warnings, parser="docx-xml", file_type="docx", error_reason=error_reason)


def extract_manual_text(payload: Dict[str, Any], started_at: Optional[float] = None) -> ExtractedManualText:
    normalized = extract_convivencia_input(payload)
    if normalized.raw_text:
        truncated = len(normalized.raw_text) > MAX_RAW_TEXT_CHARS
        text = normalized.raw_text[:MAX_RAW_TEXT_CHARS] if truncated else normalized.raw_text
        return _with_input_metadata(ExtractedManualText(
            text=text,
            raw_text_length=len(text),
            pages_processed=None,
            truncated=truncated,
            extraction_status="partial" if truncated else "ok",
            warnings=["Extracción generada desde texto bruto; requiere revisión reforzada."],
            parser="inline_text",
            file_type="txt",
        ), normalized)

    content, error = _decode_inline_file(normalized)
    if error:
        return _with_input_metadata(ExtractedManualText(
            "",
            0,
            None,
            False,
            "failed",
            error.get("warnings") or [error.get("message", "Error de archivo")],
            file_type=_infer_file_type(normalized.file_name, normalized.mime_type),
            error_reason=error.get("error_reason") or error.get("error"),
        ), normalized)
    content = content or b""
    file_type = _infer_file_type_from_content(normalized.file_name, normalized.mime_type, content)
    if file_type == "pdf":
        return _with_input_metadata(_extract_pdf_text(content, started_at=started_at), normalized)
    if file_type == "docx":
        return _with_input_metadata(_extract_docx_text(content), normalized)
    if file_type == "txt":
        text = _decode_text_bytes(content)
        truncated = len(text) > MAX_RAW_TEXT_CHARS
        if truncated:
            text = text[:MAX_RAW_TEXT_CHARS]
        status = "partial" if text and truncated else ("ok" if text else "failed")
        error_reason = "file_text_insufficient" if not text else None
        return _with_input_metadata(ExtractedManualText(text, len(text), None, truncated, status, [], parser="plain-text", file_type="txt", error_reason=error_reason), normalized)
    return _with_input_metadata(ExtractedManualText("", 0, None, False, "failed", ["Tipo de archivo no soportado para extracción Convivir."], file_type=file_type, error_reason="unsupported_file_type"), normalized)


def _section(text: str, start_terms: List[str], stop_terms: List[str], limit: int = 2400) -> str:
    normalized = _norm(text)
    starts = [normalized.find(_norm(term)) for term in start_terms if normalized.find(_norm(term)) >= 0]
    if not starts:
        return ""
    start = min(starts)
    end = min([idx for term in stop_terms if (idx := normalized.find(_norm(term), start + 20)) >= 0] or [min(len(text), start + limit)])
    return _clean(text[start:end], limit)


def _line_items_from_section(section: str, fallback_name: str = "") -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for raw_line in section.splitlines():
        line = _clean(raw_line, 350)
        if not line:
            continue
        line = re.sub(r"^(\d+[\.\)]|[-*•])\s*", "", line).strip()
        if len(line) < 4:
            continue
        if re.match(r"^(faltas?|medidas?|procedimiento|protocolo|art[ií]culo)\b", line, re.IGNORECASE):
            continue
        if len(items) < 12:
            items.append({"name": line[:160], "description": line})
    if not items and fallback_name and section:
        items.append({"name": fallback_name, "description": _clean(section, 420)})
    return items


def _contains(text_norm: str, terms: List[str]) -> bool:
    return any(_norm(term) in text_norm for term in terms)


def _detected_excerpt(text: str, terms: List[str], limit: int = 420) -> str:
    normalized = _norm(text)
    for term in terms:
        idx = normalized.find(_norm(term))
        if idx >= 0:
            return _clean(text[max(0, idx - 120): idx + limit], limit)
    return ""


def _extract_people_role(text: str, terms: List[str]) -> Dict[str, Any]:
    excerpt = _detected_excerpt(text, terms)
    role_name = _first_match(excerpt, [
        r"(?:encargad[ao]\s+de\s+convivencia(?:\s+escolar)?[:\s-]+)([A-ZÁÉÍÓÚÑ][^\n,;.]{3,90})",
        r"([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ ]{4,90})\s*,?\s+encargad[ao]\s+de\s+convivencia",
    ])
    return {"detected": bool(excerpt), "name": role_name, "sourceExcerpt": excerpt}


def build_default_parameters(payload: Dict[str, Any], extracted: ExtractedManualText) -> Dict[str, Any]:
    evidence = _as_dict(payload.get("evidence"))
    text = extracted.text
    text_norm = _norm(text)
    document_title = _first_match(text, [
        r"((?:Reglamento\s+Interno|RICE|Manual\s+de\s+Convivencia\s+Escolar)[^\n]{0,120})",
    ])
    document_year = _first_match(text, [r"\b(20[2-4][0-9])\b"])
    institution = _first_match(text, [
        r"\b((?:Colegio|Escuela|Liceo|Instituto)\s+[A-ZÁÉÍÓÚÑ0-9][^\n,;.]{2,90})",
    ])
    foundation = _first_match(text, [
        r"\b((?:Fundaci[oó]n|Corporaci[oó]n)\s+[A-ZÁÉÍÓÚÑ][^\n,;.]{4,110})",
    ])
    commune = _first_match(text, [r"\b(?:comuna\s+de|comuna:|ubicad[ao]\s+en)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ ]{2,40})"])
    if not commune and "renca" in text_norm:
        commune = "Renca"
    region = "Región Metropolitana" if _contains(text_norm, ["region metropolitana", "región metropolitana", "renca"]) else ""

    document_type = "unknown"
    if "rice" in text_norm:
        document_type = "rice"
    elif "reglamento interno" in text_norm:
        document_type = "reglamento_interno"
    elif "manual de convivencia" in text_norm:
        document_type = "manual_convivencia"

    vision = _section(text, ["visión", "vision"], ["misión", "mision", "principios", "sellos"], 1600)
    mission = _section(text, ["misión", "mision"], ["visión", "vision", "principios", "sellos", "objetivos"], 1600)
    enfoque = _section(text, ["enfoque de convivencia", "convivencia escolar"], ["faltas", "medidas", "procedimiento", "protocolos"], 2200)

    principles = []
    for principle in PRINCIPLES:
        if _norm(principle) in text_norm:
            principles.append({
                "name": principle,
                "description": _detected_excerpt(text, [principle], 360) or principle,
            })

    misconduct = {
        "leve": _line_items_from_section(_section(text, ["faltas leves", "falta leve"], ["faltas graves", "faltas gravisimas", "faltas gravísimas", "medidas"], 4200), "Faltas leves detectadas"),
        "grave": _line_items_from_section(_section(text, ["faltas graves", "falta grave"], ["faltas gravisimas", "faltas gravísimas", "faltas de apoderados", "medidas"], 4200), "Faltas graves detectadas"),
        "gravisima": _line_items_from_section(_section(text, ["faltas gravísimas", "faltas gravisimas", "falta gravísima"], ["faltas de apoderados", "medidas", "procedimiento"], 4200), "Faltas gravísimas detectadas"),
        "apoderado": _line_items_from_section(_section(text, ["faltas de apoderados", "faltas apoderados"], ["medidas", "procedimiento", "protocolos"], 3200), "Faltas de apoderados detectadas"),
    }

    measures = {
        "disciplinary": _line_items_from_section(_section(text, ["medidas disciplinarias", "sanciones"], ["medidas formativas", "medidas pedagógicas", "procedimiento"], 3000), "Medidas disciplinarias detectadas"),
        "formativePedagogical": _line_items_from_section(_section(text, ["medidas formativas", "medidas pedagógicas", "medidas formativas pedagógicas"], ["medidas de apoyo", "medidas reparatorias", "procedimiento"], 3000), "Medidas formativas/pedagógicas detectadas"),
        "supportAccompaniment": _line_items_from_section(_section(text, ["medidas de apoyo", "acompañamiento", "apoyo y acompañamiento"], ["medidas reparatorias", "medidas protectoras", "procedimiento"], 3000), "Medidas de apoyo y acompañamiento detectadas"),
        "reparatory": _line_items_from_section(_section(text, ["medidas reparatorias", "reparación"], ["medidas protectoras", "procedimiento", "protocolos"], 2600), "Medidas reparatorias detectadas"),
        "guardianMeasures": _line_items_from_section(_section(text, ["medidas apoderados", "medidas de apoderados", "apoderados"], ["procedimiento", "protocolos"], 2600), "Medidas respecto de apoderados detectadas"),
        "protectiveOrCautionary": _line_items_from_section(_section(text, ["medidas protectoras", "medidas cautelares", "protección"], ["procedimiento", "protocolos"], 2600), "Medidas protectoras/cautelares detectadas"),
    }

    protocol_items = [
        {"code": code, "name": name, "detected": True}
        for code, name, terms in PROTOCOL_CATALOG
        if _contains(text_norm, terms)
    ]

    procedure_terms = {
        "notification": ["notificacion", "notificación", "comunicación formal", "correo", "telefono", "teléfono", "carta certificada"],
        "descargos": ["descargos", "presentar antecedentes"],
        "resolution": ["resolucion", "resolución"],
        "reconsideration": ["reconsideracion", "reconsideración", "apelacion", "apelación"],
        "deadlines": ["dias habiles", "días hábiles", "plazo"],
    }
    procedure_detected = {key: _contains(text_norm, terms) for key, terms in procedure_terms.items()}
    procedure_excerpt = _section(text, ["procedimiento", "debido proceso"], ["protocolos anexos", "anexos", "plan de gestión"], 4200)
    due_process_steps = [
        {"code": "notificacion", "name": "notificación", "detected": procedure_detected["notification"]},
        {"code": "descargos", "name": "descargos", "detected": procedure_detected["descargos"]},
        {"code": "prueba", "name": "prueba", "detected": _contains(text_norm, ["prueba", "medios de prueba", "antecedentes"])},
        {"code": "resolucion", "name": "resolución", "detected": procedure_detected["resolution"]},
        {"code": "reconsideracion_apelacion", "name": "reconsideración/apelación", "detected": procedure_detected["reconsideration"]},
    ]
    deadlines = []
    business_days_rule = _first_match(text, [r"((?:\d+\s+)?d[ií]as\s+h[aá]biles[^\n.;]{0,120})"])
    if business_days_rule:
        deadlines.append({"type": "business_days", "text": business_days_rule})

    attenuating = _line_items_from_section(_section(text, ["atenuantes", "circunstancias atenuantes"], ["agravantes", "protocolos", "medidas"], 2200), "Atenuantes detectadas")
    aggravating = _line_items_from_section(_section(text, ["agravantes", "circunstancias agravantes"], ["protocolos", "medidas", "anexos"], 2200), "Agravantes detectadas")

    aula_detected = _contains(text_norm, ["aula segura", "afectacion grave", "afectación grave"])
    source_file = extracted.file_name or _text(evidence.get("file_name"))

    return {
        "source": {
            "documentType": document_type,
            "documentYear": int(document_year) if document_year else None,
            "documentTitle": document_title,
            "institution": institution,
            "foundation": foundation,
            "country": "Chile",
            "commune": commune,
            "sourceFile": source_file,
            "requiresHumanReview": True,
        },
        "establishment": {
            "name": institution,
            "sustainer": foundation,
            "commune": commune,
            "region": region,
            "levelsDetected": _extract_levels(text_norm),
            "schoolDay": _extract_school_day(text_norm),
        },
        "vision": vision,
        "mission": mission,
        "enfoqueConvivencia": enfoque,
        "principiosFormativos": principles,
        "governance": {
            "consejoEscolar": {"detected": _contains(text_norm, ["consejo escolar"]), "sourceExcerpt": _detected_excerpt(text, ["consejo escolar"])},
            "encargadoConvivencia": _extract_people_role(text, ["encargado de convivencia", "encargada de convivencia"]),
            "planGestionConvivencia": {"detected": _contains(text_norm, ["plan de gestion de convivencia", "plan de gestión de convivencia"]), "sourceExcerpt": _detected_excerpt(text, ["plan de gestión de convivencia", "plan de gestion de convivencia"])},
        },
        "policyAreas": _extract_policy_areas(text_norm),
        "misconductTypes": misconduct,
        "measures": measures,
        "procedures": {
            "faltasLeves": {"detected": bool(misconduct["leve"]), "sourceExcerpt": _section(text, ["faltas leves"], ["faltas graves", "medidas"], 900)},
            "faltasGravesGravisimas": {"detected": bool(misconduct["grave"] or misconduct["gravisima"]), "sourceExcerpt": _section(text, ["faltas graves"], ["medidas", "protocolos"], 1200)},
            "condicionalidad": {"detected": _contains(text_norm, ["condicionalidad"]), "sourceExcerpt": _detected_excerpt(text, ["condicionalidad"])},
            "expulsionCancellation": {"detected": _contains(text_norm, ["expulsion", "expulsión", "cancelacion de matricula", "cancelación de matrícula"]), "sourceExcerpt": _detected_excerpt(text, ["expulsión", "cancelación de matrícula"])},
            "guardianProcedure": {"detected": bool(misconduct["apoderado"]), "sourceExcerpt": _section(text, ["apoderados"], ["protocolos"], 900)},
            "collaborativeConflictResolution": {"detected": _contains(text_norm, ["resolucion pacifica", "resolución pacífica", "mediacion", "mediación"]), "sourceExcerpt": _detected_excerpt(text, ["resolución pacífica", "mediación"])},
            "commonStages": procedure_detected,
            "sourceExcerpt": procedure_excerpt,
        },
        "dueProcess": {
            "principles": [name for name, terms in [
                ("notificación", procedure_terms["notification"]),
                ("descargos", procedure_terms["descargos"]),
                ("prueba", ["prueba", "medios de prueba", "antecedentes"]),
                ("resolución fundada", procedure_terms["resolution"]),
                ("reconsideración", procedure_terms["reconsideration"]),
            ] if _contains(text_norm, terms)],
            "notifications": _extract_notifications(text_norm),
            "businessDaysRule": business_days_rule,
            "steps": due_process_steps,
            "deadlines": deadlines,
        },
        "attenuatingFactors": attenuating,
        "aggravatingFactors": aggravating,
        "protocols": protocol_items,
        "aulaSegura": {
            "detected": aula_detected,
            "riskFlags": ["aula_segura_or_afectacion_grave"] if aula_detected else [],
            "requiresHumanDecision": True,
            "requiresDueProcess": True,
            "automaticApplicationAllowed": False,
        },
        "systemBehavior": _system_behavior(),
        "warnings": [],
    }


def _extract_levels(text_norm: str) -> List[str]:
    levels = []
    for label, terms in [
        ("educacion_parvularia", ["educacion parvularia", "educación parvularia"]),
        ("basica", ["educacion basica", "educación básica"]),
        ("media", ["educacion media", "educación media"]),
    ]:
        if _contains(text_norm, terms):
            levels.append(label)
    return levels


def _extract_school_day(text_norm: str) -> Dict[str, Any]:
    return {
        "jornadaEscolarCompletaDetected": _contains(text_norm, ["jornada escolar completa", "jec"]),
        "source": "document_text" if _contains(text_norm, ["jornada"]) else "",
    }


def _extract_policy_areas(text_norm: str) -> List[str]:
    areas = []
    for code, terms in [
        ("comunicaciones_formales", ["correo", "telefono", "teléfono", "web", "rrss", "redes sociales", "carta certificada"]),
        ("confidencialidad_datos_estudiante", ["confidencialidad", "datos del estudiante", "datos personales"]),
        ("convivencia_escolar", ["convivencia escolar"]),
        ("inclusion", ["inclusion", "inclusión", "nee"]),
        ("seguridad_escolar", ["seguridad escolar", "accidentes escolares"]),
    ]:
        if _contains(text_norm, terms):
            areas.append(code)
    return areas


def _extract_notifications(text_norm: str) -> List[str]:
    notifications = []
    for code, terms in [
        ("correo", ["correo", "email", "e-mail"]),
        ("telefono", ["telefono", "teléfono"]),
        ("web", ["sitio web", "pagina web", "página web", "web"]),
        ("rrss", ["rrss", "redes sociales"]),
        ("carta_certificada", ["carta certificada"]),
    ]:
        if _contains(text_norm, terms):
            notifications.append(code)
    return notifications


def _system_behavior() -> Dict[str, bool]:
    return {
        "mustSuggestNotApply": True,
        "requiresHumanValidation": True,
        "mustKeepAuditTrail": True,
        "mustPreserveSourceDocumentReference": True,
        "mustAllowEditingBeforeSaving": True,
        "mustAssociateToTenantAndEstablishment": True,
        "mustVersionParameters": True,
        "mustNotClaimLegalCompliance": True,
    }


def _merge_parameters(base: Dict[str, Any], candidate: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(candidate, dict):
        return base
    candidate_params = candidate.get("parameters") if isinstance(candidate.get("parameters"), dict) else candidate
    merged = json.loads(json.dumps(base, ensure_ascii=False))
    for key, value in candidate_params.items():
        if key not in merged:
            merged[key] = value
        elif isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key].update({k: v for k, v in value.items() if v not in (None, "", [], {})})
        elif value not in (None, "", [], {}):
            merged[key] = value
    merged["source"]["requiresHumanReview"] = True
    merged["aulaSegura"]["automaticApplicationAllowed"] = False
    merged["aulaSegura"]["requiresHumanDecision"] = True
    merged["aulaSegura"]["requiresDueProcess"] = True
    merged["systemBehavior"] = _system_behavior()
    merged["warnings"] = merged.get("warnings") if isinstance(merged.get("warnings"), list) else []
    return merged


def _select_context_for_llm(text: str) -> Tuple[str, bool]:
    if len(text) <= MAX_LLM_CONTEXT_CHARS:
        return text, False
    text_norm = _norm(text)
    windows: List[str] = []
    for term in [
        "vision", "mision", "convivencia", "principios", "consejo escolar",
        "faltas leves", "faltas graves", "faltas gravisimas", "medidas",
        "procedimiento", "atenuantes", "agravantes", "protocolos", "aula segura",
    ]:
        idx = text_norm.find(term)
        if idx >= 0:
            windows.append(text[max(0, idx - 1200): idx + 5200])
    selected = "\n\n--- SECCION PRIORIZADA ---\n\n".join(windows)
    if len(selected) < MAX_LLM_CONTEXT_CHARS // 3:
        selected = text[:MAX_LLM_CONTEXT_CHARS]
    return selected[:MAX_LLM_CONTEXT_CHARS], True


def _build_llm_prompt(context_text: str, payload: Dict[str, Any]) -> str:
    meta = _as_dict(payload.get("request_meta"))
    normalized = extract_convivencia_input(payload)
    return f"""
Actúa como extractor estructurado de Reglamentos Internos, RICE y Manuales de Convivencia Escolar chilenos para TCDX Convivir.

No resumas en texto libre.
No generes un informe narrativo.
Devuelve exclusivamente JSON válido con top-level "parameters".

Debes extraer:
- source;
- establishment;
- vision;
- mission;
- enfoqueConvivencia;
- principiosFormativos;
- governance;
- policyAreas;
- misconductTypes;
- measures;
- procedures;
- dueProcess;
- attenuatingFactors;
- aggravatingFactors;
- protocols;
- aulaSegura;
- systemBehavior;
- warnings.

Reglas:
- No inventar faltas, medidas ni protocolos.
- Clasificar faltas por severidad: leve, grave, gravísima, apoderado.
- Clasificar medidas por tipo: disciplinary, formativePedagogical, supportAccompaniment, reparatory, guardianMeasures, protectiveOrCautionary.
- Extraer etapas, responsables y plazos.
- Extraer atenuantes y agravantes.
- Extraer protocolos anexos.
- Detectar Aula Segura o afectación grave.
- Marcar requiresHumanReview=true.
- Marcar automaticApplicationAllowed=false.
- Marcar mustSuggestNotApply=true.
- No declarar cumplimiento legal automático.
- No aplicar sanciones automáticamente.
- Si no hay certeza, usar warnings.
- El resultado será editable por el establecimiento antes de guardarse.

Metadata segura:
- tenantId: {meta.get("tenantId") or ""}
- establishmentId: {meta.get("establishmentId") or ""}
- sourceFile: {normalized.file_name or ""}

Texto extraído/priorizado:
{context_text}
""".strip()


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _convivencia_llm_enabled() -> bool:
    if os.getenv("AI_DISABLED", "").lower() in {"1", "true", "yes", "on"}:
        return False
    return _env_bool("CONVIVENCIA_MANUAL_LLM_ENABLED", False)


def maybe_enrich_with_llm(parameters: Dict[str, Any], payload: Dict[str, Any], extracted: ExtractedManualText) -> Tuple[Dict[str, Any], List[str], bool, bool]:
    warnings: List[str] = []
    if not _convivencia_llm_enabled():
        warnings.append("LLM no usado; extracción determinística endpoint-specific generada para revisión humana.")
        return parameters, warnings, False, False
    if not is_llm_available():
        warnings.append("LLM no configurado; extracción estructurada generada por heurísticas determinísticas.")
        return parameters, warnings, False, False
    context, context_truncated = _select_context_for_llm(extracted.text)
    if context_truncated:
        warnings.append("Texto largo priorizado por secciones relevantes antes de llamar al modelo.")

    def _call() -> Dict[str, Any]:
        return call_llm_json(
            prompt=_build_llm_prompt(context, payload),
            system_prompt="Eres un extractor JSON para TCDX Convivir. Devuelve solo JSON válido.",
            temperature=0.0,
            timeout=LLM_TIMEOUT_SECONDS,
            depth="standard",
            model_mode=os.getenv("CONVIVENCIA_MANUAL_LLM_MODEL_MODE", "fast"),
            response_contract_instruction='Devuelve exclusivamente JSON válido con top-level "parameters".',
            append_default_json_contract=False,
            generation_options_override={"num_predict": 1200, "num_ctx": 8192},
            enforce_timeout_cap=True,
        )

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    future = executor.submit(_call)
    try:
        data = future.result(timeout=max(1, LLM_TIMEOUT_SECONDS))
        executor.shutdown(wait=False, cancel_futures=True)
        return _merge_parameters(parameters, data), warnings, True, False
    except concurrent.futures.TimeoutError:
        future.cancel()
        executor.shutdown(wait=False, cancel_futures=True)
        warnings.append("LLM superó el timeout del endpoint; se devolvió extracción determinística.")
        return parameters, warnings, False, True
    except Exception as exc:
        executor.shutdown(wait=False, cancel_futures=True)
        warnings.append(f"LLM no pudo enriquecer extracción; se usó extracción determinística: {exc}")
        return parameters, warnings, False, False


def validate_parameters(parameters: Dict[str, Any]) -> Tuple[bool, List[str], int]:
    warnings: List[str] = []
    source = _as_dict(parameters.get("source"))
    establishment = _as_dict(parameters.get("establishment"))
    misconduct = _as_dict(parameters.get("misconductTypes"))
    measures = _as_dict(parameters.get("measures"))
    procedures = _as_dict(parameters.get("procedures"))
    due_process = _as_dict(parameters.get("dueProcess"))
    aula = _as_dict(parameters.get("aulaSegura"))

    families = 0
    if any(source.get(k) for k in ("documentTitle", "institution", "foundation", "documentYear")) or establishment.get("name"):
        families += 1
    else:
        warnings.append("No se detectó fuente/establecimiento suficiente.")
    if parameters.get("vision") or parameters.get("mission") or parameters.get("enfoqueConvivencia"):
        families += 1
    else:
        warnings.append("No se detectaron visión, misión o enfoque de convivencia.")
    if parameters.get("principiosFormativos"):
        families += 1
    else:
        warnings.append("No se detectaron principios formativos estructurados.")
    if any(isinstance(misconduct.get(key), list) and misconduct.get(key) for key in ("leve", "grave", "gravisima", "apoderado")):
        families += 1
    else:
        warnings.append("No se detectaron faltas clasificadas por severidad.")
    if any(isinstance(measures.get(key), list) and measures.get(key) for key in measures.keys()):
        families += 1
    else:
        warnings.append("No se detectaron medidas clasificadas por tipo.")
    procedure_signal = bool(
        procedures.get("sourceExcerpt")
        or any(
            isinstance(value, dict) and (value.get("detected") or value.get("sourceExcerpt"))
            for value in procedures.values()
        )
        or due_process.get("principles")
        or due_process.get("notifications")
        or due_process.get("businessDaysRule")
    )
    if procedure_signal:
        families += 1
    else:
        warnings.append("No se detectaron procedimientos o debido proceso estructurados.")
    if parameters.get("protocols"):
        families += 1
    else:
        warnings.append("No se detectaron protocolos anexos estructurados.")
    if aula.get("detected") or aula.get("riskFlags"):
        families += 1
    else:
        warnings.append("No se detectó Aula Segura o afectación grave.")

    if source.get("requiresHumanReview") is not True:
        warnings.append("requiresHumanReview debe ser true.")
    if aula.get("automaticApplicationAllowed") is not False:
        warnings.append("automaticApplicationAllowed debe ser false.")
    return families >= 4 and source.get("requiresHumanReview") is True and aula.get("automaticApplicationAllowed") is False, warnings, families


def _confidence(families: int, extracted: ExtractedManualText, llm_used: bool) -> float:
    score = min(0.9, 0.18 + families * 0.09)
    if extracted.raw_text_length > 15000:
        score += 0.08
    elif extracted.raw_text_length > 4000:
        score += 0.04
    if llm_used:
        score += 0.05
    if extracted.truncated:
        score -= 0.04
    return round(max(0.0, min(score, 0.95)), 2)


def _accepted_shapes() -> List[str]:
    return [
        "evidence.file_content_base64",
        "evidence.contentBase64",
        "evidence.base64",
        "evidence.raw_text",
        "evidence.text",
        "file.contentBase64",
        "document.contentBase64",
        "document.raw_text",
        "document.text",
        "file_content_base64",
        "raw_text",
    ]


def _received_shape(extracted: ExtractedManualText) -> Dict[str, Any]:
    return {
        "accepted_shapes": _accepted_shapes(),
        "received_top_level_keys": extracted.received_top_level_keys or [],
        "received_evidence_keys": extracted.received_evidence_keys or [],
    }


def _document_text_error_message(extracted: ExtractedManualText) -> str:
    reason = extracted.error_reason or ""
    if reason == "missing_content":
        return "No se recibió contenido de documento en un campo compatible."
    if reason == "pdf_text_insufficient":
        return "El PDF fue recibido, pero el texto extraído fue insuficiente. Puede ser escaneado o contener imágenes."
    if extracted.file_type == "pdf" and extracted.base64_length > 0:
        return "El PDF fue recibido, pero el texto extraído fue insuficiente. Puede ser escaneado o contener imágenes."
    if extracted.base64_length > 0:
        return "Se recibió el archivo, pero no se pudo extraer texto suficiente."
    return "No se pudo extraer texto suficiente desde el documento de convivencia."


def _debug_shape(extracted: ExtractedManualText, response: Dict[str, Any], perf: Optional[Dict[str, Any]] = None) -> None:
    if os.getenv("AI_ENGINE_DEBUG_SHAPE", "false").lower() not in {"1", "true", "yes", "on"}:
        return
    extraction = _as_dict(response.get("extraction"))
    shape = {
        "endpoint": "convivencia_manual_extract",
        "source_shape": extracted.source_shape,
        "mime_type": extracted.mime_type,
        "file_name": extracted.file_name,
        "base64_length": extracted.base64_length,
        "raw_text_length": extraction.get("raw_text_length"),
        "pages_processed": extraction.get("pages_processed"),
        "truncated": extraction.get("truncated"),
        "deterministic_family_count": (perf or {}).get("deterministic_family_count", 0),
        "llm_enabled": (perf or {}).get("llm_enabled", False),
        "llm_used": (perf or {}).get("llm_used", False),
        "llm_timed_out": (perf or {}).get("llm_timed_out", False),
        "elapsed_ms": (perf or {}).get("elapsed_ms", 0),
        "final_status": response.get("status"),
    }
    logger.info("convivencia_manual_extract=%s", json.dumps(shape, ensure_ascii=False))


def extract_convivencia_manual_parameters(payload: Dict[str, Any]) -> Dict[str, Any]:
    started_at = time.monotonic()
    extracted = extract_manual_text(payload, started_at=started_at)
    extraction_shape = {
        "raw_text_length": extracted.raw_text_length,
        "pages_processed": extracted.pages_processed,
        "truncated": extracted.truncated,
        "extraction_status": extracted.extraction_status,
        "source_shape": extracted.source_shape,
    }
    perf = {
        "deterministic_family_count": 0,
        "llm_enabled": _convivencia_llm_enabled(),
        "llm_used": False,
        "llm_timed_out": False,
        "elapsed_ms": 0,
    }
    if extracted.extraction_status == "failed" or extracted.raw_text_length < 80:
        response = {
            "status": "error",
            "error": "document_text_not_extracted",
            "message": _document_text_error_message(extracted),
            "extraction": extraction_shape,
            "warnings": extracted.warnings,
        }
        if extracted.error_reason == "missing_content":
            response.update(_received_shape(extracted))
        perf["elapsed_ms"] = int(_elapsed_seconds(started_at) * 1000)
        _debug_shape(extracted, response, perf)
        return response

    parameters = build_default_parameters(payload, extracted)
    deterministic_valid, deterministic_warnings, deterministic_families = validate_parameters(parameters)
    perf["deterministic_family_count"] = deterministic_families

    llm_warnings: List[str] = []
    llm_used = False
    llm_timed_out = False
    validation_warnings = deterministic_warnings
    families = deterministic_families
    is_valid = deterministic_valid

    if deterministic_valid:
        parameters, llm_warnings, llm_used, llm_timed_out = maybe_enrich_with_llm(parameters, payload, extracted)
        perf["llm_used"] = llm_used
        perf["llm_timed_out"] = llm_timed_out
        is_valid, validation_warnings, families = validate_parameters(parameters)
    else:
        llm_warnings.append("LLM no usado para convertir una extracción determinística insuficiente en éxito automático.")

    combined_warnings = [
        "Extracción determinística; revisar y validar antes de guardar.",
        *extracted.warnings,
        *llm_warnings,
        *validation_warnings,
    ]
    if extracted.truncated:
        combined_warnings.append("Documento truncado por límites de páginas, caracteres o tiempo.")
    parameters["warnings"] = list(dict.fromkeys([*_as_list(parameters.get("warnings")), *combined_warnings]))

    if not is_valid:
        response = {
            "status": "error",
            "error": "structured_parameters_not_extracted",
            "message": "No se pudieron extraer parámetros de convivencia suficientes.",
            "extraction": extraction_shape,
            "warnings": parameters["warnings"],
        }
        perf["elapsed_ms"] = int(_elapsed_seconds(started_at) * 1000)
        _debug_shape(extracted, response, perf)
        return response

    response = {
        "status": "ok",
        "parameters": parameters,
        "confidence": _confidence(families, extracted, llm_used),
        "warnings": parameters["warnings"],
        "extraction": extraction_shape,
    }
    perf["elapsed_ms"] = int(_elapsed_seconds(started_at) * 1000)
    _debug_shape(extracted, response, perf)
    return response


def _as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []
