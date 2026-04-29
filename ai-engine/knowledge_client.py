import json
import os
import re
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://192.168.100.120:3000").rstrip("/")
AI_INTERNAL_TOKEN = os.getenv("AI_INTERNAL_TOKEN", "tecdex_ai_internal_2026")
KNOWLEDGE_TIMEOUT = int(os.getenv("KNOWLEDGE_TIMEOUT", "15"))

STOPWORDS_ES = {
    "de",
    "del",
    "la",
    "las",
    "el",
    "los",
    "y",
    "o",
    "para",
    "por",
    "con",
    "sin",
    "en",
    "una",
    "un",
    "que",
    "se",
    "no",
    "al",
    "lo",
    "relacionada",
    "relacionado",
    "clausula",
    "cláusula",
    "nc",
    "hallazgo",
    "control",
    "controles",
    "tipo",
    "estado",
}


def _post_json(url: str, payload: dict) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-ai-internal-token": AI_INTERNAL_TOKEN,
        },
    )

    try:
        with urlopen(req, timeout=KNOWLEDGE_TIMEOUT) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw)
    except HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTPError consultando conocimiento: {e.code} {detail}")
    except URLError as e:
        raise RuntimeError(f"URLError consultando conocimiento: {e}")
    except Exception as e:
        raise RuntimeError(f"Error consultando conocimiento: {e}")


def fetch_knowledge_hits(
    question: str,
    tenant_standards=None,
    standard_code=None,
    limit: int = 5,
    include_drafts: bool = False,
):
    payload = {
        "q": question,
        "tenant_standards": tenant_standards or [],
        "standard_code": standard_code,
        "limit": limit,
        "include_drafts": include_drafts,
    }

    data = _post_json(
        f"{BACKEND_API_URL}/api/ai-compliance/knowledge/internal-search",
        payload,
    )

    if not data.get("ok"):
        raise RuntimeError(data.get("error", "Respuesta inválida de conocimiento"))

    return data.get("data", [])


def summarize_sources(hits):
    sources = []
    for h in hits:
        sources.append(
            {
                "record_id": h.get("record_id"),
                "norma": h.get("norma"),
                "clausula_o_control": h.get("clausula_o_control"),
                "titulo": h.get("titulo"),
                "is_draft": h.get("is_draft", False),
            }
        )
    return sources


def build_context_block(hits, max_items: int = 4) -> str:
    if not hits:
        return "Sin contexto documental global relevante."

    lines = []
    for i, h in enumerate(hits[:max_items], start=1):
        lines.append(
            "\n".join(
                [
                    f"[FUENTE {i}]",
                    f"Norma: {h.get('norma', '-')}",
                    f"Cláusula/control: {h.get('clausula_o_control', '-')}",
                    f"Título: {h.get('titulo', '-')}",
                    f"Resumen: {h.get('descripcion_resumen', '-')}",
                    f"Qué exige: {h.get('que_exige', '-')}",
                    f"Evidencias: {'; '.join(h.get('ejemplos_evidencia', [])) or '-'}",
                    f"Hallazgos típicos: {'; '.join(h.get('hallazgos_tipicos', [])) or '-'}",
                    f"Acciones correctivas: {'; '.join(h.get('acciones_correctivas_sugeridas', [])) or '-'}",
                    f"Draft: {'sí' if h.get('is_draft') else 'no'}",
                ]
            )
        )
    return "\n\n".join(lines)


def _dedupe_strings(items, limit=4):
    out = []
    seen = set()
    for item in items:
        if not item:
            continue
        value = str(item).strip()
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(value)
        if len(out) >= limit:
            break
    return out


def _priority_from_severity(severity: str) -> str:
    sev = str(severity or "").strip().lower()
    if sev in ("alta", "high", "critical", "critico", "crítico"):
        return "alta"
    if sev in ("baja", "low"):
        return "baja"
    return "media"


def _normalize_text(value) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text


def _extract_clause_candidates(*values) -> list:
    clauses = []
    seen = set()

    patterns = [
        r"\b(?:clausula|clause)\s*(a\.\d+(?:\.\d+)?|\d+(?:\.\d+)*)\b",
        r"\b(a\.\d+(?:\.\d+)?)\b",
        r"\b(\d+(?:\.\d+)*)\b",
    ]

    for value in values:
        text = _normalize_text(value)
        if not text:
            continue

        for pattern in patterns:
            for match in re.findall(pattern, text):
                clause = str(match).upper()
                if clause in seen:
                    continue
                seen.add(clause)
                clauses.append(clause)

    return clauses


