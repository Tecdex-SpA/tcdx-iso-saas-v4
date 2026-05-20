import json
import os
import urllib.parse
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from sqlalchemy import text
from app.core.db import engine
from app.services.finding_scenario_detector import detect_finding_scenario


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _safe_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    if isinstance(value, tuple):
        return [str(item).strip() for item in value if str(item).strip()]

    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except Exception:
            return [value.strip()]

    return []


def _load_trusted_sources(
    standard_code: Optional[str] = None,
    domain_code: Optional[str] = None,
    source_profile: Optional[str] = None,
    limit: int = 8,
) -> List[Dict[str, Any]]:
    conditions = ["is_active = TRUE"]
    params = {
        "standard_code": standard_code,
        "domain_code": domain_code,
        "source_profile": source_profile,
        "limit": max(1, min(int(limit or 8), 20)),
    }

    if standard_code:
        conditions.append(
            """
            (
              applicable_standards = '[]'::jsonb
              OR applicable_standards ? :standard_code
            )
            """
        )

    if domain_code:
        conditions.append(
            """
            (
              applicable_domains = '[]'::jsonb
              OR applicable_domains ? :domain_code
            )
            """
        )

    # source_profile todavía es una etiqueta de escenario.
    # Aquí no filtramos duro por perfil, para no dejar fuentes fuera.
    sql = f"""
      SELECT
        source_code,
        source_name,
        source_type,
        base_url,
        allowed_domains,
        applicable_domains,
        applicable_standards,
        description,
        trust_level,
        metadata
      FROM ai_core.trusted_external_sources
      WHERE {' AND '.join(conditions)}
      ORDER BY
        CASE trust_level
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        source_code
      LIMIT :limit
    """

    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).mappings().all()

    sources = []

    for row in rows:
        sources.append({
            "source_code": row.get("source_code"),
            "source_name": row.get("source_name"),
            "source_type": row.get("source_type"),
            "base_url": row.get("base_url"),
            "allowed_domains": _safe_list(row.get("allowed_domains")),
            "applicable_domains": _safe_list(row.get("applicable_domains")),
            "applicable_standards": _safe_list(row.get("applicable_standards")),
            "description": row.get("description"),
            "trust_level": row.get("trust_level"),
            "metadata": row.get("metadata") or {},
        })

    return sources


def _build_queries(payload: Dict[str, Any], scenario: Dict[str, Any]) -> List[str]:
    title = _safe_text(payload.get("title"))
    description = _safe_text(payload.get("description"))
    standard_code = _safe_text(
        payload.get("standard_code") or payload.get("iso_code") or payload.get("iso")
    )

    scenario_code = _safe_text(scenario.get("scenario_code"))
    scenario_name = _safe_text(scenario.get("scenario_name"))
    domain_code = _safe_text(scenario.get("domain_code"))
    problem_type_code = _safe_text(scenario.get("problem_type_code"))
    external_profile = _safe_text(scenario.get("external_source_profile"))

    title_l = title.lower()
    desc_l = description.lower()
    combined = f"{title_l} {desc_l} {scenario_code}".lower()

    queries = []

    # -------------------------------------------------
    # Escenarios específicos: contraseñas/autenticación
    # -------------------------------------------------
    if (
        "password" in combined
        or "contraseña" in combined
        or "contrasena" in combined
        or "credencial" in combined
        or "autentic" in combined
        or "password_authentication_weakness" in scenario_code
    ):
        queries.extend([
            "password authentication policy account lockout failed login attempts security guidance",
            "database password authentication policy account lockout privileged accounts guidance",
            "NIST password policy account lockout failed authentication guidance",
            "OWASP authentication password policy account lockout guidance",
            "CIS Controls account management password policy privileged accounts",
            "PostgreSQL password authentication failed login attempts account lockout guidance",
            "Oracle database password policy failed login attempts profile guidance",
            "Microsoft password protection account lockout policy guidance",
        ])

    # -------------------------------------------------
    # Backups/restauración
    # -------------------------------------------------
    elif "backup" in combined or "respaldo" in combined or "restore" in combined or "restaur" in combined:
        queries.extend([
            "backup restore test validation evidence RTO RPO guidance",
            "NIST contingency planning backup restore testing guidance",
            "VMware backup restore testing validation guidance",
            "database backup restore validation integrity guidance",
        ])

    # -------------------------------------------------
    # Cloud exposure
    # -------------------------------------------------
    elif "cloud" in combined or "bucket" in combined or "security group" in combined or "0.0.0.0" in combined:
        queries.extend([
            "cloud security misconfiguration public exposure remediation guidance",
            "AWS public S3 bucket security remediation guidance",
            "CIS cloud security benchmark public exposure access management",
            "Google Cloud IAM public access remediation guidance",
            "Microsoft Azure public access security remediation guidance",
        ])

    # -------------------------------------------------
    # Calibración/metrología
    # -------------------------------------------------
    elif "calibr" in combined or "metrolog" in combined or "tolerancia" in combined:
        queries.extend([
            "expired calibration certificate impact assessment corrective action guidance",
            "equipment out of tolerance impact assessment metrology guidance",
            "ISO 17025 calibration certificate traceability impact assessment guidance",
        ])

    # -------------------------------------------------
    # Fallback general
    # -------------------------------------------------
    else:
        if standard_code and scenario_name:
            queries.append(f"{standard_code} {scenario_name} remediation guidance")

        if scenario_name:
            queries.append(f"{scenario_name} corrective action evidence closure criteria")

        if domain_code:
            queries.append(f"{domain_code.replace('_', ' ')} {problem_type_code.replace('_', ' ')} best practices")

        if external_profile:
            queries.append(f"{external_profile.replace('_', ' ')} {scenario_name}")

        if title:
            queries.append(f"{title} remediation guidance")

    # Queries transversales con norma si aplica
    if standard_code and scenario_name:
        queries.append(f"{standard_code} {scenario_name} corrective action evidence")

    # Limpieza y deduplicación
    clean = []
    seen = set()

    for q in queries:
        q = " ".join(str(q).split()).strip()
        key = q.lower()

        if q and key not in seen:
            clean.append(q)
            seen.add(key)

    return clean[:8]

