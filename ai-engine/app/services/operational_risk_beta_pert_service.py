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
GENERATION_MODE = "semantic_plus_llm"
BASE_DIR = Path(__file__).resolve().parents[2]
PROMPT_PATH = BASE_DIR / "prompts" / "operational_risk_beta_pert_v1.md"
MAX_RISKS = 5

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


def _unique_texts(items: List[str], limit: int = 8) -> List[str]:
    result = []
    seen = set()
    for item in items:
        text = _text(item, "", 700)
        key = _normalize(text)
        if text and key and key not in seen:
            seen.add(key)
            result.append(text)
        if len(result) >= limit:
            break
    return result


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
    ranked_risks = sorted(beta_payload.get("risks", []), key=_risk_sort_key, reverse=True)
    concentration = []
    prioritized = []
    controls = []
    base_actions = []
    next_steps = [
        "Validar owner operativo y umbral critico de los riesgos priorizados.",
        "Revisar si las simulaciones duplicadas deben consolidarse antes de decisiones ejecutivas.",
        "Definir plan de tratamiento para los riesgos con mayor P95 o probabilidad critica.",
    ]

    for risk in ranked_risks[:MAX_RISKS]:
        domain = infer_operational_domain(risk)
        p95 = _num(risk.get("p95"), 0) or 0
        critical_probability = _num(risk.get("criticalProbability"), 0) or 0
        contribution = round((p95 / total_p95 * 100), 2) if total_p95 > 0 else 0
        driver = "p95"
        if critical_probability >= 0.5:
            driver = "probabilidad"
        elif contribution >= 30:
            driver = "concentracion"
        elif _num((risk.get("frequency") or {}).get("mode"), 0) and (_num((risk.get("frequency") or {}).get("mode"), 0) or 0) >= 5:
            driver = "frecuencia"

        priority = "media"
        if _status_rank(risk.get("status")) >= 4 or (p95 >= 120 and critical_probability >= 0.3):
            priority = "critica"
        elif _status_rank(risk.get("status")) >= 3 or p95 >= 60 or critical_probability >= 0.3:
            priority = "alta"
        elif p95 < 24 and critical_probability < 0.15:
            priority = "baja"

        prioritized.append({
            "nombre": risk.get("name"),
            "motivo": f"P95 {round(p95, 2)} y probabilidad critica {round(critical_probability * 100, 2)}%.",
            "prioridad": priority,
            "driver": driver,
        })
        concentration.append({
            "riesgo": risk.get("name"),
            "contribucion_p95_pct": contribution,
            "lectura": "Contribucion calculada sobre P95 agregado conservador.",
        })
        for suggestion in domain.get("iso_suggestions", [])[:2]:
            standard = "ISO9001" if "9001" in str(risk.get("standard") or "") else "ISO27001"
            controls.append({
                "norma": standard,
                "control_o_clausula": suggestion,
                "descripcion": f"Aplicar {suggestion.lower()} para reducir exposicion operacional en {risk.get('name')}.",
                "riesgo_relacionado": risk.get("name"),
            })
        horizon = "inmediato" if priority == "critica" else "30_dias" if priority == "alta" else "60_dias"
        base_actions.append({
            "accion": f"{domain.get('focus')} para {risk.get('name')}.",
            "horizonte": horizon,
            "responsable_sugerido": "Responsable del proceso",
            "riesgo_relacionado": risk.get("name"),
        })

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
        "riesgos_prioritarios": prioritized[:3],
        "concentracion_exposicion": concentration[:5],
        "controles_iso_sugeridos": controls[:5],
        "acciones_base_sugeridas": base_actions[:5],
        "advertencias_metodologicas": [
            "El P95 agregado conservador es suma de P95 individuales y no equivale a P95 de portafolio simulado.",
            "La priorizacion combina estado, P95 individual, probabilidad critica y contribucion al total conservador.",
        ],
        "proximos_pasos_base": next_steps[:5],
        "lectura_cuantitativa_base": {
            "riesgos_analizados": len(beta_payload.get("risks", [])),
            "exposicion_esperada_acumulada": (beta_payload.get("kpis") or {}).get("exposureExpectedAccumulated"),
            "p95_agregado_conservador": total_p95,
            "probabilidad_critica_promedio": (beta_payload.get("kpis") or {}).get("criticalProbabilityAverage"),
            "riesgos_altos_priorizados": (beta_payload.get("kpis") or {}).get("highPrioritizedRisks"),
        },
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
        "instruction": "Genera solo una sintesis ejecutiva corta. No calcules controles, concentracion ni riesgos prioritarios; esos campos los completa el servicio.",
        "kpis": beta_payload.get("kpis"),
        "selectedRisk": beta_payload.get("selectedRisk"),
        "risks": beta_payload.get("risks", [])[:MAX_RISKS],
        "semantic_summary": {
            "dominios_operacionales": semantic_context.get("domains", [])[:MAX_RISKS],
            "lectura_cuantitativa_base": semantic_context.get("lectura_cuantitativa_base"),
            "advertencia_p95": semantic_context.get("advertencias_metodologicas", [None])[0],
        },
        "required_output": {
            "diagnostico_ejecutivo": "string",
            "lectura_portafolio": "string",
            "acciones_sugeridas": ["string"],
            "proximos_pasos": ["string"],
            "advertencia_metodologica": "string",
        },
    }, ensure_ascii=False, default=str)


