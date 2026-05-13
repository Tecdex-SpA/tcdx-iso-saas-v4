from pathlib import Path

p = Path("backend/src/routes/action-plans.routes.js")
text = p.read_text()

old = """      COUNT(e.id)::int AS evidence_count,

      COUNT(e.id) FILTER (
        WHERE LOWER(COALESCE(e.status, '')) IN ('aprobada', 'aprobado', 'approved')
           OR e.validated = true
      )::int AS approved_evidence_count,

      COUNT(e.id) FILTER (
        WHERE LOWER(COALESCE(e.status, '')) IN ('pendiente', 'pending', 'en revision', 'en revisión')
      )::int AS pending_evidence_count,

      COUNT(e.id) FILTER (
        WHERE LOWER(COALESCE(e.status, '')) IN ('rechazada', 'rechazado', 'rejected')
      )::int AS rejected_evidence_count,
"""

new = """      COUNT(e.id)::int AS evidence_count,

      COUNT(e.id) FILTER (
        WHERE e.metadata->>'action_plan_id' = ap.id::text
      )::int AS direct_plan_evidence_count,

      COUNT(e.id) FILTER (
        WHERE ap.tenant_control_id IS NOT NULL
          AND e.tenant_control_id = ap.tenant_control_id
          AND COALESCE(e.metadata->>'action_plan_id', '') <> ap.id::text
      )::int AS control_context_evidence_count,

      COUNT(e.id) FILTER (
        WHERE (
          LOWER(COALESCE(e.status, '')) IN ('aprobada', 'aprobado', 'approved')
          OR e.validated = true
        )
      )::int AS approved_evidence_count,

      COUNT(e.id) FILTER (
        WHERE e.metadata->>'action_plan_id' = ap.id::text
          AND (
            LOWER(COALESCE(e.status, '')) IN ('aprobada', 'aprobado', 'approved')
            OR e.validated = true
          )
      )::int AS approved_direct_plan_evidence_count,

      COUNT(e.id) FILTER (
        WHERE LOWER(COALESCE(e.status, '')) IN ('pendiente', 'pending', 'en revision', 'en revisión')
      )::int AS pending_evidence_count,

      COUNT(e.id) FILTER (
        WHERE LOWER(COALESCE(e.status, '')) IN ('rechazada', 'rechazado', 'rejected')
      )::int AS rejected_evidence_count,
"""

if old not in text:
    raise SystemExit("ERROR: no encontré bloque evidence counters exacto en action-plans.routes.js")

text = text.replace(old, new, 1)

old_gate = """    if (Number(row.approved_evidence_count || 0) <= 0) {
      return res.status(400).json({
        error:
          'Debes contar con al menos una evidencia aprobada para solicitar aprobación',
      });
    }
"""

new_gate = """    if (Number(row.approved_direct_plan_evidence_count || 0) <= 0) {
      return res.status(400).json({
        error:
          'Debes contar con al menos una evidencia directa del plan aprobada para solicitar aprobación',
      });
    }
"""

if old_gate not in text:
    print("ADVERTENCIA: no encontré gate exacto de approved_evidence_count. Solo se aplicó mejora de métricas.")
else:
    text = text.replace(old_gate, new_gate, 1)

p.write_text(text)
print("OK: action-plans.routes.js diferencia evidencia directa vs contextual.")
