import argparse
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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


def _engine():
    from app.core.db import engine

    return engine


def _sql(query: str):
    from sqlalchemy import text

    return _sql(query)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"false", "0", "no", "off"}


def _json(value: Any, fallback: Any) -> str:
    return json.dumps(value if value is not None else fallback, ensure_ascii=False)


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
        "max_topics_per_run": int(os.getenv("BOOTSTRAP_KNOWLEDGE_MAX_TOPICS_PER_RUN", "10") or "10"),
        "max_results_per_topic": int(os.getenv("BOOTSTRAP_KNOWLEDGE_MAX_RESULTS_PER_TOPIC", "5") or "5"),
    }


def _seed_status(item: Dict[str, Any], settings: Dict[str, Any]) -> str:
    requested = str(item.get("status") or "").strip()
    source_type = str(item.get("source_type") or "internal_seed").strip()

    if source_type == "internal_seed" and settings["auto_approve_internal_seeds"]:
        return "bootstrap_approved"

    if requested in BOOTSTRAP_STATUSES:
        return requested

    return "bootstrap_pending_review"


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


def main() -> None:
    parser = argparse.ArgumentParser(description="AI General Knowledge Bootstrap service")
    parser.add_argument("--seeds", action="store_true", help="Carga seeds internos en PostgreSQL")
    parser.add_argument("--status", action="store_true", help="Muestra estado de bootstrap")
    parser.add_argument("--dry-run", action="store_true", help="Valida sin escribir en PostgreSQL")
    args = parser.parse_args()

    if args.status:
        print(json.dumps(get_bootstrap_status(), ensure_ascii=False, default=str, indent=2))
        return

    if args.seeds or args.dry_run:
        result = load_seed_knowledge(dry_run=args.dry_run)
        print(json.dumps(result, ensure_ascii=False, default=str, indent=2))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
