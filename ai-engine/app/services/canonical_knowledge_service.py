import re
import unicodedata
from typing import Any, Dict, List, Optional

from psycopg2 import errors

from app.services.ai_core_db import fetch_all, fetch_one


CANONICAL_KNOWLEDGE_CONTRACT_VERSION = "canonical-knowledge-v1"


def _normalize(value: Any) -> str:
    raw = str(value or "").lower().strip()
    raw = unicodedata.normalize("NFKD", raw)
    raw = "".join(ch for ch in raw if not unicodedata.combining(ch))
    raw = re.sub(r"[^a-z0-9_\-/\s\.]", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()


def _safe_limit(limit: int, default: int = 8, maximum: int = 25) -> int:
    try:
        value = int(limit)
    except (TypeError, ValueError):
        value = default
    return max(1, min(value, maximum))


def _standard_variants(standard_code: Optional[str]) -> Optional[List[str]]:
    if not standard_code:
        return None
    raw = str(standard_code or "").strip()
    compact = re.sub(r"[^A-Za-z0-9]+", "", raw).upper()
    variants = {raw, raw.upper(), compact}
    aliases = {
        "ISO27001": ["ISO27001", "ISO 27001:2022", "ISO/IEC 27001:2022", "ISO_27001_2022"],
        "ISO9001": ["ISO9001", "ISO 9001:2015 + AMD 1:2024", "ISO_9001_2015"],
        "ISO42001": ["ISO42001", "ISO 42001:2023", "ISO_42001_2023"],
        "ISO200001": ["ISO20000-1", "ISO/IEC20000-1", "ISO/IEC 20000-1"],
        "ISO50001": ["ISO50001", "ISO 50001"],
        "ISO14001": ["ISO14001", "ISO 14001"],
        "ISO45001": ["ISO45001", "ISO 45001"],
    }
    for value in aliases.get(compact, []):
        variants.add(value)
        variants.add(value.upper())
    return sorted(v for v in variants if v)


def _as_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return [value]


def _empty_bundle(**filters: Any) -> Dict[str, Any]:
    return {
        "ok": False,
        "contract_version": CANONICAL_KNOWLEDGE_CONTRACT_VERSION,
        "items": [],
        "gaps": [],
        "recommended_actions": [],
        "evidence_expectations": [],
        "iso_evidence_expectations": [],
        "tenant_evidence_requirements": [],
        "rules": [],
        "rule_hints": [],
        "audit_questions": [],
        "sources": [],
        "provenance": {
            "source": "canonical_knowledge",
            "filters": filters,
            "legacy_ai_core_used": False,
            "missing_is_not_zero": True,
            "limitations": ["no_canonical_knowledge_match"],
        },
    }


def _knowledge_filters(
    *,
    standard_code: Optional[str],
    control_code: Optional[str],
    domain: Optional[str],
    problem_type_code: Optional[str],
    query_text: Optional[str],
) -> Dict[str, Any]:
    query_norm = _normalize(query_text)
    return {
        "standard_code": standard_code or None,
        "standard_codes": _standard_variants(standard_code),
        "control_code": control_code or None,
        "domain": domain or None,
        "problem_type_code": problem_type_code or None,
        "query_text": query_norm or None,
        "query_like": f"%{query_norm}%" if query_norm else None,
    }


def search_knowledge_items(
    *,
    standard_code: Optional[str] = None,
    control_code: Optional[str] = None,
    domain: Optional[str] = None,
    problem_type_code: Optional[str] = None,
    query_text: Optional[str] = None,
    limit: int = 8,
) -> List[Dict[str, Any]]:
    filters = _knowledge_filters(
        standard_code=standard_code,
        control_code=control_code,
        domain=domain,
        problem_type_code=problem_type_code,
        query_text=query_text,
    )
    safe_limit = _safe_limit(limit)

    rows = fetch_all(
        """
        WITH candidates AS (
          SELECT
            i.id,
            i.item_key,
            i.source_key,
            i.source_record_id,
            i.standard_family,
            i.standard_code,
            i.clause_or_control,
            i.title,
            i.domain,
            i.item_type,
            i.intent_summary,
            i.license_class,
            i.use_in_system,
            i.search_text,
            i.applicability,
            i.implementation_guidance,
            i.evidence_examples,
            i.risk_tags,
            i.tags,
            i.severity_default,
            i.lifecycle_state,
            i.metadata,
            s.source_name,
            s.source_type,
            s.source_url,
            s.license_class AS source_license_class,
            s.use_in_system AS source_use_in_system,
            s.active AS source_active,
            MAX(COALESCE(m.match_weight, 0)) AS mapping_weight,
            MAX(COALESCE(m.confidence, 0)) AS mapping_confidence
          FROM public.knowledge_items i
          JOIN public.knowledge_sources s
            ON s.source_key = i.source_key
           AND s.active IS DISTINCT FROM false
          LEFT JOIN public.knowledge_mappings m
            ON m.item_key = i.item_key
          WHERE i.is_active IS DISTINCT FROM false
            AND i.lifecycle_state = 'active'
            AND (
              %(standard_codes)s IS NULL
              OR i.standard_code = ANY(%(standard_codes)s)
              OR m.standard_code = ANY(%(standard_codes)s)
              OR (i.standard_code IS NULL AND m.standard_code IS NULL)
            )
            AND (%(control_code)s IS NULL OR i.clause_or_control = %(control_code)s OR m.clause_or_control = %(control_code)s OR m.target_key = %(control_code)s)
            AND (%(domain)s IS NULL OR i.domain = %(domain)s OR m.domain = %(domain)s)
            AND (
              %(problem_type_code)s IS NULL
              OR i.item_key = %(problem_type_code)s
              OR i.source_record_id = %(problem_type_code)s
              OR %(problem_type_code)s = ANY(i.tags)
              OR m.target_key = %(problem_type_code)s
              OR m.mapping_key = %(problem_type_code)s
            )
            AND (
              %(query_like)s IS NULL
              OR (
                %(problem_type_code)s IS NOT NULL
                AND (
                  i.item_key = %(problem_type_code)s
                  OR i.source_record_id = %(problem_type_code)s
                  OR %(problem_type_code)s = ANY(i.tags)
                  OR m.target_key = %(problem_type_code)s
                  OR m.mapping_key = %(problem_type_code)s
                )
              )
              OR lower(COALESCE(i.search_text, '')) LIKE %(query_like)s
              OR lower(COALESCE(i.title, '')) LIKE %(query_like)s
              OR lower(COALESCE(i.intent_summary, '')) LIKE %(query_like)s
              OR lower(COALESCE(i.implementation_guidance, '')) LIKE %(query_like)s
            )
          GROUP BY i.id, s.source_name, s.source_type, s.source_url, s.license_class, s.use_in_system, s.active
        )
        SELECT *
        FROM candidates
        ORDER BY
          COALESCE(mapping_weight, 0) DESC,
          COALESCE(mapping_confidence, 0) DESC,
          CASE WHEN standard_code = %(standard_code)s THEN 0 ELSE 1 END,
          item_key
        LIMIT %(limit)s
        """,
        {**filters, "limit": safe_limit},
    )

    return rows


def _load_child_rows(table: str, item_keys: List[str], limit: int = 20) -> List[Dict[str, Any]]:
    if not item_keys:
        return []

    allowed = {
        "knowledge_common_gaps",
        "knowledge_recommended_actions",
        "knowledge_evidence_expectations",
        "knowledge_rules",
        "knowledge_rule_hints",
        "knowledge_audit_questions",
    }
    if table not in allowed:
        raise ValueError(f"unsupported canonical knowledge table: {table}")

    return fetch_all(
        f"""
        SELECT *
        FROM public.{table}
        WHERE item_key = ANY(%s)
        ORDER BY item_key, id
        LIMIT %s
        """,
        [item_keys, _safe_limit(limit, default=20, maximum=80)],
    )


def _load_mapping_rows(item_keys: List[str], limit: int = 20) -> List[Dict[str, Any]]:
    if not item_keys:
        return []

    return fetch_all(
        """
        SELECT
          item_key,
          mapping_key,
          target_type,
          target_key,
          entity_type,
          standard_family,
          standard_code,
          clause_or_control,
          domain,
          match_weight,
          confidence
        FROM public.knowledge_mappings
        WHERE item_key = ANY(%s)
        ORDER BY item_key, mapping_key
        LIMIT %s
        """,
        [item_keys, _safe_limit(limit, default=20, maximum=80)],
    )


def _stable_unique_count(rows: List[Dict[str, Any]], fields: List[str]) -> int:
    seen = set()
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        key = tuple(str(row.get(field) or "") for field in fields)
        if any(key):
            seen.add(key)
    return len(seen)


def _trace_counts(
    *,
    items: List[Dict[str, Any]],
    mappings: List[Dict[str, Any]],
    gaps: List[Dict[str, Any]],
    actions: List[Dict[str, Any]],
    evidence: List[Dict[str, Any]],
    rules: List[Dict[str, Any]],
    questions: List[Dict[str, Any]],
) -> Dict[str, int]:
    item_count = _stable_unique_count(items, ["item_key"])
    return {
        "canonical_knowledge_item_count": item_count,
        "canonical_knowledge_match_count": item_count,
        "canonical_mapping_match_count": _stable_unique_count(mappings, ["item_key", "mapping_key", "target_type", "target_key", "domain", "standard_code"]),
        "canonical_action_count": _stable_unique_count(actions, ["item_key", "action_key", "action_text"]),
        "canonical_evidence_expectation_count": _stable_unique_count(evidence, ["item_key", "expectation_key", "expectation_text"]),
        "canonical_gap_count": _stable_unique_count(gaps, ["item_key", "gap_key", "gap_text"]),
        "canonical_audit_question_count": _stable_unique_count(questions, ["item_key", "question_text", "question"]),
        "canonical_rule_count": _stable_unique_count(rules, ["item_key", "rule_key", "rule_text"]),
    }


def load_iso_evidence_expectations(
    *,
    standard_code: Optional[str] = None,
    control_code: Optional[str] = None,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    if not standard_code and not control_code:
        return []

    return fetch_all(
        """
        SELECT
          standard_code,
          version_code,
          control_code,
          evidence_name,
          evidence_type,
          description,
          required_level,
          freshness_days,
          validation_criteria,
          ai_review_guidance,
          metadata
        FROM public.iso_evidence_expectations
        WHERE (%s IS NULL OR standard_code = %s)
          AND (%s IS NULL OR control_code = %s)
        ORDER BY standard_code, version_code, control_code, evidence_name
        LIMIT %s
        """,
        [standard_code, standard_code, control_code, control_code, _safe_limit(limit)],
    )


def load_tenant_evidence_requirements(
    *,
    tenant_id: Optional[str] = None,
    related_control_id: Optional[str] = None,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    if not tenant_id:
        return []

    try:
        return fetch_all(
            """
            SELECT
              tenant_id,
              related_control_id,
              related_kpi_id,
              evidence_type,
              evidence_name,
              requirement_reason,
              priority,
              source
            FROM public.tenant_applicable_evidence_requirements
            WHERE tenant_id = %s::uuid
              AND active IS DISTINCT FROM false
              AND visible_to_tenant IS DISTINCT FROM false
              AND (%s IS NULL OR related_control_id = %s::uuid)
            ORDER BY
              CASE priority
                WHEN 'alta' THEN 1
                WHEN 'high' THEN 1
                WHEN 'media' THEN 2
                WHEN 'medium' THEN 2
                ELSE 3
              END,
              evidence_name
            LIMIT %s
            """,
            [tenant_id, related_control_id, related_control_id, _safe_limit(limit)],
        )
    except (errors.UndefinedTable, errors.UndefinedColumn):
        return []


def build_knowledge_bundle(
    *,
    standard_code: Optional[str] = None,
    control_code: Optional[str] = None,
    domain: Optional[str] = None,
    problem_type_code: Optional[str] = None,
    query_text: Optional[str] = None,
    tenant_id: Optional[str] = None,
    tenant_control_id: Optional[str] = None,
    limit: int = 8,
) -> Dict[str, Any]:
    filters = {
        "standard_code": standard_code,
        "control_code": control_code,
        "domain": domain,
        "problem_type_code": problem_type_code,
        "tenant_id": tenant_id,
        "tenant_control_id": tenant_control_id,
    }
    items = search_knowledge_items(
        standard_code=standard_code,
        control_code=control_code,
        domain=domain,
        problem_type_code=problem_type_code,
        query_text=query_text,
        limit=limit,
    )

    if not items:
        bundle = _empty_bundle(**filters)
        bundle["iso_evidence_expectations"] = load_iso_evidence_expectations(
            standard_code=standard_code,
            control_code=control_code,
            limit=limit,
        )
        bundle["tenant_evidence_requirements"] = load_tenant_evidence_requirements(
            tenant_id=tenant_id,
            related_control_id=tenant_control_id,
            limit=limit,
        )
        bundle["ok"] = bool(bundle["iso_evidence_expectations"] or bundle["tenant_evidence_requirements"])
        if bundle["ok"]:
            bundle["provenance"]["limitations"] = ["no_structured_knowledge_item_match"]
        bundle["mappings"] = []
        bundle["trace_counts"] = _trace_counts(
            items=[],
            mappings=[],
            gaps=[],
            actions=[],
            evidence=[],
            rules=[],
            questions=[],
        )
        return bundle

    item_keys = [row["item_key"] for row in items if row.get("item_key")]
    mappings = _load_mapping_rows(item_keys, limit=limit)
    gaps = _load_child_rows("knowledge_common_gaps", item_keys, limit=limit)
    actions = _load_child_rows("knowledge_recommended_actions", item_keys, limit=limit)
    evidence = _load_child_rows("knowledge_evidence_expectations", item_keys, limit=limit)
    rules = _load_child_rows("knowledge_rules", item_keys, limit=limit)
    hints = _load_child_rows("knowledge_rule_hints", item_keys, limit=limit)
    questions = _load_child_rows("knowledge_audit_questions", item_keys, limit=limit)

    sources = []
    seen_sources = set()
    for item in items:
        source_key = item.get("source_key")
        if not source_key or source_key in seen_sources:
            continue
        seen_sources.add(source_key)
        sources.append({
            "source_key": source_key,
            "source_name": item.get("source_name"),
            "source_type": item.get("source_type"),
            "source_url": item.get("source_url"),
            "license_class": item.get("source_license_class") or item.get("license_class"),
            "use_in_system": item.get("source_use_in_system") or item.get("use_in_system") or [],
        })

    return {
        "ok": True,
        "contract_version": CANONICAL_KNOWLEDGE_CONTRACT_VERSION,
        "items": items,
        "mappings": mappings,
        "gaps": gaps,
        "recommended_actions": actions,
        "evidence_expectations": evidence,
        "iso_evidence_expectations": load_iso_evidence_expectations(
            standard_code=standard_code,
            control_code=control_code,
            limit=limit,
        ),
        "tenant_evidence_requirements": load_tenant_evidence_requirements(
            tenant_id=tenant_id,
            related_control_id=tenant_control_id,
            limit=limit,
        ),
        "rules": rules,
        "rule_hints": hints,
        "audit_questions": questions,
        "sources": sources,
        "trace_counts": _trace_counts(
            items=items,
            mappings=mappings,
            gaps=gaps,
            actions=actions,
            evidence=evidence,
            rules=rules,
            questions=questions,
        ),
        "provenance": {
            "source": "canonical_knowledge",
            "filters": filters,
            "legacy_ai_core_used": False,
            "missing_is_not_zero": True,
            "item_keys": item_keys,
            "limitations": [],
        },
    }


def infer_domains_from_canonical_knowledge(
    *,
    standard_code: Optional[str] = None,
    problem_type_code: Optional[str] = None,
    query_text: Optional[str] = None,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    filters = _knowledge_filters(
        standard_code=standard_code,
        control_code=None,
        domain=None,
        problem_type_code=problem_type_code,
        query_text=query_text,
    )

    return fetch_all(
        """
        SELECT
          COALESCE(m.domain, i.domain) AS domain_code,
          COUNT(*)::int AS match_count,
          MAX(COALESCE(m.match_weight, 1)) AS match_weight,
          MAX(COALESCE(m.confidence, 0)) AS confidence
        FROM public.knowledge_items i
        LEFT JOIN public.knowledge_mappings m
          ON m.item_key = i.item_key
        WHERE i.is_active IS DISTINCT FROM false
          AND i.lifecycle_state = 'active'
          AND COALESCE(m.domain, i.domain) IS NOT NULL
          AND (
            %(standard_codes)s IS NULL
            OR i.standard_code = ANY(%(standard_codes)s)
            OR m.standard_code = ANY(%(standard_codes)s)
            OR (i.standard_code IS NULL AND m.standard_code IS NULL)
          )
          AND (
            %(problem_type_code)s IS NULL
            OR i.item_key = %(problem_type_code)s
            OR i.source_record_id = %(problem_type_code)s
            OR %(problem_type_code)s = ANY(i.tags)
            OR m.target_key = %(problem_type_code)s
            OR m.mapping_key = %(problem_type_code)s
          )
          AND (
            %(query_like)s IS NULL
            OR (
              %(problem_type_code)s IS NOT NULL
              AND (
                i.item_key = %(problem_type_code)s
                OR i.source_record_id = %(problem_type_code)s
                OR %(problem_type_code)s = ANY(i.tags)
                OR m.target_key = %(problem_type_code)s
                OR m.mapping_key = %(problem_type_code)s
              )
            )
            OR lower(COALESCE(i.search_text, '')) LIKE %(query_like)s
            OR lower(COALESCE(i.title, '')) LIKE %(query_like)s
            OR lower(COALESCE(i.intent_summary, '')) LIKE %(query_like)s
          )
        GROUP BY COALESCE(m.domain, i.domain)
        ORDER BY match_count DESC, match_weight DESC, confidence DESC, domain_code
        LIMIT %(limit)s
        """,
        {**filters, "limit": _safe_limit(limit)},
    )


def canonical_domain_standard_applicability(domain_code: str, standard_code: Optional[str]) -> Dict[str, Any]:
    if not standard_code or not domain_code:
        return {
            "state": "unknown",
            "applies_to_standard": None,
            "basis": "insufficient_filter",
        }

    row = fetch_one(
        """
        SELECT 1
        FROM public.knowledge_items i
        LEFT JOIN public.knowledge_mappings m
          ON m.item_key = i.item_key
        WHERE i.is_active IS DISTINCT FROM false
          AND i.lifecycle_state = 'active'
          AND (i.domain = %s OR m.domain = %s)
          AND (
            i.standard_code = ANY(%s)
            OR m.standard_code = ANY(%s)
          )
        LIMIT 1
        """,
        [domain_code, domain_code, _standard_variants(standard_code), _standard_variants(standard_code)],
    )
    if row is not None:
        return {
            "state": "true",
            "applies_to_standard": True,
            "basis": "canonical_knowledge_mapping",
        }

    any_domain = fetch_one(
        """
        SELECT 1
        FROM public.knowledge_items i
        LEFT JOIN public.knowledge_mappings m
          ON m.item_key = i.item_key
        WHERE i.is_active IS DISTINCT FROM false
          AND i.lifecycle_state = 'active'
          AND (i.domain = %s OR m.domain = %s)
        LIMIT 1
        """,
        [domain_code, domain_code],
    )
    return {
        "state": "unknown",
        "applies_to_standard": None,
        "basis": "no_canonical_standard_mapping" if any_domain else "no_canonical_domain_knowledge",
    }


def canonical_domain_applies_to_standard(domain_code: str, standard_code: Optional[str]) -> Optional[bool]:
    return canonical_domain_standard_applicability(domain_code, standard_code).get("applies_to_standard")


def load_canonical_external_sources(
    *,
    standard_code: Optional[str] = None,
    domain_code: Optional[str] = None,
    limit: int = 8,
) -> List[Dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT
          source_key,
          source_name,
          source_type,
          source_url,
          license_class,
          use_in_system,
          metadata,
          effective_date
        FROM public.knowledge_sources
        WHERE active IS DISTINCT FROM false
          AND (
            'external_lookup' = ANY(use_in_system)
            OR lower(COALESCE(metadata->>'external_lookup_enabled', metadata->>'external_lookup', '')) IN ('true', 'yes', '1')
          )
          AND (
            metadata->>'trusted' = 'true'
            OR metadata->>'is_trusted' = 'true'
            OR lower(COALESCE(metadata->>'trust_level', '')) IN ('high', 'medium', 'trusted', 'authoritative')
            OR lower(COALESCE(metadata->>'source_authority', metadata->>'authority', '')) IN ('authoritative', 'official', 'trusted')
          )
          AND (
            jsonb_array_length(
              CASE
                WHEN jsonb_typeof(metadata->'allowed_domains') = 'array'
                THEN metadata->'allowed_domains'
                ELSE '[]'::jsonb
              END
            ) > 0
          )
          AND (
            %s IS NULL
            OR metadata->>'standard_code' = %s
            OR metadata->'applicable_standards' ? %s
          )
          AND (
            %s IS NULL
            OR metadata->>'domain' = %s
            OR metadata->'applicable_domains' ? %s
          )
        ORDER BY
          CASE license_class
            WHEN 'authoritative' THEN 1
            WHEN 'derived_summary' THEN 2
            ELSE 3
          END,
          source_key
        LIMIT %s
        """,
        [
            standard_code, standard_code, standard_code,
            domain_code, domain_code, domain_code,
            _safe_limit(limit, default=8, maximum=20),
        ],
    )

    sources: List[Dict[str, Any]] = []
    for row in rows:
        metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        allowed_domains = _as_list(metadata.get("allowed_domains"))
        if not allowed_domains:
            continue
        sources.append({
            "source_code": row.get("source_key"),
            "source_name": row.get("source_name"),
            "source_type": row.get("source_type"),
            "base_url": row.get("source_url"),
            "allowed_domains": allowed_domains,
            "applicable_domains": _as_list(metadata.get("applicable_domains") or metadata.get("domain")),
            "applicable_standards": _as_list(metadata.get("applicable_standards") or metadata.get("standard_code")),
            "description": metadata.get("description") or row.get("source_name"),
            "trust_level": metadata.get("trust_level") or metadata.get("source_authority") or metadata.get("authority") or "explicit",
            "metadata": {
                **metadata,
                "provenance_class": row.get("license_class"),
                "trust_basis": "knowledge_sources.metadata_explicit_trust",
            },
        })
    return sources


def _load_recommendation_ledger_columns() -> List[str]:
    rows = fetch_all(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'recommendation_decision_ledger'
        """
    )
    return [row.get("column_name") for row in rows if row.get("column_name")]


def load_supervised_feedback_cases(
    *,
    tenant_id: Optional[str] = None,
    standard_code: Optional[str] = None,
    domain_code: Optional[str] = None,
    problem_type_code: Optional[str] = None,
    scenario_code: Optional[str] = None,
    limit: int = 3,
) -> Dict[str, Any]:
    if not tenant_id:
        return {
            "cases_found": 0,
            "cases": [],
            "availability": "tenant_id_required",
            "provenance": {"source": "recommendation_decision_ledger", "tenant_filter_enforced": True},
        }

    try:
        columns = set(_load_recommendation_ledger_columns())
        required = {"id", "tenant_id", "decision_key", "decision", "metadata"}
        if not required.issubset(columns):
            return {
                "cases_found": 0,
                "cases": [],
                "availability": "optional_feedback_store_unavailable",
                "provenance": {"source": "recommendation_decision_ledger", "tenant_filter_enforced": True},
            }

        reason_expr = "decision_reason" if "decision_reason" in columns else "NULL::text"
        decided_expr = (
            "decided_at" if "decided_at" in columns
            else "decision_at" if "decision_at" in columns
            else "created_at" if "created_at" in columns
            else "NULL::timestamptz"
        )
        rows = fetch_all(
            f"""
            SELECT
              id,
              tenant_id,
              decision_key,
              decision,
              {reason_expr} AS decision_reason,
              metadata,
              {decided_expr} AS feedback_recorded_at
            FROM public.recommendation_decision_ledger
            WHERE tenant_id = %s::uuid
              AND decision IN ('accepted', 'modified', 'executed')
              AND (%s IS NULL OR metadata->>'standard_code' = %s)
              AND (%s IS NULL OR metadata->>'domain_code' = %s)
              AND (%s IS NULL OR metadata->>'problem_type_code' = %s)
              AND (%s IS NULL OR metadata->>'scenario_code' = %s)
            ORDER BY feedback_recorded_at DESC NULLS LAST, id
            LIMIT %s
            """,
            [
                tenant_id,
                standard_code, standard_code,
                domain_code, domain_code,
                problem_type_code, problem_type_code,
                scenario_code, scenario_code,
                _safe_limit(limit, default=3, maximum=10),
            ],
        )
    except (errors.UndefinedTable, errors.UndefinedColumn):
        return {
            "cases_found": 0,
            "cases": [],
            "availability": "optional_feedback_store_unavailable",
            "provenance": {"source": "recommendation_decision_ledger", "tenant_filter_enforced": True},
        }

    cases = []
    for row in rows:
        metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        decision = row.get("decision")
        cases.append({
            "id": str(row.get("id")),
            "source_entity_type": metadata.get("source_entity_type"),
            "source_entity_id": metadata.get("source_entity_id"),
            "standard_code": metadata.get("standard_code") or standard_code,
            "domain_code": metadata.get("domain_code") or domain_code,
            "problem_type_code": metadata.get("problem_type_code") or problem_type_code,
            "scenario_code": metadata.get("scenario_code") or scenario_code,
            "user_rating": metadata.get("user_rating"),
            "user_comment": row.get("decision_reason"),
            "was_useful": metadata.get("was_useful") if isinstance(metadata.get("was_useful"), bool) else None,
            "was_applied": metadata.get("was_applied") if isinstance(metadata.get("was_applied"), bool) else (True if decision == "executed" else None),
            "was_corrected": metadata.get("was_corrected") if isinstance(metadata.get("was_corrected"), bool) else None,
            "usefulness_score": metadata.get("usefulness_score"),
            "created_at": str(row.get("feedback_recorded_at")) if row.get("feedback_recorded_at") else None,
            "decision": decision,
            "effectiveness_state": metadata.get("effectiveness_state"),
            "response_summary": metadata.get("response_summary") or {
                "summary": row.get("decision_reason") or row.get("decision_key"),
                "recommended_actions": [],
                "expected_deliverables": [],
                "closure_conditions": [],
            },
        })

    return {
        "cases_found": len(cases),
        "cases": cases,
        "availability": "available",
        "filters": {
            "tenant_id": tenant_id,
            "standard_code": standard_code,
            "domain_code": domain_code,
            "problem_type_code": problem_type_code,
            "scenario_code": scenario_code,
            "limit": limit,
        },
        "provenance": {"source": "recommendation_decision_ledger", "tenant_filter_enforced": True},
    }
