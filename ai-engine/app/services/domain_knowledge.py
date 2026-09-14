from typing import Any, Dict, List, Optional

from app.services.canonical_knowledge_service import (
    build_knowledge_bundle,
    canonical_domain_applies_to_standard,
    infer_domains_from_canonical_knowledge,
)


DOMAIN_KEYWORDS = [
    ("access_management", [
        "acceso", "accesos", "usuarios", "usuario", "privilegios", "privilegio",
        "perfiles", "roles", "matriz de accesos", "usuarios privilegiados",
        "revisión de accesos", "revision de accesos"
    ]),
    ("backup_restore", [
        "backup", "backups", "respaldo", "respaldos", "restauración", "restauracion",
        "restore", "recuperación", "recuperacion", "rto", "rpo"
    ]),
    ("technical_vulnerability_management", [
        "vulnerabilidad", "vulnerabilidades", "parche", "parches", "cve",
        "pentest", "escaneo", "remediación", "remediacion"
    ]),
    ("incident_management", [
        "incidente", "incidentes", "evento de seguridad", "post incidente",
        "contención", "contencion", "respuesta a incidente"
    ]),
    ("change_management", [
        "cambio", "cambios", "cab", "rollback", "reversa",
        "implementación de cambio", "implementacion de cambio"
    ]),
    ("asset_management", [
        "activo", "activos", "inventario", "propietario", "custodio",
        "criticidad", "clasificación", "clasificacion"
    ]),
    ("risk_management", [
        "riesgo", "riesgos", "riesgo residual", "riesgo inherente",
        "matriz de riesgo", "tratamiento de riesgo"
    ]),
    ("kpi_management", [
        "kpi", "indicador", "indicadores", "métrica", "metrica",
        "umbral", "tendencia", "desempeño"
    ]),
    ("document_control", [
        "documento", "documentos", "procedimiento", "política", "politica",
        "versión", "version", "obsoleto", "documentación", "documentacion"
    ]),
    ("record_control", [
        "registro", "registros", "bitácora", "bitacora", "formulario",
        "retención", "retencion"
    ]),
    ("evidence_management", [
        "evidencia", "evidencias", "respaldo", "respaldos", "captura",
        "pantallazo", "archivo cargado"
    ]),
    ("supplier_management", [
        "proveedor", "proveedores", "evaluación proveedor", "evaluacion proveedor",
        "reevaluación", "reevaluacion", "homologación", "homologacion"
    ]),
    ("training_competence", [
        "capacitación", "capacitacion", "competencia", "formación", "formacion",
        "asistencia", "relator", "certificado"
    ]),
    ("legal_regulatory_compliance", [
        "legal", "regulatorio", "regulatoria", "permiso", "autorización",
        "autorizacion", "matriz legal", "obligación", "obligacion"
    ]),
    ("operational_control", [
        "control operacional", "operación", "operacion", "proceso operativo",
        "checklist", "monitoreo operacional"
    ]),
    ("emergency_preparedness", [
        "emergencia", "simulacro", "evacuación", "evacuacion",
        "contingencia", "respuesta ante emergencias"
    ]),
    ("customer_satisfaction", [
        "satisfacción", "satisfaccion", "encuesta", "nps", "cliente",
        "percepción", "percepcion"
    ]),
    ("complaints_feedback", [
        "reclamo", "reclamos", "queja", "quejas", "retroalimentación",
        "retroalimentacion", "feedback"
    ]),
    ("privacy_personal_data", [
        "privacidad", "datos personales", "pii", "titular", "consentimiento",
        "derechos de titulares"
    ]),
    ("cloud_security", [
        "cloud", "nube", "proveedor cloud", "responsabilidad compartida",
        "servicio cloud"
    ]),
    ("it_service_management", [
        "servicio ti", "servicios ti", "mesa de ayuda", "ticket",
        "solicitud", "problema ti", "itsm"
    ]),
    ("service_level_management", [
        "sla", "ola", "nivel de servicio", "niveles de servicio",
        "disponibilidad", "tiempo de respuesta"
    ]),
    ("technical_competence", [
        "competencia técnica", "competencia tecnica", "autorización técnica",
        "autorizacion tecnica", "supervisión técnica", "supervision tecnica"
    ]),
    ("calibration_metrological_traceability", [
        "calibración", "calibracion", "metrología", "metrologia",
        "trazabilidad metrológica", "trazabilidad metrologica",
        "incertidumbre", "certificado de calibración"
    ]),
    ("method_validation", [
        "validación de método", "validacion de metodo", "verificación de método",
        "verificacion de metodo", "método de ensayo", "metodo de ensayo"
    ]),
    ("food_safety", [
        "inocuidad", "haccp", "pcc", "oprp", "prerrequisito",
        "limpieza", "sanitización", "sanitizacion", "trazabilidad de lote"
    ]),
    ("environmental_management", [
        "ambiental", "aspecto ambiental", "impacto ambiental", "permiso ambiental",
        "residuo", "emisión", "emision", "monitoreo ambiental"
    ]),
    ("energy_asset_performance", [
        "energía", "energia", "desempeño energético", "desempeno energetico",
        "mantenimiento", "confiabilidad", "falla", "activo físico", "activo fisico"
    ]),
    ("internal_audit", [
        "auditoría", "auditoria", "auditor interno", "programa de auditoría",
        "programa de auditoria", "hallazgo"
    ]),
    ("management_review", [
        "revisión por la dirección", "revision por la direccion",
        "alta dirección", "alta direccion", "revisión gerencial", "revision gerencial"
    ]),
    ("nonconformity_management", [
        "no conformidad", "noconformidad", "nc", "incumplimiento",
        "desviación", "desviacion"
    ]),
    ("corrective_actions", [
        "acción correctiva", "accion correctiva", "capa", "causa raíz",
        "causa raiz", "eficacia"
    ]),
    ("continuous_improvement", [
        "mejora continua", "mejora", "lección aprendida", "leccion aprendida",
        "optimización", "optimizacion"
    ]),
]


