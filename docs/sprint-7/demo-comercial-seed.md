# Sprint 7.1 - Seed demo comercial TCDX

## Objetivo

Crear un tenant demo comercial estable para pilotos pagados y demostraciones de TCDX Compliance, con datos suficientes para Dashboard, Health/KPIs, Cumplimiento/Auditoria, Evidencias, Riesgos, Planes de Accion, Reportes Premium y Recomendador de Alcance ISO.

El SQL queda en:

```text
database/demo/demo_comercial_tcdx.sql
```

## Alcance del seed

El script crea o reutiliza el tenant `Empresa Demo TCDX Compliance`, industria `Servicios tecnologicos / SaaS B2B`, con alcance ISO 9001 e ISO 27001.

Datos principales:

- Tenant demo y perfil comercial/aplicabilidad.
- Usuarios demo por rol.
- Normas activas `ISO9001` e `ISO27001`.
- Procesos y operaciones demo por norma.
- Asociacion operativa en `tenant_standard_operations`.
- Controles tenant-scoped si existe `tenant_controls` y catalogo de controles.
- Evidencias demo en `evidences`, con metadata sin archivos fisicos.
- Documentos indexados demo en `document_index` usando fuente `sharepoint` preparada y sin credenciales.
- Activos y riesgos en `assets` / `asset_risks` si existen.
- Matriz de riesgos ISO en `iso_risk_matrix_*` si existe.
- Brechas diagnosticas en `iso_express_*` si existen.
- Planes de accion con mezcla de estados y fechas vencidas.
- Auditorias, hallazgos y no conformidades si las tablas existen.
- Ciclo de vida ISO si existen las tablas `standard_lifecycle_*`.

El script no toca frontend, backend, IA Engine, Google Drive, Zoho WorkDrive ni carga manual.

## Usuarios demo

Todos usan la password demo sugerida:

```text
Demo.123456
```

El SQL inserta `password_hash` bcrypt compatible con backend Node.js. No inserta passwords en texto plano.

| Rol demo | Email | Rol tecnico |
| --- | --- | --- |
| Ejecutivo Cliente | `ejecutivo.demo@tcdx.local` | `viewer` |
| Admin Cumplimiento | `admin.demo@tcdx.local` | `admin` |
| Auditor | `auditor.demo@tcdx.local` | `auditor` |
| Responsable Calidad | `responsable.calidad.demo@tcdx.local` | `operativo` |
| Responsable TI | `responsable.ti.demo@tcdx.local` | `operativo` |

## Copiar a la VM DB

Desde la maquina local:

```bash
scp database/demo/demo_comercial_tcdx.sql tecdex@bd.tcdx.int:/tmp/demo_comercial_tcdx.sql
```

## Ejecutar en la VM DB

Conectado a la VM:

```bash
PGPASSWORD='<DB_PASSWORD>' psql -h localhost -U postgres -d tecdex_saas -f /tmp/demo_comercial_tcdx.sql
```

No guardar passwords reales en el repositorio ni en documentos. Usar variable de entorno o secreto operacional temporal.

## Validar ejecucion

Identificar tenant demo:

```sql
SELECT id, name, rut, business
FROM tenants
WHERE lower(name) = lower('Empresa Demo TCDX Compliance');
```

Listar usuarios demo:

```sql
SELECT tenant_id, email, role, name, full_name
FROM users
WHERE email IN (
  'ejecutivo.demo@tcdx.local',
  'admin.demo@tcdx.local',
  'auditor.demo@tcdx.local',
  'responsable.calidad.demo@tcdx.local',
  'responsable.ti.demo@tcdx.local'
)
ORDER BY email;
```

Listar normas asociadas:

```sql
SELECT ts.tenant_id, ts.standard_code, ts.is_active
FROM tenant_standards ts
JOIN tenants t ON t.id = ts.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
ORDER BY ts.standard_code;
```

Listar procesos demo:

```sql
SELECT p.code, p.name, p.area, p.criticality, p.is_active
FROM tenant_processes p
JOIN tenants t ON t.id = p.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
ORDER BY p.sort_order, p.name;
```

Listar operaciones por norma:

```sql
SELECT tso.standard_code, op.code, op.name, op.is_active
FROM tenant_standard_operations tso
JOIN tenant_operations op ON op.id = tso.operation_id
JOIN tenants t ON t.id = tso.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
ORDER BY tso.standard_code, op.sort_order, op.name;
```

Listar evidencias demo:

```sql
SELECT e.description, e.status, e.validated, e.metadata->>'standard_code' AS standard_code
FROM evidences e
JOIN tenants t ON t.id = e.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
  AND e.metadata->>'demo_seed' = 'sprint-7.1'
ORDER BY standard_code, e.description;
```

Listar documentos indexados demo:

```sql
SELECT di.id, di.file_name, di.provider, di.status, di.metadata_json->>'standard_code' AS standard_code
FROM document_index di
JOIN tenants t ON t.id = di.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
  AND di.metadata_json->>'demo_seed' = 'sprint-7.1'
ORDER BY standard_code, di.file_name;
```

