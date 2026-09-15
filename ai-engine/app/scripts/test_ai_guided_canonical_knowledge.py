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
PUBLIC_LEGACY_TOKENS = (
    "legacy_error",
    "legacy_source",
    "legacy_error_fallback",
    "legacy_knowledge_sources",
    "legacy_knowledge_context",
    "legacy_result",
    "deterministic_" + "legacy_guided",
)

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
        item_key = "missing_evidence" if problem == "missing_evidence" else "access_review_missing"
        domain = "evidence_management" if item_key == "missing_evidence" else "access_management"
        title = "Evidencia faltante" if item_key == "missing_evidence" else "Revisión de accesos"
        summary = (
            "Recopilar evidencia objetiva con fecha, responsable, alcance y resultado."
            if item_key == "missing_evidence"
            else "Revisar accesos privilegiados con trazabilidad."
        )
        return [{
            "id": "99999999-9999-9999-9999-999999999999",
            "item_key": item_key,
            "source_key": "iso27001-derived",
            "source_record_id": item_key,
            "standard_family": "ISO",
            "standard_code": "ISO27001",
            "clause_or_control": "A.5.15",
            "title": title,
            "domain": domain,
            "item_type": "control_guidance",
            "intent_summary": summary,
            "license_class": "derived_summary",
            "use_in_system": ["ai"],
            "search_text": "revision accesos evidencia privilegios",
            "applicability": {},
            "implementation_guidance": "Validar periodo, responsable y aprobacion.",
            "evidence_examples": [],
            "risk_tags": [],
            "tags": [item_key],
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
        item_key = "missing_evidence" if params and "missing_evidence" in str(params) else "access_review_missing"
        return [{
            "item_key": item_key,
            "gap_key": "access-review-gap",
            "description": "Falta revisión de accesos",
            "gap_text": "No hay evidencia objetiva trazable." if item_key == "missing_evidence" else "No hay evidencia trazable de revisión de accesos.",
            "severity_hint": "alta",
            "severity_default": "alta",
            "metadata": {},
        }]

    if "from public.knowledge_mappings" in compact:
        item_key = "missing_evidence" if params and "missing_evidence" in str(params) else "access_review_missing"
        return [{
            "item_key": item_key,
            "mapping_key": f"ai_guided_catalog_map:{item_key}",
            "target_type": "problem_type",
            "target_key": item_key,
            "entity_type": "audit_finding",
            "standard_family": "GRC",
            "standard_code": "ISO27001",
            "clause_or_control": "AI-GUIDED",
            "domain": "evidence_management" if item_key == "missing_evidence" else "access_management",
            "match_weight": 1,
            "confidence": 0.9,
        }]

    if "from public.knowledge_recommended_actions" in compact:
        item_key = "missing_evidence" if params and "missing_evidence" in str(params) else "access_review_missing"
        return [{
            "item_key": item_key,
            "action_key": "review-accesses",
            "description": "Completar revisión de accesos",
            "action_text": "Solicitar evidencia objetiva y documentar la ausencia si no existe." if item_key == "missing_evidence" else "Revisar accesos privilegiados y documentar aprobación.",
            "action_basis": "knowledge",
            "priority_hint": "alta",
            "priority_default": "alta",
            "metadata": {},
        }]

    if "from public.knowledge_evidence_expectations" in compact:
        item_key = "missing_evidence" if params and "missing_evidence" in str(params) else "access_review_missing"
        return [{
            "item_key": item_key,
            "expectation_key": "access-review-evidence",
            "description": "Registro de revisión",
            "expectation_text": "Registro con fecha, periodo, responsable, alcance y resultado." if item_key == "missing_evidence" else "Acta o registro con fecha, responsable, alcance y aprobacion.",
            "evidence_type": "record",
            "required_level": "required",
            "metadata": {},
        }]

    if "from public.knowledge_rules" in compact:
        return []

    if "from public.knowledge_rule_hints" in compact:
        return []

    if "from public.knowledge_audit_questions" in compact:
        item_key = "missing_evidence" if params and "missing_evidence" in str(params) else "access_review_missing"
        return [{
            "item_key": item_key,
            "question_text": "¿La evidencia demuestra qué ocurrió, cuándo y quién validó?" if item_key == "missing_evidence" else "¿La revisión cubre accesos privilegiados del periodo?",
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


def _sample_guided_solution(problem_type_code="missing_evidence"):
    return {
        "ok": True,
        "engine": "tcdx_guided_solution_v2_domain_aware",
        "classification": {"problem_type_code": problem_type_code, "confidence": 0.86},
        "domain_detection": {
            "domain_code": "evidence_management",
            "applies_to_standard": None,
            "standard_applicability": {"state": "unknown", "applies_to_standard": None},
        },
        "problem": {
            "code": problem_type_code,
            "name": "Evidencia faltante",
            "severity": "media",
            "priority_weight": 50,
        },
        "domain": {
            "code": "evidence_management",
            "applies_to_standard": None,
            "standard_applicability": {"state": "unknown", "applies_to_standard": None},
        },
        "context_summary": {
            "tenant_health": "F5_5_GRC_HEALTH: valor 82, publicación published, cobertura 0.91.",
            "signals": ["Contexto canónico disponible."],
        },
        "solution": {
            "problem_detected": "Falta evidencia objetiva.",
            "compliance_impact": "Requiere revisión humana antes de cualquier decisión de cumplimiento.",
            "solution_summary": "Solicitar evidencia trazable.",
            "concrete_actions": ["Solicitar evidencia objetiva"],
            "corrective_actions": ["Adjuntar registro aprobado"],
            "expected_deliverables": ["Registro aprobado"],
            "minimum_content": ["Fecha", "Responsable"],
            "accepted_formats": ["PDF"],
            "invalid_evidence": [],
            "closure_conditions": [],
            "validation_criteria": ["Validación por responsable"],
            "rejection_reasons": ["Evidencia insuficiente"],
            "health_impact": "No se modifica Health sin evidencia.",
            "kpi_impact": "No se modifica KPI sin evidencia.",
            "next_best_action": "Solicitar evidencia trazable.",
            "can_auto_close": False,
        },
        "knowledge_sources": {
            "base_problem_knowledge": True,
            "domain_knowledge": True,
            "domain_playbook_used": False,
            "domain_evidence_used": True,
            "domain_closure_used": False,
            "standard_overrides_count": 0,
            "standard_overrides_used": False,
            "trace_counts": {
                "canonical_knowledge_item_count": 1,
                "canonical_knowledge_match_count": 1,
                "canonical_mapping_match_count": 1,
                "canonical_action_count": 1,
                "canonical_evidence_expectation_count": 1,
                "canonical_gap_count": 1,
                "canonical_audit_question_count": 1,
                "canonical_rule_count": 0,
            },
            "canonical_sources": [{"source_key": "iso27001-derived", "license_class": "derived_summary"}],
        },
        "raw_context": {
            "open_findings": [],
            "closed_findings": [],
            "recent_findings": [],
        },
    }


def _assert_public_legacy_free(testcase, value):
    serialized = json.dumps(value, ensure_ascii=False, default=str)
    for token in PUBLIC_LEGACY_TOKENS:
        testcase.assertNotIn(token, serialized)


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
        self.assertEqual(result["knowledge_sources"]["trace_counts"]["canonical_knowledge_item_count"], 1)
        self.assertEqual(result["knowledge_sources"]["trace_counts"]["canonical_mapping_match_count"], 1)
        self.assertEqual(result["knowledge_sources"]["trace_counts"]["canonical_action_count"], 1)
        self.assertEqual(result["knowledge_sources"]["trace_counts"]["canonical_evidence_expectation_count"], 1)

    def test_missing_evidence_uses_canonical_knowledge_contract(self):
        from app.services.solution_engine import generate_guided_solution

        p1, p2 = self._patch_db()
        with p1, p2:
            result = generate_guided_solution(
                user_text="No existe evidencia objetiva del control evaluado",
                tenant_id=TENANT_A,
                standard_code="ISO27001",
                forced_problem_type="missing_evidence",
                forced_domain_code="evidence_management",
            )

        serialized = json.dumps(result, ensure_ascii=False)
        self.assertTrue(result["ok"])
        self.assertIn("Solicitar evidencia objetiva", serialized)
        self.assertTrue(result["knowledge_sources"]["base_problem_knowledge"])
        self.assertTrue(result["knowledge_sources"]["domain_knowledge"])
        self.assertGreater(len(result["solution"]["concrete_actions"]), 0)
        self.assertGreater(len(result["solution"]["expected_deliverables"]), 0)
        self.assertFalse(result["solution"]["can_auto_close"])

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

    def test_domain_applicability_unknown_is_not_false(self):
        import app.services.canonical_knowledge_service as canonical

        with patch.object(canonical, "fetch_one", side_effect=[None, {"?column?": 1}]):
            result = canonical.canonical_domain_standard_applicability("access_management", "ISO27001")

        self.assertEqual(result["state"], "unknown")
        self.assertIsNone(result["applies_to_standard"])
        self.assertEqual(result["basis"], "no_canonical_standard_mapping")

    def test_closed_finding_does_not_become_open_signal(self):
        from app.services.problem_classifier import classify_problem

        closed = classify_problem(
            text="",
            context={"recent_findings": [{"status": "closed", "severity": "alta", "active_gap_signal": False}]},
        )
        opened = classify_problem(
            text="",
            context={"recent_findings": [{"status": "open", "severity": "alta", "active_gap_signal": True}]},
        )

        self.assertNotEqual(closed["problem_type_code"], "finding_open")
        self.assertNotEqual(closed["problem_type_code"], "nonconformity_open")
        self.assertEqual(opened["problem_type_code"], "finding_open")

    def test_guided_adapters_do_not_call_legacy_and_trace_dgx_fallback(self):
        from app.services import guided_endpoint_adapter as adapter

        payload = {
            "tenant_id": TENANT_A,
            "iso_code": "ISO27001",
            "title": "Falta evidencia de control",
            "description": "No existe evidencia objetiva del periodo actual.",
            "severity": "alta",
        }
        llm_fallback = {
            "llm_available": False,
            "llm_used": False,
            "llm_provider": "none",
            "selected_model": "deterministic_canonical_guided",
            "model_mode": "deterministic",
            "fallback_used": True,
            "fallback_reason": "llm_unavailable",
            "enrichment": {},
        }

        with patch.object(adapter, "_safe_legacy_call", side_effect=AssertionError("legacy path must not run")), \
             patch.object(adapter, "generate_guided_solution", return_value=_sample_guided_solution()), \
             patch.object(adapter, "enrich_guided_solution_with_llm", return_value=llm_fallback):
            finding = adapter.generate_finding_analysis(payload)
            action = adapter.generate_action_plan(payload)

        self.assertTrue(finding["ok"])
        self.assertTrue(action["ok"])
        self.assertEqual(finding["source"], "ai-engine-guided-canonical-v1")
        self.assertEqual(action["source"], "ai-engine-guided-canonical-v1")
        _assert_public_legacy_free(self, finding)
        _assert_public_legacy_free(self, action)
        self.assertTrue(finding["trace"]["canonical_context_used"])
        self.assertTrue(finding["trace"]["canonical_knowledge_used"])
        self.assertEqual(finding["trace"]["canonical_knowledge_match_count"], 1)
        self.assertEqual(finding["trace"]["canonical_knowledge_item_count"], 1)
        self.assertEqual(finding["trace"]["canonical_mapping_match_count"], 1)
        self.assertEqual(finding["trace"]["canonical_action_count"], 1)
        self.assertEqual(finding["trace"]["canonical_evidence_expectation_count"], 1)
        self.assertFalse(finding["trace"]["llm_used"])
        self.assertTrue(finding["trace"]["fallback_used"])
        self.assertEqual(finding["trace"]["fallback_reason"], "llm_unavailable")
        self.assertFalse(finding["can_auto_close"])
        self.assertFalse(action["can_auto_close"])

    def test_public_response_legacy_free_for_llm_modes(self):
        from app.services import guided_endpoint_adapter as adapter

        payload = {"tenant_id": TENANT_A, "title": "Falta evidencia", "description": "No existe evidencia objetiva."}
        guided = _sample_guided_solution()
        guided["legacy_error"] = "legacy_error_fallback"
        guided["knowledge_sources"]["legacy_knowledge_context"] = {"legacy_source": "legacy_error"}
        llm_modes = [
            {
                "llm_available": True,
                "llm_used": True,
                "llm_provider": "openai_compatible",
                "selected_model": "dgx-test",
                "model_mode": "guided",
                "fallback_used": False,
                "fallback_reason": None,
                "enrichment": {"summary": "Resumen claro", "can_auto_close": False},
            },
            {
                "llm_available": False,
                "llm_used": False,
                "llm_provider": "none",
                "selected_model": "deterministic_canonical_guided",
                "model_mode": "deterministic",
                "fallback_used": True,
                "fallback_reason": "llm_unavailable",
                "enrichment": {},
            },
            {
                "llm_available": True,
                "llm_used": False,
                "llm_provider": "openai_compatible",
                "selected_model": "dgx-test",
                "model_mode": "deterministic",
                "fallback_used": True,
                "fallback_reason": "llm_enrichment_failed:ValueError",
                "enrichment": {},
            },
            {
                "llm_available": True,
                "llm_used": False,
                "llm_provider": "openai_compatible",
                "selected_model": "dgx-test",
                "model_mode": "deterministic",
                "fallback_used": True,
                "fallback_reason": "llm_enrichment_failed:TimeoutError",
                "enrichment": {},
            },
        ]

        with patch.object(adapter, "_safe_legacy_call", side_effect=AssertionError("legacy path must not run")), \
             patch.object(adapter, "generate_guided_solution", return_value=guided):
            for llm_result in llm_modes:
                with patch.object(adapter, "enrich_guided_solution_with_llm", return_value=llm_result):
                    finding = adapter.generate_finding_analysis(payload)
                    action = adapter.generate_action_plan(payload)
                    _assert_public_legacy_free(self, finding)
                    _assert_public_legacy_free(self, action)
                    self.assertNotEqual(finding["trace"]["selected_model"], "deterministic_" + "legacy_guided")
                    self.assertNotEqual(action["trace"]["selected_model"], "deterministic_" + "legacy_guided")

    def test_canonical_trace_counts_are_real_not_booleans(self):
        from app.services import canonical_knowledge_service as canonical
        from app.services import guided_endpoint_adapter as adapter

        counts = canonical._trace_counts(
            items=[{"item_key": "one"}, {"item_key": "one"}],
            mappings=[
                {"item_key": "one", "mapping_key": "m1", "target_type": "problem_type", "target_key": "one"},
                {"item_key": "one", "mapping_key": "m2", "target_type": "problem_type", "target_key": "one"},
            ],
            gaps=[{"item_key": "one", "gap_key": "g1"}],
            actions=[{"item_key": "one", "action_key": "a1"}],
            evidence=[{"item_key": "one", "expectation_key": "e1"}],
            rules=[{"item_key": "one", "rule_key": "r1"}],
            questions=[{"item_key": "one", "question_text": "Q1"}],
        )
        self.assertEqual(counts["canonical_knowledge_item_count"], 1)
        self.assertEqual(counts["canonical_mapping_match_count"], 2)

        trace = adapter._canonical_guided_trace(
            {"knowledge_sources": {"base_problem_knowledge": True, "domain_knowledge": True, "trace_counts": counts}},
            {"llm_available": False, "llm_used": False, "fallback_used": True, "fallback_reason": "llm_unavailable"},
        )
        self.assertEqual(trace["canonical_knowledge_match_count"], 1)
        self.assertEqual(trace["canonical_mapping_match_count"], 2)

        empty = adapter._canonical_guided_trace(
            {"knowledge_sources": {"base_problem_knowledge": False, "domain_knowledge": False, "trace_counts": {}}},
            {"llm_available": False, "llm_used": False, "fallback_used": True, "fallback_reason": "llm_unavailable"},
        )
        self.assertEqual(empty["canonical_knowledge_match_count"], 0)

    def test_guided_llm_enrichment_mock_success_and_failures(self):
        import app.services.guided_llm_enrichment as enrichment

        deterministic = {
            "summary": "Solicitar evidencia trazable.",
            "recommended_actions": ["Solicitar evidencia objetiva"],
            "expected_deliverables": ["Registro aprobado"],
            "minimum_content": ["Fecha"],
            "closure_conditions": [],
            "can_auto_close": False,
        }
        metadata = {"available": True, "provider": "openai_compatible", "model": "dgx-test", "model_mode": "guided"}

        with patch.object(enrichment, "get_llm_metadata", return_value=metadata), \
             patch.object(enrichment, "is_llm_available", return_value=True), \
             patch.object(enrichment, "call_llm_json", return_value={
                 "summary": "Solicitar evidencia trazable enriquecida.",
                 "impact_explanation": "La brecha requiere revisión humana con la evidencia disponible.",
                 "rationale": "Se usa sólo el contrato determinístico suministrado.",
                 "can_auto_close": False,
             }):
            success = enrichment.enrich_guided_solution_with_llm(
                endpoint_type="finding_analysis",
                payload={"tenant_id": TENANT_A, "standard_code": "ISO27001"},
                guided=_sample_guided_solution(),
                deterministic_response=deterministic,
            )

        self.assertTrue(success["llm_available"])
        self.assertTrue(success["llm_used"])
        self.assertFalse(success["fallback_used"])
        self.assertEqual(success["llm_provider"], "openai_compatible")
        self.assertEqual(success["selected_model"], "dgx-test")
        self.assertEqual(success["enrichment"]["summary"], "Solicitar evidencia trazable enriquecida.")

        adversarial_outputs = [
            {"can_auto_close": True},
            {"priority": "Alta"},
            {"action_plan": [{"step": 1, "title": "Paso", "owner_role": "Gerente inventado", "target_days": 5}]},
            {"action_plan": [{"step": 1, "title": "Paso", "owner_role": "Responsable del proceso", "target_days": 99}]},
            {"expected_deliverables": ["Evidencia inventada"]},
            {"kpi_impact": "KPI mejorado automáticamente"},
            {"health_impact": "Health mejorado automáticamente"},
            {"standard_applicability": {"state": "true", "applies_to_standard": True}},
            {"action_plan": [{"step": 1}, {"step": 2}, {"step": 3}]},
            {"summary": "Cumplimiento logrado y hallazgo cerrado"},
        ]

        for output in adversarial_outputs:
            with patch.object(enrichment, "get_llm_metadata", return_value=metadata), \
                 patch.object(enrichment, "is_llm_available", return_value=True), \
                 patch.object(enrichment, "call_llm_json", return_value=output):
                rejected = enrichment.enrich_guided_solution_with_llm(
                    endpoint_type="action_plan",
                    payload={"tenant_id": TENANT_A},
                    guided=_sample_guided_solution(),
                    deterministic_response={
                        **deterministic,
                        "priority": "Media",
                        "health_impact": "No se modifica Health sin evidencia.",
                        "kpi_impact": "No se modifica KPI sin evidencia.",
                        "action_plan": [
                            {"step": 1, "title": "Solicitar evidencia", "owner_role": "Responsable del proceso", "target_days": 5},
                            {"step": 2, "title": "Validar evidencia", "owner_role": "Administrador de cumplimiento", "target_days": 10},
                        ],
                    },
                )
            self.assertFalse(rejected["llm_used"], output)
            self.assertTrue(rejected["fallback_used"], output)
            self.assertIn("llm_enrichment_failed", rejected["fallback_reason"])

        with patch.object(enrichment, "get_llm_metadata", return_value=metadata), \
             patch.object(enrichment, "is_llm_available", return_value=True), \
             patch.object(enrichment, "call_llm_json", return_value={"can_auto_close": True}):
            invalid = enrichment.enrich_guided_solution_with_llm(
                endpoint_type="finding_analysis",
                payload={"tenant_id": TENANT_A},
                guided=_sample_guided_solution(),
                deterministic_response=deterministic,
            )

        self.assertFalse(invalid["llm_used"])
        self.assertTrue(invalid["fallback_used"])
        self.assertIn("llm_enrichment_failed", invalid["fallback_reason"])

        with patch.object(enrichment, "get_llm_metadata", return_value=metadata), \
             patch.object(enrichment, "is_llm_available", return_value=True), \
             patch.object(enrichment, "call_llm_json", side_effect=TimeoutError("timeout")):
            failure = enrichment.enrich_guided_solution_with_llm(
                endpoint_type="action_plan",
                payload={"tenant_id": TENANT_A},
                guided=_sample_guided_solution(),
                deterministic_response=deterministic,
            )

        self.assertFalse(failure["llm_used"])
        self.assertTrue(failure["fallback_used"])
        self.assertIn("TimeoutError", failure["fallback_reason"])

        with patch.object(enrichment, "get_llm_metadata", return_value={"available": False, "provider": "none", "model": ""}), \
             patch.object(enrichment, "is_llm_available", return_value=False):
            unavailable = enrichment.enrich_guided_solution_with_llm(
                endpoint_type="action_plan",
                payload={"tenant_id": TENANT_A},
                guided=_sample_guided_solution(),
                deterministic_response=deterministic,
            )

        self.assertFalse(unavailable["llm_used"])
        self.assertTrue(unavailable["fallback_used"])
        self.assertEqual(unavailable["fallback_reason"], "llm_unavailable")

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
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(AiGuidedCanonicalKnowledgeTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if result.wasSuccessful():
        print("AI_GUIDED_LLM_FACTUAL_FAIL_CLOSED=PASS")
        print("AI_GUIDED_CANONICAL_TRACE_COUNTS=PASS")
        print("AI_GUIDED_PUBLIC_RESPONSE_LEGACY_FREE=PASS")
    sys.exit(0 if result.wasSuccessful() else 1)
