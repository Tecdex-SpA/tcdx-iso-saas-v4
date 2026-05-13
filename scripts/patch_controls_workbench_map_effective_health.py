from pathlib import Path

p = Path("backend/src/routes/controls.routes.js")
text = p.read_text()

backup = p.with_suffix(".routes.js.bak_map_effective_health")
backup.write_text(text)
print(f"Backup creado: {backup}")

start_marker = "    const items = result.rows.map((row) => {"
start = text.find(start_marker)

if start == -1:
    raise SystemExit("ERROR: no encontré 'const items = result.rows.map((row) => {'.")

# Buscamos el cierre del map. Después normalmente viene una línea en blanco y summary/healthyControls.
possible_end_markers = [
    "\n\n    const healthyControls",
    "\n\n    const summary",
    "\n\n    const average",
    "\n\n    return res.json",
]

end = -1
used_marker = None

for marker in possible_end_markers:
    pos = text.find(marker, start)
    if pos != -1:
        if end == -1 or pos < end:
            end = pos
            used_marker = marker

if end == -1:
    raise SystemExit(
        "ERROR: encontré el inicio del map, pero no encontré dónde termina. "
        "Ejecuta: sed -n '950,1040p' backend/src/routes/controls.routes.js"
    )

old_block = text[start:end]

new_block = """    const items = result.rows.map((row) => {
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

        // Compatibilidad con frontend actual.
        health_score: effectiveHealthScore,
        derived_health_status: effectiveHealthStatus,
        compliance_bucket: complianceBucket,

        // Campos nuevos para salud efectiva / auditoría / KPI.
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

text = text[:start] + new_block + text[end:]

p.write_text(text)

print("OK: bloque result.rows.map reemplazado.")
print(f"Marcador de término usado: {used_marker.strip() if used_marker else 'N/A'}")
