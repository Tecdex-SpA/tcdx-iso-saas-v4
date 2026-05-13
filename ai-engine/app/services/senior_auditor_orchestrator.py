import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from app.services.drive_context_service import build_drive_context
from app.services.guardrails_service import apply_post_analysis_guardrails, apply_pre_analysis_guardrails
from app.services.llm_client import call_llm_json, get_llm_metadata, is_llm_available
from app.services.rag_context_service import build_rag_context
from app.services.source_trace_service import make_source_trace_item, normalize_source_trace
from app.services.structured_result_service import (
    build_fallback_structured_result,
    normalize_ai_structured_result,
)
from app.services.web_context_service import build_external_context

PROMPT_VERSION = "1.0.0"
CONTEXT_VERSION = "ai_context_v2.0.0"
BASE_DIR = Path(__file__).resolve().parents[2]
PROMPT_PATH = BASE_DIR / "prompts" / "iso_senior_auditor.md"


def _number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _int(value: Any) -> int:
    return int(_number(value))


def _load_master_prompt() -> str:
    try:
        return PROMPT_PATH.read_text(encoding="utf-8")
    except OSError:
        return "Prompt Maestro — Auditor ISO Senior no disponible en disco."


def _readiness(summary_rows: List[Dict[str, Any]], controls: List[Dict[str, Any]]) -> Dict[str, str]:
    active = sum(_int(row.get("active_scope_controls")) for row in summary_rows)
    official = sum(_int(row.get("controls_with_official_evidence")) for row in summary_rows)
    overdue = sum(_int(row.get("overdue_action_plans_count")) for row in summary_rows)
    open_nc = sum(_int(row.get("open_nonconformities_count")) for row in summary_rows)
    pct = (official / active * 100) if active else 0

    if not active and not controls:
        return {"status": "sin_datos", "reason": "Sin controles activos ni resumen efectivo disponible."}
    if pct >= 80 and overdue == 0 and open_nc == 0:
        return {"status": "listo", "reason": "Cobertura de evidencia oficial alta y sin planes vencidos ni NC abiertas."}
    if pct >= 50:
        return {"status": "parcial", "reason": "Cobertura de evidencia parcial o existen brechas abiertas por tratar."}
    return {"status": "no_listo", "reason": "Menos de 50% de controles activos con evidencia oficial o brechas críticas activas."}


def _evidence_status(control: Dict[str, Any]) -> str:
    evidence_count = _int(control.get("evidence_count"))
    official_count = _int(control.get("official_evidence_count"))
    quality = str(control.get("evidence_quality_status") or "").lower()
    if evidence_count <= 0:
        return "sin_evidencia"
    if official_count <= 0:
        return "evidencia_aprobada_sin_oficial"
    if "debil" in quality or "weak" in quality:
        return "evidencia_debil"
    return "evidencia_debil" if _number(control.get("effective_health_score")) < 50 else "evidencia_aprobada_sin_oficial"


def _severity(control: Dict[str, Any]) -> str:
    score = _number(control.get("effective_health_score"))
    overdue = _int(control.get("overdue_action_plans_count"))
    nc = _int(control.get("open_nonconformities_count"))
    if score < 40 or overdue > 0 or nc > 0:
        return "alta"
    if score < 70:
        return "media"
    return "baja"


