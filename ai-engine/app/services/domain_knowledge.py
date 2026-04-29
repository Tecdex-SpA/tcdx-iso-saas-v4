from typing import Any, Dict, List, Optional

from app.services.ai_core_db import fetch_all, fetch_one


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

    return fetch_all(
        """
        SELECT
          sdm.standard_code,
          sdm.domain_code,
          dc.domain_name,
          dc.domain_category,
          sdm.relevance_level,
          sdm.standard_focus,
          sdm.expected_emphasis,
          sdm.typical_findings,
          sdm.typical_evidence
        FROM ai_core.standard_domain_map sdm
        JOIN ai_core.domains_catalog dc
          ON dc.domain_code = sdm.domain_code
        WHERE sdm.standard_code = %s
          AND sdm.is_active = true
          AND dc.is_active = true
        ORDER BY
          CASE WHEN sdm.relevance_level = 'alta' THEN 1 ELSE 2 END,
          dc.domain_name
        """,
        [standard_code],
    )


def _domain_applies_to_standard(domain_code: str, standard_code: Optional[str]) -> bool:
    if not standard_code:
        return True

    row = fetch_one(
        """
        SELECT 1
        FROM ai_core.standard_domain_map
        WHERE standard_code = %s
          AND domain_code = %s
          AND is_active = true
        LIMIT 1
        """,
        [standard_code, domain_code],
    )

    return row is not None


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

    # Refuerzo por BD domain_problem_type_map.
    if problem_type_code:
        rows = fetch_all(
            """
            SELECT dptm.domain_code, dptm.relevance_level
            FROM ai_core.domain_problem_type_map dptm
            JOIN ai_core.domains_catalog dc
              ON dc.domain_code = dptm.domain_code
            WHERE dptm.problem_type_code = %s
              AND dptm.is_active = true
              AND dc.is_active = true
            """,
            [problem_type_code],
        )

        for row in rows:
            matched.append({
                "domain_code": row["domain_code"],
                "score": 6 if row.get("relevance_level") == "alta" else 4,
                "matched_terms": [f"domain_problem_type_map:{problem_type_code}"],
                "source": "domain_problem_type_map",
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

    domain = fetch_one(
        """
        SELECT
          domain_code,
          domain_name,
          domain_category,
          description,
          is_transversal,
          metadata
        FROM ai_core.domains_catalog
        WHERE domain_code = %s
          AND is_active = true
        """,
        [domain_code],
    )

    standard_domain = None

    if standard_code:
        standard_domain = fetch_one(
            """
            SELECT
              sdm.standard_code,
              sdm.domain_code,
              sdm.relevance_level,
              sdm.standard_focus,
              sdm.expected_emphasis,
              sdm.typical_findings,
              sdm.typical_evidence
            FROM ai_core.standard_domain_map sdm
            WHERE sdm.standard_code = %s
              AND sdm.domain_code = %s
              AND sdm.is_active = true
            """,
            [standard_code, domain_code],
        )

    params = [domain_code]
    problem_filter = ""

    if problem_type_code:
        problem_filter = "AND (problem_type_code = %s OR problem_type_code IS NULL)"
        params.append(problem_type_code)

    evidence = fetch_all(
        f"""
        SELECT
          domain_code,
          problem_type_code,
          evidence_context,
          expected_deliverables,
          minimum_content,
          accepted_formats,
          invalid_evidence,
          validation_criteria,
          metadata
        FROM ai_core.domain_evidence_expectations
        WHERE domain_code = %s
          {problem_filter}
          AND is_active = true
        ORDER BY
          CASE WHEN problem_type_code = %s THEN 1 ELSE 2 END,
          id
        LIMIT 5
        """,
        [*params, problem_type_code or ""],
    )

    playbooks = fetch_all(
        f"""
        SELECT
          domain_code,
          problem_type_code,
          title,
          diagnosis_template,
          solution_summary,
          solution_steps,
          corrective_actions,
          preventive_actions,
          closure_conditions,
          health_impact_notes,
          kpi_impact_notes,
          metadata
        FROM ai_core.domain_solution_playbooks
        WHERE domain_code = %s
          {problem_filter}
          AND is_active = true
        ORDER BY
          CASE WHEN problem_type_code = %s THEN 1 ELSE 2 END,
          id
        LIMIT 5
        """,
        [*params, problem_type_code or ""],
    )

    closure = fetch_all(
        f"""
        SELECT
          domain_code,
          problem_type_code,
          title,
          required_conditions,
          validation_questions,
          rejection_reasons,
          closure_summary_template,
          requires_effectiveness_validation,
          metadata
        FROM ai_core.domain_closure_criteria
        WHERE domain_code = %s
          {problem_filter}
          AND is_active = true
        ORDER BY
          CASE WHEN problem_type_code = %s THEN 1 ELSE 2 END,
          id
        LIMIT 5
        """,
        [*params, problem_type_code or ""],
    )

    overrides = []

    if standard_code:
        overrides = fetch_all(
            """
            SELECT
              standard_code,
              domain_code,
              problem_type_code,
              override_type,
              title,
              content,
              priority,
              metadata
            FROM ai_core.standard_specific_overrides
            WHERE standard_code = %s
              AND is_active = true
              AND (domain_code = %s OR domain_code IS NULL)
              AND (problem_type_code = %s OR problem_type_code IS NULL)
            ORDER BY priority DESC, id
            LIMIT 10
            """,
            [standard_code, domain_code, problem_type_code],
        )

    return {
        "ok": domain is not None,
        "domain": domain,
        "standard_domain": standard_domain,
        "playbooks": playbooks,
        "evidence_expectations": evidence,
        "closure_criteria": closure,
        "overrides": overrides,
    }
