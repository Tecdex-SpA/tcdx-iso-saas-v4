from typing import Any, Dict, List, Optional, Tuple


PROBLEM_KEYWORDS = {
    "access_review_missing": [
        "acceso", "accesos", "privilegio", "privilegios", "usuario", "usuarios",
        "cuenta", "cuentas", "perfil", "perfiles", "roles", "admin", "administrador",
        "revisión de accesos", "revision de accesos"
    ],
    "backup_restore_test_missing": [
        "backup", "respaldo", "respaldos", "restauración", "restauracion",
        "restore", "recuperación", "recuperacion", "rto", "rpo"
    ],
    "kpi_deteriorated": [
        "kpi", "indicador", "indicadores", "métrica", "metrica", "bajo",
        "deteriorado", "rojo", "tendencia", "umbral"
    ],
    "finding_recurrent": [
        "recurrente", "repetido", "repite", "otra vez", "nuevamente",
        "mismo hallazgo", "misma no conformidad"
    ],
    "nonconformity_open": [
        "no conformidad", "nc", "noconformidad", "incumplimiento mayor",
        "incumplimiento menor"
    ],
    "procedure_missing": [
        "procedimiento", "instructivo", "proceso documentado", "documento",
        "documentación", "documentacion", "no está documentado", "no esta documentado"
    ],
    "procedure_not_implemented": [
        "procedimiento no implementado", "no se aplica", "no se ejecuta",
        "solo documentado", "no hay registros"
    ],
    "expired_evidence": [
        "vencida", "vencido", "desactualizada", "desactualizado", "antigua",
        "antiguo", "periodo anterior", "año anterior", "no vigente"
    ],
    "weak_evidence": [
        "insuficiente", "débil", "debil", "incompleta", "incompleto",
        "sin fecha", "sin responsable", "sin resultado", "sin aprobación", "sin aprobacion"
    ],
    "invalid_evidence": [
        "no sirve", "no válida", "no valida", "inválida", "invalida",
        "no corresponde", "sin relación", "sin relacion"
    ],
    "action_overdue": [
        "acción vencida", "accion vencida", "plan vencido", "fuera de plazo",
        "atrasada", "atrasado", "vencimiento", "plazo vencido"
    ],
    "action_without_evidence": [
        "acción sin evidencia", "accion sin evidencia", "cerrada sin evidencia",
        "declarada", "sin respaldo"
    ],
    "risk_without_treatment": [
        "riesgo sin tratamiento", "riesgo no tratado", "sin tratamiento",
        "matriz de riesgo", "plan de tratamiento"
    ],
    "high_residual_risk": [
        "riesgo residual alto", "riesgo alto", "riesgo crítico", "riesgo critico",
        "residual alto"
    ],
    "asset_without_owner": [
        "activo sin dueño", "activo sin propietario", "sin propietario",
        "sin custodio", "sin responsable del activo"
    ],
    "supplier_without_evaluation": [
        "proveedor", "proveedores", "evaluación proveedor", "evaluacion proveedor",
        "reevaluación", "reevaluacion", "homologación", "homologacion"
    ],
    "training_without_record": [
        "capacitación", "capacitacion", "asistencia", "registro de capacitación",
        "registro de capacitacion", "competencia", "relator"
    ],
    "management_review_gap": [
        "revisión por la dirección", "revision por la direccion", "revisión gerencial",
        "revision gerencial", "acta de dirección", "acta de direccion"
    ],
    "control_not_executed": [
        "control no ejecutado", "no ejecutado", "no se ejecutó", "no se ejecuto",
        "no se realizó", "no se realizo"
    ],
    "control_without_owner": [
        "control sin responsable", "sin responsable", "responsable no definido"
    ],
    "control_overdue_review": [
        "revisión atrasada", "revision atrasada", "revisión vencida", "revision vencida",
        "última revisión", "ultima revision"
    ],
    "missing_evidence": [
        "falta evidencia", "sin evidencia", "no hay evidencia", "no existe evidencia",
        "evidencia faltante", "falta respaldo", "sin respaldo", "no hay respaldo"
    ],
}


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, (list, tuple)):
        return " ".join(_normalize_text(item) for item in value)

    if isinstance(value, dict):
        return " ".join(_normalize_text(item) for item in value.values())

    return str(value).lower()


