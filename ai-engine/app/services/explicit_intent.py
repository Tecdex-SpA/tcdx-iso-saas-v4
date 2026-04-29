from typing import Optional, Tuple


def normalize_text(value: Optional[str]) -> str:
    return str(value or "").lower()


def detect_explicit_problem_and_domain(
    user_text: Optional[str],
    standard_code: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """
    Detecta intención explícita desde el texto del usuario.

    Regla:
    Cuando el texto habla claramente de proveedor, calibración, ambiente,
    inocuidad, SLA, privacidad, energía, accesos, etc., esa señal debe pesar
    más que el contexto general del tenant.
    """
    t = normalize_text(user_text)
    standard = str(standard_code or "").upper()

    # Proveedores
    if any(term in t for term in [
        "proveedor",
        "proveedores",
        "proveedor crítico",
        "proveedor critico",
        "evaluación periódica del proveedor",
        "evaluacion periodica del proveedor",
        "evaluación del proveedor",
        "evaluacion del proveedor",
        "sin evaluación",
        "sin evaluacion",
        "reevaluación",
        "reevaluacion",
        "homologación",
        "homologacion",
    ]):
        return "supplier_without_evaluation", "supplier_management"


    # Contraseñas / credenciales / autenticación
    if any(term in t for term in [
        "contraseña",
        "contraseñas",
        "contrasena",
        "contrasenas",
        "password",
        "passwords",
        "clave",
        "claves",
        "credencial",
        "credenciales",
        "autenticación",
        "autenticacion",
        "mfa",
        "2fa",
        "doble factor",
        "cuenta compartida",
        "cuentas compartidas",
        "cuenta generica",
        "cuenta genérica",
        "credenciales por defecto",
        "password por defecto",
        "contraseña por defecto",
        "politica de contraseña",
        "política de contraseña",
        "politica de contraseñas",
        "política de contraseñas",
        "complejidad de contraseña",
        "complejidad de contraseñas",
        "bloqueo por intentos",
        "intentos fallidos",
        "rotación de contraseña",
        "rotacion de contraseña",
        "base de datos",
        "motor bd",
        "sistema bd",
    ]):
        if any(term in t for term in [
            "brecha",
            "riesgo",
            "expuesto",
            "exposición",
            "exposicion",
            "vulnerabilidad",
            "débil",
            "debil",
            "insegura",
            "inseguro",
        ]):
            return "risk_without_treatment", "access_management"

        return "control_not_executed", "access_management"

    # Accesos
    if any(term in t for term in [
        "revisión de accesos",
        "revision de accesos",
        "accesos privilegiados",
        "usuarios privilegiados",
        "matriz de accesos",
        "privilegios",
    ]):
        return "access_review_missing", "access_management"

    # Calibración / metrología
    if any(term in t for term in [
        "calibración",
        "calibracion",
        "certificado de calibración",
        "certificado de calibracion",
        "trazabilidad metrológica",
        "trazabilidad metrologica",
        "metrología",
        "metrologia",
    ]):
        if any(term in t for term in ["vencido", "vencida", "caducado", "caducada", "no vigente"]):
            return "expired_evidence", "calibration_metrological_traceability"
        return "missing_evidence", "calibration_metrological_traceability"

    # Ambiental
    if any(term in t for term in [
        "ambiental",
        "permiso ambiental",
        "matriz legal ambiental",
        "aspecto ambiental",
        "impacto ambiental",
        "monitoreo ambiental",
        "residuo",
        "emisión",
        "emision",
    ]):
        if any(term in t for term in ["vencido", "vencida", "desactualizada", "desactualizado", "no vigente"]):
            return "expired_evidence", "environmental_management"
        return "missing_evidence", "environmental_management"

    # Inocuidad
    if any(term in t for term in [
        "inocuidad",
        "pcc",
        "oprp",
        "haccp",
        "monitoreo del pcc",
        "trazabilidad de lote",
        "prerrequisito",
        "límite crítico",
        "limite critico",
    ]):
        if any(term in t for term in ["no ejecutado", "no se ejecutó", "no se ejecuto", "no existe registro", "sin monitoreo"]):
            return "control_not_executed", "food_safety"
        return "missing_evidence", "food_safety"

    # Energía / activos
    if any(term in t for term in [
        "energético",
        "energetico",
        "energía",
        "energia",
        "desempeño energético",
        "desempeno energetico",
        "consumo",
        "uso significativo de energía",
    ]):
        if any(term in t for term in ["kpi", "indicador", "deteriorado", "bajo", "aumentó", "aumento"]):
            return "kpi_deteriorated", "energy_asset_performance"
        return "missing_evidence", "energy_asset_performance"

    # SLA / servicios TI
    if any(term in t for term in [
        "sla",
        "ola",
        "nivel de servicio",
        "niveles de servicio",
        "tiempo de respuesta",
        "tickets fuera de plazo",
        "disponibilidad",
    ]):
        return "kpi_deteriorated", "service_level_management"

    # Privacidad
    if any(term in t for term in [
        "privacidad",
        "datos personales",
        "tratamiento de datos",
        "titular",
        "pii",
        "consentimiento",
    ]):
        if any(term in t for term in ["riesgo", "sin tratamiento", "controles definidos"]):
            return "risk_without_treatment", "privacy_personal_data"
        return "missing_evidence", "privacy_personal_data"

    # Emergencias
    if any(term in t for term in [
        "simulacro",
        "emergencia",
        "plan de emergencia",
        "evacuación",
        "evacuacion",
        "respuesta ante emergencias",
    ]):
        return "procedure_not_implemented", "emergency_preparedness"

    # Compliance legal
    if any(term in t for term in [
        "obligación legal",
        "obligacion legal",
        "obligación regulatoria",
        "obligacion regulatoria",
        "matriz legal",
        "requisito legal",
        "cumplimiento legal",
        "regulatoria",
        "regulatorio",
    ]):
        if any(term in t for term in ["vencido", "vencida", "desactualizada", "sin evidencia", "no vigente"]):
            return "expired_evidence", "legal_regulatory_compliance"
        return "missing_evidence", "legal_regulatory_compliance"

    # Fallbacks por norma si el texto es muy genérico.
    if standard == "ISO50001" and any(term in t for term in ["kpi", "indicador", "deteriorado"]):
        return "kpi_deteriorated", "energy_asset_performance"

    if standard == "ISO20000-1" and any(term in t for term in ["kpi", "indicador", "sla"]):
        return "kpi_deteriorated", "service_level_management"

    return None, None