def _safe_response_text(value: Any, max_len: int = 2000) -> str:
    if isinstance(value, str):
        raw = value
    else:
        raw = json.dumps(value, ensure_ascii=False, default=str)
    raw = re.sub(r"(?i)(token|secret|password|api[_-]?key)\s*[:=]\s*[^,\s}]+", r"\1=[redacted]", raw)
    return re.sub(r"\s+", " ", raw).strip()[:max_len]


def _balanced_json_candidates(text: str) -> List[str]:
    candidates = []
    start = -1
    depth = 0
    in_string = False
    escaped = False
    for index, char in enumerate(text):
        if escaped:
            escaped = False
            continue
        if char == "\\":
            escaped = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            if depth == 0:
                start = index
            depth += 1
        elif char == "}" and depth > 0:
            depth -= 1
            if depth == 0 and start >= 0:
                candidates.append(text[start:index + 1])
                start = -1
    return candidates


def parse_json_candidate(value: Any) -> Optional[Dict[str, Any]]:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        return None
    text = value.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.I)
    candidates = [
        text,
        fenced.group(1) if fenced else "",
        text[text.find("{"): text.rfind("}") + 1] if "{" in text and "}" in text else "",
        *_balanced_json_candidates(text),
    ]
    for candidate in [item for item in candidates if item]:
        try:
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            continue
    return None


def _decode_jsonish_string(value: str) -> str:
    try:
        return json.loads(f'"{value}"')
    except Exception:
        return value.replace('\\"', '"').replace("\\n", "\n").replace("\\t", "\t")


def _extract_jsonish_string_field(text: str, field: str) -> str:
    pattern = rf'"{re.escape(field)}"\s*:\s*"((?:\\.|[^"\\])*)'
    match = re.search(pattern, text, re.S)
    if not match:
        return ""
    return _text(_decode_jsonish_string(match.group(1)), "", 1600)


def _extract_jsonish_string_array(text: str, field: str, limit: int = 3) -> List[str]:
    match = re.search(rf'"{re.escape(field)}"\s*:\s*\[([\s\S]*?)(?:\]|$)', text)
    if not match:
        return []
    values = []
    for item in re.findall(r'"((?:\\.|[^"\\])*)"', match.group(1)):
        decoded = _text(_decode_jsonish_string(item), "", 700)
        if decoded:
            values.append(decoded)
        if len(values) >= limit:
            break
    return values


def extract_beta_summary_fields_from_text(text: str) -> Optional[Dict[str, Any]]:
    if not isinstance(text, str) or not text.strip():
        return None
    extracted = {
        "diagnostico_ejecutivo": _extract_jsonish_string_field(text, "diagnostico_ejecutivo"),
        "lectura_portafolio": _extract_jsonish_string_field(text, "lectura_portafolio"),
        "advertencia_metodologica": _extract_jsonish_string_field(text, "advertencia_metodologica"),
        "acciones_sugeridas": _extract_jsonish_string_array(text, "acciones_sugeridas", 3),
        "proximos_pasos": _extract_jsonish_string_array(text, "proximos_pasos", 3),
    }
    if extracted["diagnostico_ejecutivo"] or extracted["lectura_portafolio"]:
        return {key: value for key, value in extracted.items() if value}
    return None


