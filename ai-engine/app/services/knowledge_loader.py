import json
import logging
import os
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[2]
KNOWLEDGE_DIR = BASE_DIR / "knowledge"

EXPECTED_FILES = [
    "tcdx_ai_knowledge_seed.json",
    "senior_auditor_reasoning_rules.json",
    "report_generation_rules.json",
    "task_generation_rules.json",
    "audit_intelligence_rules.json",
    "evidence_quality_rules.json",
    "risk_analysis_rules.json",
    "kpi_interpretation_rules.json",
    "ai_output_schemas.json",
    "web_context_rules.json",
]

MODULE_FILE_MAP = {
    "reports": ["tcdx_ai_knowledge_seed.json", "report_generation_rules.json", "ai_output_schemas.json"],
    "tasks": ["tcdx_ai_knowledge_seed.json", "task_generation_rules.json", "ai_output_schemas.json"],
    "audit": ["tcdx_ai_knowledge_seed.json", "senior_auditor_reasoning_rules.json", "audit_intelligence_rules.json", "ai_output_schemas.json"],
    "evidence": ["senior_auditor_reasoning_rules.json", "evidence_quality_rules.json", "ai_output_schemas.json"],
    "risk": ["senior_auditor_reasoning_rules.json", "risk_analysis_rules.json", "ai_output_schemas.json"],
    "kpi": ["kpi_interpretation_rules.json", "ai_output_schemas.json"],
    "web_context": ["web_context_rules.json", "ai_output_schemas.json"],
    "global": EXPECTED_FILES,
}

_CACHE: Dict[str, Any] = {}


def _web_context_config() -> Dict[str, Any]:
    provider = os.getenv("WEB_CONTEXT_PROVIDER") or os.getenv("EXTERNAL_LOOKUP_PROVIDER") or "brave"
    enable_raw = os.getenv("ENABLE_WEB_CONTEXT", "true").strip().lower()
    disabled = provider.strip().lower() == "disabled" or enable_raw in {"false", "0", "no", "off"}

    return {
        "enabled": not disabled,
        "provider": provider,
        "configured": bool(os.getenv("BRAVE_SEARCH_API_KEY")),
        "endpoint_configured": bool(os.getenv("BRAVE_SEARCH_ENDPOINT")),
        "legacy_brave_limits_configured": bool(
            os.getenv("BRAVE_SEARCH_MAX_QUERIES_PER_REQUEST")
            or os.getenv("BRAVE_SEARCH_MAX_RESULTS_PER_QUERY")
        ),
    }


def _load_knowledge_from_disk() -> Dict[str, Any]:
    files: Dict[str, Any] = {}
    files_loaded: List[str] = []
    missing_files: List[str] = []
    errors: List[Dict[str, str]] = []

    for filename in EXPECTED_FILES:
        path = KNOWLEDGE_DIR / filename

        if not path.exists():
            missing_files.append(filename)
            logger.warning("AI knowledge file missing: %s", filename)
            continue

        try:
            with path.open("r", encoding="utf-8") as handle:
                files[filename] = json.load(handle)
            files_loaded.append(filename)
        except json.JSONDecodeError as exc:
            errors.append({"file": filename, "error": f"invalid_json:{exc.lineno}:{exc.colno}"})
            logger.warning("AI knowledge JSON invalid in %s at line %s", filename, exc.lineno)
        except OSError as exc:
            errors.append({"file": filename, "error": "read_error"})
            logger.warning("AI knowledge file could not be read: %s", filename)

    return {
        "knowledge_loaded": len(files_loaded) == len(EXPECTED_FILES) and not errors,
        "knowledge_dir": str(KNOWLEDGE_DIR),
        "files": files,
        "files_loaded": files_loaded,
        "expected_files": EXPECTED_FILES,
        "missing_files": missing_files,
        "errors": errors,
        "web_context": _web_context_config(),
    }


def reload_knowledge() -> Dict[str, Any]:
    global _CACHE
    _CACHE = _load_knowledge_from_disk()
    return get_knowledge_status()


def get_knowledge_base() -> Dict[str, Any]:
    if not _CACHE:
        reload_knowledge()
    return deepcopy(_CACHE.get("files") or {})


def get_knowledge_module(module: Optional[str]) -> Dict[str, Any]:
    if not _CACHE:
        reload_knowledge()

    module_key = (module or "global").strip().lower()
    selected_files = MODULE_FILE_MAP.get(module_key, MODULE_FILE_MAP["global"])
    files = _CACHE.get("files") or {}

    return {
        filename: deepcopy(files[filename])
        for filename in selected_files
        if filename in files
    }


def get_knowledge_status() -> Dict[str, Any]:
    if not _CACHE:
        reload_knowledge()

    return {
        "ok": bool(_CACHE.get("knowledge_loaded")) and not _CACHE.get("errors"),
        "knowledge_loaded": bool(_CACHE.get("knowledge_loaded")),
        "files_loaded": list(_CACHE.get("files_loaded") or []),
        "expected_files": list(_CACHE.get("expected_files") or EXPECTED_FILES),
        "missing_files": list(_CACHE.get("missing_files") or []),
        "errors": list(_CACHE.get("errors") or []),
        "modules": sorted(MODULE_FILE_MAP.keys()),
        "web_context": dict(_CACHE.get("web_context") or _web_context_config()),
    }


reload_knowledge()
