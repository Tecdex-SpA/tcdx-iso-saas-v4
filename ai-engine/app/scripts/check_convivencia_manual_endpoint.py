import base64
import os
import sys
from typing import Any, Dict


os.environ.setdefault("AI_INTERNAL_TOKEN", "test-token-for-convivencia-checks-only")
os.environ.setdefault("AI_DISABLED", "true")

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402


TOKEN = os.environ["AI_INTERNAL_TOKEN"]


def _b64(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


def _post_json(client: TestClient, path: str, payload: Dict[str, Any], token: str = TOKEN):
    return client.post(path, json=payload, headers={"x-ai-token": token, "x-internal-token": token})


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _synthetic_rice_payload() -> Dict[str, Any]:
    text = """
Reglamento Interno 2026 RICE Colegio SOCHIDES Renca
Fundación Educacional María Isabel Órdenes Hidalgo
Visión: formar estudiantes responsables y solidarios.
Misión: entregar educación integral con buen trato.
Principios formativos: Buen Trato, Disciplina, Responsabilidad, Solidaridad, Tolerancia,
Diálogo y participación, Resolución pacífica de controversias y conflictos.
Consejo Escolar. Encargada de Convivencia Escolar: Ana Pérez.
Plan de Gestión de Convivencia Escolar.

Faltas leves
- Atrasos reiterados.
- No traer materiales.
Faltas graves
- Agredir verbalmente a un integrante de la comunidad educativa.
Faltas gravísimas
- Agresión física y afectación grave de la convivencia escolar.
Faltas de apoderados
- Maltrato a funcionarios.

Medidas disciplinarias
- Amonestación escrita.
Medidas formativas pedagógicas
- Diálogo reflexivo.
Medidas de apoyo y acompañamiento
- Derivación a convivencia escolar.
Medidas reparatorias
- Disculpas y reparación del daño.
Medidas protectoras y cautelares
- Separación preventiva si hay riesgo.

Procedimiento: notificación por correo, teléfono, web, RRSS o carta certificada;
descargos; resolución; reconsideración dentro de 5 días hábiles.
Atenuantes
- Reconocer la falta.
Agravantes
- Reiteración de la conducta.
Protocolos anexos: debido proceso, maltrato y abuso sexual infantil, vulneración de derechos,
maltrato acoso violencia, bullying, alcohol y drogas, embarazo maternidad paternidad,
identidad de género, accidentes escolares, seguridad escolar, DEC, derivación,
reclamos apoderados, cámaras, NEE, celulares.
Aula Segura y afectación grave requieren decisión humana y debido proceso.
Confidencialidad de datos del estudiante.
"""
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


def run() -> None:
    client = TestClient(app)

    health = client.get("/health")
    _assert(health.status_code == 200, "/health debe responder 200")
    _assert(isinstance(health.json(), dict), "/health debe devolver JSON")

    no_auth = client.post("/api/convivencia/manual/extract-parameters", json=_synthetic_rice_payload())
    _assert(no_auth.status_code == 401, "endpoint Convivir debe exigir token")

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

    ok_response = _post_json(client, "/api/convivencia/manual/extract-parameters", _synthetic_rice_payload())
    _assert(ok_response.status_code == 200, "endpoint Convivir debe aceptar fixture sintético")
    ok_body = ok_response.json()
    _assert(ok_body.get("status") == "ok", "endpoint Convivir debe devolver status ok")
    params = ok_body.get("parameters") or {}
    _assert("parameters" in ok_body and isinstance(params, dict), "respuesta debe incluir parameters")
    _assert(params.get("source", {}).get("requiresHumanReview") is True, "requiresHumanReview debe ser true")
    _assert(params.get("aulaSegura", {}).get("automaticApplicationAllowed") is False, "automaticApplicationAllowed debe ser false")
    _assert(len(params.get("misconductTypes", {}).get("leve", [])) >= 1, "debe clasificar faltas leves")
    _assert(len(params.get("measures", {}).get("disciplinary", [])) >= 1, "debe clasificar medidas disciplinarias")
    _assert(len(params.get("protocols", [])) >= 4, "debe detectar protocolos anexos")
    _assert("raw_text" not in ok_body.get("extraction", {}), "no debe devolver documento completo en extraction")

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