def _tokenize_keywords(*values) -> list:
    tokens = []
    seen = set()

    for value in values:
        text = _normalize_text(value)
        if not text:
            continue

        parts = re.findall(r"[a-z0-9./-]+", text)
        for part in parts:
            if len(part) < 3:
                continue
            if part in STOPWORDS_ES:
                continue
            if part in seen:
                continue
            seen.add(part)
            tokens.append(part)

    return tokens


def _expand_nonconformity_terms(title: str, description: str, category: str = "", control_description: str = "") -> list:
    base = " ".join([title or "", description or "", category or "", control_description or ""])
    text = _normalize_text(base)

    extra = []

    supplier_terms = [
        "proveedor",
        "proveedores",
        "supplier",
        "suppliers",
        "vendor",
        "vendors",
        "third party",
        "third-party",
        "tercero",
        "terceros",
        "subprocesador",
        "subprocesadores",
        "outsourcing",
        "contratista",
        "contratistas",
    ]

    if any(term in text for term in supplier_terms):
        extra.extend(
            [
                "proveedor",
                "proveedores",
                "supplier",
                "vendor",
                "third party",
                "tercero",
                "terceros",
                "due diligence",
                "evaluacion de proveedores",
                "evaluación de proveedores",
                "gestion de terceros",
                "gestión de terceros",
                "contratos",
                "homologacion",
                "homologación",
            ]
        )

    access_terms = ["mfa", "acceso", "auth", "autenticacion", "autenticación", "identity", "identidad"]
    if any(term in text for term in access_terms):
        extra.extend(
            [
                "mfa",
                "autenticacion",
                "autenticación",
                "identity access",
                "iam",
                "access control",
            ]
        )

    soa_terms = ["soa", "statement of applicability", "aplicabilidad", "annex a", "anexo a"]
    if any(term in text for term in soa_terms):
        extra.extend(
            [
                "soa",
                "statement of applicability",
                "annex a",
                "anexo a",
                "plan de tratamiento",
                "risk treatment",
            ]
        )

    return _dedupe_strings(extra, limit=20)


def _build_nonconformity_question(payload: dict) -> str:
    iso_code = payload.get("iso_code") or ""
    title = payload.get("title") or ""
    description = payload.get("description") or ""
    severity = payload.get("severity") or ""
    clause = payload.get("clause") or ""
    category = payload.get("category") or ""
    control_description = payload.get("control_description") or ""

    clause_candidates = _extract_clause_candidates(title, description, clause, category)
    keywords = _tokenize_keywords(title, description, category, control_description)
    expanded_terms = _expand_nonconformity_terms(title, description, category, control_description)

    important_terms = []
    important_terms.extend(clause_candidates[:3])
    important_terms.extend(keywords[:10])
    important_terms.extend(expanded_terms[:10])

    parts = [
        iso_code,
        f"clausula {clause}" if clause else "",
        category,
        control_description,
        title,
        description,
        " ".join(important_terms),
        "que exige",
        "evidencia objetiva",
        "hallazgos tipicos",
        "acciones correctivas sugeridas",
    ]

    return " | ".join([p for p in parts if p])


def _score_nonconformity_hit(hit: dict, payload: dict) -> float:
    score = 0.0

    clause_candidates = _extract_clause_candidates(
        payload.get("title"),
        payload.get("description"),
        payload.get("clause"),
        payload.get("category"),
    )
    hit_clause = str(hit.get("clausula_o_control") or "").upper()
    hit_text = " ".join(
        [
            str(hit.get("titulo") or ""),
            str(hit.get("descripcion_resumen") or ""),
            str(hit.get("que_exige") or ""),
            " ".join(hit.get("palabras_clave_tags") or []),
            " ".join(hit.get("related_norms") or []),
            hit_clause,
        ]
    )
    hit_text_norm = _normalize_text(hit_text)

    # 1. Prioridad fuerte por cláusula exacta
    for clause in clause_candidates:
        clause_norm = _normalize_text(clause)
        if not clause_norm:
            continue

        if hit_clause == clause.upper():
            score += 25.0
        elif _normalize_text(hit_clause).startswith(clause_norm):
            score += 18.0
        elif f"clausula {clause_norm}" in hit_text_norm:
            score += 12.0

    # 2. Coincidencia por control/título/descripción
    keyword_terms = _tokenize_keywords(
        payload.get("title"),
        payload.get("description"),
        payload.get("category"),
        payload.get("control_description"),
    )

    for term in keyword_terms[:15]:
        if term and term in hit_text_norm:
            score += 2.5

    # 3. Coincidencia por dominio específico
    domain_terms = _expand_nonconformity_terms(
        payload.get("title") or "",
        payload.get("description") or "",
        payload.get("category") or "",
        payload.get("control_description") or "",
    )

    for term in domain_terms[:15]:
        term_norm = _normalize_text(term)
        if term_norm and term_norm in hit_text_norm:
            score += 4.0

    # 4. Aprovechar ranking base del backend
    score += float(hit.get("final_rank") or 0.0) * 10.0

    return score


