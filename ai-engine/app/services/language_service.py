from typing import Any, Dict, List


SUPPORTED_LOCALES = {"es", "en"}
DEFAULT_LOCALE = "es"


def normalize_locale(value: Any = None) -> str:
    raw = str(value or "").strip().lower().replace("_", "-")
    if not raw:
        return DEFAULT_LOCALE

    base = raw.split(",")[0].split(";")[0].split("-")[0]
    return base if base in SUPPORTED_LOCALES else DEFAULT_LOCALE


def language_instruction(locale: Any = None) -> str:
    normalized = normalize_locale(locale)

    if normalized == "en":
        return (
            "Respond in clear, professional executive English. "
            "Do not translate company names, people's names, ISO standard names, ISO codes, "
            "control codes, evidence file names, finding titles, historical comments, or customer-provided text. "
            "Keep JSON field names and response schema unchanged."
        )

    return (
        "Responde en español claro, profesional y ejecutivo. "
        "No traduzcas nombres de empresa, personas, normas ISO, códigos ISO, códigos de control, "
        "nombres de archivos de evidencia, títulos de hallazgos, comentarios históricos ni texto ingresado por clientes. "
        "Mantén nombres de campos JSON y esquema de respuesta sin cambios."
    )


def apply_language_instruction(prompt: str, locale: Any = None) -> str:
    instruction = language_instruction(locale)
    return f"{prompt.rstrip()}\n\n[RESPONSE LANGUAGE]\n{instruction}\n"


