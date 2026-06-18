import json
import re
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.knowledge_loader import get_knowledge_module
from app.services.llm_client import call_llm_json, get_llm_metadata, is_llm_available
from app.services.rag_context_service import search_baseline_knowledge

PROMPT_VERSION = "beta-pert-operational-risk-v1"
SOURCE = "ai-engine-operational-beta-pert"
BASE_DIR = Path(__file__).resolve().parents[2]
PROMPT_PATH = BASE_DIR / "prompts" / "operational_risk_beta_pert_v1.md"
MAX_RISKS = 8

DOMAIN_MISMATCH_PATTERNS = [
    "preparacion sin_datos",
    "preparación sin_datos",
    "controles activos",
    "cumplimiento efectivo",
    "evidencia oficial",
    "controles sin evidencia",
    "0 controles",
    "0% cumplimiento",
]


class OperationalBetaPertError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def _text(value: Any, fallback: str = "", max_len: int = 500) -> str:
    text = str(value if value is not None else fallback).replace("\x00", "").strip()
    return text[:max_len]


def _num(value: Any, fallback: Optional[float] = None) -> Optional[float]:
    try:
        number = float(value)
        if number != number:
            return fallback
        return number
    except Exception:
        return fallback


def _round(value: Any, digits: int = 2, fallback: Optional[float] = None) -> Optional[float]:
    number = _num(value, fallback)
    return None if number is None else round(number, digits)


def _list(value: Any, limit: int = 8) -> List[Any]:
    return value[:limit] if isinstance(value, list) else []


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or "").lower())
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9%]+", " ", text)).strip()


def _load_prompt() -> str:
    try:
        return PROMPT_PATH.read_text(encoding="utf-8")
    except OSError:
        return (
            "Eres un analista senior de riesgo operacional Beta-PERT. "
            "Devuelve exclusivamente JSON valido con el schema solicitado."
        )


def _extract_beta_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    beta = context.get("operational_risk_beta_pert")
    if isinstance(beta, dict):
        return beta
    return payload