PROBLEM_DOMAIN_DEFAULTS = {
    "access_review_missing": "access_management",
    "backup_restore_test_missing": "backup_restore",
    "kpi_deteriorated": "kpi_management",
    "kpi_without_source": "kpi_management",
    "risk_without_treatment": "risk_management",
    "high_residual_risk": "risk_management",
    "asset_without_owner": "asset_management",
    "supplier_without_evaluation": "supplier_management",
    "training_without_record": "training_competence",
    "management_review_gap": "management_review",
    "document_obsolete": "document_control",
    "procedure_missing": "document_control",
    "procedure_not_implemented": "operational_control",
    "control_not_executed": "operational_control",
    "finding_open": "internal_audit",
    "finding_recurrent": "continuous_improvement",
    "nonconformity_open": "nonconformity_management",
    "action_overdue": "corrective_actions",
    "action_without_evidence": "corrective_actions",
    "missing_evidence": "evidence_management",
    "weak_evidence": "evidence_management",
    "expired_evidence": "evidence_management",
    "invalid_evidence": "evidence_management",
}


def _normalize(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, dict):
        return " ".join(_normalize(v) for v in value.values())

    if isinstance(value, (list, tuple)):
        return " ".join(_normalize(v) for v in value)

    return str(value).lower()


def get_standard_domains(standard_code: Optional[str]) -> List[Dict[str, Any]]:
    if not standard_code:
        return []

    rows = infer_domains_from_canonical_knowledge(standard_code=standard_code, limit=20)
    return [
        {
            "standard_code": standard_code,
            "domain_code": row.get("domain_code"),
            "domain_name": row.get("domain_code"),
            "domain_category": None,
            "relevance_level": None,
            "relevance_basis": "canonical_match_without_criticality_inference",
            "match_count": int(row.get("match_count") or 0),
            "standard_focus": None,
            "expected_emphasis": None,
            "typical_findings": [],
            "typical_evidence": [],
            "source": "canonical_knowledge",
        }
        for row in rows
    ]


def _domain_applies_to_standard(domain_code: str, standard_code: Optional[str]) -> bool:
    return canonical_domain_applies_to_standard(domain_code, standard_code)