def _rerank_nonconformity_hits(hits: list, payload: dict) -> list:
    scored = []
    for hit in hits:
        scored.append((hit, _score_nonconformity_hit(hit, payload)))

    scored.sort(key=lambda item: item[1], reverse=True)
    return [item[0] for item in scored]


def generate_health_summary(payload: dict) -> dict:
    standards = payload.get("standards") or []
    tenant_name = payload.get("tenant_name", "Cliente")

    question = " ".join(
        [
            "resumen de salud cumplimiento",
            " ".join(standards),
            "evidencias pendientes",
            "hallazgos críticos",
            "controles en atención",
        ]
    )

    hits = fetch_knowledge_hits(
        question=question,
        tenant_standards=standards,
        limit=4,
        include_drafts=False,
    )

    controls_total = int(payload.get("controls_total", 0))
    controls_warning = int(payload.get("controls_warning", 0))
    controls_critical = int(payload.get("controls_critical", 0))
    evidences_pending = int(payload.get("evidences_pending", 0))
    findings_critical = int(payload.get("findings_critical", 0))

    context_summary = (
        f"{tenant_name} mantiene {controls_total} controles dentro del alcance activo. "
        f"Hoy existen {controls_warning} controles en atención, {controls_critical} deteriorados, "
        f"{evidences_pending} evidencias pendientes y {findings_critical} hallazgos críticos."
    )

    extra_actions = []
    for h in hits:
        extra_actions.extend(h.get("acciones_correctivas_sugeridas", []))

    suggestions = _dedupe_strings(
        [
            f"Regularizar {evidences_pending} evidencias pendientes, priorizando los controles con mayor impacto.",
            f"Revisar {controls_warning} controles en atención y validar responsables y fechas de cierre.",
            *extra_actions,
        ],
        limit=5,
    )

    return {
        "ok": True,
        "type": "health_summary",
        "summary": context_summary,
        "suggestions": suggestions,
        "confidence": "media",
        "source": "ai-engine-knowledge",
        "knowledge_sources": summarize_sources(hits),
        "knowledge_context": build_context_block(hits),
    }


def generate_finding_analysis(payload: dict) -> dict:
    iso_code = payload.get("iso_code")
    title = payload.get("title", "")
    description = payload.get("description", "")
    severity = payload.get("severity", "media")

    question = " | ".join(
        [
            str(iso_code or ""),
            str(title or ""),
            str(description or ""),
            "hallazgos tipicos",
            "acciones correctivas sugeridas",
            "evidencia objetiva",
        ]
    )

    hits = fetch_knowledge_hits(
        question=question,
        tenant_standards=[iso_code] if iso_code else [],
        standard_code=iso_code,
        limit=4,
        include_drafts=False,
    )

    primary = hits[0] if hits else {}

    summary = primary.get("descripcion_resumen") or (
        f"El hallazgo reportado en {iso_code or 'la norma aplicable'} requiere revisar "
        f"el cumplimiento del requisito vinculado y su evidencia objetiva."
    )

    impact = primary.get("que_exige") or (
        "La desviación puede afectar la trazabilidad, la demostración de cumplimiento y el cierre formal del requisito."
    )

    likely_causes = _dedupe_strings(
        primary.get("hallazgos_tipicos", [])
        or [
            "Criterio aplicable insuficientemente interpretado.",
            "Evidencia no vinculada al requisito específico.",
            "Tratamiento documental incompleto o desactualizado.",
        ],
        limit=4,
    )

    recommended_actions = _dedupe_strings(
        primary.get("acciones_correctivas_sugeridas", [])
        or [
            "Relacionar el hallazgo con el requisito exacto.",
            "Reunir evidencia objetiva suficiente y vigente.",
            "Asignar responsable y fecha de cierre.",
        ],
        limit=5,
    )

    return {
        "ok": True,
        "type": "finding_analysis",
        "summary": summary,
        "impact": impact,
        "priority": _priority_from_severity(severity),
        "likely_causes": likely_causes,
        "recommended_actions": recommended_actions,
        "confidence": "media",
        "source": "ai-engine-knowledge",
        "knowledge_sources": summarize_sources(hits),
        "knowledge_context": build_context_block(hits),
    }


