from pathlib import Path
import re

p = Path("backend/src/routes/controls.routes.js")
text = p.read_text()

backup = p.with_suffix(".routes.js.bak_effective_health_view")
backup.write_text(text)

print(f"Backup creado: {backup}")

# ---------------------------------------------------------------------
# 1) Agrega LEFT JOIN contra la vista efectiva de salud en la query del
#    Workbench operativo.
#
#    Buscamos el LEFT JOIN LATERAL de último health, que ya existe en tu query.
#    Insertamos después un LEFT JOIN a public.v_iso_control_effective_health.
# ---------------------------------------------------------------------

join_block = """
      LEFT JOIN public.v_iso_control_effective_health veh
        ON veh.tenant_control_id = tc.id
       AND veh.tenant_id = tc.tenant_id
       AND veh.catalog_control_id = cc.id
       AND veh.operation_id = os.operation_id
       AND veh.iso = $3
"""

if "LEFT JOIN public.v_iso_control_effective_health veh" not in text:
    # Insertar antes del WHERE principal del candidate_controls.
    marker = """
      WHERE cc.is_active = TRUE
"""
    if marker not in text:
        raise SystemExit(
            "ERROR: no encontré el WHERE principal del candidate_controls. "
            "No se aplicó cambio."
        )

    text = text.replace(marker, join_block + marker, 1)
    print("OK: agregado LEFT JOIN public.v_iso_control_effective_health veh.")
else:
    print("OK: LEFT JOIN veh ya existía.")

# ---------------------------------------------------------------------
# 2) Agrega columnas de la vista al SELECT candidate_controls.
#
#    No eliminamos columnas antiguas. Agregamos columnas nuevas con prefijo
#    effective_* y además columnas de conteo enriquecidas.
# ---------------------------------------------------------------------

select_anchor = "          tc.score AS declared_score,"
insert_after = """          tc.score AS declared_score,
          veh.effective_health_score,
          veh.effective_health_status,
          veh.compliance_bucket AS effective_compliance_bucket,
          veh.evidence_quality_status,
          veh.approved_evidence_count,
          veh.official_evidence_count,
          veh.open_action_plans_count,
          veh.overdue_action_plans_count,
          veh.is_in_active_operational_scope,
          veh.health_trace_json,"""

if "veh.effective_health_score" not in text:
    if select_anchor not in text:
        raise SystemExit(
            "ERROR: no encontré 'tc.score AS declared_score,' para insertar columnas veh."
        )
    text = text.replace(select_anchor, insert_after, 1)
    print("OK: columnas veh agregadas al SELECT.")
else:
    print("OK: columnas veh ya existían.")

# ---------------------------------------------------------------------
# 3) Reemplaza el mapeo JS de healthScore/derivedStatus/complianceBucket.
#
#    La idea:
#    - si la vista trae valor, manda la vista
#    - si la vista no trae valor, mantiene lógica anterior
#
#    Esto evita romper controles sin fila en la vista o entornos donde la vista
#    todavía no esté poblada correctamente.
# ---------------------------------------------------------------------

old = """    const items = result.rows.map((row) => {
      const healthScore = Number(row.health_score || 0);

      let derivedStatus = row.derived_health_status || null;
      if (!derivedStatus) {
        if (healthScore < 50) derivedStatus = 'deteriorado';
        else if (healthScore < 80) derivedStatus = 'atencion';
        else derivedStatus = 'saludable';
      }

      let complianceBucket = 'cumple';
      if (healthScore < 50) complianceBucket = 'no cumple';
      else if (healthScore < 80) complianceBucket = 'parcial';

      return {
        ...row,
        health_score: healthScore,
        derived_health_status: derivedStatus,
        compliance_bucket: complianceBucket,
      };
    });"""

new = """    const items = result.rows.map((row) => {
      const fallbackHealth = getWorkbenchDerivedHealth(row);

      const effectiveHealthScore =
        row.effective_health_score !== null && row.effective_health_score !== undefined
          ? Number(row.effective_health_score || 0)
          : Number(fallbackHealth.health_score || 0);

      const effectiveHealthStatus =
        row.effective_health_status ||
        fallbackHealth.derived_health_status ||
        'sin_datos';

      let complianceBucket =
        row.effective_compliance_bucket ||
        row.compliance_bucket ||
        null;

      if (!complianceBucket) {
        if (effectiveHealthScore >= 80) complianceBucket = 'cumple';
        else if (effectiveHealthScore >= 50) complianceBucket = 'parcial';
        else if (effectiveHealthScore > 0) complianceBucket = 'no_cumple';
        else complianceBucket = 'sin_datos';
      }

      return {
        ...row,

        // Campos legacy que consume el frontend actual.
        health_score: effectiveHealthScore,
        derived_health_status: effectiveHealthStatus,
        compliance_bucket: complianceBucket,

        // Campos nuevos para trazabilidad y próximos módulos.
        effective_health_score: effectiveHealthScore,
        effective_health_status: effectiveHealthStatus,
        evidence_quality_status: row.evidence_quality_status || 'sin_evidencia',
        approved_evidence_count: Number(row.approved_evidence_count || 0),
        official_evidence_count: Number(row.official_evidence_count || 0),
        open_action_plans_count: Number(row.open_action_plans_count || 0),
        overdue_action_plans_count: Number(row.overdue_action_plans_count || 0),
        is_in_active_operational_scope:
          row.is_in_active_operational_scope === null ||
          row.is_in_active_operational_scope === undefined
            ? true
            : Boolean(row.is_in_active_operational_scope),
        health_trace_json: row.health_trace_json || null,
      };
    });"""

if old in text:
    text = text.replace(old, new, 1)
    print("OK: mapeo JS del Workbench reemplazado por salud efectiva.")
else:
    # Fallback más flexible si el bloque exacto ya cambió.
    pattern = re.compile(
        r"""    const items = result\.rows\.map\(\(row\) => \{\s*
      const healthScore = Number\(row\.health_score \|\| 0\);\s*
\s*
      let derivedStatus = row\.derived_health_status \|\| null;\s*
      if \(!derivedStatus\) \{\s*
        if \(healthScore < 50\) derivedStatus = 'deteriorado';\s*
        else if \(healthScore < 80\) derivedStatus = 'atencion';\s*
        else derivedStatus = 'saludable';\s*
      \}\s*
\s*
      let complianceBucket = 'cumple';\s*
      if \(healthScore < 50\) complianceBucket = 'no cumple';\s*
      else if \(healthScore < 80\) complianceBucket = 'parcial';\s*
\s*
      return \{\s*
        \.\.\.row,\s*
        health_score: healthScore,\s*
        derived_health_status: derivedStatus,\s*
        compliance_bucket: complianceBucket,\s*
      \};\s*
    \}\);""",
        re.MULTILINE,
    )

    text2, n = pattern.subn(new, text, count=1)

    if n == 0:
        raise SystemExit(
            "ERROR: no encontré el bloque de mapeo result.rows.map. "
            "Ejecuta: sed -n '950,1030p' backend/src/routes/controls.routes.js"
        )

    text = text2
    print("OK: mapeo JS reemplazado con patrón flexible.")

p.write_text(text)

print("OK: patch aplicado en backend/src/routes/controls.routes.js")
