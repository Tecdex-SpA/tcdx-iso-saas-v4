import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime

AI_HOST = os.getenv("AI_HOST", "127.0.0.1")
AI_PORT = os.getenv("AI_PORT", "8001")
AI_TOKEN = os.getenv("AI_TOKEN", "tecdex_ai_internal_2026")
TENANT_ID = os.getenv("TENANT_ID", "697eefa4-3b56-4c8a-a7d4-6d512c40233e")
FINDING_ID = os.getenv("FINDING_ID", "00000000-0000-0000-0000-000000000000")

URL = f"http://{AI_HOST}:{AI_PORT}/api/ai/suggest/finding-analysis"

REPORT_DIR = Path("/home/tecdex/ai-engine/reports")
REPORT_DIR.mkdir(parents=True, exist_ok=True)

CASES = [
    {
        "name": "ISO27001 - Revisión de accesos privilegiados",
        "expected_domain": "access_management",
        "expected_problem": "access_review_missing",
        "payload": {
            "tenant_id": TENANT_ID,
            "finding_id": FINDING_ID,
            "iso_code": "ISO27001",
            "title": "No existe evidencia de revisión de accesos privilegiados",
            "description": "No se encontró matriz vigente ni acta de revisión de usuarios privilegiados del periodo actual.",
            "severity": "alta",
            "status": "open",
        },
    },
    {
        "name": "ISO9001 - Proveedor crítico sin evaluación",
        "expected_domain": "supplier_management",
        "expected_problem": "supplier_without_evaluation",
        "payload": {
            "tenant_id": TENANT_ID,
            "finding_id": FINDING_ID,
            "iso_code": "ISO9001",
            "title": "Proveedor crítico sin evaluación vigente",
            "description": "No se evidencia evaluación periódica del proveedor crítico de servicios externos ni aprobación de continuidad.",
            "severity": "alta",
            "status": "open",
        },
    },
    {
        "name": "ISO17025 - Calibración vencida",
        "expected_domain": "calibration_metrological_traceability",
        "expected_problem": "expired_evidence",
        "payload": {
            "tenant_id": TENANT_ID,
            "finding_id": FINDING_ID,
            "iso_code": "ISO17025",
            "title": "Certificado de calibración vencido",
            "description": "El certificado de calibración del equipo crítico está vencido y no existe evaluación de impacto sobre resultados emitidos.",
            "severity": "alta",
            "status": "open",
        },
    },
    {
        "name": "ISO14001 - Permiso ambiental vencido",
        "expected_domain": "environmental_management",
        "expected_problem": "expired_evidence",
        "payload": {
            "tenant_id": TENANT_ID,
            "finding_id": FINDING_ID,
            "iso_code": "ISO14001",
            "title": "Permiso ambiental vencido",
            "description": "El permiso ambiental está vencido, la matriz legal ambiental no fue actualizada y no hay acción definida.",
            "severity": "alta",
            "status": "open",
        },
    },
    {
        "name": "ISO22000 - Control de inocuidad no ejecutado",
        "expected_domain": "food_safety",
        "expected_problem": "control_not_executed",
        "payload": {
            "tenant_id": TENANT_ID,
            "finding_id": FINDING_ID,
            "iso_code": "ISO22000",
            "title": "Control de inocuidad no ejecutado",
            "description": "No existe registro de monitoreo del PCC, no se documentaron desviaciones ni acciones correctivas.",
            "severity": "alta",
            "status": "open",
        },
    },
    {
        "name": "ISO50001 - KPI energético deteriorado",
        "expected_domain": "energy_asset_performance",
        "expected_problem": "kpi_deteriorated",
        "payload": {
            "tenant_id": TENANT_ID,
            "finding_id": FINDING_ID,
            "iso_code": "ISO50001",
            "title": "KPI de desempeño energético deteriorado",
            "description": "El indicador de desempeño energético está bajo, aumentó el consumo y no existe análisis de causa ni acción de mejora.",
            "severity": "media",
            "status": "open",
        },
    },
    {
        "name": "ISO20000-1 - SLA deteriorado",
        "expected_domain": "service_level_management",
        "expected_problem": "kpi_deteriorated",
        "payload": {
            "tenant_id": TENANT_ID,
            "finding_id": FINDING_ID,
            "iso_code": "ISO20000-1",
            "title": "Incumplimiento de SLA de atención",
            "description": "El SLA de tiempo de respuesta está deteriorado, existen tickets fuera de plazo y no hay plan de mejora.",
            "severity": "media",
            "status": "open",
        },
    },
    {
        "name": "ISO27701 - Riesgo de privacidad sin tratamiento",
        "expected_domain": "privacy_personal_data",
        "expected_problem": "risk_without_treatment",
        "payload": {
            "tenant_id": TENANT_ID,
            "finding_id": FINDING_ID,
            "iso_code": "ISO27701",
            "title": "Riesgo de privacidad sin tratamiento",
            "description": "Existe tratamiento de datos personales sin evaluación de riesgo, sin responsable y sin controles definidos.",
            "severity": "alta",
            "status": "open",
        },
    },
    {
        "name": "ISO45001 - Simulacro de emergencia no evidenciado",
        "expected_domain": "emergency_preparedness",
        "expected_problem": "procedure_not_implemented",
        "payload": {
            "tenant_id": TENANT_ID,
            "finding_id": FINDING_ID,
            "iso_code": "ISO45001",
            "title": "Simulacro de emergencia no ejecutado",
            "description": "No existe registro de simulacro, participantes, resultado ni acciones por brechas detectadas.",
            "severity": "alta",
            "status": "open",
        },
    },
    {
        "name": "ISO37301 - Obligación legal sin evidencia",
        "expected_domain": "legal_regulatory_compliance",
        "expected_problem": "expired_evidence",
        "payload": {
            "tenant_id": TENANT_ID,
            "finding_id": FINDING_ID,
            "iso_code": "ISO37301",
            "title": "Obligación regulatoria sin evidencia vigente",
            "description": "La matriz legal no fue actualizada, existe evidencia vencida y no se definió acción para la brecha.",
            "severity": "alta",
            "status": "open",
        },
    },
]