def _has_llm_summary_fields(value: Any) -> bool:
    return isinstance(value, dict) and bool(value.get("diagnostico_ejecutivo") or value.get("lectura_portafolio"))


def extract_llm_payload(value: Any, max_depth: int = 5) -> Dict[str, Any]:
    wrapper_keys = ["answer", "analysis", "result", "content", "text", "output", "message", "data", "raw", "structured_result"]
    seen_ids = set()

    def walk(node: Any, depth: int, keys_seen: List[str]) -> Dict[str, Any]:
        if depth > max_depth:
            return {"payload": None, "unwrap_depth": depth, "wrapper_keys_seen": keys_seen, "has_json_candidate": False}

        marker = id(node) if isinstance(node, (dict, list)) else None
        if marker is not None:
            if marker in seen_ids:
                return {"payload": None, "unwrap_depth": depth, "wrapper_keys_seen": keys_seen, "has_json_candidate": False}
            seen_ids.add(marker)

        parsed = parse_json_candidate(node) if isinstance(node, str) else node
        has_json_candidate = isinstance(parsed, dict)

        if _has_llm_summary_fields(parsed):
            return {
                "payload": parsed,
                "unwrap_depth": depth,
                "wrapper_keys_seen": keys_seen,
                "has_json_candidate": True,
            }

        if isinstance(parsed, dict):
            for key in wrapper_keys:
                if key not in parsed:
                    continue
                child = parsed.get(key)
                if not isinstance(child, (dict, str)):
                    continue
                result = walk(child, depth + 1, [*keys_seen, key])
                if result.get("payload"):
                    return {
                        **result,
                        "has_json_candidate": True,
                    }
                has_json_candidate = has_json_candidate or bool(result.get("has_json_candidate"))

        if isinstance(node, str):
            recovered = extract_beta_summary_fields_from_text(node)
            if recovered:
                return {
                    "payload": recovered,
                    "unwrap_depth": depth,
                    "wrapper_keys_seen": keys_seen,
                    "has_json_candidate": has_json_candidate or "{" in node,
                    "parse_recovery_mode": "field_extraction",
                }

        return {
            "payload": None,
            "unwrap_depth": depth,
            "wrapper_keys_seen": keys_seen,
            "has_json_candidate": has_json_candidate,
            "parse_recovery_mode": None,
        }

    return walk(value, 0, [])


def _log_parse_observation(
    ai_raw: Any,
    source: Optional[Dict[str, Any]],
    metadata: Dict[str, Any],
    trace_context: Optional[Dict[str, Any]],
    parse_error_code: Optional[str],
    missing_required_fields: Optional[List[str]] = None,
    unwrap_info: Optional[Dict[str, Any]] = None,
) -> None:
    trace_context = trace_context or {}
    unwrap_info = unwrap_info or {}
    response_text = _safe_response_text(ai_raw)
    print(json.dumps({
        "event": "operational_beta_pert_ai_parse",
        "parse_status": "error" if parse_error_code else "ok",
        "request_id": trace_context.get("request_id"),
        "tenant_id": trace_context.get("tenant_id"),
        "model": metadata.get("model") or metadata.get("selected_model"),
        "duration_ms": trace_context.get("duration_ms"),
        "response_type": type(ai_raw).__name__,
        "response_length": len(response_text),
        "parse_error_code": parse_error_code,
        "parse_recovery_mode": unwrap_info.get("parse_recovery_mode"),
        "missing_required_fields": missing_required_fields or [],
        "unwrap_depth": unwrap_info.get("unwrap_depth", 0),
        "wrapper_keys_seen": unwrap_info.get("wrapper_keys_seen", []),
        "has_diagnostico": bool(source and source.get("diagnostico_ejecutivo")),
        "has_lectura": bool(source and source.get("lectura_portafolio")),
        "has_json_candidate": source is not None or bool(unwrap_info.get("has_json_candidate")) or parse_json_candidate(ai_raw) is not None,
        "first_120_chars_sanitized": response_text[:120],
    }, ensure_ascii=False, default=str))


def _has_domain_mismatch(text: Any) -> bool:
    normalized = _normalize(json.dumps(text, ensure_ascii=False, default=str) if not isinstance(text, str) else text)
    return any(_normalize(pattern) in normalized for pattern in DOMAIN_MISMATCH_PATTERNS)


