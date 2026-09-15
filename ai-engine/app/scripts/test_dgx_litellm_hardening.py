import asyncio
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

AI_ENGINE_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(AI_ENGINE_DIR))


class DgxLiteLlmHardeningTests(unittest.TestCase):
    def _fake_detected_scenario(self, payload):
        return {
            "ok": True,
            "detected": True,
            "threshold": 28,
            "best_candidate": {"scenario_code": "EVIDENCE_GAP", "score": 42},
            "alternatives": [],
            "scenario": {
                "scenario_code": "EVIDENCE_GAP",
                "scenario_name": "Brecha de evidencia",
                "domain_code": "evidence",
                "domain_name": "Evidencia",
                "problem_type_code": "missing_evidence",
                "problem_type_name": "Evidencia faltante",
                "score": 42,
                "matched_keywords": ["evidencia"],
                "diagnosis_guidance": "Falta evidencia objetiva suficiente.",
                "solution_summary": "Completar evidencia trazable antes del cierre.",
                "solution_steps": ["Asignar responsable", "Cargar evidencia", "Validar cierre"],
                "expected_evidence": ["Registro aprobado"],
                "minimum_evidence_content": ["Fecha", "Responsable"],
                "invalid_evidence": ["Captura sin fecha"],
                "closure_conditions": ["Evidencia revisada"],
                "health_impact": "No se puede confirmar eficacia sin evidencia.",
                "kpi_impact": "Puede afectar cobertura de evidencia.",
                "metadata": {},
            },
        }

    def test_openai_compatible_metadata_and_payload_defaults(self):
        from app.services import llm_client

        captured = {}

        def fake_request(url, headers, payload, timeout):
            captured["url"] = url
            captured["headers"] = headers
            captured["payload"] = payload
            captured["timeout"] = timeout
            return {
                "choices": [{
                    "message": {
                        "reasoning_content": "{\"ok\": false}",
                        "content": "{\"ok\": true, \"source\": \"content_only\"}",
                    }
                }]
            }

        env = {
            "LLM_PROVIDER": "openai_compatible",
            "OPENAI_API_KEY": "test-secret-value",
            "OPENAI_BASE_URL": "http://ia2.tcdx.int:8000/v1",
            "OPENAI_MODEL": "general",
            "LLM_MIN_MAX_TOKENS": "500",
        }
        with patch.dict(os.environ, env, clear=False):
            original_request = llm_client._request_json
            try:
                llm_client._request_json = fake_request
                metadata = llm_client.get_llm_metadata(model_mode="balanced")
                result = llm_client.call_llm_json(
                    prompt="{}",
                    system_prompt="JSON only",
                    generation_options_override={"num_predict": 100, "num_ctx": 2048},
                )
            finally:
                llm_client._request_json = original_request

        self.assertEqual(metadata["provider"], "openai_compatible")
        self.assertEqual(metadata["model"], "general")
        self.assertEqual(metadata["base_url"], "http://ia2.tcdx.int:8000/v1")
        self.assertEqual(captured["url"], "http://ia2.tcdx.int:8000/v1/chat/completions")
        self.assertEqual(captured["payload"]["model"], "general")
        self.assertEqual(captured["payload"]["reasoning_effort"], "low")
        self.assertGreaterEqual(captured["payload"]["max_tokens"], 2000)
        self.assertEqual(captured["payload"]["response_format"], {"type": "json_object"})
        self.assertNotIn("num_predict", captured["payload"])
        self.assertNotIn("num_ctx", captured["payload"])
        self.assertEqual(result, {"ok": True, "source": "content_only"})

    def test_openai_compatible_reasoning_and_token_env_override(self):
        from app.services import llm_client

        captured = {}

        def fake_request(url, headers, payload, timeout):
            captured["payload"] = payload
            return {"choices": [{"message": {"content": "{\"ok\": true}"}}]}

        env = {
            "LLM_PROVIDER": "openai_compatible",
            "OPENAI_API_KEY": "test-secret-value",
            "OPENAI_BASE_URL": "http://ia2.tcdx.int:8000/v1",
            "OPENAI_MODEL": "general",
            "LLM_REASONING_EFFORT": "medium",
            "LLM_MIN_MAX_TOKENS": "4096",
        }
        with patch.dict(os.environ, env, clear=False):
            original_request = llm_client._request_json
            try:
                llm_client._request_json = fake_request
                llm_client.call_llm_json(prompt="{}", system_prompt="JSON only")
            finally:
                llm_client._request_json = original_request

        self.assertEqual(captured["payload"]["reasoning_effort"], "medium")
        self.assertEqual(captured["payload"]["max_tokens"], 4096)

    def test_ollama_generation_options_regression(self):
        from app.services import llm_client

        captured = {}

        def fake_request(url, headers, payload, timeout):
            captured["url"] = url
            captured["payload"] = payload
            return {"response": "{\"ok\": true}"}

        env = {
            "LLM_PROVIDER": "ollama",
            "OLLAMA_HOST": "http://localhost:11434",
            "OLLAMA_MODEL": "qwen-test",
        }
        with patch.dict(os.environ, env, clear=False):
            original_request = llm_client._request_json
            try:
                llm_client._request_json = fake_request
                result = llm_client.call_llm_json(
                    prompt="{}",
                    system_prompt="JSON only",
                    local_compact=True,
                    generation_options_override={"num_predict": 123, "num_ctx": 4096},
                )
            finally:
                llm_client._request_json = original_request

        self.assertEqual(captured["url"], "http://localhost:11434/api/generate")
        self.assertEqual(captured["payload"]["format"], "json")
        self.assertEqual(captured["payload"]["options"]["num_predict"], 123)
        self.assertEqual(captured["payload"]["options"]["num_ctx"], 4096)
        self.assertNotIn("reasoning_effort", captured["payload"])
        self.assertNotIn("max_tokens", captured["payload"])
        self.assertEqual(result, {"ok": True})

    def test_intelligence_narrative_sparse_context_degrades_generic_claims(self):
        from app.routes import ai as ai_routes

        def fake_llm(**kwargs):
            return {
                "executive_summary": "La iniciativa alcanzó resultados satisfactorios.",
                "technical_summary": "El desempeño operativo quedó validado correctamente.",
                "audit_summary": "Todas las obligaciones revisadas quedaron aprobadas.",
                "assumptions": [],
                "limitations": [],
                "recommendations": [{"title": "Cerrar prueba", "action_basis": "Modelo"}],
                "knowledge_basis": [],
                "confidence": "alta",
                "should_escalate_to_human": False,
            }

        payload = {
            "context": {
                "purpose": "Prueba técnica de integración",
                "facts": [
                    "La plataforma se llama TCDX ISO SaaS",
                    "Se está probando el motor de IA con contexto mínimo",
                ],
            }
        }

        ai_routes.settings.AI_INTERNAL_TOKEN = "test-token"
        with patch.object(ai_routes, "is_llm_available", return_value=True), \
             patch.object(ai_routes, "get_llm_metadata", return_value={"provider": "openai_compatible", "model": "general"}), \
             patch.object(ai_routes, "call_llm_json", side_effect=fake_llm):
            class FakeRequest:
                async def json(self):
                    return payload

            body = asyncio.run(
                ai_routes.intelligence_narrative(
                    FakeRequest(),
                    x_ai_token="test-token",
                    x_request_id="test-narrative",
                )
            )

        self.assertTrue(body["engine"]["llm_used"])
        structured_text = json.dumps(body["structured_result"], ensure_ascii=False).lower()
        self.assertNotIn("resultados satisfactorios", structured_text)
        self.assertNotIn("desempeño operativo quedó validado", structured_text)
        self.assertNotIn("obligaciones revisadas quedaron aprobadas", structured_text)
        self.assertEqual(body["structured_result"]["grounding_status"], "insufficient_evidence")
        self.assertTrue(body["structured_result"]["should_escalate_to_human"])

    def test_intelligence_grounding_claim_contract_is_generic(self):
        from app.routes import ai as ai_routes

        context = {
            "metrics": [{"metric_code": "METRIC-A", "value": 92}],
            "evidences": [{"id": "EVID-1", "title": "Registro revisado"}],
        }
        valid = ai_routes._normalize_intelligence_contract({
            "executive_summary": "Resumen basado en métrica autorizada.",
            "technical_summary": "Detalle técnico trazable.",
            "audit_summary": "Conclusión requiere revisión humana.",
            "assumptions": [],
            "limitations": [],
            "recommendations": [],
            "knowledge_basis": [],
            "confidence": "media",
            "should_escalate_to_human": True,
            "grounding_claims": [
                {"claim": "Métrica disponible", "source_refs": ["METRIC-A"]},
                {"claim": "Evidencia disponible", "source_refs": ["EVID-1"]},
            ],
        }, context)
        self.assertEqual(valid["grounding_status"], "grounded")
        self.assertTrue(valid["claim_validation"]["validated"])

        missing_claims = ai_routes._normalize_intelligence_contract({
            "executive_summary": "Resumen sin claims.",
            "technical_summary": "Detalle sin claims.",
            "audit_summary": "Conclusión sin claims.",
            "assumptions": [],
            "limitations": [],
            "recommendations": [],
            "knowledge_basis": [],
            "confidence": "alta",
            "should_escalate_to_human": False,
        }, context)
        self.assertEqual(missing_claims["grounding_status"], "human_review_required")
        self.assertEqual(missing_claims["confidence"], "media")
        self.assertTrue(missing_claims["should_escalate_to_human"])

        unsupported = ai_routes._normalize_intelligence_contract({
            "executive_summary": "Resumen con fuente no autorizada.",
            "technical_summary": "Detalle con fuente no autorizada.",
            "audit_summary": "Conclusión con fuente no autorizada.",
            "assumptions": [],
            "limitations": [],
            "recommendations": [],
            "knowledge_basis": [],
            "confidence": "media",
            "should_escalate_to_human": False,
            "grounding_claims": [{"claim": "Fuente externa", "source_refs": ["NOT-AUTHORIZED"]}],
        }, context)
        self.assertEqual(unsupported["grounding_status"], "partially_grounded")
        self.assertEqual(unsupported["claim_validation"]["unsupported_claims_count"], 1)
        self.assertTrue(unsupported["should_escalate_to_human"])

    def test_confidence_textual_and_numeric_normalization(self):
        from app.services.scenario_response_enricher import _normalize_confidence

        self.assertEqual(_normalize_confidence("alta"), "alta")
        self.assertEqual(_normalize_confidence("media"), "media")
        self.assertEqual(_normalize_confidence("baja"), "baja")
        self.assertEqual(_normalize_confidence("high"), "alta")
        self.assertEqual(_normalize_confidence("medium"), "media")
        self.assertEqual(_normalize_confidence("low"), "baja")
        self.assertEqual(_normalize_confidence(0.9), 0.9)
        self.assertEqual(_normalize_confidence(0.5), 0.85)
        self.assertEqual(_normalize_confidence("invalid"), "media")
        self.assertEqual(_normalize_confidence(None), "media")

    def test_guided_suggest_endpoints_do_not_500_on_textual_confidence(self):
        from app.routes import ai as ai_routes
        import app.services.scenario_response_enricher as enricher

        finding_payload = {
            "tenant_id": "tenant-test",
            "iso_code": "ISO27001",
            "title": "Falta evidencia de revisión de accesos",
            "description": "No existe evidencia objetiva del periodo actual.",
            "severity": "alta",
        }
        action_payload = {
            **finding_payload,
            "title": "Plan para cerrar brecha de evidencia",
        }

        ai_routes.settings.AI_INTERNAL_TOKEN = "test-token"
        original_detect = enricher.detect_finding_scenario
        original_feedback = enricher.load_useful_feedback_cases
        try:
            enricher.detect_finding_scenario = self._fake_detected_scenario
            enricher.load_useful_feedback_cases = lambda **kwargs: {"cases_found": 0, "cases": []}
            with patch.object(ai_routes, "generate_finding_analysis", return_value={"ok": True, "summary": "Base", "confidence": "alta"}), \
                 patch.object(ai_routes, "generate_action_plan", return_value={"ok": True, "objective": "Base", "confidence": "alta"}):
                finding_response = ai_routes.suggest_finding_analysis(
                    ai_routes.FindingAnalysisRequest(**finding_payload),
                    x_ai_token="test-token",
                )
                action_response = ai_routes.suggest_action_plan(
                    ai_routes.ActionPlanSuggestionRequest(**action_payload),
                    x_ai_token="test-token",
                )
        finally:
            enricher.detect_finding_scenario = original_detect
            enricher.load_useful_feedback_cases = original_feedback

        self.assertTrue(finding_response["ok"])
        self.assertTrue(action_response["ok"])
        self.assertEqual(finding_response["confidence"], "alta")
        self.assertEqual(action_response["confidence"], "alta")


