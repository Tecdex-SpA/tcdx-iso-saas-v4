import base64
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict


os.environ.setdefault("AI_INTERNAL_TOKEN", "test-token-for-convivencia-checks-only")
os.environ.setdefault("AI_DISABLED", "true")
os.environ.setdefault("CONVIVENCIA_MANUAL_LLM_ENABLED", "false")

AI_ENGINE_ROOT = Path(__file__).resolve().parents[2]
if str(AI_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_ENGINE_ROOT))

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402


TOKEN = os.environ["AI_INTERNAL_TOKEN"]


def _b64(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


def _post_json(client: TestClient, path: str, payload: Dict[str, Any], token: str = TOKEN):
    return client.post(path, json=payload, headers={"x-ai-token": token, "x-internal-token": token})


def _post_json_with_header(client: TestClient, path: str, payload: Dict[str, Any], header_name: str, token: str = TOKEN):
    return client.post(path, json=payload, headers={header_name: token})


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _synthetic_rice_payload() -> Dict[str, Any]:
    text = _synthetic_rice_text()
    return {
        "job_type": "extract_convivencia_manual_parameters",
        "payload_version": 1,
        "request_meta": {
            "tenantId": "tenant-check",
            "establishmentId": "establishment-check",
            "language": "es-CL",
            "product": "tcdx-convivir",
        },
        "evidence": {
            "file_name": "rice-sintetico.txt",
            "file_mime_type": "text/plain",
            "file_size_bytes": len(text.encode("utf-8")),
            "file_content_base64": _b64(text),
            "file_content_encoding": "base64",
            "description": "Fixture sintético no sensible para check Convivir.",
        },
        "control": {"code": "manual_convivencia", "title": "Manual de convivencia escolar"},
        "operation": {
            "purpose": "extract_parameters",
            "expected_output": "structured_convivencia_parameters_json",
            "do_not_summarize": True,
            "requires_human_review": True,
        },
    }


def _synthetic_rice_text() -> str:
    return """
Reglamento Interno 2026 RICE Colegio SOCHIDES Renca
Fundación Educacional María Isabel Órdenes Hidalgo
Visión: formar estudiantes responsables y solidarios.
Misión: entregar educación integral con buen trato.
Principios formativos: Buen Trato, Disciplina, Responsabilidad, Solidaridad, Tolerancia,
Diálogo y participación, Resolución pacífica de controversias y conflictos.
Consejo Escolar. Encargada de Convivencia Escolar: Ana Pérez.
Plan de Gestión de Convivencia Escolar.

Faltas leves
1. Atrasos reiterados.
2. No traer materiales.
3. Usar teléfono celular en clases sin autorización.
4. Interrumpir reiteradamente el desarrollo de la clase.
Faltas graves
1. Agredir verbalmente a un integrante de la comunidad educativa.
2. Dañar mobiliario o infraestructura del establecimiento.
3. Realizar acoso u hostigamiento a otro estudiante.
4. Salir del establecimiento sin autorización.
Faltas gravísimas
1. Agresión física y afectación grave de la convivencia escolar.
2. Portar armas o elementos cortopunzantes.
3. Agresión sexual o hechos de connotación sexual.
4. Venta o porte de drogas dentro del establecimiento.
Faltas de apoderados
1. Maltrato a funcionarios.
2. Amenazar a docentes o asistentes de la educación.
3. Difundir información falsa por redes sociales que afecte a la comunidad.

Medidas disciplinarias
1. Amonestación escrita.
2. Suspensión temporal con debido proceso.
3. Condicionalidad de matrícula.
Medidas formativas pedagógicas
1. Diálogo reflexivo.
2. Trabajo pedagógico reparatorio.
3. Compromiso de mejora conductual.
Medidas de apoyo y acompañamiento
1. Derivación a convivencia escolar.
2. Derivación a orientación.
3. Derivación a dupla psicosocial o psicología.
Medidas reparatorias
1. Disculpas y reparación del daño.
2. Restitución del bien dañado.
3. Acción comunitaria reparatoria.
Medidas protectoras y cautelares
1. Separación preventiva si hay riesgo.
2. Medida de resguardo para la víctima.
3. Contacto con Carabineros, PDI, Fiscalía, OPD/OLN o Tribunal de Familia si corresponde.

Procedimiento: notificación por correo, teléfono, web, RRSS o carta certificada;
descargos; plazo para presentar pruebas; resolución; reconsideración dentro de 5 días hábiles;
consulta a Consejo de Profesores; decisión de Dirección; denuncia dentro de 24 horas cuando corresponda.
Atenuantes
1. Reconocer la falta.
2. Reparar voluntariamente el daño.
3. Colaborar con la investigación.
Agravantes
1. Reiteración de la conducta.
2. Actuar con premeditación.
3. Afectar a estudiantes vulnerables.
Evidencias: acta, entrevista, registro escrito, hoja de vida, evidencia documental y medios verificadores.
Protocolos anexos: debido proceso, maltrato y abuso sexual infantil, vulneración de derechos,
maltrato acoso violencia, bullying, alcohol y drogas, embarazo maternidad paternidad,
identidad de género, accidentes escolares, seguridad escolar, DEC, derivación,
reclamos apoderados, cámaras, NEE, celulares.
Aula Segura y afectación grave requieren decisión humana y debido proceso.
Confidencialidad de datos del estudiante.
"""


def _assert_ok_convivencia_response(response, label: str) -> None:
    _assert(response.status_code == 200, f"{label} debe responder 200")
    body = response.json()
    _assert(body.get("status") == "ok", f"{label} debe devolver status ok")
    params = body.get("parameters") or {}
    _assert("parameters" in body and isinstance(params, dict), f"{label} debe incluir parameters")
    _assert("confidence" in body, f"{label} debe incluir confidence")
    _assert(isinstance(body.get("warnings"), list), f"{label} debe incluir warnings array")
    _assert(params.get("source", {}).get("requiresHumanReview") is True, f"{label}: requiresHumanReview debe ser true")
    _assert(
        params.get("aulaSegura", {}).get("automaticApplicationAllowed") is False,
        f"{label}: automaticApplicationAllowed debe ser false",
    )
    misconduct = params.get("misconductTypes", {})
    measures = params.get("measures", {})
    _assert(len(misconduct.get("leve", [])) >= 3, f"{label}: debe clasificar al menos 3 faltas leves")
    _assert(len(misconduct.get("grave", [])) >= 3, f"{label}: debe clasificar al menos 3 faltas graves")
    _assert(len(misconduct.get("gravisima", [])) >= 3, f"{label}: debe clasificar al menos 3 faltas gravísimas")
    _assert(len(misconduct.get("apoderado", [])) >= 3, f"{label}: debe clasificar al menos 3 faltas de apoderados")
    first_leve = misconduct.get("leve", [{}])[0]
    _assert(isinstance(first_leve, dict) and first_leve.get("code") == "LEVE-001", f"{label}: faltas deben ser objetos con código estable")
    _assert(first_leve.get("humanReviewRequired") is True, f"{label}: faltas deben exigir revisión humana")
    _assert(
        any(item.get("aulaSeguraRisk") is True for item in misconduct.get("gravisima", [])),
        f"{label}: faltas gravísimas deben marcar riesgo Aula Segura cuando corresponda",
    )
    _assert(sum(len(value) for value in measures.values() if isinstance(value, list)) >= 3, f"{label}: debe extraer al menos 3 medidas")
    first_measure = measures.get("disciplinary", [{}])[0]
    _assert(first_measure.get("automaticApplicationAllowed") is False, f"{label}: medidas no deben aplicarse automáticamente")
    _assert(first_measure.get("humanReviewRequired") is True, f"{label}: medidas deben exigir revisión humana")
    _assert(len(params.get("protocols", [])) >= 5, f"{label}: debe detectar al menos 5 protocolos anexos")
    _assert(isinstance(params.get("misconductMeasureMatrix"), list), f"{label}: debe incluir misconductMeasureMatrix")
    _assert(isinstance(params.get("derivationRules"), list), f"{label}: debe incluir derivationRules")
    _assert(isinstance(params.get("communicationRules"), list), f"{label}: debe incluir communicationRules")
    _assert(isinstance(params.get("evidenceRules"), list), f"{label}: debe incluir evidenceRules")
    _assert(isinstance(params.get("extractionQuality"), dict), f"{label}: debe incluir extractionQuality")
    _assert(len(params.get("misconductMeasureMatrix", [])) >= 1, f"{label}: debe sugerir matriz falta-medida")
    _assert(len(params.get("derivationRules", [])) >= 1, f"{label}: debe extraer reglas de derivación")
    _assert(len(params.get("communicationRules", [])) >= 1, f"{label}: debe extraer reglas de comunicación")
    _assert(len(params.get("evidenceRules", [])) >= 1, f"{label}: debe extraer reglas de evidencia")
    _assert(
        params.get("extractionQuality", {}).get("requiresHumanReview") is True,
        f"{label}: extractionQuality debe conservar revisión humana",
    )
    _assert(isinstance(params.get("systemBehavior"), dict), f"{label}: debe incluir systemBehavior")
    _assert(
        params.get("systemBehavior", {}).get("mustSuggestNotApply") is True,
        f"{label}: mustSuggestNotApply debe ser true",
    )
    _assert(
        params.get("systemBehavior", {}).get("mustNotClaimLegalCompliance") is True,
        f"{label}: mustNotClaimLegalCompliance debe ser true",
    )
    _assert(any("LLM no usado" in warning for warning in body.get("warnings", [])), f"{label}: no debe usar LLM por defecto")
    _assert("raw_text" not in body.get("extraction", {}), f"{label}: no debe devolver documento completo en extraction")


def run() -> None:
    client = TestClient(app)

    health = client.get("/health")
    _assert(health.status_code == 200, "/health debe responder 200")
    _assert(isinstance(health.json(), dict), "/health debe devolver JSON")

    no_auth = client.post("/api/convivencia/manual/extract-parameters", json=_synthetic_rice_payload())
    _assert(no_auth.status_code == 401, "endpoint Convivir debe exigir token")

    ai_token_response = _post_json_with_header(
        client,
        "/api/convivencia/manual/extract-parameters",
        _synthetic_rice_payload(),
        "x-ai-token",
    )
    _assert_ok_convivencia_response(ai_token_response, "auth con x-ai-token")

    internal_token_response = _post_json_with_header(
        client,
        "/api/convivencia/manual/extract-parameters",
        _synthetic_rice_payload(),
        "x-internal-token",
    )
    _assert_ok_convivencia_response(internal_token_response, "auth con x-internal-token")

    legacy = _post_json(client, "/api/evidences/process", {
        "job_type": "analyze_evidence",
        "evidence": {"description": "Evidencia de prueba para contrato legacy."},
        "control": {"description": "Control de prueba", "standard_code": "ISO9001"},
        "operation": {"operation_name": "analyze"},
    })
    _assert(legacy.status_code == 200, "/api/evidences/process legacy debe responder 200")
    legacy_body = legacy.json()
    _assert({"ok", "source", "job_type", "extraction", "assessment", "chunks"}.issubset(legacy_body.keys()), "contrato legacy de evidencias cambió")

    executive = _post_json(client, "/api/ai/suggest/executive-brief", {
        "tenant_id": "tenant-check",
        "tenant_name": "Tenant Check",
        "period": "Periodo actual",
        "standards": ["ISO9001"],
        "controls_total": 10,
        "controls_warning": 2,
        "controls_critical": 1,
        "evidences_pending": 3,
        "findings_critical": 1,
        "weakest_standards": ["ISO9001"],
    })
    _assert(executive.status_code == 200, "/api/ai/suggest/executive-brief debe responder 200")
    _assert(isinstance(executive.json(), dict), "executive-brief debe devolver JSON")

    started = time.monotonic()
    ok_response = _post_json(client, "/api/convivencia/manual/extract-parameters", _synthetic_rice_payload())
    elapsed = time.monotonic() - started
    _assert(elapsed < 10, f"fixture text/plain/base64 debe responder bajo 10s; demoró {elapsed:.2f}s")
    _assert_ok_convivencia_response(ok_response, "evidence.file_content_base64 text/plain/base64")

    evidence_raw_text_payload = _synthetic_rice_payload()
    evidence_raw_text_payload["evidence"] = {
        "file_name": "rice-sintetico.txt",
        "file_mime_type": "text/plain",
        "raw_text": _synthetic_rice_text(),
    }
    evidence_raw_text_response = _post_json(
        client,
        "/api/convivencia/manual/extract-parameters",
        evidence_raw_text_payload,
    )
    _assert_ok_convivencia_response(evidence_raw_text_response, "evidence.raw_text")

    top_level_raw_text_payload = _synthetic_rice_payload()
    top_level_raw_text_payload.pop("evidence", None)
    top_level_raw_text_payload["file_name"] = "rice-sintetico.txt"
    top_level_raw_text_payload["file_mime_type"] = "text/plain"
    top_level_raw_text_payload["raw_text"] = _synthetic_rice_text()
    top_level_raw_text_response = _post_json(
        client,
        "/api/convivencia/manual/extract-parameters",
        top_level_raw_text_payload,
    )
    _assert_ok_convivencia_response(top_level_raw_text_response, "top-level raw_text")

    empty_response = _post_json(client, "/api/convivencia/manual/extract-parameters", {})
    _assert(empty_response.status_code == 422, "payload vacío debe devolver 422")
    empty_body = empty_response.json()
    _assert(empty_body.get("error") == "document_text_not_extracted", "payload vacío debe informar document_text_not_extracted")
    _assert(isinstance(empty_body.get("accepted_shapes"), list), "payload vacío debe incluir accepted_shapes")
    _assert(isinstance(empty_body.get("received_top_level_keys"), list), "payload vacío debe incluir received_top_level_keys")
    _assert(isinstance(empty_body.get("received_evidence_keys"), list), "payload vacío debe incluir received_evidence_keys")

    invalid_pdf = _synthetic_rice_payload()
    invalid_pdf["evidence"].update({
        "file_name": "invalid.pdf",
        "file_mime_type": "application/pdf",
        "file_content_base64": base64.b64encode(b"not a pdf").decode("ascii"),
    })
    invalid_response = _post_json(client, "/api/convivencia/manual/extract-parameters", invalid_pdf)
    _assert(invalid_response.status_code == 422, "PDF inválido debe rechazarse con 422")
    _assert(invalid_response.json().get("status") == "error", "PDF inválido debe devolver status error")

    print("PASS convivencia manual endpoint checks")


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        print(f"FAIL convivencia manual endpoint checks: {exc}", file=sys.stderr)
        sys.exit(1)