def generate_nonconformity_draft(payload: dict) -> dict:
    iso_code = payload.get("iso_code")
    title = payload.get("title", "No conformidad")
    description = payload.get("description", "")
    severity = payload.get("severity", "media")

    question = _build_nonconformity_question(payload)

    raw_hits = fetch_knowledge_hits(
        question=question,
        tenant_standards=[iso_code] if iso_code else [],
        standard_code=iso_code,
        limit=12,
        include_drafts=False,
    )

    hits = _rerank_nonconformity_hits(raw_hits, payload)
    primary = hits[0] if hits else {}

    clause_or_title = primary.get("clausula_o_control") or title

    statement = (
        f"Se evidencia una desviación respecto de {iso_code or 'la norma aplicable'} "
        f"relacionada con {clause_or_title}. "
        f"{primary.get('descripcion_resumen') or description or 'No se demuestra en forma suficiente el cumplimiento del requisito.'}"
    )

    objective_evidence = "; ".join(primary.get("ejemplos_evidencia", [])) or (
        "Debe presentarse evidencia objetiva vigente, trazable y suficiente."
    )

    risk_statement = primary.get("que_exige") or (
        "La ausencia o debilidad del control puede comprometer la conformidad del sistema y dificultar el cierre de auditoría."
    )

    corrective_actions = _dedupe_strings(
        primary.get("acciones_correctivas_sugeridas", [])
        or [
            "Corregir la desviación identificada.",
            "Actualizar el control o documento afectado.",
            "Vincular evidencia objetiva suficiente al requisito.",
        ],
        limit=4,
    )

    immediate_correction = corrective_actions[0] if corrective_actions else "Corregir la desviación identificada."
    corrective_action = " | ".join(corrective_actions[:3])

    return {
        "ok": True,
        "type": "nonconformity_draft",
        "draft_title": f"Borrador IA - {title}",
        "statement": statement,
        "objective_evidence": objective_evidence,
        "risk_statement": risk_statement,
        "immediate_correction": immediate_correction,
        "corrective_action": corrective_action,
        "confidence": _priority_from_severity(severity),
        "source": "ai-engine-knowledge",
        "knowledge_sources": summarize_sources(hits),
        "knowledge_context": build_context_block(hits),
    }


