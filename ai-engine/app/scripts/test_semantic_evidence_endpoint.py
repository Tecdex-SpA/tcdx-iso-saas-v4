import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("AI_INTERNAL_TOKEN", "semantic-evidence-test-token")

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import main  # noqa: E402


TENANT_A = "11111111-1111-4111-8111-111111111111"
CONTROL_A = "33333333-3333-4333-8333-333333333333"
CONTROL_B = "44444444-4444-4444-8444-444444444444"
NC_A = "55555555-5555-4555-8555-555555555555"
FINDING_A = "66666666-6666-4666-8666-666666666666"


def request_payload(extra=None):
    payload = {
        "tenant_id": TENANT_A,
        "source_type": "document_index",
        "source_id": "77777777-7777-4777-8777-777777777777",
        "filename": "politica-calidad.txt",
        "title": "Politica de calidad",
        "text": (
            "Politica de calidad version 2. Responsable: Gerencia. "
            "Aprobado por Direccion. El alcance cubre el proceso comercial, "
            "no conformidad recurrente y hallazgo de auditoria interna. "
            "Incluye control documental y revision periodica."
        ),
        "metadata": {"mime_type": "text/plain", "status": "active"},
        "candidate_targets": {
            "control": [{"id": CONTROL_A, "target_type": "control", "label": "Control documental"}],
            "nonconformity": [{"id": NC_A, "target_type": "nonconformity", "label": "No conformidad recurrente"}],
            "finding": [{"id": FINDING_A, "target_type": "finding", "label": "Hallazgo de auditoria interna"}],
        },
        "user_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "request_id": "semantic-evidence-test",
        "request_metadata": {
            "request_id": "semantic-evidence-test",
            "module_origin": "evidence_library",
            "task_type": "semantic_evidence_analysis",
            "llm_trace": {
                "actor": "spoofed@example.invalid",
                "system": "spoofed",
                "company": "Spoofed Co",
            },
        },
        "llm_trace": {
            "actor": "analyst@example.com",
            "actor_type": "user",
            "system": "tcdx-iso",
            "company": "Empresa A",
            "tenant_id": TENANT_A,
            "user_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
    }
    payload.update(extra or {})
    return payload


class SemanticEvidenceEndpointTest(unittest.TestCase):
    def call_endpoint(self, payload):
        with patch.object(main, "get_configured_ai_token", return_value=None):
            return main.analyze_semantic_evidence(
                payload=main.SemanticEvidenceAnalyzeRequest(**payload),
                x_ai_token="semantic-evidence-test-token",
            )

    def test_llm_contract_trace_and_authorized_targets(self):
        captured = {}

        def fake_llm(**kwargs):
            captured["trace_context"] = kwargs.get("trace_context")
            return {
                "summary": "Resumen IA basado en la politica real.",
                "classification": {"type": "policy", "confidence": 0.91, "reason": "Tiene alcance, responsable y aprobacion."},
                "document_facts": ["El documento declara responsable."],
                "ai_inferences": ["Puede apoyar revision de control documental."],
                "chunks": [{
                    "chunk_index": 0,
                    "chunk_text": "Responsable: Gerencia. Aprobado por Direccion.",
                    "relevance_reason": "Demuestra trazabilidad de aprobacion.",
                    "evidence_strength": "parcial",
                    "warnings": ["Validar vigencia."],
                }],
                "suggestions": [
                    {"target_type": "control", "target_id": CONTROL_A, "score": 0.92, "confidence": 0.9, "reason": "Coincide con control documental.", "chunk_index": 0, "snippet": "control documental"},
                    {"target_type": "control", "target_id": CONTROL_B, "score": 0.99, "confidence": 0.99, "reason": "No autorizado.", "chunk_index": 0, "snippet": "cross tenant"},
                    {"target_type": "nonconformity", "target_id": NC_A, "score": 0.81, "confidence": 0.8, "reason": "Menciona no conformidad.", "chunk_index": 0, "snippet": "no conformidad"},
                    {"target_type": "finding", "target_id": FINDING_A, "score": 0.77, "confidence": 0.76, "reason": "Menciona hallazgo.", "chunk_index": 0, "snippet": "hallazgo"},
                ],
                "scoring": {"relevance_to_object": 88, "document_quality": 72, "traceability": 80},
                "usefulness_assessment": {"status": "parcial", "missing_for_sufficiency": ["Validar vigencia."]},
                "limitations": ["Validar vigencia."],
            }

        with patch.object(main, "is_llm_available", return_value=True), \
                patch.object(main, "get_llm_metadata", return_value={"available": True, "provider": "openai_compatible", "model": "test-model"}), \
                patch.object(main, "call_llm_json", side_effect=fake_llm):
            body = self.call_endpoint(request_payload())

        self.assertEqual(body["classification"]["method"], "llm_assisted")
        self.assertEqual(body["trace"]["llm_used"], True)
        self.assertEqual(captured["trace_context"]["actor"], "analyst@example.com")
        self.assertEqual(captured["trace_context"]["system"], "tcdx-iso")
        self.assertEqual(captured["trace_context"]["company"], "Empresa A")
        ids = {item["target_id"] for item in body["suggestions"]}
        self.assertIn(CONTROL_A, ids)
        self.assertNotIn(CONTROL_B, ids)
        self.assertEqual(body["human_review_required"], True)

    def test_llm_error_degrades_to_reviewable_deterministic_result(self):
        with patch.object(main, "is_llm_available", return_value=True), \
                patch.object(main, "call_llm_json", side_effect=TimeoutError("timeout")):
            body = self.call_endpoint(request_payload())

        self.assertEqual(body["analysis_status"], "analizado_con_limitaciones")
        self.assertGreaterEqual(len(body["chunks"]), 1)
        self.assertEqual(body["trace"]["ai_enrichment_failed"], True)
        self.assertEqual(body["human_review_required"], True)

    def test_malformed_llm_response_preserves_fallback(self):
        with patch.object(main, "is_llm_available", return_value=True), \
                patch.object(main, "get_llm_metadata", return_value={"available": True, "provider": "openai_compatible", "model": "test-model"}), \
                patch.object(main, "call_llm_json", return_value={"chunks": "bad", "suggestions": "bad"}):
            body = self.call_endpoint(request_payload())

        self.assertGreaterEqual(len(body["chunks"]), 1)
        self.assertEqual(body["human_review_required"], True)

    def test_without_text_returns_controlled_result(self):
        body = self.call_endpoint(request_payload({"text": ""}))
        self.assertEqual(body["analysis_status"], "error")
        self.assertEqual(body["human_review_required"], True)
        self.assertEqual(body["trace"]["llm_used"], False)


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(SemanticEvidenceEndpointTest)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
    print("SEMANTIC_EVIDENCE_ENDPOINT_CONTRACT=PASS")
    print("DOCUMENT_ANALYSIS_LLM_PRODUCTIVE_CONTRACT=PASS")
    print("DOCUMENT_EVIDENCE_AI_HUMAN_GOVERNANCE=PASS")