TRANSLATIONS_EN = {
    "alta": "high",
    "media": "medium",
    "baja": "low",
    "critica": "critical",
    "crítica": "critical",
    "saludable": "healthy",
    "atencion": "attention",
    "atención": "attention",
    "deteriorado": "deteriorated",
    "sin_datos": "no_data",

    "auditor interno": "internal auditor",
    "Responsable del proceso": "Process owner",
    "Dueño del control": "Control owner",
    "Administrador de cumplimiento": "Compliance administrator",
    "Responsable documental": "Document owner",
    "Auditor interno / administrador": "Internal auditor / administrator",

    "Definir segun criticidad y proximidad de auditoria.": "Define according to criticality and audit proximity.",
    "No aplica.": "Not applicable.",

    "Controles deteriorados requieren seguimiento": "Deteriorated controls require follow-up",
    "Controles sin evidencia objetiva": "Controls without objective evidence",
    "Evidencias antiguas o con vigencia debil": "Old evidence or weak validity",
    "Riesgos residuales altos": "High residual risks",
    "Planes de accion vencidos": "Overdue action plans",
    "KPIs criticos": "Critical KPIs",
    "Preparar auditoria con foco en brechas criticas": "Prepare audit focused on critical gaps",
    "Sin senales criticas suficientes": "No sufficient critical signals",

    "Controles deteriorados": "Deteriorated controls",
    "Brecha de evidencia": "Evidence gap",
    "Evidencia antigua": "Old evidence",
    "Riesgos residuales altos": "High residual risks",
    "Planes vencidos": "Overdue plans",
    "KPIs criticos": "Critical KPIs",
    "Preparacion de auditoria": "Audit preparation",
    "Evidencia insuficiente": "Insufficient evidence",
    "Riesgo alto con potencial impacto": "High risk with potential impact",

    "El estado de salud del control es una senal interna directa de deterioro operativo.": "The control health status is a direct internal signal of operational deterioration.",
    "Revisar causa, responsable, evidencia disponible y necesidad de plan de accion.": "Review cause, owner, available evidence, and need for an action plan.",
    "Un control sin evidencia no permite confirmar operacion efectiva.": "A control without evidence does not allow confirmation of effective operation.",
    "Solicitar evidencia objetiva, vigente y trazable para cada control afectado.": "Request objective, current, and traceable evidence for each affected control.",
    "La ausencia de evidencia limita cualquier conclusion de cumplimiento.": "The absence of evidence limits any compliance conclusion.",
    "La evidencia antigua puede no demostrar vigencia actual del control.": "Old evidence may not demonstrate current control validity.",
    "Actualizar evidencia indicando periodo cubierto, responsable y control respaldado.": "Update evidence indicating covered period, owner, and supported control.",
    "Un riesgo residual alto requiere tratamiento, controles efectivos y seguimiento ejecutivo.": "A high residual risk requires treatment, effective controls, and executive follow-up.",
    "Validar controles asociados, tratamiento, responsable, fecha objetivo y evidencias de avance.": "Validate associated controls, treatment, owner, target date, and evidence of progress.",
    "El auditor debe cruzar estos riesgos con controles, hallazgos y planes de accion abiertos.": "The auditor should cross-check these risks with controls, findings, and open action plans.",
    "Un plan vencido puede evidenciar debilidad de seguimiento o cierre de brechas.": "An overdue plan may evidence weak follow-up or gap closure.",
    "Regularizar estado, definir nuevo compromiso y adjuntar evidencia de avance o cierre.": "Regularize status, define a new commitment, and attach evidence of progress or closure.",
    "Los KPIs criticos reflejan deterioro o insuficiencia de datos frente al umbral definido.": "Critical KPIs reflect deterioration or insufficient data against the defined threshold.",
    "Revisar fuente, periodo, tendencia, responsable y accion correctiva asociada.": "Review source, period, trend, owner, and associated corrective action.",
    "La proximidad de auditoria aumenta la urgencia de controles deteriorados, evidencias faltantes y riesgos altos.": "Audit proximity increases the urgency of deteriorated controls, missing evidence, and high risks.",
    "Preparar paquete de evidencia, responsables y estado de planes antes de la auditoria.": "Prepare evidence package, owners, and plan status before the audit.",
    "Con los datos recibidos no se identifican brechas criticas concretas.": "With the received data, no concrete critical gaps were identified.",
    "La salida depende estrictamente de los resumenes internos recibidos.": "The output strictly depends on the internal summaries received.",
    "Completar datos internos si se requiere una conclusion de auditoria mas robusta.": "Complete internal data if a more robust audit conclusion is required.",

    "No se recibio resumen de controles.": "No controls summary was received.",
    "No se recibio resumen de evidencias.": "No evidence summary was received.",
    "No se recibio resumen de riesgos.": "No risk summary was received.",
    "No se recibio resumen de hallazgos.": "No findings summary was received.",
    "No se recibio resumen de planes de accion.": "No action plan summary was received.",
    "No se recibio resumen de KPIs.": "No KPI summary was received.",
    "No se recibio contexto de auditoria.": "No audit context was received.",

    "No se declara cumplimiento total sin evidencia suficiente.": "Full compliance is not declared without sufficient evidence.",
    "El conocimiento bootstrap aprobado es contexto general y no reemplaza evidencia interna.": "Approved bootstrap knowledge is general context and does not replace internal evidence.",
    "La informacion externa no reemplaza los datos internos del tenant.": "External information does not replace the tenant's internal data.",
    "Las posibles no conformidades requieren validacion de auditor humano.": "Potential nonconformities require human auditor validation.",

    "Confirmar brecha y alcance": "Confirm gap and scope",
    "Ejecutar corrección": "Execute correction",
    "Adjuntar evidencia objetiva": "Attach objective evidence",
    "Preparar entregables de cierre": "Prepare closure deliverables",
    "Validar contenido mínimo": "Validate minimum content",
    "Validar criterio de cierre": "Validate closure criteria",
    "Confirmar el problema, el control afectado, el periodo aplicable y el responsable de tratamiento.": "Confirm the issue, affected control, applicable period, and treatment owner.",
    "Ejecutar la corrección necesaria y documentar el resultado.": "Execute the required correction and document the result.",
    "Cargar evidencia suficiente con fecha, responsable, periodo, resultado y aprobación.": "Upload sufficient evidence with date, owner, period, result, and approval.",
    "Resolver la brecha con acción, responsable, evidencia objetiva y validación de cierre.": "Resolve the gap with action, owner, objective evidence, and closure validation.",
    "Corregir la desviación y adjuntar evidencia objetiva suficiente.": "Correct the deviation and attach sufficient objective evidence.",

    "La información interna de la empresa no fue suficiente para responder con seguridad completa. Se complementó la respuesta con la Base de Conocimiento TCDX.": "The company's internal information was not sufficient to respond with full confidence. The answer was complemented with the TCDX Knowledge Base.",
    "No se encontraron referencias TCDX fuertes, por lo que se entrega una recomendación de mejor esfuerzo.": "No strong TCDX references were found, so a best-effort recommendation is provided.",
    "Aplicar el criterio de la norma, documentar evidencia objetiva y dejar trazabilidad de responsable, fecha, revisión y eficacia.": "Apply the standard criterion, document objective evidence, and keep traceability of owner, date, review, and effectiveness.",
    "Base de conocimiento TCDX": "TCDX Knowledge Base",
    "Buenas prácticas anonimizadas": "Anonymized best practices",
    "Información interna de la empresa": "Company internal information",
    "Mejor esfuerzo controlado con información interna limitada": "Controlled best effort with limited internal information",
}