def _build_gaps(controls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    gaps = []
    for control in controls[:5]:
        iso = str(control.get("iso") or "")
        clause = str(control.get("clause") or "")
        title = f"{iso} {clause} con salud efectiva {control.get('effective_health_score', 0)}%"
        desc = (
            f"Según datos internos: el control '{control.get('control_description') or 'sin descripción'}' "
            f"presenta estado {control.get('effective_health_status') or 'sin estado'}, "
            f"{_int(control.get('official_evidence_count'))} evidencias oficiales, "
            f"{_int(control.get('open_findings_count'))} hallazgos abiertos, "
            f"{_int(control.get('open_nonconformities_count'))} no conformidades abiertas y "
            f"{_int(control.get('overdue_action_plans_count'))} planes vencidos."
        )
        gaps.append({
            "title": title,
            "description": desc,
            "iso": iso,
            "clause": clause,
            "severity": _severity(control),
            "evidence_status": _evidence_status(control),
            "business_impact": "Riesgo de observación o no conformidad en auditoría si no se oficializa evidencia y se cierran brechas abiertas.",
        })
    return gaps


def _build_actions(gaps: List[Dict[str, Any]], controls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    actions = []
    for index, gap in enumerate(gaps):
        control = controls[index] if index < len(controls) else {}
        actions.append({
            "title": f"Regularizar {gap['iso']} {gap['clause']}",
            "description": "Cargar evidencia oficial, revisar hallazgos/NC vinculadas y actualizar planes de acción vencidos hasta dejar trazabilidad verificable.",
            "priority": gap["severity"],
            "target_module": "evidencias" if gap["evidence_status"] != "evidencia_debil" else "plan-accion",
            "suggested_owner_role": "Responsable del proceso y auditor interno ISO",
            "due_days": 15 if gap["severity"] == "alta" else 30,
            "acceptance_criteria": [
                "Evidencia oficial cargada y validada en el sistema",
                "No existen planes vencidos asociados al control",
                "Hallazgos y no conformidades tienen tratamiento documentado",
                "La vista public.v_iso_control_effective_health refleja mejora verificable",
            ],
            "related_control_id": str(control.get("tenant_control_id") or ""),
            "related_iso": gap["iso"],
            "related_clause": gap["clause"],
        })
    return actions


def _calculate_confidence(context: Dict[str, Any], used_rag: bool, used_drive: bool, used_web: bool) -> float:
    summaries = context.get("effective_health_summary") if isinstance(context.get("effective_health_summary"), list) else []
    controls = context.get("priority_controls") if isinstance(context.get("priority_controls"), list) else []
    recent_evidences = context.get("recent_evidences") if isinstance(context.get("recent_evidences"), list) else []
    score = 0.5
    if sum(_int(row.get("active_scope_controls")) for row in summaries) >= 10 or len(controls) >= 10:
        score += 0.2
    if recent_evidences:
        score += 0.1
    if used_rag:
        score += 0.1
    if used_drive:
        score += 0.05
    if used_web:
        score += 0.05
    if not summaries and not controls:
        score -= 0.2
    active = sum(_int(row.get("active_scope_controls")) for row in summaries)
    without = sum(_int(row.get("controls_without_evidence")) for row in summaries)
    if active and without / active > 0.5:
        score -= 0.1
    if not used_rag:
        score -= 0.1
    if not used_drive:
        score -= 0.1
    if not used_web:
        score -= 0.1
    return round(max(0.0, min(1.0, score)), 2)


def _web_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    question = str(payload.get("question") or "")
    depth = str((payload.get("options") or {}).get("depth") or "standard")
    topics = ["iso_best_practices"]
    lowered = question.lower()
    if any(term in lowered for term in ["ciber", "vulnerabilidad", "cloud", "hardening", "privacidad", "regulación", "regulacion", "ia"]):
        topics.extend(["cybersecurity_threats", "cloud_security"])
    return {
        "allow_web_context": bool((payload.get("options") or {}).get("use_web", True)),
        "requested_output": "audit_preparation" if depth in {"standard", "deep"} else "global_analysis",
        "web_context_topics": topics,
        "tenant_context": {"tenant_id": payload.get("tenant_id")},
    }


def _build_llm_user_prompt(payload: Dict[str, Any], context: Dict[str, Any], deterministic_result: Dict[str, Any]) -> str:
    compact = {
        "task_type": payload.get("task_type"),
        "tenant_id": payload.get("tenant_id"),
        "module_origin": payload.get("module_origin"),
        "question": payload.get("question"),
        "context": {
            "tenant": context.get("tenant"),
            "scope": context.get("scope"),
            "effective_health_summary": (context.get("effective_health_summary") or [])[:10],
            "priority_controls": (context.get("priority_controls") or [])[:20],
            "recent_evidences": (context.get("recent_evidences") or [])[:10],
            "recent_findings": (context.get("recent_findings") or [])[:10],
            "recent_nonconformities": (context.get("recent_nonconformities") or [])[:10],
            "recent_action_plans": (context.get("recent_action_plans") or [])[:10],
            "documents": (context.get("documents") or [])[:10],
            "source_trace": context.get("source_trace") or [],
            "limitations": context.get("limitations") or [],
        },
        "deterministic_baseline": {
            "answer": deterministic_result.get("answer"),
            "structured_result": deterministic_result.get("structured_result"),
        },
        "required_output": "Devuelve JSON válido con answer y structured_result completo. Todo en español.",
    }
    return json.dumps(compact, ensure_ascii=False, default=str)


def analyze_with_senior_auditor_v2(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        payload = {}
    tenant_id = str(payload.get("tenant_id") or "")
    if not tenant_id:
        raise ValueError("tenant_id requerido")
    payload["locale"] = "es"
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    summaries = context.get("effective_health_summary") if isinstance(context.get("effective_health_summary"), list) else []
    controls = context.get("priority_controls") if isinstance(context.get("priority_controls"), list) else []
    limitations = list(context.get("limitations") or [])
    source_trace = normalize_source_trace(context.get("source_trace") or [])
    pre = apply_pre_analysis_guardrails(payload)
    limitations.extend(pre.get("limitations") or [])
    source_trace.extend(pre.get("source_trace") or [])

    _load_master_prompt()

    rag = drive = web = {"used": False, "limitations": []}
    for name, fn, args in [
        ("rag", build_rag_context, (payload,)),
        ("drive", build_drive_context, (payload,)),
        ("web", build_external_context, (_web_payload(payload),)),
    ]:
        try:
            if name == "web" and (payload.get("options") or {}).get("use_web") is False:
                continue
            result = fn(*args)
            if name == "rag":
                rag = result
            elif name == "drive":
                drive = result
            else:
                web = result
        except Exception as exc:
            limitations.append(f"{name}: fuente complementaria no disponible ({str(exc)[:120]})")

    limitations.extend(rag.get("limitations") or [])
    limitations.extend(drive.get("limitations") or [])
    limitations.extend(web.get("limitations") or [])
    source_trace.extend(rag.get("source_trace") or [])
    source_trace.extend(drive.get("source_trace") or [])

    if web.get("used"):
        source_trace.append(make_source_trace_item("web", "Brave Search", "buenas prácticas externas actuales"))
    elif web.get("reason"):
        limitations.append(str(web.get("reason")))

    readiness = _readiness(summaries, controls)
    active = sum(_int(row.get("active_scope_controls")) for row in summaries)
    complies = sum(_int(row.get("complies_controls")) for row in summaries)
    without = sum(_int(row.get("controls_without_evidence")) for row in summaries)
    official = sum(_int(row.get("controls_with_official_evidence")) for row in summaries)
    overdue = sum(_int(row.get("overdue_action_plans_count")) for row in summaries)
    open_nc = sum(_int(row.get("open_nonconformities_count")) for row in summaries)
    compliance = round((complies / active * 100), 2) if active else 0
    official_pct = round((official / active * 100), 2) if active else 0
    gaps = _build_gaps(controls)
    actions = _build_actions(gaps, controls)

    facts = [
        f"Según datos internos: {active} controles activos en alcance evaluados por public.v_iso_effective_kpi_summary.",
        f"Según datos internos: cumplimiento efectivo {compliance}% y evidencia oficial {official_pct}%.",
        f"Según datos internos: {without} controles sin evidencia, {overdue} planes vencidos y {open_nc} no conformidades abiertas.",
    ]
    if not active and not controls:
        facts = ["Según datos internos: no se recibieron controles activos, evidencias ni planes suficientes para concluir cumplimiento."]

    inferences = [
        f"Inferencia razonada: la preparación de auditoría es {readiness['status']} porque {readiness['reason']}",
    ]
    if without > 0:
        inferences.append("Inferencia razonada: los controles sin evidencia serán foco probable de preguntas auditoras y deben priorizarse antes de cualquier auditoría formal.")

    diagnosis = (
        f"Según datos internos, el tenant presenta preparación {readiness['status']}. "
        f"El análisis se basa en salud ISO efectiva, controles activos en alcance, evidencia oficial, hallazgos, no conformidades y planes vencidos. "
        f"Se detectaron {len(gaps)} brechas prioritarias y {len(actions)} acciones recomendadas. "
        "La referencia externa o documental se usa solo como complemento y no reemplaza la evidencia interna."
    )

    answer = (
        f"{diagnosis}\n\n"
        f"Según datos internos: existen {active} controles activos evaluables; {complies} cumplen, {without} no tienen evidencia y {official} tienen evidencia oficial computable. "
        f"El cumplimiento efectivo promedio calculado es {compliance}% y la cobertura de evidencia oficial es {official_pct}%. "
        f"Hay {overdue} planes de acción vencidos y {open_nc} no conformidades abiertas que pueden afectar la preparación de auditoría.\n\n"
        "Inferencia razonada: el foco operativo debe estar en cerrar brechas con impacto auditor, no en producir documentación genérica. "
        "Primero deben oficializarse evidencias de controles críticos, actualizar planes vencidos con responsable y fecha futura, y resolver no conformidades abiertas con trazabilidad de causa raíz y criterio de cierre. "
        "Cada acción sugerida debe ejecutarse en el módulo correspondiente y validarse por un responsable humano antes de considerarse cerrada.\n\n"
        "Limitación del análisis: Google Drive, RAG o Brave pueden aportar contraste y mejores prácticas, pero no sustituyen la evidencia interna ni permiten declarar certificación."
    )

    confidence = _calculate_confidence(context, bool(rag.get("used")), bool(drive.get("used")), bool(web.get("used")))
    structured = normalize_ai_structured_result({
        "executive_summary": f"Preparación {readiness['status']}: {active} controles activos, {compliance}% cumplimiento efectivo, {official_pct}% evidencia oficial, {without} controles sin evidencia.",
        "diagnosis": diagnosis,
        "confirmed_facts": facts,
        "inferences": inferences,
        "gaps": gaps,
        "evidence_assessment": {
            "available_evidence": [f"{_int(control.get('evidence_count'))} evidencias en {control.get('iso')} {control.get('clause')}" for control in controls[:6] if _int(control.get("evidence_count")) > 0],
            "official_evidence": [f"{_int(control.get('official_evidence_count'))} oficiales en {control.get('iso')} {control.get('clause')}" for control in controls[:6] if _int(control.get("official_evidence_count")) > 0],
            "weak_evidence": [gap["title"] for gap in gaps if gap["evidence_status"] == "evidencia_debil"],
            "missing_evidence": [gap["title"] for gap in gaps if gap["evidence_status"] == "sin_evidencia"],
        },
        "risk_impact": "Riesgo de hallazgos mayores si controles críticos carecen de evidencia oficial, planes vigentes y cierre de no conformidades.",
        "audit_readiness": {
            "status": readiness["status"],
            "reason": readiness["reason"],
            "auditor_concerns": [
                "¿Qué evidencia oficial sustenta los controles críticos?",
                "¿Por qué existen planes vencidos y quién aprobó la extensión?",
                "¿Las no conformidades abiertas tienen causa raíz y tratamiento verificable?",
            ],
        },
        "recommended_actions": actions,
        "auditor_questions": [
            "¿Cuál es el criterio formal para marcar una evidencia como oficial?",
            "¿Qué controles críticos siguen sin evidencia en alcance activo?",
            "¿Quién es responsable del cierre de planes vencidos?",
            "¿Cómo se verifica la eficacia de las acciones correctivas?",
        ],
        "documents_to_request": [
            "Política o procedimiento vigente aplicable al control crítico",
            "Registro operacional reciente que demuestre ejecución del control",
            "Evidencia de revisión/aprobación por responsable formal",
        ],
        "web_context_used": [
            f"Como referencia externa: {item.get('url')} — {item.get('summary')}"
            for item in (web.get("sources") or [])[:5]
        ],
        "drive_context_used": drive.get("drive_context_used") or [],
        "rag_context_used": rag.get("rag_context_used") or [],
        "source_trace": source_trace + [make_source_trace_item("prompt_inference", "iso_senior_auditor.md", "razonamiento auditor determinístico")],
        "confidence": confidence,
        "limitations": list(dict.fromkeys(limitations)),
    })

    if not structured["diagnosis"]:
        structured = build_fallback_structured_result(answer, context, limitations)

    engine_model = "deterministic_senior_auditor_v2"
    llm_metadata = get_llm_metadata()
    llm_used = False
    if is_llm_available():
        try:
            llm_raw = call_llm_json(
                prompt=_build_llm_user_prompt(
                    payload,
                    context,
                    {"answer": answer, "structured_result": structured},
                ),
                system_prompt=_load_master_prompt(),
                temperature=0.2,
                timeout=60,
            )
            llm_structured = normalize_ai_structured_result(llm_raw, defaults=structured)
            llm_structured["confidence"] = structured["confidence"]
            llm_structured["source_trace"] = normalize_source_trace(
                (llm_structured.get("source_trace") or []) + structured.get("source_trace", [])
            )
            llm_structured["limitations"] = list(dict.fromkeys(
                (llm_structured.get("limitations") or []) + structured.get("limitations", [])
            ))
            answer = str(llm_raw.get("answer") or answer) if isinstance(llm_raw, dict) else answer
            structured = llm_structured
            llm_used = True
            engine_model = f"{llm_metadata.get('provider')}/{llm_metadata.get('model')}"
        except Exception as exc:
            provider = llm_metadata.get("provider") or "desconocido"
            model = llm_metadata.get("model") or "sin_modelo"
            structured["limitations"].append(
                f"Proveedor LLM falló — análisis generado por fallback determinístico. Proveedor: {provider}, modelo: {model}. Detalle: {str(exc)[:160]}"
            )
            limitations.append(f"Proveedor LLM falló — análisis generado por fallback determinístico. Modelo intentado: {model}")
            engine_model = "deterministic_senior_auditor_v2"
    else:
        structured["limitations"].append(
            "Proveedor LLM no configurado — análisis generado por motor determinístico basado en contexto interno"
        )
        limitations.append("Proveedor LLM no configurado — análisis generado por motor determinístico basado en contexto interno")

    result = {
        "ok": True,
        "answer": answer,
        "structured_result": structured,
        "source_trace": structured["source_trace"],
        "confidence": structured["confidence"],
        "limitations": structured["limitations"],
        "engine": {
            "prompt_version": PROMPT_VERSION,
            "context_version": context.get("scope", {}).get("context_version") or CONTEXT_VERSION,
            "model": engine_model,
            "llm_provider": llm_metadata.get("provider"),
            "llm_available": llm_metadata.get("available") is True,
            "used_llm": llm_used,
            "used_internal_context": True,
            "used_rag": bool(rag.get("used")),
            "used_drive": bool(drive.get("used")),
            "used_web": bool(web.get("used")),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
    }
    return apply_post_analysis_guardrails(result, context)