def _has_operational_summary_signal(value: Dict[str, Any]) -> bool:
    text = _normalize(" ".join([
        str(value.get("diagnostico_ejecutivo") or ""),
        str(value.get("lectura_portafolio") or ""),
    ]))
    return any(token in text for token in [
        "p95",
        "riesgo",
        "riesgos",
        "operacional",
        "operativa",
        "exposicion",
        "probabilidad",
        "portafolio",
        "impacto",
        "frecuencia",
        "proceso",
        "beta",
        "pert",
    ])


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


def normalize_beta_pert_analysis(
    ai_raw: Any,
    beta_payload: Dict[str, Any],
    metadata: Dict[str, Any],
    semantic_context: Optional[Dict[str, Any]] = None,
    trace_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    semantic_context = semantic_context or build_semantic_context(beta_payload)
    unwrap_info = extract_llm_payload(ai_raw)
    source = unwrap_info.get("payload")
    if not source:
        _log_parse_observation(
            ai_raw,
            None,
            metadata,
            trace_context,
            "ai_invalid_response",
            ["json_candidate"],
            unwrap_info,
        )
        raise OperationalBetaPertError("ai_invalid_response", "AI operacional Beta-PERT devolvio una respuesta no estructurada.", 502)
    if _has_domain_mismatch(source):
        _log_parse_observation(
            ai_raw,
            source,
            metadata,
            trace_context,
            "ai_domain_mismatch",
            [],
            unwrap_info,
        )
        raise OperationalBetaPertError("ai_domain_mismatch", "La respuesta AI corresponde a readiness documental y no a Beta-PERT operacional.", 502)
    if unwrap_info.get("parse_recovery_mode") == "field_extraction" and not _has_operational_summary_signal(source):
        _log_parse_observation(
            ai_raw,
            source,
            metadata,
            trace_context,
            "ai_invalid_response",
            ["operational_summary_signal"],
            unwrap_info,
        )
        raise OperationalBetaPertError("ai_invalid_response", "AI operacional Beta-PERT no entrego una sintesis operacional util.", 502)

    diagnostico = _text(source.get("diagnostico_ejecutivo") or source.get("executive_summary") or source.get("diagnosis"), "", 1600)
    lectura = _text(source.get("lectura_portafolio") or source.get("portfolio_reading") or source.get("risk_portfolio_reading"), "", 1800)
    missing = []
    if not diagnostico and not lectura:
        missing.append("diagnostico_ejecutivo_or_lectura_portafolio")
    if missing:
        _log_parse_observation(ai_raw, source, metadata, trace_context, "ai_invalid_response", missing, unwrap_info)
        raise OperationalBetaPertError("ai_invalid_response", "AI operacional Beta-PERT no entrego una sintesis util.", 502)

    acciones = []
    for item in _list(source.get("acciones_sugeridas") or source.get("recommended_actions") or source.get("actions"), 3):
        if isinstance(item, str):
            action = _text(item, "", 700)
            if action:
                acciones.append({"accion": action, "horizonte": "30_dias", "responsable_sugerido": None, "riesgo_relacionado": None})
        elif isinstance(item, dict):
            action = _text(item.get("accion") or item.get("action") or item.get("descripcion") or item.get("description"), "", 700)
            if action:
                acciones.append({"accion": action, "horizonte": _horizon(item.get("horizonte") or item.get("horizon")), "responsable_sugerido": _text(item.get("responsable_sugerido") or item.get("owner") or item.get("responsable"), "", 180) or None, "riesgo_relacionado": _text(item.get("riesgo_relacionado") or item.get("risk") or item.get("riesgo"), "", 220) or None})
    base_actions = _list(semantic_context.get("acciones_base_sugeridas"), 5)
    merged_actions = []
    seen_actions = set()
    for action in [*acciones, *base_actions]:
        if not isinstance(action, dict):
            continue
        action_text = _text(action.get("accion"), "", 700)
        key = _normalize(action_text)
        if action_text and key not in seen_actions:
            seen_actions.add(key)
            merged_actions.append({
                "accion": action_text,
                "horizonte": _horizon(action.get("horizonte")),
                "responsable_sugerido": _text(action.get("responsable_sugerido"), "", 180) or None,
                "riesgo_relacionado": _text(action.get("riesgo_relacionado"), "", 220) or None,
            })
        if len(merged_actions) >= 5:
            break

    llm_next_steps = _string_list(source.get("proximos_pasos") or source.get("next_steps"), 3)
    proximos = _unique_texts([*llm_next_steps, *_list(semantic_context.get("proximos_pasos_base"), 5)], 5)
    advertencia_llm = _text(source.get("advertencia_metodologica") or source.get("methodology_warning"), "", 700)
    advertencias = _unique_texts([
        *(_list(semantic_context.get("advertencias_metodologicas"), 3)),
        advertencia_llm,
    ], 3)
    _log_parse_observation(ai_raw, source, metadata, trace_context, None, [], unwrap_info)

    return {
        "diagnostico_ejecutivo": diagnostico,
        "lectura_portafolio": lectura,
        "riesgos_prioritarios": _list(semantic_context.get("riesgos_prioritarios"), 3),
        "concentracion_exposicion": _list(semantic_context.get("concentracion_exposicion"), 5),
        "acciones_sugeridas": merged_actions[:5],
        "controles_iso_sugeridos": _list(semantic_context.get("controles_iso_sugeridos"), 5),
        "advertencias_metodologicas": advertencias,
        "proximos_pasos": proximos[:5],
        "efectividad_estimada_pct": _round(source.get("efectividad_estimada_pct") or source.get("estimated_effectiveness_pct"), 2, None),
        "ai_model": _text(source.get("ai_model") or metadata.get("model") or metadata.get("selected_model") or "ai-engine", "ai-engine", 120),
        "prompt_version": PROMPT_VERSION,
        "source": SOURCE,
        "generation_mode": GENERATION_MODE,
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

    semantic_context = build_semantic_context(beta_payload)
    prompt_payload = build_prompt_payload(beta_payload, semantic_context)
    try:
        raw = call_llm_json(
            prompt=prompt_payload,
            system_prompt=_load_prompt(),
            temperature=0.1,
            timeout=75,
            depth=depth,
            local_compact=True,
            model_mode=llm_model_mode,
            response_contract_instruction="Devuelve JSON valido directo con diagnostico_ejecutivo, lectura_portafolio, acciones_sugeridas, proximos_pasos y advertencia_metodologica. No uses wrapper answer. No uses wrapper structured_result. No uses markdown ni texto fuera del JSON.",
            append_default_json_contract=False,
        )
    except TimeoutError as exc:
        raise OperationalBetaPertError("ai_timeout", "AI operacional Beta-PERT excedio el tiempo de respuesta.", 504) from exc
    except Exception as exc:
        message = str(exc).lower()
        if "timeout" in message or "timed out" in message:
            raise OperationalBetaPertError("ai_timeout", "AI operacional Beta-PERT excedio el tiempo de respuesta.", 504) from exc
        raise OperationalBetaPertError("ai_engine_unavailable", f"No fue posible ejecutar AI operacional Beta-PERT: {str(exc)[:160]}", 503) from exc

    duration_ms = int((time.perf_counter() - started_at) * 1000)
    analysis = normalize_beta_pert_analysis(raw, beta_payload, metadata, semantic_context, {"request_id": request_id or None, "tenant_id": tenant_id, "duration_ms": duration_ms})
    print(json.dumps({"event": "operational_beta_pert_ai_ok", "request_id": request_id or None, "tenant_id": tenant_id, "risks_count": len(beta_payload["risks"]), "selected_model": metadata.get("model"), "provider": metadata.get("provider"), "duration_ms": duration_ms, "status": "ok"}, ensure_ascii=False, default=str))
    return {"success": True, "analysis": analysis, "metadata": {"request_id": request_id or "", "model": metadata.get("model"), "model_mode": "expert" if llm_model_mode == "deep" else llm_model_mode, "duration_ms": duration_ms, "risks_analyzed": len(beta_payload["risks"]), "generated_at": datetime.now(timezone.utc).isoformat()}}


def error_response(error: Exception) -> Dict[str, Any]:
    if isinstance(error, OperationalBetaPertError):
        return {"success": False, "code": error.code, "message": error.message, "guardable": False}
    return {"success": False, "code": "ai_unknown_error", "message": "No fue posible generar el analisis AI operacional Beta-PERT.", "guardable": False}
