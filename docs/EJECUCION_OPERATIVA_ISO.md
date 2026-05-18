# Ejecucion Operativa ISO

## Objetivo

La Fase 1.7 crea el puente entre inteligencia ISO y ejecucion operativa. El sistema toma brechas, riesgos, documentos, salud de controles, evidencias, hallazgos, no conformidades y activos, y los convierte en sugerencias revisables.

La regla central es simple: **generar sugerencias no crea registros operativos**. Solo una aprobacion humana crea un plan de accion, hallazgo, no conformidad o solicitud operativa.

## Modelo de Datos

Migracion:

`database/migrations/20260506_iso_operational_execution.sql`

Tablas:

- `iso_operational_suggestions`: bandeja de sugerencias operativas.
- `iso_operational_suggestion_audit_log`: auditoria de generacion, aprobacion y rechazo.

Vistas:

- `v_iso_operational_suggestions_summary`: resumen por tenant/norma.
- `v_iso_operational_suggestions_queue`: cola enriquecida con datos de control.

## Fuentes

El motor lee:

- `iso_express_assessments`
- `iso_express_assessment_gaps`
- `iso_risk_matrix_actions`
- `iso_risk_matrix_items`
- `iso_generated_documents`
- `control_health_scores`
- `tenant_controls`
- `evidences`
- `findings`
- `tenant_nonconformities`
- `assets`
- `asset_risks`
- `action_plans`

Durante `generate` solo escribe en `iso_operational_suggestions` y su audit log.

## Flujo

1. `POST /api/iso-operational-execution/generate`
   - Lee las fuentes.
   - Deduplica por `tenant_id + dedupe_key`.
   - Guarda sugerencias `pending`.
   - No crea planes ni hallazgos.

2. Usuario revisa en `/ejecucion-iso`.

3. `POST /api/iso-operational-execution/:id/approve`
   - Con `dry_run=true`, valida que podria crear el registro.
   - Sin `dry_run`, crea el registro operativo solicitado.
   - Actualiza la sugerencia con `created_record_type` y `created_record_id`.

4. `POST /api/iso-operational-execution/:id/reject`
   - Marca la sugerencia como rechazada.
   - Guarda comentario y trazabilidad.

## Endpoints

- `GET /api/iso-operational-execution/summary`
- `GET /api/iso-operational-execution/suggestions`
- `POST /api/iso-operational-execution/generate`
- `GET /api/iso-operational-execution/:id`
- `POST /api/iso-operational-execution/:id/approve`
- `POST /api/iso-operational-execution/:id/reject`

Los endpoints resuelven `tenant_id` desde el JWT. Roles plataforma pueden enviar `tenant_id`.

## Tipos de Sugerencia

Ejemplos:

- `accion_correctiva`
- `accion_preventiva`
- `solicitud_evidencia`
- `revision_documental`
- `revision_control`
- `tarea_riesgo`
- `tarea_auditoria`
- `tarea_capacitacion`
- `tarea_gobierno`
- `preparacion_certificacion`

## Destinos

`target_record_type` permitido:

- `action_plan`
- `finding`
- `nonconformity`
- `evidence_request`

Por seguridad, el motor prioriza `action_plan` como destino por defecto. Para `finding` y `nonconformity` exige control operativo resoluble.

## Deduplicacion

Cada sugerencia tiene `dedupe_key`. Existe un indice unico parcial:

`tenant_id + dedupe_key` cuando `status IN ('pending', 'approved', 'applied')`.

Esto evita repetir la misma recomendacion activa, pero permite regenerar una sugerencia previamente rechazada.

## Seguridad Multitenant

- El tenant se resuelve desde JWT.
- `tenant_id` enviado por request solo aplica a roles plataforma.
- Toda consulta filtra por tenant.
- No se aceptan escrituras masivas.
- `generate` no crea registros operativos.
- `approve` es transaccional.

## Validacion

```bash
node -c backend/src/services/isoOperationalExecution.service.js
node -c backend/src/routes/iso-operational-execution.routes.js
node -c backend/src/app.js
node -c backend/src/middleware/rbac.middleware.js

cd frontend
npm run build
cd ..
```

Anti-riesgo:

```bash
grep -RIn "DROP TABLE\|DROP COLUMN\|TRUNCATE\|DELETE FROM\|ALTER TABLE standards\|ALTER TABLE controls_catalog\|ALTER TABLE tenant_controls\|ALTER TABLE tenant_standards\|ALTER TABLE evidences\|ALTER TABLE action_plans\|ALTER TABLE findings\|ALTER TABLE tenant_nonconformities\|ALTER TABLE users\|ALTER TABLE tenants" database/migrations/20260506_iso_operational_execution.sql || true
```

Aplicar migracion:

```bash
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f database/migrations/20260506_iso_operational_execution.sql
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT USAGE ON SCHEMA public TO tecdex_user;"
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT SELECT, INSERT, UPDATE ON iso_operational_suggestions, iso_operational_suggestion_audit_log TO tecdex_user;"
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT SELECT ON v_iso_operational_suggestions_summary, v_iso_operational_suggestions_queue TO tecdex_user;"
```

Validar API:

```bash
export API_URL="http://bk.tcdx.int:3000"
export TEST_EMAIL="admin@rieltec.com"
export TEST_PASSWORD="123456"

bash scripts/validate-iso-operational-execution.sh
```

## Que No Hace Todavia

- No convierte automaticamente todas las sugerencias.
- No crea evidencias reales.
- No modifica `tenant_controls`.
- No cierra hallazgos o no conformidades.
- No usa `ai-engine` como dependencia obligatoria.

## Proximos Pasos

- Agregar reglas de aprobacion por rol.
- Crear workflow de asignacion y SLA.
- Permitir convertir acciones aceptadas en paquetes 30/60/90.
- Conectar aprobaciones con reportes ejecutivos.