def _sanitize_risk(risk: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not isinstance(risk, dict):
        return None
    name = _text(risk.get("name") or risk.get("nombre_riesgo"), "", 120)
    risk_id = _text(risk.get("id"), "", 80)
    if not name and not risk_id:
        return None
    return {
        "id": risk_id,
        "name": name or "Riesgo operativo",
        "standard": _text(risk.get("standard") or risk.get("norm") or risk.get("norma_tipo"), "", 40).upper().replace(" ", ""),
        "model": _text(risk.get("model") or risk.get("modelo_usado"), "", 80),
        "process": _text(risk.get("process") or risk.get("processName") or risk.get("proceso_afectado"), "", 80),
        "description": _text(risk.get("description") or risk.get("descripcion"), "", 240),
        "expectedAnnualExposure": _round(risk.get("expectedAnnualExposure") or risk.get("expectedValue"), 2, 0),
        "p95": _round(risk.get("p95") or risk.get("peor_escenario_p95"), 2, 0),
        "criticalProbability": _round(risk.get("criticalProbability") or risk.get("probabilidad_disrupcion_critica"), 4, None),
        "status": _text(risk.get("status") or risk.get("estado"), "", 40),
        "probabilityScore": _num(risk.get("probabilityScore"), None),
        "impactScore": _num(risk.get("impactScore"), None),
        "frequency": {
            "min": _round((risk.get("frequency") or {}).get("min") or risk.get("frecuencia_min"), 2, None),
            "mode": _round((risk.get("frequency") or {}).get("mode") or (risk.get("frequency") or {}).get("mostLikely") or risk.get("frecuencia_mode"), 2, None),
            "max": _round((risk.get("frequency") or {}).get("max") or risk.get("frecuencia_max"), 2, None),
        },
        "impact": {
            "min": _round((risk.get("impact") or {}).get("min") or risk.get("impacto_min"), 2, None),
            "mode": _round((risk.get("impact") or {}).get("mode") or (risk.get("impact") or {}).get("mostLikely") or risk.get("impacto_mode"), 2, None),
            "max": _round((risk.get("impact") or {}).get("max") or risk.get("impacto_max"), 2, None),
        },
    }


def _status_rank(status: str) -> int:
    normalized = _normalize(status)
    if normalized == "critico":
        return 4
    if normalized == "alto":
        return 3
    if normalized == "medio":
        return 2
    return 1


def _risk_sort_key(risk: Dict[str, Any]):
    return (
        _status_rank(risk.get("status")),
        _num(risk.get("p95"), 0) or 0,
        _num(risk.get("criticalProbability"), 0) or 0,
        _num(risk.get("expectedAnnualExposure"), 0) or 0,
    )


def _dedupe_key(risk: Dict[str, Any]) -> str:
    return "|".join([
        _normalize(risk.get("standard")),
        _normalize(risk.get("model")),
        _normalize(risk.get("name")),
        _normalize(risk.get("process")),
    ])


def sanitize_beta_pert_payload(raw_payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = _extract_beta_payload(raw_payload if isinstance(raw_payload, dict) else {})
    risks = [_sanitize_risk(item) for item in _list(payload.get("risks"), 30)]
    risks = [item for item in risks if item]
    selected = _sanitize_risk(payload.get("selectedRisk") or {})

    by_key: Dict[str, Dict[str, Any]] = {}
    for risk in risks:
        key = _dedupe_key(risk)
        current = by_key.get(key)
        if not current or (_num(risk.get("p95"), 0) or 0) > (_num(current.get("p95"), 0) or 0):
            by_key[key] = risk
    if selected:
        by_key[_dedupe_key(selected)] = selected

    ordered = sorted(by_key.values(), key=_risk_sort_key, reverse=True)
    if selected:
        selected_key = _dedupe_key(selected)
        ordered = [by_key[selected_key]] + [item for item in ordered if _dedupe_key(item) != selected_key]
    risks = ordered[:MAX_RISKS]

    if not risks:
        raise OperationalBetaPertError("ai_invalid_payload", "Se requiere al menos un riesgo Beta-PERT valido.", 400)

    kpis = payload.get("kpis") if isinstance(payload.get("kpis"), dict) else {}
    return {
        "scope": payload.get("scope") if payload.get("scope") in {"portfolio", "simulation"} else "portfolio",
        "methodology": {
            "exposureExpectedAccumulated": "SUM(media_operativa_anual)",
            "conservativeP95": "SUM(peor_escenario_p95)",
            "criticalProbabilityAverage": "AVG(probabilidad_disrupcion_critica)",
            "warning": "El P95 agregado conservador no equivale a un P95 de portafolio simulado.",
        },
        "kpis": {
            "exposureExpectedAccumulated": _round(kpis.get("exposureExpectedAccumulated") or kpis.get("expectedExposure"), 2, 0),
            "conservativeP95": _round(kpis.get("conservativeP95"), 2, 0),
            "criticalProbabilityAverage": _round(kpis.get("criticalProbabilityAverage") or kpis.get("criticalProbability"), 4, None),
            "highPrioritizedRisks": int(_num(kpis.get("highPrioritizedRisks") or kpis.get("prioritizedHighRisks"), 0) or 0),
        },
        "selectedRisk": selected,
        "risks": risks,
    }


DOMAIN_RULES = [
    {"domain": "identidad_acceso", "keywords": ["autenticacion", "acceso", "accesos", "iam", "identidad", "privilegio", "mfa"], "iso27001": ["Control de accesos", "Autenticacion", "Gestion de identidades", "Monitoreo de accesos"], "iso9001": ["Control operacional", "Seguimiento de proceso"], "focus": "fortalecer IAM, MFA, monitoreo y contingencia de acceso"},
    {"domain": "continuidad_resiliencia", "keywords": ["respaldo", "backup", "restauracion", "continuidad", "rto", "rpo", "drp", "recuperacion"], "iso27001": ["Backup", "Continuidad", "Recuperacion", "Preparacion TIC para continuidad"], "iso9001": ["Control operacional", "Continuidad de servicio"], "focus": "probar restauraciones, revisar RTO/RPO y reforzar DRP"},
    {"domain": "cambios_qa", "keywords": ["cambio", "cambios", "liberacion", "version", "release", "rollback", "qa", "despliegue"], "iso27001": ["Gestion de cambios", "Seguridad en desarrollo", "Pruebas y rollback"], "iso9001": ["Control operacional", "Validacion de cambios", "Liberacion controlada", "Acciones correctivas"], "focus": "reforzar CAB, pipeline QA, rollback y pruebas automatizadas"},
    {"domain": "infraestructura_capacidad", "keywords": ["base de datos", "infraestructura", "capacidad", "latencia", "servidor", "disponibilidad", "vulnerabilidad"], "iso27001": ["Monitoreo", "Capacidad", "Disponibilidad", "Gestion de vulnerabilidades"], "iso9001": ["Control operacional", "Seguimiento de capacidad"], "focus": "fortalecer monitoreo, capacidad, alertas y pruebas de carga"},
    {"domain": "conocimiento_documental", "keywords": ["documentacion", "documento", "procedimiento", "versionado", "manual"], "iso27001": ["Procedimientos operativos documentados"], "iso9001": ["Informacion documentada", "Control documental", "Ownership documental"], "focus": "control documental, ownership, revision periodica y versionamiento"},
    {"domain": "respuesta_incidentes", "keywords": ["soporte", "incidente", "sla", "ticket", "mesa", "atencion", "escalamiento"], "iso27001": ["Gestion de incidentes", "Monitoreo y respuesta"], "iso9001": ["Atencion de reclamos", "Seguimiento", "Mejora"], "focus": "runbooks, escalamiento, guardias, metricas SLA y postmortems"},
    {"domain": "onboarding_calidad", "keywords": ["parametrizacion", "cliente", "implementacion", "onboarding", "entrega", "requisito"], "iso27001": ["Control de cambios y configuracion segura"], "iso9001": ["Validacion de requisitos", "Control de entrega", "Revision de conformidad"], "focus": "checklist, QA funcional, doble validacion y control de entregables"},
    {"domain": "control_operacional_backoffice", "keywords": ["conciliacion", "backoffice", "operacion manual", "revision dual", "cuadratura"], "iso27001": ["Segregacion de funciones", "Monitoreo de operaciones"], "iso9001": ["Control operacional", "Verificacion", "Revision dual"], "focus": "controles preventivos, conciliacion automatizada y segregacion"},
]


def infer_operational_domain(risk: Dict[str, Any]) -> Dict[str, Any]:
    text = _normalize(" ".join([risk.get("name", ""), risk.get("process", ""), risk.get("description", "")]))
    for rule in DOMAIN_RULES:
        if any(keyword in text for keyword in rule["keywords"]):
            standard = str(risk.get("standard") or "").upper()
            suggestions = rule["iso9001"] if "9001" in standard else rule["iso27001"]
            return {"risk_id": risk.get("id"), "risk_name": risk.get("name"), "domain": rule["domain"], "focus": rule["focus"], "iso_suggestions": suggestions}
    return {"risk_id": risk.get("id"), "risk_name": risk.get("name"), "domain": "riesgo_operacional_general", "focus": "priorizar mitigacion segun P95, probabilidad critica y recurrencia", "iso_suggestions": ["Control operacional", "Tratamiento de riesgos", "Seguimiento de eficacia"]}


def build_semantic_context(beta_payload: Dict[str, Any]) -> Dict[str, Any]:
    total_p95 = _num((beta_payload.get("kpis") or {}).get("conservativeP95"), 0) or 0
    domains = [infer_operational_domain(risk) for risk in beta_payload.get("risks", [])]
    concentration = []
    for risk in beta_payload.get("risks", [])[:MAX_RISKS]:
        p95 = _num(risk.get("p95"), 0) or 0
        contribution = round((p95 / total_p95 * 100), 2) if total_p95 > 0 else 0
        concentration.append({"risk_id": risk.get("id"), "risk_name": risk.get("name"), "p95": p95, "contribution_p95_pct": contribution})

    baseline = []
    for risk, domain in zip(beta_payload.get("risks", [])[:5], domains[:5]):
        try:
            result = search_baseline_knowledge(
                standard_code=risk.get("standard") or "ISO27001",
                topic=" ".join([domain.get("domain", ""), risk.get("process", ""), risk.get("name", "")]),
                control_description=domain.get("focus", ""),
                module_origin="operational-risk-beta-pert",
                limit=2,
            )
            if result.get("used"):
                baseline.extend(result.get("rag_context_used") or [])
        except Exception:
            continue

    risk_rules = get_knowledge_module("risk").get("risk_analysis_rules.json", {})
    return {
        "domains": domains,
        "p95_concentration": concentration[:5],
        "risk_rules": {
            "priority_factors": _list(risk_rules.get("risk_priority_factors"), 8),
            "high_priority_conditions": _list(risk_rules.get("high_priority_conditions"), 6),
            "recommended_outputs": _list(risk_rules.get("recommended_outputs"), 6),
        },
        "iso_baseline_context": baseline[:5],
    }


def build_prompt_payload(beta_payload: Dict[str, Any], semantic_context: Dict[str, Any]) -> str:
    return json.dumps({
        "task": "operational_risk_beta_pert_analysis",
        "prompt_version": PROMPT_VERSION,
        "beta_pert": beta_payload,
        "semantic_context": semantic_context,
        "required_output": {
            "diagnostico_ejecutivo": "string",
            "lectura_portafolio": "string",
            "riesgos_prioritarios": "max 3",
            "concentracion_exposicion": "top contributors by p95",
            "acciones_sugeridas": "max 5",
            "controles_iso_sugeridos": "max 5",
            "advertencias_metodologicas": "max 3",
            "proximos_pasos": "max 5",
            "prompt_version": PROMPT_VERSION,
            "source": SOURCE,
        },
    }, ensure_ascii=False, default=str)


def parse_json_candidate(value: Any) -> Optional[Dict[str, Any]]:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        return None
    text = value.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.I)
    candidates = [text, fenced.group(1) if fenced else "", text[text.find("{"): text.rfind("}") + 1] if "{" in text and "}" in text else ""]
    for candidate in [item for item in candidates if item]:
        try:
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            continue
    return None


def _first_analysis_candidate(value: Any, depth: int = 0) -> Optional[Dict[str, Any]]:
    if depth > 4 or value is None:
        return None
    parsed = parse_json_candidate(value)
    if parsed and (parsed.get("diagnostico_ejecutivo") or parsed.get("analysis") or parsed.get("structured_result") or parsed.get("answer")):
        for key in ["analysis", "structured_result", "answer"]:
            if isinstance(parsed.get(key), (dict, str)):
                candidate = _first_analysis_candidate(parsed[key], depth + 1)
                if candidate:
                    return candidate
        return parsed
    if isinstance(value, dict):
        for key in ["analysis", "result", "content", "text", "output", "data", "raw", "message", "answer", "structured_result"]:
            if key in value:
                candidate = _first_analysis_candidate(value[key], depth + 1)
                if candidate:
                    return candidate
    return None


def _has_domain_mismatch(text: Any) -> bool:
    normalized = _normalize(json.dumps(text, ensure_ascii=False, default=str) if not isinstance(text, str) else text)
    return any(_normalize(pattern) in normalized for pattern in DOMAIN_MISMATCH_PATTERNS)


def _priority(value: Any) -> str:
    normalized = _normalize(value)
    if normalized in {"critica", "alta", "media", "baja"}:
        return normalized
    return {"critical": "critica", "high": "alta", "low": "baja"}.get(normalized, "media")


def _driver(value: Any) -> str:
    normalized = _normalize(value)
    return normalized if normalized in {"p95", "probabilidad", "frecuencia", "impacto", "concentracion"} else "p95"


def _horizon(value: Any) -> str:
    normalized = _normalize(value).replace(" ", "_")
    if normalized in {"inmediato", "30_dias", "60_dias", "90_dias"}:
        return normalized
    if "inmedi" in normalized:
        return "inmediato"
    if "60" in normalized:
        return "60_dias"
    if "90" in normalized:
        return "90_dias"
    return "30_dias"


def _string_list(value: Any, limit: int) -> List[str]:
    result = []
    for item in _list(value, limit):
        text = _text(item if isinstance(item, str) else item.get("descripcion") or item.get("description") or item.get("text") or item.get("title"), "", 700)
        if text:
            result.append(text)
    return result[:limit]


def normalize_beta_pert_analysis(ai_raw: Any, beta_payload: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
    source = _first_analysis_candidate(ai_raw)
    if not source:
        raise OperationalBetaPertError("ai_invalid_response", "AI operacional Beta-PERT devolvio una respuesta no estructurada.", 502)
    if _has_domain_mismatch(source):
        raise OperationalBetaPertError("ai_domain_mismatch", "La respuesta AI corresponde a readiness documental y no a Beta-PERT operacional.", 502)

    diagnostico = _text(source.get("diagnostico_ejecutivo") or source.get("executive_summary") or source.get("diagnosis"), "", 1600)
    lectura = _text(source.get("lectura_portafolio") or source.get("portfolio_reading") or source.get("risk_portfolio_reading"), "", 1800)
    acciones = []
    for item in _list(source.get("acciones_sugeridas") or source.get("recommended_actions") or source.get("actions"), 5):
        if isinstance(item, str):
            action = _text(item, "", 700)
            if action:
                acciones.append({"accion": action, "horizonte": "30_dias", "responsable_sugerido": None, "riesgo_relacionado": None})
        elif isinstance(item, dict):
            action = _text(item.get("accion") or item.get("action") or item.get("descripcion") or item.get("description"), "", 700)
            if action:
                acciones.append({"accion": action, "horizonte": _horizon(item.get("horizonte") or item.get("horizon")), "responsable_sugerido": _text(item.get("responsable_sugerido") or item.get("owner") or item.get("responsable"), "", 180) or None, "riesgo_relacionado": _text(item.get("riesgo_relacionado") or item.get("risk") or item.get("riesgo"), "", 220) or None})
    proximos = _string_list(source.get("proximos_pasos") or source.get("next_steps"), 5)
    if not diagnostico or (not acciones and not proximos):
        raise OperationalBetaPertError("ai_invalid_response", "AI operacional Beta-PERT devolvio una respuesta incompleta.", 502)

    riesgos = []
    for item in _list(source.get("riesgos_prioritarios") or source.get("prioritized_risks") or source.get("key_risks"), 3):
        if isinstance(item, str):
            name = _text(item, "", 220)
            if name:
                riesgos.append({"nombre": name, "motivo": "Priorizado por el analisis Beta-PERT.", "prioridad": "media", "driver": "p95"})
        elif isinstance(item, dict):
            name = _text(item.get("nombre") or item.get("name") or item.get("riesgo") or item.get("risk"), "", 220)
            if name:
                riesgos.append({"nombre": name, "motivo": _text(item.get("motivo") or item.get("reason") or item.get("descripcion") or item.get("description"), "", 700), "prioridad": _priority(item.get("prioridad") or item.get("priority")), "driver": _driver(item.get("driver"))})

    concentracion = []
    for item in _list(source.get("concentracion_exposicion") or source.get("exposure_concentration"), 5):
        if isinstance(item, dict):
            risk_name = _text(item.get("riesgo") or item.get("risk") or item.get("name"), "", 220)
            if risk_name:
                concentracion.append({"riesgo": risk_name, "contribucion_p95_pct": _round(item.get("contribucion_p95_pct") or item.get("contribution_p95_pct"), 2, 0), "lectura": _text(item.get("lectura") or item.get("reading") or item.get("descripcion"), "", 500)})
    if not concentracion:
        total_p95 = _num((beta_payload.get("kpis") or {}).get("conservativeP95"), 0) or 0
        for risk in beta_payload.get("risks", [])[:3]:
            p95 = _num(risk.get("p95"), 0) or 0
            concentracion.append({"riesgo": risk.get("name"), "contribucion_p95_pct": round((p95 / total_p95 * 100), 2) if total_p95 else 0, "lectura": "Contribucion calculada sobre P95 agregado conservador."})

    controles = []
    for item in _list(source.get("controles_iso_sugeridos") or source.get("iso_controls") or source.get("controls"), 5):
        if isinstance(item, str):
            control = _text(item, "", 180)
            if control:
                controles.append({"norma": "ISO27001", "control_o_clausula": control, "descripcion": control, "riesgo_relacionado": None})
        elif isinstance(item, dict):
            standard = _text(item.get("norma") or item.get("standard"), "ISO27001", 40).upper().replace(" ", "")
            control = _text(item.get("control_o_clausula") or item.get("control") or item.get("clausula") or item.get("clause"), "", 180)
            desc = _text(item.get("descripcion") or item.get("description") or item.get("motivo"), "", 700)
            if control or desc:
                controles.append({"norma": "ISO9001" if "9001" in standard else "ISO27001", "control_o_clausula": control or "Control ISO sugerido", "descripcion": desc or control, "riesgo_relacionado": _text(item.get("riesgo_relacionado") or item.get("risk") or item.get("riesgo"), "", 220) or None})

    return {
        "diagnostico_ejecutivo": diagnostico,
        "lectura_portafolio": lectura,
        "riesgos_prioritarios": riesgos[:3],
        "concentracion_exposicion": concentracion[:5],
        "acciones_sugeridas": acciones[:5],
        "controles_iso_sugeridos": controles[:5],
        "advertencias_metodologicas": _string_list(source.get("advertencias_metodologicas") or source.get("methodology_warnings") or ["El P95 agregado conservador es suma de P95 individuales y no equivale a P95 de portafolio simulado."], 3),
        "proximos_pasos": proximos[:5],
        "efectividad_estimada_pct": _round(source.get("efectividad_estimada_pct") or source.get("estimated_effectiveness_pct"), 2, None),
        "ai_model": _text(source.get("ai_model") or metadata.get("model") or metadata.get("selected_model") or "ai-engine", "ai-engine", 120),
        "prompt_version": PROMPT_VERSION,
        "source": SOURCE,
    }


def analyze_operational_beta_pert(payload: Dict[str, Any]) -> Dict[str, Any]:
    started_at = time.perf_counter()
    tenant_id = _text(payload.get("tenant_id") or (payload.get("context") or {}).get("tenant", {}).get("tenant_id"), "", 80)
    request_id = _text((payload.get("request_metadata") or {}).get("request_id") or payload.get("request_id") or "", "", 120)
    if not tenant_id:
        raise OperationalBetaPertError("ai_invalid_payload", "tenant_id requerido.", 400)

    beta_payload = sanitize_beta_pert_payload(payload)
    options = payload.get("options") if isinstance(payload.get("options"), dict) else {}
    model_mode = str(options.get("model_mode") or payload.get("model_mode") or "fast").lower()
    if model_mode not in {"fast", "balanced", "expert", "deep"}:
        model_mode = "fast"
    llm_model_mode = "deep" if model_mode == "expert" else model_mode
    depth = str(options.get("depth") or ("deep" if llm_model_mode == "deep" else "standard"))
    if depth not in {"executive", "standard", "deep"}:
        depth = "standard"
    metadata = get_llm_metadata(depth=depth, local_compact=True, model_mode=llm_model_mode)

    print(json.dumps({"event": "operational_beta_pert_ai_start", "request_id": request_id or None, "tenant_id": tenant_id, "risks_count": len(beta_payload["risks"]), "selected_model": metadata.get("model"), "provider": metadata.get("provider")}, ensure_ascii=False, default=str))

    if not is_llm_available():
        raise OperationalBetaPertError("ai_engine_unavailable", "Motor LLM no disponible para analisis Beta-PERT.", 503)

    prompt_payload = build_prompt_payload(beta_payload, build_semantic_context(beta_payload))
    try:
        raw = call_llm_json(prompt=prompt_payload, system_prompt=_load_prompt(), temperature=0.15, timeout=90, depth=depth, local_compact=True, model_mode=llm_model_mode)
    except TimeoutError as exc:
        raise OperationalBetaPertError("ai_timeout", "AI operacional Beta-PERT excedio el tiempo de respuesta.", 504) from exc
    except Exception as exc:
        message = str(exc).lower()
        if "timeout" in message or "timed out" in message:
            raise OperationalBetaPertError("ai_timeout", "AI operacional Beta-PERT excedio el tiempo de respuesta.", 504) from exc
        raise OperationalBetaPertError("ai_engine_unavailable", f"No fue posible ejecutar AI operacional Beta-PERT: {str(exc)[:160]}", 503) from exc

    duration_ms = int((time.perf_counter() - started_at) * 1000)
    analysis = normalize_beta_pert_analysis(raw, beta_payload, metadata)
    print(json.dumps({"event": "operational_beta_pert_ai_ok", "request_id": request_id or None, "tenant_id": tenant_id, "risks_count": len(beta_payload["risks"]), "selected_model": metadata.get("model"), "provider": metadata.get("provider"), "duration_ms": duration_ms, "status": "ok"}, ensure_ascii=False, default=str))
    return {"success": True, "analysis": analysis, "metadata": {"request_id": request_id or "", "model": metadata.get("model"), "model_mode": "expert" if llm_model_mode == "deep" else llm_model_mode, "duration_ms": duration_ms, "risks_analyzed": len(beta_payload["risks"]), "generated_at": datetime.now(timezone.utc).isoformat()}}


def error_response(error: Exception) -> Dict[str, Any]:
    if isinstance(error, OperationalBetaPertError):
        return {"success": False, "code": error.code, "message": error.message, "guardable": False}
    return {"success": False, "code": "ai_unknown_error", "message": "No fue posible generar el analisis AI operacional Beta-PERT.", "guardable": False}