def _log_external_lookup(
    tenant_id: Optional[str],
    standard_code: Optional[str],
    domain_code: Optional[str],
    problem_type_code: Optional[str],
    scenario_code: Optional[str],
    query_text: str,
    lookup_reason: Optional[str],
    sources_requested: List[Dict[str, Any]],
    result_summary: str,
    metadata: Dict[str, Any],
) -> Optional[str]:
    sql = """
      INSERT INTO ai_core.external_lookup_logs (
        tenant_id,
        standard_code,
        domain_code,
        problem_type_code,
        scenario_code,
        query_text,
        lookup_reason,
        sources_requested,
        sources_used,
        result_summary,
        response_used,
        quality_score,
        metadata
      )
      VALUES (
        NULLIF(:tenant_id, '')::uuid,
        :standard_code,
        :domain_code,
        :problem_type_code,
        :scenario_code,
        :query_text,
        :lookup_reason,
        CAST(:sources_requested AS jsonb),
        '[]'::jsonb,
        :result_summary,
        FALSE,
        NULL,
        CAST(:metadata AS jsonb)
      )
      RETURNING id::text
    """

    params = {
        "tenant_id": tenant_id or "",
        "standard_code": standard_code,
        "domain_code": domain_code,
        "problem_type_code": problem_type_code,
        "scenario_code": scenario_code,
        "query_text": query_text,
        "lookup_reason": lookup_reason,
        "sources_requested": json.dumps(sources_requested, ensure_ascii=False),
        "result_summary": result_summary,
        "metadata": json.dumps(metadata or {}, ensure_ascii=False),
    }

    with engine.begin() as conn:
        row = conn.execute(text(sql), params).mappings().first()

    return row.get("id") if row else None


def build_external_lookup_plan(payload: Dict[str, Any]) -> Dict[str, Any]:
    scenario_detection = detect_finding_scenario(payload)

    standard_code = _safe_text(
        payload.get("standard_code") or payload.get("iso_code") or payload.get("iso")
    )
    tenant_id = _safe_text(payload.get("tenant_id"))

    if not scenario_detection.get("detected"):
        return {
            "ok": True,
            "external_lookup_ready": False,
            "reason": "No se detectó un escenario suficientemente confiable para sugerir búsqueda externa.",
            "scenario_detection": scenario_detection,
            "sources": [],
            "queries": [],
        }

    scenario = scenario_detection.get("scenario") or {}

    requires_external_lookup = bool(scenario.get("requires_external_lookup"))
    domain_code = _safe_text(scenario.get("domain_code"))
    problem_type_code = _safe_text(scenario.get("problem_type_code"))
    scenario_code = _safe_text(scenario.get("scenario_code"))
    source_profile = _safe_text(scenario.get("external_source_profile"))
    lookup_reason = _safe_text(scenario.get("external_lookup_reason"))

    sources = _load_trusted_sources(
        standard_code=standard_code,
        domain_code=domain_code,
        source_profile=source_profile,
        limit=15,
    )

    queries = _build_queries(payload, scenario)

    result_summary = (
        "Plan de búsqueda externa generado. "
        "Aún no ejecuta consulta a internet; selecciona fuentes confiables y consultas sugeridas."
    )

    log_id = _log_external_lookup(
        tenant_id=tenant_id,
        standard_code=standard_code,
        domain_code=domain_code,
        problem_type_code=problem_type_code,
        scenario_code=scenario_code,
        query_text=queries[0] if queries else _safe_text(payload.get("title")),
        lookup_reason=lookup_reason,
        sources_requested=sources,
        result_summary=result_summary,
        metadata={
            "mode": "lookup_plan_only",
            "requires_external_lookup": requires_external_lookup,
            "source_profile": source_profile,
        },
    )

    return {
        "ok": True,
        "external_lookup_ready": True,
        "mode": "lookup_plan_only",
        "executed_web_search": False,
        "log_id": log_id,
        "requires_external_lookup": requires_external_lookup,
        "lookup_reason": lookup_reason,
        "source_profile": source_profile,
        "scenario": {
            "scenario_code": scenario_code,
            "scenario_name": scenario.get("scenario_name"),
            "domain_code": domain_code,
            "problem_type_code": problem_type_code,
            "score": scenario.get("score"),
        },
        "queries": queries,
        "sources": sources,
        "note": (
            "Este paso prepara una búsqueda externa controlada. "
            "La ejecución real contra Google/Bing/SerpAPI se activará en el siguiente paso con API key."
        ),
    }


