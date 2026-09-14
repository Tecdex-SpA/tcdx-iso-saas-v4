import json
import re
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

AI_ENGINE_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(AI_ENGINE_DIR))

TENANT_A = "11111111-1111-1111-1111-111111111111"
TENANT_B = "22222222-2222-2222-2222-222222222222"

LEGACY_SQL_PATTERN = re.compile(
    r"ai_core\.(closure_criteria|domain_closure_criteria|domain_evidence_expectations|"
    r"domain_problem_type_map|domain_solution_playbooks|domains_catalog|"
    r"evidence_expectations|invalid_evidence_patterns|priority_rules|problem_types|"
    r"response_templates|solution_playbooks|standard_domain_map|"
    r"standard_specific_overrides|standards_catalog|trusted_external_sources|"
    r"v_ai_useful_feedback_cases|v_finding_scenarios_active)",
    re.IGNORECASE,
)


def _forbid_legacy_sql(sql):
    compact = " ".join(str(sql).split())
    if LEGACY_SQL_PATTERN.search(compact):
        raise AssertionError(f"legacy SQL detected: {compact}")


def _canonical_fetch_all(sql, params=None):
    _forbid_legacy_sql(sql)
    compact = " ".join(str(sql).lower().split())
    params = params or []

    if "ai_core.v_tenant_health_context" in compact:
        tenant_id = params[0] if params else None
        return [{
            "tenant_id": tenant_id,
            "metric_code": "F5_5_GRC_HEALTH",
            "numeric_value": 81 if tenant_id == TENANT_A else 22,
            "publication_state": "published",
            "coverage": 0.91,
            "effective_at": "2026-09-14T10:00:00Z",
        }]

    if "ai_core.v_control_context" in compact:
        tenant_id = params[0] if params else None
        return [{
            "tenant_id": tenant_id,
            "tenant_control_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "catalog_control_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "code": "A.5.15",
            "title": "Control de accesos",
            "standard_code": "ISO27001",
            "implementation_status": "partial",
        }] if tenant_id == TENANT_A else [{
            "tenant_id": tenant_id,
            "tenant_control_id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
            "catalog_control_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
            "code": "A.5.16",
            "title": "Identidad Tenant B",
            "standard_code": "ISO27001",
            "implementation_status": "not_implemented",
        }]

    if "ai_core.v_finding_context" in compact:
        return []

    if "ai_core.v_kpi_context" in compact:
        return []

    if "from public.knowledge_items" in compact and "group by coalesce" not in compact:
        problem = None
        if isinstance(params, dict):
            problem = params.get("problem_type_code")
        if problem == "empty_knowledge":
            return []
        return [{
            "id": "99999999-9999-9999-9999-999999999999",
            "item_key": "access_review_missing",
            "source_key": "iso27001-derived",
            "source_record_id": "access_review_missing",
            "standard_family": "ISO",
            "standard_code": "ISO27001",
            "clause_or_control": "A.5.15",
            "title": "Revisión de accesos",
            "domain": "access_management",
            "item_type": "control_guidance",
            "intent_summary": "Revisar accesos privilegiados con trazabilidad.",
            "license_class": "derived_summary",
            "use_in_system": ["ai"],
            "search_text": "revision accesos evidencia privilegios",
            "applicability": {},
            "implementation_guidance": "Validar periodo, responsable y aprobacion.",
            "evidence_examples": [],
            "risk_tags": [],
            "tags": ["access_review_missing"],
            "severity_default": "alta",
            "lifecycle_state": "active",
            "metadata": {},
            "source_name": "ISO 27001 derived guidance",
            "source_type": "derived_summary",
            "source_url": None,
            "source_license_class": "derived_summary",
            "source_use_in_system": ["ai"],
            "source_active": True,
            "mapping_weight": 1,
            "mapping_confidence": 0.9,
        }]

    if "from public.knowledge_common_gaps" in compact:
        return [{
            "item_key": "access_review_missing",
            "gap_key": "access-review-gap",
            "description": "Falta revisión de accesos",
            "gap_text": "No hay evidencia trazable de revisión de accesos.",
            "severity_hint": "alta",
            "severity_default": "alta",
            "metadata": {},
        }]

    if "from public.knowledge_recommended_actions" in compact:
        return [{
            "item_key": "access_review_missing",
            "action_key": "review-accesses",
            "description": "Completar revisión de accesos",
            "action_text": "Revisar accesos privilegiados y documentar aprobación.",
            "action_basis": "knowledge",
            "priority_hint": "alta",
            "priority_default": "alta",
            "metadata": {},
        }]

    if "from public.knowledge_evidence_expectations" in compact:
        return [{
            "item_key": "access_review_missing",
            "expectation_key": "access-review-evidence",
            "description": "Registro de revisión",
            "expectation_text": "Acta o registro con fecha, responsable, alcance y aprobacion.",
            "evidence_type": "record",
            "required_level": "required",
            "metadata": {},
        }]

    if "from public.knowledge_rules" in compact:
        return []

    if "from public.knowledge_rule_hints" in compact:
        return []

    if "from public.knowledge_audit_questions" in compact:
        return [{
            "item_key": "access_review_missing",
            "question_text": "¿La revisión cubre accesos privilegiados del periodo?",
            "question_type": "audit",
            "metadata": {},
        }]

    if "from public.iso_evidence_expectations" in compact:
        return [{
            "standard_code": "ISO27001",
            "version_code": "2022",
            "control_code": "A.5.15",
            "evidence_name": "Registro de revisión de accesos",
            "evidence_type": "record",
            "description": "Registro versionado de revisión de accesos.",
            "required_level": "required",
            "freshness_days": 365,
            "validation_criteria": {},
            "ai_review_guidance": "Validar fecha y responsable.",
            "metadata": {},
        }]

    if "from public.tenant_applicable_evidence_requirements" in compact:
        tenant_id = params[0] if params else None
        return [{
            "tenant_id": tenant_id,
            "related_control_id": None,
            "related_kpi_id": None,
            "evidence_type": "record",
            "evidence_name": "Revisión tenant-scoped",
            "requirement_reason": "profile_engine",
            "priority": "alta",
            "source": "profile_engine",
        }] if tenant_id == TENANT_A else []

    if "from public.recommendation_decision_ledger" in compact:
        return []

    if "from public.knowledge_sources" in compact:
        return []

    return []