def _translate_string(value: str, locale: str) -> str:
    if locale != "en":
        return value

    text = str(value)

    if text in TRANSLATIONS_EN:
        return TRANSLATIONS_EN[text]

    # Conservative phrase-level replacements. Customer data remains untouched.
    replacements = {
        "Se informan ": "There are ",
        "Se detectan ": "Detected ",
        " controles deteriorados en el contexto interno.": " deteriorated controls in the internal context.",
        " controles sin evidencia asociada.": " controls without associated evidence.",
        " evidencias antiguas.": " old evidence items.",
        " riesgos residuales altos.": " high residual risks.",
        " planes de accion vencidos o atrasados.": " overdue or delayed action plans.",
        " KPIs en estado critico.": " KPIs in critical status.",
        "Existen senales internas relevantes y auditorias proximas.": "There are relevant internal signals and upcoming audits.",
        "El analisis se basa en datos internos del tenant. ": "The analysis is based on internal tenant data. ",
        "Estado estimado: ": "Estimated status: ",
        "Las conclusiones deben validarse contra evidencias, riesgos, hallazgos, planes y KPIs disponibles.": "Conclusions must be validated against available evidence, risks, findings, plans, and KPIs.",
        "Redacción propuesta:": "Proposed wording:",
        "Evidencia objetiva:": "Objective evidence:",
        "Riesgo / impacto:": "Risk / impact:",
        "Corrección inmediata:": "Immediate correction:",
        "Acción correctiva sugerida:": "Suggested corrective action:",
        "Objetivo sugerido:": "Suggested objective:",
        "Acciones inmediatas:": "Immediate actions:",
        "Plan sugerido:": "Suggested plan:",
        "Criterios de cierre:": "Closure criteria:",
        "Prioridad sugerida IA:": "AI suggested priority:",
        "Resumen:": "Summary:",
        "Impacto:": "Impact:",
        "Prioridad sugerida:": "Suggested priority:",
        "Acciones sugeridas:": "Suggested actions:",
        "Paso ": "Step ",
        " días": " days",
    }

    for source, target in replacements.items():
        text = text.replace(source, target)

    return text


def localize_ai_response(value: Any, locale: Any = None) -> Any:
    normalized = normalize_locale(locale)

    if isinstance(value, str):
        return _translate_string(value, normalized)

    if isinstance(value, list):
        return [localize_ai_response(item, normalized) for item in value]

    if isinstance(value, dict):
        out: Dict[str, Any] = {}
        for key, item in value.items():
            # Never change JSON field names.
            out[key] = localize_ai_response(item, normalized)

        out.setdefault("locale", normalized)
        out.setdefault("response_language", "English" if normalized == "en" else "Spanish")
        return out

    return value