def _domain_allowed(url: str, allowed_domains: List[str]) -> bool:
    if not url or not allowed_domains:
        return False

    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return False

    host = host.split(":")[0].replace("www.", "")

    for domain in allowed_domains:
        d = str(domain or "").lower().replace("www.", "").strip()
        if not d:
            continue
        if host == d or host.endswith("." + d):
            return True

    return False


def _result_usable_as_context(item: Dict[str, Any]) -> bool:
    text = " ".join([
        str(item.get("title") or ""),
        str(item.get("description") or ""),
        str(item.get("url") or ""),
    ]).lower()
    if any(blocked in text for blocked in ["casino", "gambling", "adult", "coupon", "torrent"]):
        return False
    return any(term in text for term in [
        "iso",
        "audit",
        "auditor",
        "risk",
        "evidence",
        "management system",
        "certification",
        "quality management",
        "information security",
    ])


def _collect_allowed_domains(sources: List[Dict[str, Any]]) -> List[str]:
    domains = []

    for source in sources:
        for domain in source.get("allowed_domains") or []:
            domain = str(domain or "").strip().lower().replace("www.", "")
            if domain and domain not in domains:
                domains.append(domain)

    return domains


def _brave_web_search(query: str, count: int = 5) -> Dict[str, Any]:
    api_key = os.getenv("BRAVE_SEARCH_API_KEY")

    if not api_key:
        return {
            "ok": False,
            "error": "BRAVE_SEARCH_API_KEY no configurada en el servicio IA.",
            "query": query,
            "results": [],
        }

    max_results = int(os.getenv("BRAVE_SEARCH_MAX_RESULTS_PER_QUERY", "5") or "5")
    count = max(1, min(int(count or max_results), max_results, 10))

    endpoint = "https://api.search.brave.com/res/v1/web/search"

    params = urllib.parse.urlencode({
        "q": query,
        "count": count,
        "search_lang": "en",
        "country": "us",
    })

    req = urllib.request.Request(
        f"{endpoint}?{params}",
        headers={
            "Accept": "application/json",
            "Accept-Encoding": "identity",
            "X-Subscription-Token": api_key,
            "User-Agent": "TCDX-AI-Engine/1.0",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            raw = response.read().decode("utf-8", errors="replace")
            data = json.loads(raw)

        web_results = data.get("web", {}).get("results", []) or []

        results = []
        for item in web_results:
            results.append({
                "title": item.get("title"),
                "url": item.get("url"),
                "description": item.get("description"),
                "age": item.get("age"),
                "source": "brave_web_search",
            })

        return {
            "ok": True,
            "query": query,
            "results": results,
            "raw_result_count": len(results),
        }

    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else str(e)
        return {
            "ok": False,
            "query": query,
            "error": f"HTTP {e.code}: {detail[:500]}",
            "results": [],
        }
    except Exception as e:
        return {
            "ok": False,
            "query": query,
            "error": str(e),
            "results": [],
        }


def _log_external_search_result(
    tenant_id: Optional[str],
    standard_code: Optional[str],
    domain_code: Optional[str],
    problem_type_code: Optional[str],
    scenario_code: Optional[str],
    query_text: str,
    lookup_reason: Optional[str],
    sources_requested: List[Dict[str, Any]],
    sources_used: List[Dict[str, Any]],
    result_summary: str,
    response_used: bool,
    quality_score: Optional[float],
    metadata: Dict[str, Any],
) -> Optional[str]:
    sql = """
      INSERT INTO ai_core.external_lookup_logs (
        tenant_id,
        standard_code,
        domain_code,
        problem_type_code,
        scenario_code,
        query_text,
        lookup_reason,
        sources_requested,
        sources_used,
        result_summary,
        response_used,
        quality_score,
        metadata
      )
      VALUES (
        NULLIF(:tenant_id, '')::uuid,
        :standard_code,
        :domain_code,
        :problem_type_code,
        :scenario_code,
        :query_text,
        :lookup_reason,
        CAST(:sources_requested AS jsonb),
        CAST(:sources_used AS jsonb),
        :result_summary,
        :response_used,
        :quality_score,
        CAST(:metadata AS jsonb)
      )
      RETURNING id::text
    """

    params = {
        "tenant_id": tenant_id or "",
        "standard_code": standard_code,
        "domain_code": domain_code,
        "problem_type_code": problem_type_code,
        "scenario_code": scenario_code,
        "query_text": query_text,
        "lookup_reason": lookup_reason,
        "sources_requested": json.dumps(sources_requested, ensure_ascii=False),
        "sources_used": json.dumps(sources_used, ensure_ascii=False),
        "result_summary": result_summary,
        "response_used": response_used,
        "quality_score": quality_score,
        "metadata": json.dumps(metadata or {}, ensure_ascii=False),
    }

    with engine.begin() as conn:
        row = conn.execute(text(sql), params).mappings().first()

    return row.get("id") if row else None



def _build_external_guidance_from_results(
    scenario: Dict[str, Any],
    trusted_results: List[Dict[str, Any]],
) -> Dict[str, Any]:
    scenario_code = _safe_text(scenario.get("scenario_code"))
    scenario_name = _safe_text(scenario.get("scenario_name"))
    domain_code = _safe_text(scenario.get("domain_code"))
    problem_type_code = _safe_text(scenario.get("problem_type_code"))

    source_summaries = []
    used_domains = []

    for item in trusted_results[:8]:
        domain = _safe_text(item.get("matched_trusted_domain"))
        if domain and domain not in used_domains:
            used_domains.append(domain)

        source_summaries.append({
            "title": item.get("title"),
            "url": item.get("url"),
            "domain": domain,
            "description": item.get("description"),
        })

    # Guías específicas por escenario
    if scenario_code == "password_authentication_weakness":
        common_recommendations = [
            "Validar que la política técnica de contraseñas esté configurada en el sistema afectado, no solo documentada.",
            "Revisar longitud mínima, complejidad, reutilización/historial de contraseñas y vigencia según criticidad del sistema.",
            "Configurar bloqueo o mitigación frente a intentos fallidos cuando la tecnología lo permita.",
            "Revisar cuentas privilegiadas, cuentas genéricas, cuentas inactivas y credenciales por defecto.",
            "Aplicar MFA para accesos administrativos o remotos cuando sea técnicamente viable.",
            "Registrar evidencia posterior al cambio y validación del responsable técnico.",
        ]

        how_to_apply = [
            "Levantar configuración actual de autenticación del motor BD o aplicación.",
            "Comparar configuración actual contra política interna, baseline técnico y buenas prácticas.",
            "Ejecutar cambio controlado para endurecer parámetros débiles.",
            "Eliminar o bloquear credenciales inseguras y cuentas no justificadas.",
            "Documentar ticket de cambio, capturas/export de configuración y validación posterior.",
        ]

        evidence_to_collect = [
            "Captura o export de configuración posterior al cambio.",
            "Política de contraseñas vigente y aprobada.",
            "Ticket de cambio o registro de configuración aplicada.",
            "Matriz o listado revisado de cuentas privilegiadas.",
            "Evidencia de eliminación/bloqueo de credenciales por defecto o cuentas compartidas no justificadas.",
            "Validación técnica del responsable del sistema.",
        ]

        cautions = [
            "No basta una política escrita si no existe evidencia de configuración aplicada.",
            "No incluir contraseñas reales en evidencias o capturas.",
            "Evitar subir información sensible del cliente a buscadores externos.",
            "Si la tecnología no permite bloqueo por intentos fallidos, documentar control compensatorio.",
        ]

    elif "backup" in scenario_code or "restore" in scenario_code:
        common_recommendations = [
            "Ejecutar pruebas periódicas de restauración, no solo verificar que el backup finalizó correctamente.",
            "Validar integridad, tiempo de recuperación y alcance de datos restaurados.",
            "Comparar resultados contra RTO/RPO definidos.",
            "Registrar brechas y acciones correctivas cuando la restauración falle o tarde más de lo esperado.",
        ]

        how_to_apply = [
            "Seleccionar sistema o datos críticos.",
            "Restaurar en ambiente controlado.",
            "Validar integridad y funcionalidad.",
            "Documentar tiempo de recuperación y resultado.",
            "Actualizar plan de continuidad o respaldo según brechas detectadas.",
        ]

        evidence_to_collect = [
            "Registro de backup ejecutado.",
            "Acta o reporte de restauración.",
            "Logs o capturas del proceso de restore.",
            "Validación de integridad.",
            "Comparación contra RTO/RPO.",
            "Acciones correctivas si hubo desviaciones.",
        ]

        cautions = [
            "Un backup exitoso no demuestra recuperabilidad si nunca fue restaurado.",
            "No probar restauraciones directamente sobre producción sin control.",
        ]

    elif "cloud" in scenario_code:
        common_recommendations = [
            "Revisar exposición pública, permisos amplios y configuraciones inseguras.",
            "Aplicar principio de mínimo privilegio.",
            "Registrar excepción formal si una exposición pública es necesaria.",
            "Habilitar monitoreo o alertas para cambios críticos.",
        ]

        how_to_apply = [
            "Identificar recurso cloud expuesto.",
            "Validar necesidad de exposición.",
            "Corregir permisos o configuración.",
            "Documentar riesgo residual o excepción.",
            "Registrar evidencia posterior.",
        ]

        evidence_to_collect = [
            "Captura/configuración antes y después.",
            "Ticket de cambio.",
            "Evaluación de riesgo.",
            "Aprobación de excepción si aplica.",
            "Evidencia de monitoreo habilitado.",
        ]

        cautions = [
            "No publicar identificadores sensibles, URLs internas o secretos en evidencia.",
            "No asumir que un recurso público es aceptable sin aprobación formal.",
        ]

    elif "calibration" in scenario_code or "calibr" in scenario_code:
        common_recommendations = [
            "Regularizar calibración o verificación del equipo.",
            "Bloquear uso de equipo fuera de vigencia si impacta resultados.",
            "Evaluar impacto sobre mediciones o resultados emitidos.",
            "Actualizar programa de calibración y estado del equipo.",
        ]

        how_to_apply = [
            "Identificar equipo y uso crítico.",
            "Revisar certificado y vigencia.",
            "Evaluar resultados afectados.",
            "Ejecutar calibración/verificación.",
            "Documentar decisión técnica.",
        ]

        evidence_to_collect = [
            "Certificado vigente.",
            "Inventario actualizado.",
            "Evaluación de impacto.",
            "Registro de bloqueo/liberación.",
            "Acción correctiva si aplica.",
        ]

        cautions = [
            "No cerrar solo adjuntando certificado nuevo si hubo uso fuera de vigencia.",
            "Debe evaluarse impacto sobre resultados previos.",
        ]

    else:
        common_recommendations = [
            "Contrastar el hallazgo contra fuentes técnicas confiables.",
            "Identificar acciones correctivas aplicables al contexto real del cliente.",
            "Documentar evidencia objetiva posterior al cambio.",
            "Validar cierre con responsable del proceso o control.",
        ]

        how_to_apply = [
            "Revisar fuentes externas encontradas.",
            "Seleccionar recomendaciones aplicables.",
            "Ejecutar acción controlada.",
            "Registrar evidencia.",
            "Validar eficacia o cierre.",
        ]

        evidence_to_collect = [
            "Documento técnico o procedimiento aplicable.",
            "Registro de cambio o acción.",
            "Evidencia posterior.",
            "Validación del responsable.",
        ]

        cautions = [
            "No usar recomendaciones externas sin validar aplicabilidad al contexto del cliente.",
            "No enviar datos sensibles del cliente a buscadores externos.",
        ]

    return {
        "scenario_code": scenario_code,
        "scenario_name": scenario_name,
        "domain_code": domain_code,
        "problem_type_code": problem_type_code,
        "summary": (
            f"Se encontraron fuentes externas confiables para respaldar el escenario "
            f"{scenario_code or scenario_name}. La recomendación debe aplicarse considerando "
            f"la tecnología afectada, criticidad del sistema y evidencia disponible."
        ),
        "common_recommendations": common_recommendations,
        "how_to_apply": how_to_apply,
        "evidence_to_collect": evidence_to_collect,
        "cautions": cautions,
        "sources_used_count": len(trusted_results),
        "domains_used": used_domains,
        "source_summaries": source_summaries,
    }


def _load_recent_successful_external_lookup(
    tenant_id: Optional[str],
    standard_code: Optional[str],
    domain_code: Optional[str],
    problem_type_code: Optional[str],
    scenario_code: Optional[str],
    max_age_days: int = 30,
) -> Optional[Dict[str, Any]]:
    sql = """
      SELECT
        id::text AS id,
        tenant_id::text AS tenant_id,
        standard_code,
        domain_code,
        problem_type_code,
        scenario_code,
        query_text,
        lookup_reason,
        sources_requested,
        sources_used,
        result_summary,
        response_used,
        quality_score,
        metadata,
        created_at
      FROM ai_core.external_lookup_logs
      WHERE response_used = TRUE
        AND jsonb_array_length(COALESCE(sources_used, '[]'::jsonb)) > 0
        AND created_at >= now() - (:max_age_days || ' days')::interval
        AND (:tenant_id IS NULL OR tenant_id = NULLIF(:tenant_id, '')::uuid)
        AND (:standard_code IS NULL OR standard_code = :standard_code)
        AND (:domain_code IS NULL OR domain_code = :domain_code)
        AND (:problem_type_code IS NULL OR problem_type_code = :problem_type_code)
        AND (:scenario_code IS NULL OR scenario_code = :scenario_code)
      ORDER BY quality_score DESC NULLS LAST, created_at DESC
      LIMIT 1
    """

    params = {
        "tenant_id": tenant_id or None,
        "standard_code": standard_code or None,
        "domain_code": domain_code or None,
        "problem_type_code": problem_type_code or None,
        "scenario_code": scenario_code or None,
        "max_age_days": int(max_age_days or 30),
    }

    with engine.connect() as conn:
        row = conn.execute(text(sql), params).mappings().first()

    if not row:
        return None

    def as_json(value: Any, fallback: Any):
        if value is None:
            return fallback
        if isinstance(value, (dict, list)):
            return value
        try:
            return json.loads(value)
        except Exception:
            return fallback

    return {
        "id": row.get("id"),
        "tenant_id": row.get("tenant_id"),
        "standard_code": row.get("standard_code"),
        "domain_code": row.get("domain_code"),
        "problem_type_code": row.get("problem_type_code"),
        "scenario_code": row.get("scenario_code"),
        "query_text": row.get("query_text"),
        "lookup_reason": row.get("lookup_reason"),
        "sources_requested": as_json(row.get("sources_requested"), []),
        "sources_used": as_json(row.get("sources_used"), []),
        "result_summary": row.get("result_summary"),
        "response_used": row.get("response_used"),
        "quality_score": row.get("quality_score"),
        "metadata": as_json(row.get("metadata"), {}),
        "created_at": str(row.get("created_at")) if row.get("created_at") else None,
    }


def _check_external_lookup_quota(tenant_id: Optional[str]) -> Dict[str, Any]:
    sql = """
      WITH quota AS (
        SELECT
          q.monthly_limit
        FROM ai_core.external_lookup_quotas q
        WHERE q.is_active = TRUE
          AND (
            q.tenant_id = NULLIF(:tenant_id, '')::uuid
            OR q.is_default = TRUE
          )
        ORDER BY
          CASE WHEN q.tenant_id = NULLIF(:tenant_id, '')::uuid THEN 1 ELSE 2 END
        LIMIT 1
      ),
      usage AS (
        SELECT
          COALESCE(SUM(u.used_count), 0)::integer AS used_count
        FROM ai_core.v_external_lookup_usage_monthly u
        WHERE u.tenant_id = COALESCE(NULLIF(:tenant_id, '')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
          AND u.usage_month = date_trunc('month', now())::date
      )
      SELECT
        COALESCE((SELECT monthly_limit FROM quota), 100)::integer AS monthly_limit,
        COALESCE((SELECT used_count FROM usage), 0)::integer AS used_count
    """

    params = {
        "tenant_id": tenant_id or "",
    }

    with engine.connect() as conn:
        row = conn.execute(text(sql), params).mappings().first()

    monthly_limit = int(row.get("monthly_limit") or 100)
    used_count = int(row.get("used_count") or 0)
    remaining = max(monthly_limit - used_count, 0)

    return {
        "monthly_limit": monthly_limit,
        "used_count": used_count,
        "remaining": remaining,
        "allowed": remaining > 0,
    }

def execute_external_lookup_search(payload: Dict[str, Any]) -> Dict[str, Any]:
    plan = build_external_lookup_plan(payload)

    if not plan.get("external_lookup_ready"):
        return {
            **plan,
            "executed_web_search": False,
            "search_results": [],
            "trusted_results": [],
            "message": "No se ejecutó búsqueda porque no hay escenario confiable.",
        }

    scenario = plan.get("scenario") or {}
    standard_code = _safe_text(payload.get("standard_code") or payload.get("iso_code") or payload.get("iso"))
    tenant_id = _safe_text(payload.get("tenant_id"))
    domain_code = _safe_text(scenario.get("domain_code"))
    problem_type_code = _safe_text(scenario.get("problem_type_code"))
    scenario_code = _safe_text(scenario.get("scenario_code"))

    force_refresh = bool(payload.get("force_refresh") or payload.get("refresh_external_lookup"))

    if not force_refresh:
        cached = _load_recent_successful_external_lookup(
            tenant_id=tenant_id,
            standard_code=standard_code,
            domain_code=domain_code,
            problem_type_code=problem_type_code,
            scenario_code=scenario_code,
            max_age_days=int(os.getenv("EXTERNAL_LOOKUP_CACHE_DAYS", "30") or "30"),
        )

        if cached:
            trusted_results = cached.get("sources_used") or []
            external_guidance = _build_external_guidance_from_results(
                scenario=scenario,
                trusted_results=trusted_results,
            ) if trusted_results else None

            return {
                **plan,
                "mode": "cached_external_lookup",
                "executed_web_search": False,
                "from_cache": True,
                "cache_hit": True,
                "cached_log_id": cached.get("id"),
                "search_log_id": cached.get("id"),
                "trusted_results_count": len(trusted_results),
                "trusted_results": trusted_results,
                "external_guidance": external_guidance,
                "result_summary": (
                    "Búsqueda externa reutilizada desde caché. "
                    f"No se consumió API. Log original: {cached.get('id')}."
                ),
                "quality_score": cached.get("quality_score"),
                "cached_created_at": cached.get("created_at"),
                "usage_guardrails": {
                    "cache_days": int(os.getenv("EXTERNAL_LOOKUP_CACHE_DAYS", "30") or "30"),
                    "api_consumed": False,
                    "force_refresh_available": True,
                    "trusted_domain_filtering": True,
                },
            }

    quota = _check_external_lookup_quota(tenant_id)

    if not quota.get("allowed"):
        return {
            **plan,
            "mode": "quota_exceeded",
            "executed_web_search": False,
            "from_cache": False,
            "cache_hit": False,
            "trusted_results": [],
            "trusted_results_count": 0,
            "external_guidance": None,
            "error": "Límite mensual de búsquedas externas agotado para este tenant.",
            "quota": quota,
            "usage_guardrails": {
                "api_consumed": False,
                "reason": "monthly_quota_exceeded",
            },
        }

    api_key = os.getenv("BRAVE_SEARCH_API_KEY")
    if not api_key:
        return {
            **plan,
            "executed_web_search": False,
            "search_results": [],
            "trusted_results": [],
            "error": "BRAVE_SEARCH_API_KEY no configurada.",
            "quota": quota,
        }

    max_queries = int(os.getenv("BRAVE_SEARCH_MAX_QUERIES_PER_REQUEST", "3") or "3")
    max_results = int(os.getenv("BRAVE_SEARCH_MAX_RESULTS_PER_QUERY", "5") or "5")

    base_queries = plan.get("queries") or []
    sources = plan.get("sources") or []
    allowed_domains = _collect_allowed_domains(sources)

    # Crear queries dirigidas con site:dominio para mejorar precisión.
    preferred_domains = [
        d for d in allowed_domains
        if d in [
            "nist.gov",
            "nvlpubs.nist.gov",
            "cisecurity.org",
            "owasp.org",
            "cheatsheetseries.owasp.org",
            "postgresql.org",
            "docs.oracle.com",
            "learn.microsoft.com",
            "docs.aws.amazon.com",
            "cloud.google.com",
            "docs.fortinet.com",
            "docs.vmware.com",
            "knowledge.broadcom.com"
        ]
    ]

    site_queries = []
    if base_queries:
        main_query = base_queries[0]
        for domain in preferred_domains[:6]:
            site_queries.append(f"site:{domain} {main_query}")

    query_pool = site_queries + base_queries

    # Deduplicar queries
    deduped_queries = []
    seen_queries = set()
    for q in query_pool:
        key = str(q).lower().strip()
        if key and key not in seen_queries:
            deduped_queries.append(q)
            seen_queries.add(key)

    queries = deduped_queries[:max(1, min(max_queries, 8))]

    all_results = []
    trusted_results = []
    usable_context_results = []
    rejected_results = []

    for query in queries:
        result = _brave_web_search(query, count=max_results)
        all_results.append(result)

        for item in result.get("results", []):
            if _domain_allowed(item.get("url"), allowed_domains):
                trusted_results.append({
                    **item,
                    "matched_trusted_domain": urlparse(item.get("url") or "").netloc.lower().replace("www.", ""),
                    "query": query,
                    "classification": "trusted",
                })
            elif _result_usable_as_context(item):
                usable_context_results.append({
                    **item,
                    "query": query,
                    "classification": "usable_context",
                })
            else:
                rejected_results.append({
                    **item,
                    "query": query,
                    "rejected_reason": "domain_not_in_trusted_sources",
                })

    # Deduplicar por URL
    deduped = []
    seen_urls = set()

    for item in trusted_results:
        url = item.get("url")
        if not url or url in seen_urls:
            continue
        deduped.append(item)
        seen_urls.add(url)

    trusted_results = deduped[:12]
    if not trusted_results and usable_context_results:
        deduped_usable = []
        seen_urls = set()
        for item in usable_context_results:
            url = item.get("url")
            if not url or url in seen_urls:
                continue
            deduped_usable.append(item)
            seen_urls.add(url)
        usable_context_results = deduped_usable[:12]
    else:
        usable_context_results = usable_context_results[:12]

    result_summary = (
        f"Búsqueda externa ejecutada con Brave Search. "
        f"Consultas ejecutadas: {len(queries)}. "
        f"Resultados confiables filtrados: {len(trusted_results)}. "
        f"Resultados de contexto usable: {len(usable_context_results)}."
    )

    quality_score = 0.0
    if trusted_results:
        quality_score = min(100.0, 50.0 + len(trusted_results) * 8)
    elif usable_context_results:
        quality_score = min(100.0, 35.0 + len(usable_context_results) * 5)

    external_guidance = _build_external_guidance_from_results(
        scenario=scenario,
        trusted_results=trusted_results or usable_context_results,
    ) if (trusted_results or usable_context_results) else None

    log_id = _log_external_search_result(
        tenant_id=tenant_id,
        standard_code=standard_code,
        domain_code=domain_code,
        problem_type_code=problem_type_code,
        scenario_code=scenario_code,
        query_text=queries[0] if queries else _safe_text(payload.get("title")),
        lookup_reason=plan.get("lookup_reason"),
        sources_requested=sources,
        sources_used=trusted_results,
        result_summary=result_summary,
        response_used=bool(trusted_results),
        quality_score=quality_score if quality_score else None,
        metadata={
            "mode": "brave_web_search",
            "executed_queries": queries,
            "total_raw_batches": len(all_results),
            "trusted_domains": allowed_domains,
            "rejected_count": len(rejected_results),
            "previous_plan_log_id": plan.get("log_id"),
        },
    )

    return {
        **plan,
        "mode": "brave_web_search",
        "executed_web_search": True,
        "search_log_id": log_id,
        "queries_executed": queries,
        "trusted_domains": allowed_domains,
        "trusted_results_count": len(trusted_results),
        "trusted_results": trusted_results,
        "usable_context_count": len(usable_context_results),
        "usable_context_results": usable_context_results,
        "external_guidance": external_guidance,
        "raw_batches": all_results,
        "rejected_results_count": len(rejected_results),
        "context_limitation": None if trusted_results else "Referencias externas usadas como apoyo contextual, no como fuente normativa oficial.",
        "result_summary": result_summary,
        "quality_score": quality_score if quality_score else None,
        "quota": quota,
        "usage_guardrails": {
            "max_queries_per_request": max_queries,
            "max_results_per_query": max_results,
            "trusted_domain_filtering": True,
            "client_sensitive_data_sent": False,
            "api_consumed": True,
            "quota_remaining_before_request": quota.get("remaining"),
        },
    }


def get_cached_external_lookup(payload: Dict[str, Any]) -> Dict[str, Any]:
    plan = build_external_lookup_plan(payload)

    if not plan.get("external_lookup_ready"):
        return {
            **plan,
            "mode": "cache_only",
            "executed_web_search": False,
            "from_cache": False,
            "cache_hit": False,
            "trusted_results": [],
            "trusted_results_count": 0,
            "external_guidance": None,
            "message": "No hay escenario confiable para buscar caché externo.",
        }

    scenario = plan.get("scenario") or {}
    standard_code = _safe_text(payload.get("standard_code") or payload.get("iso_code") or payload.get("iso"))
    tenant_id = _safe_text(payload.get("tenant_id"))
    domain_code = _safe_text(scenario.get("domain_code"))
    problem_type_code = _safe_text(scenario.get("problem_type_code"))
    scenario_code = _safe_text(scenario.get("scenario_code"))

    cached = _load_recent_successful_external_lookup(
        tenant_id=tenant_id,
        standard_code=standard_code,
        domain_code=domain_code,
        problem_type_code=problem_type_code,
        scenario_code=scenario_code,
        max_age_days=int(os.getenv("EXTERNAL_LOOKUP_CACHE_DAYS", "30") or "30"),
    )

    if not cached:
        return {
            **plan,
            "mode": "cache_only",
            "executed_web_search": False,
            "from_cache": False,
            "cache_hit": False,
            "trusted_results": [],
            "trusted_results_count": 0,
            "external_guidance": None,
            "message": "No existe respaldo externo previo en caché para este escenario.",
        }

    trusted_results = cached.get("sources_used") or []
    external_guidance = _build_external_guidance_from_results(
        scenario=scenario,
        trusted_results=trusted_results,
    ) if trusted_results else None

    return {
        **plan,
        "mode": "cache_only",
        "executed_web_search": False,
        "from_cache": True,
        "cache_hit": True,
        "cached_log_id": cached.get("id"),
        "search_log_id": cached.get("id"),
        "trusted_results_count": len(trusted_results),
        "trusted_results": trusted_results,
        "external_guidance": external_guidance,
        "result_summary": (
            "Respaldo externo cargado desde caché interno. "
            f"No se consumió API externa. Log original: {cached.get('id')}."
        ),
        "quality_score": cached.get("quality_score"),
        "cached_created_at": cached.get("created_at"),
        "usage_guardrails": {
            "cache_days": int(os.getenv("EXTERNAL_LOOKUP_CACHE_DAYS", "30") or "30"),
            "api_consumed": False,
            "force_refresh_available": True,
            "trusted_domain_filtering": True,
        },
    }
