import argparse
import hashlib
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from app.services.web_context_service import sanitize_web_query

BASE_DIR = Path(__file__).resolve().parents[2]
BOOTSTRAP_DIR = BASE_DIR / "knowledge" / "bootstrap"
TOPICS_PATH = BOOTSTRAP_DIR / "topics" / "bootstrap_topics.json"
SEEDS_DIR = BOOTSTRAP_DIR / "seeds"

BOOTSTRAP_STATUSES = {
    "bootstrap_pending_review",
    "bootstrap_approved",
    "bootstrap_rejected",
    "bootstrap_archived",
}

ITEM_COLUMNS = """
  id,
  title,
  summary,
  content,
  practical_use,
  recommended_application,
  limitations,
  knowledge_type,
  domain,
  module,
  standard_code,
  clause_or_control,
  tags_json,
  trust_score,
  freshness_score,
  usefulness_score,
  confidence_score,
  source_type,
  origin,
  status,
  source_url,
  source_provider,
  retrieved_at,
  created_at,
  updated_at
"""


def _engine():
    from app.core.db import engine

    return engine


def _sql(query: str):
    from sqlalchemy import text as sqlalchemy_text

    return sqlalchemy_text(query)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"false", "0", "no", "off"}


def _json(value: Any, fallback: Any) -> str:
    return json.dumps(value if value is not None else fallback, ensure_ascii=False)


def _clean_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _clean_row(row: Any) -> Dict[str, Any]:
    data = dict(row)
    return {key: _clean_value(value) for key, value in data.items()}


def _safe_limit(value: int, fallback: int = 20, maximum: int = 100) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = fallback
    return max(1, min(parsed, maximum))