def generate_action_plan(payload: dict) -> dict:
    iso_code = payload.get("iso_code")
    title = payload.get("title", "Plan de acción")
    description = payload.get("description", "")
    severity = payload.get("severity", "media")

    question = " | ".join(
        [
            str(iso_code or ""),
            str(title or ""),
            str(description or ""),
            "acciones correctivas sugeridas",
            "que exige",
            "evidencia",
        ]
    )

    hits = fetch_knowledge_hits(
        question=question,
        tenant_standards=[iso_code] if iso_code else [],
        standard_code=iso_code,
        limit=4,
        include_drafts=False,
    )

    primary = hits[0] if hits else {}

    immediate_actions = _dedupe_strings(
        primary.get("acciones_correctivas_sugeridas", [])
        or [
            "Identificar la causa de la desviación.",
            "Definir corrección inmediata.",
            "Asignar responsable y plazo.",
        ],
        limit=4,
    )

    evidence_examples = _dedupe_strings(
        primary.get("ejemplos_evidencia", []),
        limit=3,
    )

    objective = primary.get("que_exige") or (
        f"Restablecer el cumplimiento del requisito aplicable en {iso_code or 'la norma objetivo'}."
    )

    action_plan = [
        {
            "step": 1,
            "title": "Analizar causa y alcance",
            "owner_role": "responsable del proceso",
            "target_days": 5,
            "description": "Revisar la desviación, confirmar el requisito afectado y determinar su causa raíz.",
        },
        {
            "step": 2,
            "title": "Aplicar corrección inmediata",
            "owner_role": "dueño del control",
            "target_days": 7,
            "description": immediate_actions[0] if immediate_actions else "Implementar la corrección prioritaria.",
        },
        {
            "step": 3,
            "title": "Formalizar evidencia de cierre",
            "owner_role": "responsable documental",
            "target_days": 10,
            "description": (
                f"Reunir y vincular evidencia objetiva: {', '.join(evidence_examples)}."
                if evidence_examples
                else "Reunir y vincular evidencia objetiva suficiente."
            ),
        },
        {
            "step": 4,
            "title": "Validar eficacia",
            "owner_role": "auditor interno / administrador",
            "target_days": 15,
            "description": "Verificar que la acción elimina la causa y deja trazabilidad suficiente para cierre.",
        },
    ]

    success_criteria = _dedupe_strings(
        [
            "Existe evidencia objetiva vinculada al requisito.",
            "La acción queda trazada con responsable y fecha de cierre.",
            "El requisito afectado demuestra cumplimiento verificable.",
            *evidence_examples,
        ],
        limit=5,
    )

    return {
        "ok": True,
        "type": "action_plan",
        "priority": _priority_from_severity(severity),
        "objective": objective,
        "immediate_actions": immediate_actions,
        "action_plan": action_plan,
        "success_criteria": success_criteria,
        "confidence": "media",
        "source": "ai-engine-knowledge",
        "knowledge_sources": summarize_sources(hits),
        "knowledge_context": build_context_block(hits),
    }


def generate_executive_brief(payload: dict) -> dict:
    tenant_name = payload.get("tenant_name", "Cliente")
    period = payload.get("period", "Periodo actual")
    standards = payload.get("standards") or []
    weakest = payload.get("weakest_standards") or []

    controls_total = int(payload.get("controls_total", 0))
    controls_warning = int(payload.get("controls_warning", 0))
    controls_critical = int(payload.get("controls_critical", 0))
    evidences_pending = int(payload.get("evidences_pending", 0))
    findings_critical = int(payload.get("findings_critical", 0))

    question = " ".join(
        [
            "resumen gerencial",
            tenant_name,
            " ".join(standards),
            " ".join(weakest),
            "evidencias pendientes",
            "hallazgos críticos",
            "acciones correctivas sugeridas",
        ]
    )

    hits = fetch_knowledge_hits(
        question=question,
        tenant_standards=standards,
        limit=6,
        include_drafts=False,
    )

    extra_actions = []
    for h in hits:
        extra_actions.extend(h.get("acciones_correctivas_sugeridas", []))

    top_priorities = _dedupe_strings(
        [
            f"Disminuir {controls_warning} controles en atención.",
            f"Regularizar {evidences_pending} evidencias pendientes.",
            f"Tratar {findings_critical} hallazgos críticos.",
            *weakest,
        ],
        limit=5,
    )

    management_actions = _dedupe_strings(
        [
            "Validar responsables y fechas de cierre de acciones críticas.",
            "Reforzar trazabilidad de evidencia objetiva en controles sensibles.",
            "Priorizar cierre de brechas en normas con peor desempeño.",
            *extra_actions,
        ],
        limit=6,
    )

    executive_summary = (
        f"Durante {period}, {tenant_name} mantiene {controls_total} controles dentro del alcance activo. "
        f"Se observan {controls_warning} controles en atención, {controls_critical} deteriorados, "
        f"{evidences_pending} evidencias pendientes y {findings_critical} hallazgos críticos. "
        f"El foco gerencial debe estar en asegurar evidencia suficiente, acelerar cierres y fortalecer la justificación de requisitos sensibles."
    )

    return {
        "ok": True,
        "type": "executive_brief",
        "headline": f"Resumen ejecutivo IA - {tenant_name}",
        "executive_summary": executive_summary,
        "top_priorities": top_priorities,
        "management_actions": management_actions,
        "confidence": "media",
        "source": "ai-engine-knowledge",
        "knowledge_sources": summarize_sources(hits),
        "knowledge_context": build_context_block(hits),
    }