def _canonical_fetch_one(sql, params=None):
    _forbid_legacy_sql(sql)
    compact = " ".join(str(sql).lower().split())
    if "select 1 from public.knowledge_items" in compact:
        return {"?column?": 1}
    return None


class AiGuidedCanonicalKnowledgeTests(unittest.TestCase):
    def _patch_db(self):
        import app.services.context_builder as context_builder
        import app.services.canonical_knowledge_service as canonical

        return patch.multiple(
            context_builder,
            fetch_all=_canonical_fetch_all,
            fetch_one=_canonical_fetch_one,
        ), patch.multiple(
            canonical,
            fetch_all=_canonical_fetch_all,
            fetch_one=_canonical_fetch_one,
        )

    def test_guided_solution_uses_canonical_knowledge_and_tenant_scope(self):
        from app.services.solution_engine import generate_guided_solution

        p1, p2 = self._patch_db()
        with p1, p2:
            result = generate_guided_solution(
                user_text="Falta evidencia de revisión de accesos privilegiados",
                tenant_id=TENANT_A,
                standard_code="ISO27001",
                forced_problem_type="access_review_missing",
                forced_domain_code="access_management",
            )

        serialized = json.dumps(result, ensure_ascii=False)
        self.assertTrue(result["ok"])
        self.assertIn("Revisar accesos privilegiados", serialized)
        self.assertIn(TENANT_A, serialized)
        self.assertNotIn(TENANT_B, serialized)
        self.assertTrue(result["knowledge_sources"]["base_problem_knowledge"])
        self.assertTrue(result["knowledge_sources"]["domain_knowledge"])

    def test_empty_knowledge_degrades_without_zero_or_cross_tenant(self):
        from app.services.solution_engine import generate_guided_solution

        p1, p2 = self._patch_db()
        with p1, p2:
            result = generate_guided_solution(
                user_text="Caso sin conocimiento exacto",
                tenant_id=TENANT_A,
                standard_code="ISO27001",
                forced_problem_type="empty_knowledge",
                forced_domain_code="access_management",
            )

        serialized = json.dumps(result, ensure_ascii=False)
        self.assertTrue(result["ok"])
        self.assertFalse(result["knowledge_sources"]["base_problem_knowledge"])
        self.assertNotIn(TENANT_B, serialized)
        self.assertFalse(result["solution"]["can_auto_close"])
        self.assertIn("evidencia objetiva", result["solution"]["auto_close_reason"])

    def test_scenario_and_feedback_absence_do_not_break_enrichment(self):
        from app.services.scenario_response_enricher import enrich_ai_response_with_scenario

        p1, p2 = self._patch_db()
        with p1, p2:
            result = enrich_ai_response_with_scenario(
                {
                    "tenant_id": TENANT_A,
                    "standard_code": "ISO27001",
                    "problem_type_code": "empty_knowledge",
                    "title": "Caso sin escenario exacto",
                    "description": "No hay escenario canónico exacto.",
                },
                {"ok": True, "summary": "Base"},
                mode="finding_analysis",
            )

        self.assertTrue(result["ok"])
        self.assertEqual(result["summary"], "Base")

    def test_decision_ledger_does_not_invent_usefulness_or_effectiveness(self):
        import app.services.canonical_knowledge_service as canonical

        def fake_fetch_all(sql, params=None):
            _forbid_legacy_sql(sql)
            compact = " ".join(str(sql).lower().split())
            if "from information_schema.columns" in compact:
                return [
                    {"column_name": "id"},
                    {"column_name": "tenant_id"},
                    {"column_name": "decision_key"},
                    {"column_name": "decision"},
                    {"column_name": "decision_reason"},
                    {"column_name": "metadata"},
                    {"column_name": "decided_at"},
                ]
            if "from public.recommendation_decision_ledger" in compact:
                return [{
                    "id": "ffffffff-ffff-ffff-ffff-ffffffffffff",
                    "tenant_id": TENANT_A,
                    "decision_key": "decision-1",
                    "decision": "accepted",
                    "decision_reason": "Se acepta revisar la sugerencia.",
                    "metadata": {},
                    "feedback_recorded_at": "2026-09-14T10:00:00Z",
                }]
            return []

        with patch.object(canonical, "fetch_all", side_effect=fake_fetch_all):
            result = canonical.load_supervised_feedback_cases(tenant_id=TENANT_A)

        self.assertEqual(result["cases_found"], 1)
        case = result["cases"][0]
        self.assertEqual(case["decision"], "accepted")
        self.assertIsNone(case["was_useful"])
        self.assertIsNone(case["was_applied"])
        self.assertIsNone(case["was_corrected"])
        self.assertIsNone(case["effectiveness_state"])

    def test_external_sources_require_explicit_trust_and_domains(self):
        import app.services.canonical_knowledge_service as canonical

        captured_sql = []

        def fake_fetch_all(sql, params=None):
            _forbid_legacy_sql(sql)
            captured_sql.append(sql)
            return [
                {
                    "source_key": "trusted-source",
                    "source_name": "Trusted Source",
                    "source_type": "reference",
                    "source_url": "https://example.test",
                    "license_class": "derived_summary",
                    "use_in_system": ["external_lookup"],
                    "metadata": {
                        "trusted": "true",
                        "trust_level": "high",
                        "allowed_domains": ["example.test"],
                    },
                    "effective_date": None,
                },
                {
                    "source_key": "active-only-source",
                    "source_name": "Active Only Source",
                    "source_type": "reference",
                    "source_url": "https://active-only.test",
                    "license_class": "authoritative",
                    "use_in_system": ["external_lookup"],
                    "metadata": {},
                    "effective_date": None,
                },
            ]

        with patch.object(canonical, "fetch_all", side_effect=fake_fetch_all):
            sources = canonical.load_canonical_external_sources(limit=5)

        self.assertIn("metadata->>'trusted'", captured_sql[0])
        self.assertNotIn("cardinality(use_in_system) = 0", captured_sql[0])
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]["source_code"], "trusted-source")
        self.assertEqual(sources[0]["trust_level"], "high")
        self.assertEqual(sources[0]["allowed_domains"], ["example.test"])

    def test_runtime_legacy_sql_gate(self):
        ai_engine = Path(__file__).resolve().parents[2]
        runtime_files = list((ai_engine / "app" / "services").glob("*.py")) + list((ai_engine / "app" / "routes").glob("*.py"))
        offenders = []
        for path in runtime_files:
            text = path.read_text(encoding="utf-8")
            for match in LEGACY_SQL_PATTERN.finditer(text):
                offenders.append(f"{path.relative_to(ai_engine)}:{match.group(0)}")
        self.assertEqual(offenders, [])


if __name__ == "__main__":
    unittest.main()
