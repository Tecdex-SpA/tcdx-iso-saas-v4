from pathlib import Path

p = Path("backend/src/routes/controls.routes.js")
text = p.read_text()

old_evidence = """        LEFT JOIN evidences e
          ON e.tenant_id = tc.tenant_id
         AND (
              e.tenant_control_id = tc.id
              OR e.control_id = tc.control_id
         )
         AND COALESCE(e.status, '') <> 'deleted'
"""

new_evidence = """        LEFT JOIN evidences e
          ON e.tenant_id = tc.tenant_id
         AND COALESCE(e.status, '') <> 'deleted'
         AND (
              e.tenant_control_id = tc.id
              OR (
                e.tenant_control_id IS NULL
                AND e.control_id = tc.control_id
                AND (
                  e.metadata->>'operation_id' IS NULL
                  OR e.metadata->>'operation_id' = tc.operation_id::text
                )
              )
         )
"""

if old_evidence not in text:
    raise SystemExit("ERROR: no encontré bloque evidence_stats exacto en controls.routes.js")

text = text.replace(old_evidence, new_evidence, 1)

old_nc = """        LEFT JOIN tenant_nonconformities tnc
          ON tnc.tenant_id = tc.tenant_id
         AND tnc.control_id = tc.control_id
"""

new_nc = """        LEFT JOIN tenant_nonconformities tnc
          ON tnc.tenant_id = tc.tenant_id
         AND (
              tnc.control_id = tc.control_id
              AND (
                tnc.metadata->>'operation_id' IS NULL
                OR tnc.metadata->>'operation_id' = tc.operation_id::text
              )
         )
"""

if old_nc not in text:
    raise SystemExit("ERROR: no encontré bloque nonconformity_stats exacto en controls.routes.js")

text = text.replace(old_nc, new_nc, 1)

old_finding = """        LEFT JOIN findings f
          ON f.tenant_id = tc.tenant_id
         AND (
              f.tenant_control_id = tc.id
              OR (
                lc.controls_id_legacy IS NOT NULL
                AND f.tenant_control_id = lc.controls_id_legacy
              )
         )
"""

new_finding = """        LEFT JOIN findings f
          ON f.tenant_id = tc.tenant_id
         AND (
              f.tenant_control_id = tc.id
              OR (
                lc.controls_id_legacy IS NOT NULL
                AND f.tenant_control_id = lc.controls_id_legacy
                AND (
                  f.metadata->>'operation_id' IS NULL
                  OR f.metadata->>'operation_id' = tc.operation_id::text
                )
              )
         )
"""

if old_finding not in text:
    raise SystemExit("ERROR: no encontré bloque finding_stats exacto en controls.routes.js")

text = text.replace(old_finding, new_finding, 1)

p.write_text(text)
print("OK: controls.routes.js protegido contra contaminación operacional básica.")