def classify_problem(
    text: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
    fallback: str = "missing_evidence",
) -> Dict[str, Any]:
    """
    Clasifica el problema usando palabras clave y señales del contexto.
    No usa escritura ni altera datos.
    """
    combined_text = _normalize_text(text)

    if context:
        selected_parts = [
            context.get("entity_type"),
            context.get("standard_code"),
            context.get("tenant_health"),
            context.get("critical_controls"),
            context.get("attention_controls"),
            context.get("recent_findings"),
            context.get("recent_kpis"),
            context.get("selected_control"),
        ]
        combined_text += " " + _normalize_text(selected_parts)

    scores: List[Tuple[str, int, List[str]]] = []

    for code, keywords in PROBLEM_KEYWORDS.items():
        matched = []
        score = 0

        for keyword in keywords:
            kw = keyword.lower()
            if kw in combined_text:
                matched.append(keyword)
                score += 1

        if matched:
            scores.append((code, score, matched))

    # Señales de contexto adicionales.
    if context:
        critical_controls = context.get("critical_controls") or []
        recent_kpis = context.get("recent_kpis") or []
        recent_findings = context.get("recent_findings") or []

        if critical_controls:
            scores.append(("control_not_executed", 1, ["contexto: controles deteriorados"]))

            for control in critical_controls:
                evidence_count = int(control.get("evidence_count") or 0)
                finding_count = int(control.get("finding_count") or 0)

                if evidence_count == 0:
                    scores.append(("missing_evidence", 3, ["contexto: control sin evidencias"]))
                if finding_count > 0:
                    scores.append(("finding_open", 2, ["contexto: control con hallazgos"]))

        if recent_kpis:
            for kpi in recent_kpis:
                status_color = _normalize_text(kpi.get("status_color"))
                if status_color in {"red", "rojo", "critical", "deteriorado"}:
                    scores.append(("kpi_deteriorated", 3, ["contexto: KPI en rojo"]))

        if recent_findings:
            for finding in recent_findings:
                status = _normalize_text(finding.get("status"))
                severity = _normalize_text(finding.get("severity"))
                if status and status not in {"closed", "cerrado", "resuelto"}:
                    scores.append(("finding_open", 2, ["contexto: hallazgo abierto"]))
                if severity in {"alta", "high", "critica", "crítica", "critical"}:
                    scores.append(("nonconformity_open", 1, ["contexto: severidad alta/crítica"]))

    if not scores:
        return {
            "problem_type_code": fallback,
            "confidence": 0.45,
            "matched_terms": [],
            "alternatives": [],
        }

    aggregate: Dict[str, Dict[str, Any]] = {}

    for code, score, matched in scores:
        if code not in aggregate:
            aggregate[code] = {
                "score": 0,
                "matched_terms": [],
            }

        aggregate[code]["score"] += score
        aggregate[code]["matched_terms"].extend(matched)

    ranked = sorted(
        aggregate.items(),
        key=lambda item: item[1]["score"],
        reverse=True,
    )

    best_code, best_data = ranked[0]
    best_score = best_data["score"]

    confidence = min(0.95, 0.50 + (best_score * 0.08))

    return {
        "problem_type_code": best_code,
        "confidence": round(confidence, 2),
        "matched_terms": list(dict.fromkeys(best_data["matched_terms"])),
        "alternatives": [
            {
                "problem_type_code": code,
                "score": data["score"],
                "matched_terms": list(dict.fromkeys(data["matched_terms"])),
            }
            for code, data in ranked[1:5]
        ],
    }