class AiContextCanonicalSchemaTests(unittest.TestCase):
    TENANT_A = "11111111-1111-1111-1111-111111111111"
    TENANT_B = "22222222-2222-2222-2222-222222222222"
    CONTROL_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    CATALOG_A = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    FINDING_A = "cccccccc-cccc-cccc-cccc-cccccccccccc"

    def _install_context_builder_db_fake(self, context_builder):
        captured = []
        forbidden_sql_terms = (
            "tenant_name",
            "total_controls",
            "healthy_controls",
            "attention_controls,",
            "deteriorated_controls",
            "total_evidences",
            "total_findings",
            "total_action_plans",
            "healthy_percentage",
            "control_code",
            "control_title",
            "control_description",
            "control_category",
            "health_status",
            "responsible_user_id",
            "last_reviewed_at",
            "due_date",
            "priority",
            "applicability",
            "evidence_count",
            "finding_count",
            "action_plan_count",
            "kpi_snapshot_id",
            "kpi_code",
            "kpi_name",
            "status_color",
            "calculated_at",
        )

        def fake_fetch_all(sql, params=None):
            sql_lower = " ".join(sql.lower().split())
            for term in forbidden_sql_terms:
                self.assertNotIn(term, sql_lower)
            captured.append({"sql": sql, "params": list(params or [])})

            if "ai_core.v_tenant_health_context" in sql:
                self.assertIn("tenant_id = %s::uuid", sql)
                self.assertNotIn("standard_code = %s", sql)
                return [
                    {
                        "tenant_id": self.TENANT_A,
                        "metric_code": "F5_5_GRC_HEALTH",
                        "numeric_value": 82,
                        "publication_state": "published",
                        "coverage": 0.91,
                        "effective_at": "2026-09-14T10:00:00Z",
                    }
                ]

            if "ai_core.v_control_context" in sql:
                self.assertIn("tenant_id = %s::uuid", sql)
                rows = [
                    {
                        "tenant_id": self.TENANT_A,
                        "tenant_control_id": self.CONTROL_A,
                        "catalog_control_id": self.CATALOG_A,
                        "code": "A.5.1",
                        "title": "Control de prueba",
                        "standard_code": "ISO27001",
                        "implementation_status": "not_implemented",
                    },
                    {
                        "tenant_id": self.TENANT_A,
                        "tenant_control_id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
                        "catalog_control_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
                        "code": "A.5.2",
                        "title": "Control parcial",
                        "standard_code": "ISO27001",
                        "implementation_status": "partial",
                    },
                    {
                        "tenant_id": self.TENANT_B,
                        "tenant_control_id": "ffffffff-ffff-ffff-ffff-ffffffffffff",
                        "catalog_control_id": "abababab-abab-abab-abab-abababababab",
                        "code": "B.1",
                        "title": "Control otro tenant",
                        "standard_code": "ISO27001",
                        "implementation_status": "not_implemented",
                    },
                ]
                return [row for row in rows if row["tenant_id"] == self.TENANT_A]

            if "ai_core.v_finding_context" in sql:
                return [
                    {
                        "tenant_id": self.TENANT_A,
                        "finding_id": self.FINDING_A,
                        "tenant_control_id": self.CONTROL_A,
                        "title": "Hallazgo canónico",
                        "severity": "alta",
                        "status": "open",
                        "created_at": "2026-09-14T11:00:00Z",
                    }
                ]

            if "ai_core.v_kpi_context" in sql:
                self.assertNotIn("standard_code = %s", sql)
                return [
                    {
                        "tenant_id": self.TENANT_A,
                        "metric_code": "F5_5_CONTROL_EFFECTIVENESS",
                        "numeric_value": 70,
                        "publication_state": "published",
                        "coverage": 0.75,
                        "effective_at": "2026-09-14T12:00:00Z",
                    }
                ]

            return []

        original_fetch_all = context_builder.fetch_all
        context_builder.fetch_all = fake_fetch_all
        return captured, original_fetch_all

    def test_context_builder_uses_canonical_health_and_control_shapes(self):
        from app.services import context_builder

        captured, original_fetch_all = self._install_context_builder_db_fake(context_builder)
        try:
            context = context_builder.build_context_pack(
                tenant_id=self.TENANT_A,
                entity_type="control",
                entity_id=self.CONTROL_A,
                standard_code="ISO27001",
            )
        finally:
            context_builder.fetch_all = original_fetch_all

        self.assertEqual(context["tenant_id"], self.TENANT_A)
        self.assertEqual(context["scope_status"], "tenant_scoped")
        self.assertTrue(context["tenant_scope_authorized"])
        self.assertTrue(context["provenance"]["no_cross_tenant_fallback"])
        self.assertEqual(context["tenant_health"][0]["metric_code"], "F5_5_GRC_HEALTH")
        self.assertNotIn("standard_code", context["tenant_health"][0])
        self.assertEqual(context["critical_controls"][0]["code"], "A.5.1")
        self.assertEqual(context["critical_controls"][0]["context_bucket"], "implementation_gap")
        self.assertEqual(context["attention_controls"][0]["context_bucket"], "implementation_attention")
        self.assertEqual(context["selected_control"][0]["tenant_control_id"], self.CONTROL_A)
        serialized = json.dumps(context, ensure_ascii=False)
        self.assertNotIn(self.TENANT_B, serialized)
        self.assertGreaterEqual(len(captured), 5)

    def test_context_builder_filters_tenant_control_standard_without_legacy_columns(self):
        from app.services import context_builder

        captured, original_fetch_all = self._install_context_builder_db_fake(context_builder)
        try:
            rows = context_builder.get_control_context(
                tenant_id=self.TENANT_A,
                tenant_control_id=self.CONTROL_A,
                standard_code="ISO27001",
                limit=5,
            )
        finally:
            context_builder.fetch_all = original_fetch_all

        self.assertEqual(rows[0]["tenant_id"], self.TENANT_A)
        self.assertEqual(rows[0]["tenant_control_id"], self.CONTROL_A)
        self.assertEqual(rows[0]["catalog_control_id"], self.CATALOG_A)
        self.assertEqual(rows[0]["code"], "A.5.1")
        self.assertEqual(rows[0]["title"], "Control de prueba")
        sql = captured[-1]["sql"]
        self.assertIn("tenant_id = %s::uuid", sql)
        self.assertIn("tenant_control_id = %s::uuid", sql)
        self.assertIn("standard_code = %s", sql)

    def test_context_builder_requires_tenant_scope_without_querying_db(self):
        from app.services import context_builder

        captured = []
        original_fetch_all = context_builder.fetch_all
        context_builder.fetch_all = lambda *args, **kwargs: captured.append(args) or []
        try:
            context = context_builder.build_context_pack()
        finally:
            context_builder.fetch_all = original_fetch_all

        self.assertFalse(captured)
        self.assertFalse(context["tenant_scope_authorized"])
        self.assertEqual(context["warnings"], ["tenant_scope_required"])
        self.assertTrue(context["provenance"]["no_cross_tenant_fallback"])

    def test_guided_adapters_continue_without_500_with_canonical_context_shape(self):
        from app.services import guided_endpoint_adapter as adapter

        canonical_guided = {
            "ok": True,
            "engine": "tcdx_guided_solution_v2_domain_aware",
            "classification": {"problem_type_code": "missing_evidence", "confidence": 0.86},
            "domain_detection": {"domain_code": "evidence_management"},
            "problem": {
                "code": "missing_evidence",
                "name": "Evidencia faltante",
                "severity": "media",
                "priority_weight": 50,
            },
            "context_summary": {
                "tenant_health": "F5_5_GRC_HEALTH: valor 82, publicación published, cobertura 0.91.",
                "signals": ["Contexto canónico disponible."],
            },
            "knowledge_sources": {
                "base_problem_knowledge": True,
                "domain_knowledge": True,
                "domain_playbook_used": False,
                "domain_evidence_used": True,
                "domain_closure_used": False,
            },
            "solution": {
                "problem_detected": "Falta evidencia objetiva.",
                "compliance_impact": "Requiere revisión humana antes de cualquier decisión de cumplimiento.",
                "solution_summary": "Solicitar evidencia trazable.",
                "concrete_actions": ["Solicitar evidencia"],
                "corrective_actions": ["Adjuntar registro aprobado"],
                "expected_deliverables": ["Registro aprobado"],
                "minimum_content": ["Fecha", "Responsable"],
                "accepted_formats": ["PDF"],
                "invalid_evidence": ["Captura sin fecha"],
                "closure_conditions": ["Evidencia revisada"],
                "validation_criteria": ["Validación por responsable"],
                "rejection_reasons": ["Evidencia insuficiente"],
                "health_impact": "No se modifica Health sin evidencia.",
                "kpi_impact": "No se modifica KPI sin evidencia.",
                "next_best_action": "Solicitar evidencia trazable.",
                "can_auto_close": False,
            },
        }
        payload = {
            "tenant_id": self.TENANT_A,
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
             patch.object(adapter, "generate_guided_solution", return_value=canonical_guided), \
             patch.object(adapter, "enrich_guided_solution_with_llm", return_value=llm_fallback):
            finding = adapter.generate_finding_analysis(payload)
            action = adapter.generate_action_plan(payload)

        self.assertTrue(finding["ok"])
        self.assertTrue(action["ok"])
        self.assertEqual(finding["source"], "ai-engine-guided-canonical-v1")
        self.assertEqual(action["source"], "ai-engine-guided-canonical-v1")
        self.assertEqual(finding["confidence"], 0.86)
        self.assertEqual(action["confidence"], 0.86)
        self.assertTrue(finding["trace"]["canonical_knowledge_used"])
        self.assertFalse(finding["trace"]["llm_used"])
        self.assertTrue(finding["trace"]["fallback_used"])
        self.assertNotIn("legacy_source", finding)
        self.assertNotIn("legacy_error", action)


if __name__ == "__main__":
    unittest.main()