Listar riesgos demo:

```sql
SELECT a.iso, a.name AS asset_name, ar.risk, ar.level
FROM asset_risks ar
JOIN assets a ON a.id = ar.asset_id
JOIN tenants t ON t.id = a.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
ORDER BY a.iso, ar.level DESC, ar.risk;
```

Listar brechas demo:

```sql
SELECT g.standard_code, g.title, g.severity, g.gap_type
FROM iso_express_assessment_gaps g
JOIN tenants t ON t.id = g.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
  AND g.metadata->>'demo_seed' = 'sprint-7.1'
ORDER BY g.standard_code, g.severity DESC, g.title;
```

Listar acciones demo:

```sql
SELECT ap.iso_code, ap.title, ap.status, ap.priority, ap.owner, ap.due_date,
       (ap.status NOT IN ('completado', 'cancelado') AND ap.due_date < CURRENT_DATE) AS vencida
FROM action_plans ap
JOIN tenants t ON t.id = ap.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
ORDER BY ap.iso_code, ap.due_date NULLS LAST, ap.title;
```

Listar auditorias demo:

```sql
SELECT a.iso, a.start_date, a.end_date, a.requester_name, a.auditor_name, a.status
FROM audits a
JOIN tenants t ON t.id = a.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
ORDER BY a.iso, a.start_date;
```

Listar ciclo de vida demo:

```sql
SELECT sls.standard_code, sls.calculated_stage_code, sls.confirmed_stage_code,
       sls.effective_stage_code, sls.health_status, sls.maturity_score
FROM standard_lifecycle_status sls
JOIN tenants t ON t.id = sls.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
ORDER BY sls.standard_code;
```

## Rollback manual seguro

No ejecutar rollback sin backup reciente. Recomendacion: restaurar desde backup si el piloto requiere volver a estado exacto anterior.

Rollback tenant-scoped, manual y solo demo:

```sql
BEGIN;

WITH demo AS (
  SELECT id
  FROM tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
)
SELECT id AS demo_tenant_id
FROM demo;

-- Revisar el tenant_id antes de borrar.
-- Luego borrar datos dependientes solo para ese tenant.

DELETE FROM evidence_document_links
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM document_ai_analysis
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM document_association_suggestions
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM document_index
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM tenant_document_sources
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM tenant_integrations
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM standard_lifecycle_stage_requests
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM standard_lifecycle_snapshots
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM standard_lifecycle_status
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM iso_risk_matrix_actions
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM iso_risk_matrix_items
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM iso_risk_matrix_runs
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM iso_express_assessment_gaps
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM iso_express_assessment_items
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM iso_express_assessment_answers
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM iso_express_assessment_audit_log
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM iso_express_assessments
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM findings
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM tenant_nonconformities
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM action_plans
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM evidences
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM asset_risks
WHERE asset_id IN (
  SELECT id
  FROM assets
  WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'))
);

DELETE FROM asset_standards
WHERE asset_id IN (
  SELECT id
  FROM assets
  WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'))
);

DELETE FROM assets
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM tenant_controls
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM tenant_standard_operations
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM tenant_operations
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM tenant_processes
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM tenant_applicability_profiles
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM tenant_company_profiles
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM tenant_standards
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'));

DELETE FROM users
WHERE tenant_id = (SELECT id FROM tenants WHERE lower(name) = lower('Empresa Demo TCDX Compliance'))
  AND email LIKE '%.demo@tcdx.local';

DELETE FROM tenants
WHERE lower(name) = lower('Empresa Demo TCDX Compliance');

-- COMMIT solo despues de revisar conteos.
-- COMMIT;
ROLLBACK;
```

Si una tabla no existe en la base instalada, omitir manualmente ese `DELETE`. No borrar tablas globales como `standards`, `iso_standards`, `controls_catalog` o catalogos ISO.

## Riesgos y limitaciones

- El repositorio no contiene DDL base completo para algunas tablas historicas (`tenants`, `users`, `standards`, `assets`, `audits`, etc.); el seed usa contratos observados en backend y guards por tabla para modulos opcionales.
- Las evidencias y `document_index` son metadata demo; no hay archivos fisicos descargables.
- El script no ejecuta migraciones. Si faltan tablas de Sprint 5/6, las secciones correspondientes se omiten o notifican por `NOTICE`.
- El rollback recomendado es backup/restore. El rollback SQL manual debe revisarse antes de cambiar `ROLLBACK` por `COMMIT`.

## Validaciones locales esperadas

Antes de copiar a la VM:

```bash
git diff --check
```

Revisar que el diff no contenga secretos reales:

```bash
git diff -- database/demo/demo_comercial_tcdx.sql docs/sprint-7/demo-comercial-seed.md | grep -Ei 'password|secret|token|apikey|api_key|PGPASSWORD'
```

La aparicion de `password_hash`, `Demo.123456` y `PGPASSWORD='<DB_PASSWORD>'` es esperada. No debe aparecer una password real.