def infer_domain_code(
    user_text: Optional[str] = None,
    standard_code: Optional[str] = None,
    problem_type_code: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Detecta dominio usando texto + tipo de problema + norma.
    El texto explícito tiene prioridad. Si el dominio no aplica a la norma,
    busca alternativa por problem_type dentro de la norma.
    """
    text = _normalize(user_text)

    if context:
        text += " " + _normalize([
            context.get("selected_control"),
            context.get("critical_controls"),
            context.get("attention_controls"),
            context.get("recent_findings"),
            context.get("recent_kpis"),
        ])

    matched = []

    for domain_code, keywords in DOMAIN_KEYWORDS:
        hits = [kw for kw in keywords if kw.lower() in text]
        if hits:
            matched.append({
                "domain_code": domain_code,
                "score": len(hits) * 10,
                "matched_terms": hits,
                "source": "keyword",
            })

    # Refuerzo por tipo de problema.
    if problem_type_code and problem_type_code in PROBLEM_DOMAIN_DEFAULTS:
        matched.append({
            "domain_code": PROBLEM_DOMAIN_DEFAULTS[problem_type_code],
            "score": 8,
            "matched_terms": [f"problem_type:{problem_type_code}"],
            "source": "problem_default",
        })

    # Refuerzo por Knowledge Base canónica.
    if problem_type_code:
        rows = infer_domains_from_canonical_knowledge(
            standard_code=standard_code,
            problem_type_code=problem_type_code,
            query_text=user_text,
            limit=5,
        )

        for row in rows:
            matched.append({
                "domain_code": row["domain_code"],
                "score": 4,
                "matched_terms": [f"canonical_knowledge:{problem_type_code}"],
                "source": "canonical_knowledge",
            })

    if not matched:
        fallback = PROBLEM_DOMAIN_DEFAULTS.get(problem_type_code or "", "evidence_management")
        return {
            "domain_code": fallback,
            "confidence": 0.45,
            "matched_terms": [],
            "alternatives": [],
            "source": "fallback",
            "applies_to_standard": _domain_applies_to_standard(fallback, standard_code),
        }

    aggregated: Dict[str, Dict[str, Any]] = {}

    for item in matched:
        domain = item["domain_code"]

        if domain not in aggregated:
            aggregated[domain] = {
                "score": 0,
                "matched_terms": [],
                "sources": [],
                "applies_to_standard": _domain_applies_to_standard(domain, standard_code),
            }

        # Si aplica a la norma, bonus. Si no aplica, penaliza.
        score = item["score"]
        if standard_code:
            score = score + 5 if aggregated[domain]["applies_to_standard"] else score - 5

        aggregated[domain]["score"] += score
        aggregated[domain]["matched_terms"].extend(item.get("matched_terms") or [])
        aggregated[domain]["sources"].append(item.get("source"))

    ranked = sorted(
        aggregated.items(),
        key=lambda x: x[1]["score"],
        reverse=True,
    )

    best_domain, best_data = ranked[0]

    # Si el mejor no aplica a la norma, intentar elegir uno que sí aplique.
    if standard_code and not best_data["applies_to_standard"]:
        applying = [item for item in ranked if item[1]["applies_to_standard"]]
        if applying:
            best_domain, best_data = applying[0]

    confidence = min(0.95, 0.50 + max(best_data["score"], 0) * 0.03)

    return {
        "domain_code": best_domain,
        "confidence": round(confidence, 2),
        "matched_terms": list(dict.fromkeys(best_data["matched_terms"])),
        "sources": list(dict.fromkeys(best_data["sources"])),
        "applies_to_standard": best_data["applies_to_standard"],
        "alternatives": [
            {
                "domain_code": domain,
                "score": data["score"],
                "applies_to_standard": data["applies_to_standard"],
                "matched_terms": list(dict.fromkeys(data["matched_terms"])),
                "sources": list(dict.fromkeys(data["sources"])),
            }
            for domain, data in ranked[1:5]
        ],
    }


def get_domain_knowledge(
    domain_code: Optional[str],
    problem_type_code: Optional[str] = None,
    standard_code: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Devuelve conocimiento experto por dominio y problema.
    Prioridad:
    1) coincidencia exacta dominio + problem_type
    2) dominio genérico
    3) overrides por norma si existen
    """
    if not domain_code:
        return {
            "ok": False,
            "domain": None,
            "standard_domain": None,
            "playbooks": [],
            "evidence_expectations": [],
            "closure_criteria": [],
            "overrides": [],
        }

    bundle = build_knowledge_bundle(
        standard_code=standard_code,
        domain=domain_code,
        problem_type_code=problem_type_code,
        query_text=" ".join([domain_code or "", problem_type_code or ""]),
        limit=5,
    )
    first_item = (bundle.get("items") or [{}])[0] if bundle.get("items") else {}

    domain = {
        "domain_code": domain_code,
        "domain_name": domain_code,
        "domain_category": first_item.get("item_type"),
        "description": first_item.get("intent_summary") or first_item.get("implementation_guidance"),
        "is_transversal": first_item.get("standard_code") is None,
        "metadata": {
            "source": "canonical_knowledge",
            "item_key": first_item.get("item_key"),
            "provenance": bundle.get("provenance"),
        },
    }

    standard_domain = {
        "standard_code": standard_code,
        "domain_code": domain_code,
        "relevance_level": None,
        "relevance_basis": "canonical_match_without_criticality_inference",
        "standard_focus": first_item.get("implementation_guidance"),
        "expected_emphasis": None,
        "typical_findings": [
            row.get("gap_text") or row.get("description")
            for row in bundle.get("gaps", [])[:5]
            if row.get("gap_text") or row.get("description")
        ],
        "typical_evidence": [
            row.get("expectation_text") or row.get("description")
            for row in bundle.get("evidence_expectations", [])[:5]
            if row.get("expectation_text") or row.get("description")
        ],
        "source": "canonical_knowledge",
    } if standard_code else None

    evidence = []
    for item in bundle.get("evidence_expectations") or []:
        expectation_text = item.get("expectation_text") or item.get("description")
        evidence.append({
            "domain_code": domain_code,
            "problem_type_code": problem_type_code,
            "evidence_context": item.get("description"),
            "expected_deliverables": [expectation_text] if expectation_text else [],
            "minimum_content": [],
            "accepted_formats": [item.get("evidence_type")] if item.get("evidence_type") else [],
            "invalid_evidence": [],
            "validation_criteria": [],
            "metadata": {
                "source": "knowledge_evidence_expectations",
                "item_key": item.get("item_key"),
                "required_level": item.get("required_level"),
            },
        })

    playbooks = []
    gaps = bundle.get("gaps") or []
    for item in bundle.get("recommended_actions") or []:
        playbooks.append({
            "domain_code": domain_code,
            "problem_type_code": problem_type_code,
            "title": item.get("description") or item.get("action_key") or "Acción recomendada",
            "diagnosis_template": (gaps[0].get("gap_text") or gaps[0].get("description")) if gaps else None,
            "solution_summary": item.get("description") or item.get("action_text"),
            "solution_steps": [item.get("action_text")] if item.get("action_text") else [],
            "corrective_actions": [item.get("action_text")] if item.get("action_text") else [],
            "preventive_actions": [],
            "closure_conditions": [],
            "health_impact_notes": None,
            "kpi_impact_notes": None,
            "metadata": {
                "source": "knowledge_recommended_actions",
                "item_key": item.get("item_key"),
                "action_basis": item.get("action_basis"),
                "priority_hint": item.get("priority_hint") or item.get("priority_default"),
            },
        })

    closure = []
    audit_questions = bundle.get("audit_questions") or []
    rules = bundle.get("rules") or []
    if audit_questions or rules:
        closure.append({
            "domain_code": domain_code,
            "problem_type_code": problem_type_code,
            "title": "Validación humana requerida",
            "required_conditions": [],
            "validation_questions": [
                row.get("question_text") or row.get("question")
                for row in audit_questions
                if row.get("question_text") or row.get("question")
            ],
            "rejection_reasons": [],
            "closure_summary_template": None,
            "requires_effectiveness_validation": None,
            "metadata": {
                "source": "knowledge_audit_questions_and_rules",
                "rule_keys": [row.get("rule_key") for row in rules if row.get("rule_key")],
            },
        })

    overrides = []

    return {
        "ok": bool(bundle.get("ok")),
        "domain": domain,
        "standard_domain": standard_domain,
        "playbooks": playbooks,
        "evidence_expectations": evidence,
        "closure_criteria": closure,
        "overrides": overrides,
        "canonical_bundle": bundle,
    }
