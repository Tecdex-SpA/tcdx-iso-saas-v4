import json
import sys
from pathlib import Path

BASE_DIR = Path("/home/tecdex/ai-engine")
sys.path.insert(0, str(BASE_DIR))

from app.services.ai_core_db import fetch_all, fetch_one


CANONICAL_RELATIONS = [
    "knowledge_sources",
    "knowledge_items",
    "knowledge_mappings",
    "knowledge_common_gaps",
    "knowledge_recommended_actions",
    "knowledge_evidence_expectations",
    "knowledge_rules",
    "knowledge_rule_hints",
    "knowledge_audit_questions",
    "iso_evidence_expectations",
]


def check_relation(relation):
    row = fetch_one(
        """
        SELECT to_regclass(%s) IS NOT NULL AS exists
        """,
        [f"public.{relation}"],
    )
    return {
        "relation": f"public.{relation}",
        "exists": bool(row and row.get("exists")),
    }


def count_relation(relation):
    row = fetch_one(f"SELECT COUNT(*)::int AS total FROM public.{relation}")
    return int(row["total"] or 0)


def main():
    relation_checks = [check_relation(relation) for relation in CANONICAL_RELATIONS]
    missing = [item["relation"] for item in relation_checks if not item["exists"]]

    counts = []
    if not missing:
        for relation in CANONICAL_RELATIONS:
            counts.append({
                "relation": f"public.{relation}",
                "total": count_relation(relation),
            })

    knowledge_items_without_source = []
    active_sources_without_use = []
    mappings_without_items = []

    if not missing:
        knowledge_items_without_source = fetch_all("""
            SELECT i.item_key
            FROM public.knowledge_items i
            LEFT JOIN public.knowledge_sources s
              ON s.source_key = i.source_key
            WHERE i.is_active IS DISTINCT FROM false
              AND s.source_key IS NULL
            ORDER BY i.item_key
            LIMIT 50
        """)

        active_sources_without_use = fetch_all("""
            SELECT source_key, source_name
            FROM public.knowledge_sources
            WHERE active IS DISTINCT FROM false
              AND COALESCE(array_length(use_in_system, 1), 0) = 0
            ORDER BY source_key
            LIMIT 50
        """)

        mappings_without_items = fetch_all("""
            SELECT m.item_key, m.mapping_key
            FROM public.knowledge_mappings m
            LEFT JOIN public.knowledge_items i
              ON i.item_key = m.item_key
            WHERE i.item_key IS NULL
            ORDER BY m.item_key, m.mapping_key
            LIMIT 50
        """)

    result = {
        "ok": not missing and not knowledge_items_without_source and not mappings_without_items,
        "contract": "canonical_knowledge_v1",
        "relations": relation_checks,
        "counts": counts,
        "missing_relations": missing,
        "knowledge_items_without_source": knowledge_items_without_source,
        "mappings_without_items": mappings_without_items,
        "active_sources_without_use_in_system": active_sources_without_use,
        "legacy_ai_core_model_expected": False,
    }

    print(json.dumps(result, indent=2, ensure_ascii=False, default=str))

    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