def post_json(payload):
    body = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-ai-token": AI_TOKEN,
        },
    )

    with urllib.request.urlopen(req, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def get_nested(data, *keys):
    cur = data

    for key in keys:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)

    return cur


def main():
    started_at = datetime.now().isoformat(timespec="seconds")
    results = []
    failures = 0

    print("============================================================")
    print("REGRESIÓN MULTI-NORMA MOTOR IA TCDX")
    print("============================================================")
    print(f"URL: {URL}")
    print(f"Started at: {started_at}")
    print("")

    for index, case in enumerate(CASES, start=1):
        print("------------------------------------------------------------")
        print(f"{index}) {case['name']}")
        print("------------------------------------------------------------")

        try:
            result = post_json(case["payload"])
            error = None
        except urllib.error.HTTPError as e:
            result = {}
            error = f"HTTP {e.code}: {e.read().decode('utf-8')}"
        except Exception as e:
            result = {}
            error = str(e)

        structured = result.get("structured_guided") or {}
        problem_type = get_nested(structured, "classification", "problem_type_code")
        domain_code = get_nested(structured, "domain_detection", "domain_code")
        engine = structured.get("engine")
        knowledge_sources = structured.get("knowledge_sources") or {}

        expected_problem = case["expected_problem"]
        expected_domain = case["expected_domain"]

        ok = (
            error is None
            and result.get("ok") is True
            and engine == "tcdx_guided_solution_v2_domain_aware"
            and problem_type == expected_problem
            and domain_code == expected_domain
            and knowledge_sources.get("domain_knowledge") is True
            and bool(result.get("expected_deliverables"))
            and bool(result.get("closure_conditions"))
        )

        if not ok:
            failures += 1

        record = {
            "case": case["name"],
            "ok": ok,
            "error": error,
            "expected_problem": expected_problem,
            "actual_problem": problem_type,
            "expected_domain": expected_domain,
            "actual_domain": domain_code,
            "engine": engine,
            "domain_knowledge": knowledge_sources.get("domain_knowledge"),
            "domain_playbook_used": knowledge_sources.get("domain_playbook_used"),
            "domain_evidence_used": knowledge_sources.get("domain_evidence_used"),
            "domain_closure_used": knowledge_sources.get("domain_closure_used"),
            "summary": result.get("summary"),
            "expected_deliverables": result.get("expected_deliverables", [])[:8],
            "closure_conditions": result.get("closure_conditions", [])[:8],
        }

        results.append(record)

        print(f"Status:                  {'OK' if ok else 'REVISAR'}")
        print(f"Engine:                  {engine}")
        print(f"Problem esperado/real:   {expected_problem} / {problem_type}")
        print(f"Dominio esperado/real:   {expected_domain} / {domain_code}")
        print(f"Domain knowledge:        {knowledge_sources.get('domain_knowledge')}")
        print(f"Resumen:                 {result.get('summary')}")
        if error:
            print(f"Error:                   {error}")
        print("")

    report = {
        "ok": failures == 0,
        "started_at": started_at,
        "finished_at": datetime.now().isoformat(timespec="seconds"),
        "url": URL,
        "total_cases": len(CASES),
        "failures": failures,
        "results": results,
    }

    report_path = REPORT_DIR / f"ai_regression_multinorma_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str), encoding="utf-8")

    print("============================================================")
    if failures == 0:
        print("RESULTADO FINAL: OK - Motor multi-norma funcionando correctamente")
    else:
        print(f"RESULTADO FINAL: REVISAR - {failures} caso(s) con diferencia")
    print(f"Reporte: {report_path}")
    print("============================================================")

    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