def _safe_offset(value: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = 0
    return max(0, parsed)


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _to_float(value: Any, fallback: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = fallback
    return max(0.0, min(100.0, round(parsed, 2)))


def _normalize_text(value: Any) -> str:
    text_value = str(value or "").strip().lower()
    text_value = re.sub(r"\s+", " ", text_value)
    return text_value


def _clean_external_text(value: Any, max_length: int = 600) -> str:
    text_value = str(value or "")
    text_value = re.sub(r"<[^>]+>", " ", text_value)
    text_value = re.sub(r"&nbsp;", " ", text_value, flags=re.IGNORECASE)
    text_value = re.sub(r"&amp;", "&", text_value, flags=re.IGNORECASE)
    text_value = re.sub(r"&lt;", "<", text_value, flags=re.IGNORECASE)
    text_value = re.sub(r"&gt;", ">", text_value, flags=re.IGNORECASE)
    text_value = re.sub(r"\s+", " ", text_value).strip()
    return text_value[:max_length]


def _fingerprint(item: Dict[str, Any]) -> str:
    raw = "|".join(
        [
            _normalize_text(item.get("title")),
            _normalize_text(item.get("summary")),
            _normalize_text(item.get("module")),
            _normalize_text(item.get("domain")),
            _normalize_text(item.get("standard_code")),
            _normalize_text(item.get("knowledge_type")),
            _normalize_text(item.get("source_url")),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _score_item(item: Dict[str, Any]) -> Tuple[float, float, float, float]:
    base_confidence = _to_float(item.get("confidence_score"), 90.0)
    trust = _to_float(item.get("trust_score"), base_confidence)
    freshness = _to_float(item.get("freshness_score"), 90.0 if item.get("source_type") == "internal_seed" else 70.0)
    usefulness = _to_float(item.get("usefulness_score"), base_confidence)
    confidence = round((trust * 0.45) + (freshness * 0.25) + (usefulness * 0.30), 2)
    return trust, freshness, usefulness, confidence


def _settings() -> Dict[str, Any]:
    provider = os.getenv("BOOTSTRAP_KNOWLEDGE_PROVIDER") or os.getenv("WEB_CONTEXT_PROVIDER") or "brave"
    enabled = _env_bool("ENABLE_BOOTSTRAP_KNOWLEDGE", True)
    dry_run = _env_bool("BOOTSTRAP_KNOWLEDGE_DRY_RUN", False)
    require_review = _env_bool("BOOTSTRAP_KNOWLEDGE_REQUIRE_REVIEW", True)
    auto_approve_internal = _env_bool("BOOTSTRAP_KNOWLEDGE_AUTO_APPROVE_INTERNAL_SEEDS", True)
    auto_approve_external = _env_bool("BOOTSTRAP_KNOWLEDGE_AUTO_APPROVE_EXTERNAL", False)

    return {
        "enabled": enabled,
        "provider": provider.strip().lower(),
        "dry_run": dry_run,
        "require_review": require_review,
        "auto_approve_internal_seeds": auto_approve_internal,
        "auto_approve_external": auto_approve_external,
        "brave_configured": bool(os.getenv("BRAVE_SEARCH_API_KEY")),
        "brave_endpoint": os.getenv("BRAVE_SEARCH_ENDPOINT", "https://api.search.brave.com/res/v1/web/search"),
        "timeout_seconds": max(1, min(int(os.getenv("WEB_CONTEXT_TIMEOUT_MS", "8000") or "8000") / 1000, 20)),
        "max_topics_per_run": int(os.getenv("BOOTSTRAP_KNOWLEDGE_MAX_TOPICS_PER_RUN", "10") or "10"),
        "max_results_per_topic": int(os.getenv("BOOTSTRAP_KNOWLEDGE_MAX_RESULTS_PER_TOPIC", "5") or "5"),
        "allowed_domains": _csv_env("BOOTSTRAP_KNOWLEDGE_ALLOWED_DOMAINS"),
        "blocked_domains": _csv_env("BOOTSTRAP_KNOWLEDGE_BLOCKED_DOMAINS"),
    }


def _csv_env(name: str) -> Set[str]:
    raw = os.getenv(name, "")
    return {
        item.strip().lower()
        for item in raw.split(",")
        if item.strip()
    }


def _seed_status(item: Dict[str, Any], settings: Dict[str, Any]) -> str:
    requested = str(item.get("status") or "").strip()
    source_type = str(item.get("source_type") or "internal_seed").strip()

    if source_type == "internal_seed" and settings["auto_approve_internal_seeds"]:
        return "bootstrap_approved"

    if requested in BOOTSTRAP_STATUSES:
        return requested

    return "bootstrap_pending_review"


def _external_status(settings: Dict[str, Any], confidence_score: float) -> str:
    if (
        settings["auto_approve_external"]
        and not settings["require_review"]
        and confidence_score >= 70
    ):
        return "bootstrap_approved"
    return "bootstrap_pending_review"


def _hostname(url: str) -> str:
    try:
        return (urllib.parse.urlparse(url).hostname or "").lower()
    except Exception:
        return ""


def _domain_allowed(url: str, settings: Dict[str, Any]) -> bool:
    host = _hostname(url)
    if not host:
        return False

    blocked = settings.get("blocked_domains") or set()
    allowed = settings.get("allowed_domains") or set()

    if any(host == domain or host.endswith(f".{domain}") for domain in blocked):
        return False

    if allowed:
        return any(host == domain or host.endswith(f".{domain}") for domain in allowed)

    return True


def _trust_score_for_url(url: str) -> float:
    host = _hostname(url)
    official_domains = (
        "nist.gov",
        "cisa.gov",
        "enisa.europa.eu",
        "owasp.org",
        "cisecurity.org",
        "cloudsecurityalliance.org",
        "iso.org",
    )
    vendor_domains = (
        "learn.microsoft.com",
        "docs.aws.amazon.com",
        "cloud.google.com",
        "docs.oracle.com",
        "docs.vmware.com",
        "docs.fortinet.com",
        "dell.com",
        "hpe.com",
    )

    if any(host == domain or host.endswith(f".{domain}") for domain in official_domains):
        return 92.0
    if any(host == domain or host.endswith(f".{domain}") for domain in vendor_domains):
        return 84.0
    if host.endswith(".gov") or ".gov." in host:
        return 88.0
    if host.endswith(".edu"):
        return 78.0
    return 65.0


def _external_item_from_result(topic: Dict[str, Any], result: Dict[str, Any]) -> Dict[str, Any]:
    knowledge_types = topic.get("knowledge_types") or ["best_practice"]
    knowledge_type = knowledge_types[0] if knowledge_types else "best_practice"
    source_url = result.get("url") or ""
    source_title = _clean_external_text(result.get("title") or topic.get("title") or "Fuente externa", 220)
    source_summary = _clean_external_text(result.get("summary") or "", 500)
    trust_score = _trust_score_for_url(source_url)
    usefulness_score = 82.0 if topic.get("priority") == "high" else 74.0
    freshness_score = 72.0
    confidence_score = round((trust_score * 0.45) + (freshness_score * 0.25) + (usefulness_score * 0.30), 2)

    return {
        "title": f"{topic.get('title')}: {source_title}"[:240],
        "summary": (
            "Contexto externo complementario localizado mediante Brave Search. "
            f"Resumen de referencia: {source_summary[:450]}"
        ).strip(),
        "content": (
            "Este item no almacena contenido completo de la fuente. "
            "Registra metadata y un resumen operativo breve para revision humana antes de uso general."
        ),
        "practical_use": "Puede enriquecer recomendaciones, reportes o preparacion de auditoria como contexto externo complementario.",
        "recommended_application": (
            "Usar solo si se aprueba internamente y siempre separado de la evidencia interna del tenant."
        ),
        "limitations": (
            "No declara cumplimiento interno, no reemplaza evidencia del tenant y requiere revision humana antes de quedar aprobado."
        ),
        "knowledge_type": knowledge_type,
        "domain": topic.get("domain"),
        "module": topic.get("module"),
        "standard_code": topic.get("standard_code"),
        "clause_or_control": None,
        "tags": [
            "bootstrap",
            "brave",
            str(topic.get("code") or "").lower(),
            str(topic.get("module") or "").lower(),
        ],
        "trust_score": trust_score,
        "freshness_score": freshness_score,
        "usefulness_score": usefulness_score,
        "confidence_score": confidence_score,
        "source_type": "external_public",
        "origin": "bootstrap_brave",
        "source_url": source_url,
        "source_provider": "brave",
        "retrieved_at": result.get("retrieved_at") or _utc_now().isoformat(),
        "raw_result": result,
    }


def _source_url_for_seed(seed_file: Path) -> str:
    return f"internal://bootstrap/seeds/{seed_file.name}"


def load_topics_from_disk() -> List[Dict[str, Any]]:
    topics = _load_json(TOPICS_PATH)
    if not isinstance(topics, list):
        raise ValueError("bootstrap_topics.json debe contener una lista")
    return topics


def load_seed_items_from_disk() -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for seed_file in sorted(SEEDS_DIR.glob("*.json")):
        data = _load_json(seed_file)
        if not isinstance(data, list):
            raise ValueError(f"{seed_file.name} debe contener una lista")
        for item in data:
            if not isinstance(item, dict):
                raise ValueError(f"{seed_file.name} contiene un item no objeto")
            items.append({**item, "_seed_file": seed_file.name})
    return items


def _ensure_enabled(settings: Dict[str, Any]) -> None:
    if not settings["enabled"]:
        raise RuntimeError("ENABLE_BOOTSTRAP_KNOWLEDGE esta desactivado")


def _create_run(conn, mode: str, dry_run: bool, require_review: bool, config: Dict[str, Any]) -> str:
    row = conn.execute(
        _sql(
            """
            INSERT INTO ai_bootstrap_knowledge_runs (
              mode,
              status,
              provider,
              dry_run,
              require_review,
              config_json
            )
            VALUES (:mode, 'running', :provider, :dry_run, :require_review, CAST(:config_json AS jsonb))
            RETURNING id
            """
        ),
        {
            "mode": mode,
            "provider": config.get("provider") or "internal_seed",
            "dry_run": dry_run,
            "require_review": require_review,
            "config_json": _json(
                {
                    "enabled": config.get("enabled"),
                    "provider": config.get("provider"),
                    "require_review": require_review,
                    "auto_approve_internal_seeds": config.get("auto_approve_internal_seeds"),
                    "auto_approve_external": config.get("auto_approve_external"),
                    "brave_configured": config.get("brave_configured"),
                },
                {},
            ),
        },
    ).mappings().first()
    return str(row["id"])


def _finish_run(conn, run_id: str, status: str, summary: Dict[str, Any], error_message: Optional[str] = None) -> None:
    conn.execute(
        _sql(
            """
            UPDATE ai_bootstrap_knowledge_runs
            SET
              status = :status,
              topics_processed = :topics_processed,
              items_created = :items_created,
              items_pending_review = :items_pending_review,
              items_approved = :items_approved,
              items_rejected = :items_rejected,
              duplicates = :duplicates,
              log_json = CAST(:log_json AS jsonb),
              error_message = :error_message,
              finished_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = :run_id
            """
        ),
        {
            "run_id": run_id,
            "status": status,
            "topics_processed": summary.get("topics_processed", 0),
            "items_created": summary.get("items_created", 0),
            "items_pending_review": summary.get("items_pending_review", 0),
            "items_approved": summary.get("items_approved", 0),
            "items_rejected": summary.get("items_rejected", 0),
            "duplicates": summary.get("duplicates", 0),
            "log_json": _json(summary.get("logs"), []),
            "error_message": error_message,
        },
    )


def _upsert_topic(conn, topic: Dict[str, Any]) -> str:
    row = conn.execute(
        _sql(
            """
            INSERT INTO ai_bootstrap_knowledge_topics (
              code,
              title,
              query_templates_json,
              domain,
              module,
              standard_code,
              knowledge_types_json,
              priority,
              max_results,
              source_file,
              raw_json,
              updated_at
            )
            VALUES (
              :code,
              :title,
              CAST(:query_templates AS jsonb),
              :domain,
              :module,
              :standard_code,
              CAST(:knowledge_types AS jsonb),
              :priority,
              :max_results,
              'bootstrap_topics.json',
              CAST(:raw_json AS jsonb),
              CURRENT_TIMESTAMP
            )
            ON CONFLICT (code)
            DO UPDATE SET
              title = EXCLUDED.title,
              query_templates_json = EXCLUDED.query_templates_json,
              domain = EXCLUDED.domain,
              module = EXCLUDED.module,
              standard_code = EXCLUDED.standard_code,
              knowledge_types_json = EXCLUDED.knowledge_types_json,
              priority = EXCLUDED.priority,
              max_results = EXCLUDED.max_results,
              raw_json = EXCLUDED.raw_json,
              is_active = true,
              updated_at = CURRENT_TIMESTAMP
            RETURNING id
            """
        ),
        {
            "code": topic.get("code"),
            "title": topic.get("title"),
            "query_templates": _json(topic.get("query_templates"), []),
            "domain": topic.get("domain"),
            "module": topic.get("module"),
            "standard_code": topic.get("standard_code"),
            "knowledge_types": _json(topic.get("knowledge_types"), []),
            "priority": topic.get("priority") or "medium",
            "max_results": int(topic.get("max_results") or 5),
            "raw_json": _json(topic, {}),
        },
    ).mappings().first()
    return str(row["id"])


def _upsert_seed_source(conn, seed_file: str) -> str:
    source_url = f"internal://bootstrap/seeds/{seed_file}"
    row = conn.execute(
        _sql(
            """
            INSERT INTO ai_bootstrap_knowledge_sources (
              source_url,
              source_provider,
              source_domain,
              source_type,
              title,
              summary,
              trust_score,
              retrieved_at,
              metadata_json,
              updated_at
            )
            VALUES (
              :source_url,
              'internal_seed',
              'tcdx',
              'internal_seed',
              :title,
              'Seed interno interpretativo TCDX para conocimiento general no-tenant.',
              95,
              CURRENT_TIMESTAMP,
              CAST(:metadata_json AS jsonb),
              CURRENT_TIMESTAMP
            )
            ON CONFLICT (source_provider, source_url)
            DO UPDATE SET
              title = EXCLUDED.title,
              summary = EXCLUDED.summary,
              trust_score = EXCLUDED.trust_score,
              metadata_json = EXCLUDED.metadata_json,
              updated_at = CURRENT_TIMESTAMP
            RETURNING id
            """
        ),
        {
            "source_url": source_url,
            "title": seed_file,
            "metadata_json": _json({"seed_file": seed_file, "origin": "bootstrap_seed"}, {}),
        },
    ).mappings().first()
    return str(row["id"])


def _find_topic_id(topic_ids_by_module: Dict[str, str], item: Dict[str, Any]) -> Optional[str]:
    module = str(item.get("module") or "").strip().lower()
    return topic_ids_by_module.get(module)


def _upsert_seed_item(
    conn,
    item: Dict[str, Any],
    run_id: str,
    source_id: str,
    topic_id: Optional[str],
    settings: Dict[str, Any],
) -> str:
    trust, freshness, usefulness, confidence = _score_item(item)
    status = _seed_status(item, settings)
    fingerprint = _fingerprint(item)
    source_url = _source_url_for_seed(SEEDS_DIR / str(item.get("_seed_file") or "unknown.json"))

    existing = conn.execute(
        _sql("SELECT id FROM ai_bootstrap_knowledge_items WHERE fingerprint = :fingerprint"),
        {"fingerprint": fingerprint},
    ).mappings().first()

    params = {
        "topic_id": topic_id,
        "source_id": source_id,
        "run_id": run_id,
        "title": item.get("title"),
        "summary": item.get("summary"),
        "content": item.get("content"),
        "practical_use": item.get("practical_use"),
        "recommended_application": item.get("recommended_application"),
        "limitations": item.get("limitations"),
        "knowledge_type": item.get("knowledge_type"),
        "domain": item.get("domain"),
        "module": item.get("module"),
        "standard_code": item.get("standard_code"),
        "clause_or_control": item.get("clause_or_control"),
        "tags": _json(item.get("tags"), []),
        "trust_score": trust,
        "freshness_score": freshness,
        "usefulness_score": usefulness,
        "confidence_score": confidence,
        "source_type": item.get("source_type") or "internal_seed",
        "origin": item.get("origin") or "bootstrap_seed",
        "status": status,
        "source_url": item.get("source_url") or source_url,
        "source_provider": item.get("source_provider") or "internal_seed",
        "retrieved_at": item.get("retrieved_at"),
        "fingerprint": fingerprint,
        "raw_json": _json(item, {}),
    }

    if existing:
        conn.execute(
            _sql(
                """
                UPDATE ai_bootstrap_knowledge_items
                SET
                  topic_id = :topic_id,
                  source_id = :source_id,
                  run_id = :run_id,
                  title = :title,
                  summary = :summary,
                  content = :content,
                  practical_use = :practical_use,
                  recommended_application = :recommended_application,
                  limitations = :limitations,
                  knowledge_type = :knowledge_type,
                  domain = :domain,
                  module = :module,
                  standard_code = :standard_code,
                  clause_or_control = :clause_or_control,
                  tags_json = CAST(:tags AS jsonb),
                  trust_score = :trust_score,
                  freshness_score = :freshness_score,
                  usefulness_score = :usefulness_score,
                  confidence_score = :confidence_score,
                  source_type = :source_type,
                  origin = :origin,
                  status = :status,
                  source_url = :source_url,
                  source_provider = :source_provider,
                  raw_json = CAST(:raw_json AS jsonb),
                  is_active = true,
                  updated_at = CURRENT_TIMESTAMP
                WHERE fingerprint = :fingerprint
                """
            ),
            params,
        )
        return "duplicate_updated"

    conn.execute(
        _sql(
            """
            INSERT INTO ai_bootstrap_knowledge_items (
              topic_id,
              source_id,
              run_id,
              title,
              summary,
              content,
              practical_use,
              recommended_application,
              limitations,
              knowledge_type,
              domain,
              module,
              standard_code,
              clause_or_control,
              tags_json,
              trust_score,
              freshness_score,
              usefulness_score,
              confidence_score,
              source_type,
              origin,
              status,
              source_url,
              source_provider,
              retrieved_at,
              fingerprint,
              raw_json
            )
            VALUES (
              :topic_id,
              :source_id,
              :run_id,
              :title,
              :summary,
              :content,
              :practical_use,
              :recommended_application,
              :limitations,
              :knowledge_type,
              :domain,
              :module,
              :standard_code,
              :clause_or_control,
              CAST(:tags AS jsonb),
              :trust_score,
              :freshness_score,
              :usefulness_score,
              :confidence_score,
              :source_type,
              :origin,
              :status,
              :source_url,
              :source_provider,
              :retrieved_at,
              :fingerprint,
              CAST(:raw_json AS jsonb)
            )
            """
        ),
        params,
    )
    return "created"


def _brave_search(query: str, settings: Dict[str, Any], max_results: int) -> Dict[str, Any]:
    api_key = os.getenv("BRAVE_SEARCH_API_KEY")
    if not api_key:
        return {"ok": False, "error": "brave_api_key_missing", "results": []}

    params = urllib.parse.urlencode({
        "q": query,
        "count": max(1, min(int(max_results or 5), 10)),
        "search_lang": "en",
        "country": "us",
    })
    request = urllib.request.Request(
        f"{settings['brave_endpoint']}?{params}",
        headers={
            "Accept": "application/json",
            "Accept-Encoding": "identity",
            "X-Subscription-Token": api_key,
            "User-Agent": "TCDX-AI-Bootstrap/1.0",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=settings["timeout_seconds"]) as response:
            data = json.loads(response.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as exc:
        return {"ok": False, "error": f"brave_http_{exc.code}", "results": []}
    except Exception:
        return {"ok": False, "error": "brave_request_failed", "results": []}

    results = []
    for item in (data.get("web") or {}).get("results") or []:
        url = item.get("url") or ""
        if not url.startswith(("http://", "https://")):
            continue
        if not _domain_allowed(url, settings):
            continue
        results.append({
            "title": _clean_external_text(item.get("title") or "Fuente externa", 220),
            "url": url,
            "source": "brave",
            "retrieved_at": _utc_now().isoformat(),
            "summary": _clean_external_text(item.get("description") or "", 600),
        })

    return {"ok": True, "query": query, "results": results}


def _upsert_external_source(conn, result: Dict[str, Any], item: Dict[str, Any]) -> str:
    source_url = result.get("url") or item.get("source_url")
    source_domain = _hostname(source_url)
    row = conn.execute(
        _sql(
            """
            INSERT INTO ai_bootstrap_knowledge_sources (
              source_url,
              source_provider,
              source_domain,
              source_type,
              title,
              summary,
              trust_score,
              retrieved_at,
              metadata_json,
              updated_at
            )
            VALUES (
              :source_url,
              'brave',
              :source_domain,
              'external_public',
              :title,
              :summary,
              :trust_score,
              :retrieved_at,
              CAST(:metadata_json AS jsonb),
              CURRENT_TIMESTAMP
            )
            ON CONFLICT (source_provider, source_url)
            DO UPDATE SET
              title = EXCLUDED.title,
              summary = EXCLUDED.summary,
              trust_score = EXCLUDED.trust_score,
              retrieved_at = EXCLUDED.retrieved_at,
              metadata_json = EXCLUDED.metadata_json,
              updated_at = CURRENT_TIMESTAMP
            RETURNING id
            """
        ),
        {
            "source_url": source_url,
            "source_domain": source_domain,
            "title": result.get("title") or item.get("title"),
            "summary": result.get("summary") or item.get("summary"),
            "trust_score": item.get("trust_score") or 65,
            "retrieved_at": item.get("retrieved_at"),
            "metadata_json": _json({"origin": "bootstrap_brave", "raw_result": result}, {}),
        },
    ).mappings().first()
    return str(row["id"])


def _upsert_external_item(
    conn,
    item: Dict[str, Any],
    run_id: str,
    source_id: str,
    topic_id: Optional[str],
    settings: Dict[str, Any],
) -> str:
    status = _external_status(settings, _to_float(item.get("confidence_score"), 0))
    fingerprint = _fingerprint(item)
    existing = conn.execute(
        _sql("SELECT id FROM ai_bootstrap_knowledge_items WHERE fingerprint = :fingerprint"),
        {"fingerprint": fingerprint},
    ).mappings().first()
    params = {
        "topic_id": topic_id,
        "source_id": source_id,
        "run_id": run_id,
        "title": item.get("title"),
        "summary": item.get("summary"),
        "content": item.get("content"),
        "practical_use": item.get("practical_use"),
        "recommended_application": item.get("recommended_application"),
        "limitations": item.get("limitations"),
        "knowledge_type": item.get("knowledge_type"),
        "domain": item.get("domain"),
        "module": item.get("module"),
        "standard_code": item.get("standard_code"),
        "clause_or_control": item.get("clause_or_control"),
        "tags": _json(item.get("tags"), []),
        "trust_score": item.get("trust_score"),
        "freshness_score": item.get("freshness_score"),
        "usefulness_score": item.get("usefulness_score"),
        "confidence_score": item.get("confidence_score"),
        "source_type": item.get("source_type") or "external_public",
        "origin": item.get("origin") or "bootstrap_brave",
        "status": status,
        "source_url": item.get("source_url"),
        "source_provider": item.get("source_provider") or "brave",
        "retrieved_at": item.get("retrieved_at"),
        "fingerprint": fingerprint,
        "raw_json": _json(item, {}),
    }

    if existing:
        conn.execute(
            _sql(
                """
                UPDATE ai_bootstrap_knowledge_items
                SET
                  topic_id = :topic_id,
                  source_id = :source_id,
                  run_id = :run_id,
                  title = :title,
                  summary = :summary,
                  content = :content,
                  practical_use = :practical_use,
                  recommended_application = :recommended_application,
                  limitations = :limitations,
                  knowledge_type = :knowledge_type,
                  domain = :domain,
                  module = :module,
                  standard_code = :standard_code,
                  clause_or_control = :clause_or_control,
                  tags_json = CAST(:tags AS jsonb),
                  trust_score = :trust_score,
                  freshness_score = :freshness_score,
                  usefulness_score = :usefulness_score,
                  confidence_score = :confidence_score,
                  source_url = :source_url,
                  source_provider = :source_provider,
                  raw_json = CAST(:raw_json AS jsonb),
                  is_active = true,
                  updated_at = CURRENT_TIMESTAMP
                WHERE fingerprint = :fingerprint
                """
            ),
            params,
        )
        return "duplicate_updated"

    conn.execute(
        _sql(
            """
            INSERT INTO ai_bootstrap_knowledge_items (
              topic_id,
              source_id,
              run_id,
              title,
              summary,
              content,
              practical_use,
              recommended_application,
              limitations,
              knowledge_type,
              domain,
              module,
              standard_code,
              clause_or_control,
              tags_json,
              trust_score,
              freshness_score,
              usefulness_score,
              confidence_score,
              source_type,
              origin,
              status,
              source_url,
              source_provider,
              retrieved_at,
              fingerprint,
              raw_json
            )
            VALUES (
              :topic_id,
              :source_id,
              :run_id,
              :title,
              :summary,
              :content,
              :practical_use,
              :recommended_application,
              :limitations,
              :knowledge_type,
              :domain,
              :module,
              :standard_code,
              :clause_or_control,
              CAST(:tags AS jsonb),
              :trust_score,
              :freshness_score,
              :usefulness_score,
              :confidence_score,
              :source_type,
              :origin,
              :status,
              :source_url,
              :source_provider,
              :retrieved_at,
              :fingerprint,
              CAST(:raw_json AS jsonb)
            )
            """
        ),
        params,
    )
    return "created"


def get_bootstrap_status() -> Dict[str, Any]:
    settings = _settings()
    try:
        with _engine().connect() as conn:
            counts_rows = conn.execute(
                _sql(
                    """
                    SELECT status, COUNT(*)::int AS total
                    FROM ai_bootstrap_knowledge_items
                    GROUP BY status
                    """
                )
            ).mappings().all()

            last_run = conn.execute(
                _sql(
                    """
                    SELECT id, mode, status, provider, started_at, finished_at, items_created, duplicates
                    FROM ai_bootstrap_knowledge_runs
                    ORDER BY created_at DESC
                    LIMIT 1
                    """
                )
            ).mappings().first()
    except Exception as exc:
        return {
            "ok": False,
            "bootstrap_enabled": settings["enabled"],
            "provider": settings["provider"],
            "error": "bootstrap_tables_unavailable",
            "detail": str(exc),
        }

    counts = {
        "bootstrap_approved": 0,
        "bootstrap_pending_review": 0,
        "bootstrap_rejected": 0,
        "bootstrap_archived": 0,
    }
    for row in counts_rows:
        counts[str(row["status"])] = int(row["total"])

    return {
        "ok": True,
        "bootstrap_enabled": settings["enabled"],
        "provider": settings["provider"],
        "counts": counts,
        "last_run": dict(last_run) if last_run else None,
    }


def load_seed_knowledge(dry_run: bool = False, require_review: Optional[bool] = None) -> Dict[str, Any]:
    settings = _settings()
    _ensure_enabled(settings)
    dry_run = bool(dry_run or settings["dry_run"])
    require_review = settings["require_review"] if require_review is None else bool(require_review)

    topics = load_topics_from_disk()
    seed_items = load_seed_items_from_disk()

    summary: Dict[str, Any] = {
        "ok": True,
        "mode": "seeds",
        "dry_run": dry_run,
        "topics_available": len(topics),
        "seed_items_available": len(seed_items),
        "topics_processed": 0,
        "items_created": 0,
        "items_pending_review": 0,
        "items_approved": 0,
        "items_rejected": 0,
        "duplicates": 0,
        "logs": [],
    }

    if dry_run:
        return summary

    with _engine().begin() as conn:
        run_id = _create_run(conn, "seeds", dry_run, require_review, settings)
        summary["run_id"] = run_id

        try:
            topic_ids_by_module: Dict[str, str] = {}
            for topic in topics:
                topic_id = _upsert_topic(conn, topic)
                module = str(topic.get("module") or "").strip().lower()
                if module and module not in topic_ids_by_module:
                    topic_ids_by_module[module] = topic_id
                summary["topics_processed"] += 1

            source_ids: Dict[str, str] = {}
            for item in seed_items:
                seed_file = str(item.get("_seed_file") or "unknown.json")
                source_id = source_ids.get(seed_file)
                if not source_id:
                    source_id = _upsert_seed_source(conn, seed_file)
                    source_ids[seed_file] = source_id

                result = _upsert_seed_item(
                    conn,
                    item,
                    run_id,
                    source_id,
                    _find_topic_id(topic_ids_by_module, item),
                    settings,
                )

                status = _seed_status(item, settings)
                if result == "created":
                    summary["items_created"] += 1
                else:
                    summary["duplicates"] += 1

                if status == "bootstrap_approved":
                    summary["items_approved"] += 1
                elif status == "bootstrap_rejected":
                    summary["items_rejected"] += 1
                elif status == "bootstrap_pending_review":
                    summary["items_pending_review"] += 1

            summary["logs"].append({
                "message": "Seeds internos cargados en base bootstrap separada.",
                "seed_files": sorted(source_ids.keys()),
                "generated_at": _utc_now().isoformat(),
            })
            _finish_run(conn, run_id, "completed", summary)
        except Exception as exc:
            _finish_run(conn, run_id, "failed", summary, error_message=str(exc))
            raise

    return summary


def load_brave_knowledge(
    topic_codes: Optional[List[str]] = None,
    max_topics: Optional[int] = None,
    max_results_per_topic: Optional[int] = None,
    dry_run: bool = False,
    require_review: Optional[bool] = None,
) -> Dict[str, Any]:
    settings = _settings()
    _ensure_enabled(settings)
    dry_run = bool(dry_run or settings["dry_run"])
    require_review = settings["require_review"] if require_review is None else bool(require_review)

    if settings["provider"] != "brave":
        return {
            "ok": False,
            "mode": "brave",
            "reason": "BOOTSTRAP_KNOWLEDGE_PROVIDER no esta configurado como brave.",
            "provider": settings["provider"],
        }

    if not settings["brave_configured"]:
        return {
            "ok": False,
            "mode": "brave",
            "reason": "BRAVE_SEARCH_API_KEY no esta configurada.",
            "items_created": 0,
        }

    topics = load_topics_from_disk()
    requested_codes = {
        str(code).strip()
        for code in (topic_codes or [])
        if str(code).strip()
    }
    if requested_codes:
        topics = [topic for topic in topics if str(topic.get("code") or "") in requested_codes]

    topics = topics[: _safe_limit(max_topics or settings["max_topics_per_run"], fallback=10, maximum=50)]
    max_results = _safe_limit(
        max_results_per_topic or settings["max_results_per_topic"],
        fallback=5,
        maximum=10,
    )

    summary: Dict[str, Any] = {
        "ok": True,
        "mode": "brave",
        "dry_run": dry_run,
        "topics_requested": len(requested_codes),
        "topics_selected": len(topics),
        "topics_processed": 0,
        "queries_executed": 0,
        "items_created": 0,
        "items_pending_review": 0,
        "items_approved": 0,
        "items_rejected": 0,
        "duplicates": 0,
        "failed_queries": [],
        "blocked_queries": [],
        "logs": [],
    }

    if dry_run:
        for topic in topics:
            query_templates = topic.get("query_templates") or []
            query = query_templates[0] if query_templates else topic.get("title")
            sanitized = sanitize_web_query(query)
            if sanitized.get("safe"):
                summary["queries_executed"] += 1
            else:
                summary["blocked_queries"].append({
                    "topic_code": topic.get("code"),
                    "reason": sanitized.get("blocked_reason"),
                })
        return summary

    with _engine().begin() as conn:
        run_id = _create_run(conn, "brave", dry_run, require_review, settings)
        summary["run_id"] = run_id

        try:
            for topic in topics:
                topic_id = _upsert_topic(conn, topic)
                query_templates = topic.get("query_templates") or []
                raw_query = query_templates[0] if query_templates else topic.get("title")
                sanitized = sanitize_web_query(raw_query)

                if not sanitized.get("safe"):
                    summary["blocked_queries"].append({
                        "topic_code": topic.get("code"),
                        "reason": sanitized.get("blocked_reason"),
                    })
                    continue

                query = sanitized["query"]
                result = _brave_search(query, settings, max_results)
                summary["topics_processed"] += 1
                summary["queries_executed"] += 1

                if not result.get("ok"):
                    summary["failed_queries"].append({
                        "topic_code": topic.get("code"),
                        "query": query,
                        "error": result.get("error"),
                    })
                    continue

                for raw_result in result.get("results") or []:
                    item = _external_item_from_result(topic, raw_result)
                    source_id = _upsert_external_source(conn, raw_result, item)
                    write_result = _upsert_external_item(
                        conn,
                        item,
                        run_id,
                        source_id,
                        topic_id,
                        settings,
                    )
                    status = _external_status(settings, _to_float(item.get("confidence_score"), 0))

                    if write_result == "created":
                        summary["items_created"] += 1
                    else:
                        summary["duplicates"] += 1

                    if status == "bootstrap_approved":
                        summary["items_approved"] += 1
                    elif status == "bootstrap_rejected":
                        summary["items_rejected"] += 1
                    else:
                        summary["items_pending_review"] += 1

            summary["logs"].append({
                "message": "Brave bootstrap ejecutado con consultas genericas sanitizadas.",
                "max_results_per_topic": max_results,
                "generated_at": _utc_now().isoformat(),
            })
            _finish_run(conn, run_id, "completed", summary)
        except Exception as exc:
            _finish_run(conn, run_id, "failed", summary, error_message=str(exc))
            raise

    return summary


def search_bootstrap_knowledge(
    q: Optional[str] = None,
    module: Optional[str] = None,
    domain: Optional[str] = None,
    standard_code: Optional[str] = None,
    knowledge_type: Optional[str] = None,
    approved_only: bool = True,
    limit: int = 20,
    offset: int = 0,
) -> Dict[str, Any]:
    limit = _safe_limit(limit)
    offset = _safe_offset(offset)
    conditions = ["is_active = true"]
    params: Dict[str, Any] = {"limit": limit, "offset": offset}

    if approved_only:
        conditions.append("status = 'bootstrap_approved'")

    if module:
        conditions.append("module = :module")
        params["module"] = module

    if domain:
        conditions.append("domain = :domain")
        params["domain"] = domain

    if standard_code:
        conditions.append("standard_code = :standard_code")
        params["standard_code"] = standard_code

    if knowledge_type:
        conditions.append("knowledge_type = :knowledge_type")
        params["knowledge_type"] = knowledge_type

    if q:
        params["q_like"] = f"%{q.strip()}%"
        conditions.append(
            """
            (
              title ILIKE :q_like
              OR summary ILIKE :q_like
              OR coalesce(content, '') ILIKE :q_like
              OR coalesce(practical_use, '') ILIKE :q_like
              OR coalesce(recommended_application, '') ILIKE :q_like
            )
            """
        )

    where_sql = " AND ".join(conditions)

    with _engine().connect() as conn:
        rows = conn.execute(
            _sql(
                f"""
                SELECT {ITEM_COLUMNS}
                FROM ai_bootstrap_knowledge_items
                WHERE {where_sql}
                ORDER BY confidence_score DESC, updated_at DESC
                LIMIT :limit OFFSET :offset
                """
            ),
            params,
        ).mappings().all()

        total = conn.execute(
            _sql(
                f"""
                SELECT COUNT(*)::int AS total
                FROM ai_bootstrap_knowledge_items
                WHERE {where_sql}
                """
            ),
            params,
        ).mappings().first()

    return {
        "ok": True,
        "approved_only": approved_only,
        "count": len(rows),
        "total": int(total["total"] if total else 0),
        "limit": limit,
        "offset": offset,
        "data": [_clean_row(row) for row in rows],
    }


def get_bootstrap_context_for_auditor(payload: Dict[str, Any], limit: int = 5) -> Dict[str, Any]:
    if not (
        payload.get("use_bootstrap_knowledge") is True
        or payload.get("use_general_knowledge") is True
    ):
        return {
            "used": False,
            "reason": "El payload no solicito uso de conocimiento bootstrap aprobado.",
        }

    requested_output = str(payload.get("requested_output") or "global_analysis")
    standards = payload.get("active_standards") or []
    standards_text = " ".join(str(item) for item in standards if item)
    controls = payload.get("controls_summary") if isinstance(payload.get("controls_summary"), dict) else {}
    evidence = payload.get("evidence_summary") if isinstance(payload.get("evidence_summary"), dict) else {}
    risks = payload.get("risks_summary") if isinstance(payload.get("risks_summary"), dict) else {}

    if controls.get("controls_without_evidence") or evidence.get("old_evidence_count"):
        q = "evidencia"
    elif risks.get("high_residual_risks"):
        q = "riesgo"
    elif controls.get("deteriorated_controls"):
        q = "control"
    elif standards_text:
        q = standards_text
    else:
        q = requested_output or "auditoria"

    try:
        result = search_bootstrap_knowledge(
            q=q,
            approved_only=True,
            limit=limit,
        )
    except Exception as exc:
        return {
            "used": False,
            "reason": "No fue posible consultar conocimiento bootstrap aprobado.",
            "error": str(exc),
        }

    items = []
    for row in result.get("data") or []:
        items.append({
            "id": row.get("id"),
            "title": row.get("title"),
            "summary": row.get("summary"),
            "knowledge_type": row.get("knowledge_type"),
            "module": row.get("module"),
            "domain": row.get("domain"),
            "standard_code": row.get("standard_code"),
            "source_url": row.get("source_url"),
            "source_provider": row.get("source_provider"),
            "confidence_score": row.get("confidence_score"),
            "origin": row.get("origin"),
        })

    if not items:
        return {
            "used": False,
            "reason": "No se encontro conocimiento bootstrap aprobado relevante.",
            "query": q,
        }

    return {
        "used": True,
        "query": q,
        "items": items,
        "limitations": [
            "El conocimiento bootstrap aprobado es contexto general y no reemplaza datos internos ni evidencia del tenant.",
            "No se debe declarar cumplimiento usando solo conocimiento bootstrap.",
        ],
    }


def list_pending_bootstrap_knowledge(limit: int = 20, offset: int = 0) -> Dict[str, Any]:
    limit = _safe_limit(limit)
    offset = _safe_offset(offset)

    with _engine().connect() as conn:
        rows = conn.execute(
            _sql(
                f"""
                SELECT {ITEM_COLUMNS}
                FROM ai_bootstrap_knowledge_items
                WHERE is_active = true
                  AND status = 'bootstrap_pending_review'
                ORDER BY confidence_score DESC, created_at ASC
                LIMIT :limit OFFSET :offset
                """
            ),
            {"limit": limit, "offset": offset},
        ).mappings().all()

        total = conn.execute(
            _sql(
                """
                SELECT COUNT(*)::int AS total
                FROM ai_bootstrap_knowledge_items
                WHERE is_active = true
                  AND status = 'bootstrap_pending_review'
                """
            )
        ).mappings().first()

    return {
        "ok": True,
        "count": len(rows),
        "total": int(total["total"] if total else 0),
        "limit": limit,
        "offset": offset,
        "data": [_clean_row(row) for row in rows],
    }


def approve_bootstrap_knowledge_item(item_id: str) -> Dict[str, Any]:
    with _engine().begin() as conn:
        row = conn.execute(
            _sql(
                """
                UPDATE ai_bootstrap_knowledge_items
                SET
                  status = 'bootstrap_approved',
                  approved_at = CURRENT_TIMESTAMP,
                  reviewed_at = CURRENT_TIMESTAMP,
                  rejection_reason = NULL,
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = CAST(:item_id AS uuid)
                  AND is_active = true
                RETURNING id, title, status, approved_at, updated_at
                """
            ),
            {"item_id": item_id},
        ).mappings().first()

    if not row:
        return {"ok": False, "error": "bootstrap_item_not_found", "id": item_id}

    return {"ok": True, "item": _clean_row(row)}


def reject_bootstrap_knowledge_item(item_id: str, reason: Optional[str] = None) -> Dict[str, Any]:
    clean_reason = str(reason or "").strip()[:500] or "Rechazado en revision interna."

    with _engine().begin() as conn:
        row = conn.execute(
            _sql(
                """
                UPDATE ai_bootstrap_knowledge_items
                SET
                  status = 'bootstrap_rejected',
                  reviewed_at = CURRENT_TIMESTAMP,
                  rejection_reason = :reason,
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = CAST(:item_id AS uuid)
                  AND is_active = true
                RETURNING id, title, status, rejection_reason, reviewed_at, updated_at
                """
            ),
            {"item_id": item_id, "reason": clean_reason},
        ).mappings().first()

    if not row:
        return {"ok": False, "error": "bootstrap_item_not_found", "id": item_id}

    return {"ok": True, "item": _clean_row(row)}


def main() -> None:
    parser = argparse.ArgumentParser(description="AI General Knowledge Bootstrap service")
    parser.add_argument("--seeds", action="store_true", help="Carga seeds internos en PostgreSQL")
    parser.add_argument("--brave", action="store_true", help="Carga contexto externo desde Brave Search")
    parser.add_argument("--status", action="store_true", help="Muestra estado de bootstrap")
    parser.add_argument("--dry-run", action="store_true", help="Valida sin escribir en PostgreSQL")
    parser.add_argument("--max-topics", type=int, default=None)
    parser.add_argument("--max-results-per-topic", type=int, default=None)
    args = parser.parse_args()

    if args.status:
        print(json.dumps(get_bootstrap_status(), ensure_ascii=False, default=str, indent=2))
        return

    if args.seeds or args.dry_run:
        result = load_seed_knowledge(dry_run=args.dry_run)
        print(json.dumps(result, ensure_ascii=False, default=str, indent=2))
        return

    if args.brave:
        result = load_brave_knowledge(
            dry_run=False,
            max_topics=args.max_topics,
            max_results_per_topic=args.max_results_per_topic,
        )
        print(json.dumps(result, ensure_ascii=False, default=str, indent=2))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
