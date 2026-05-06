# Matriz de Riesgos Automatizada ISO

## Objetivo

La Fase 1.6 agrega una matriz de riesgos multinorma basada en la base ISO versionada, activos del tenant, diagnostico express y controles mapeados. La matriz genera riesgos sugeridos y acciones candidatas, pero no reemplaza la revision humana ni modifica registros operativos existentes.

## Modelo de Datos

La migracion `database/migrations/20260506_iso_risk_matrix.sql` crea:

- `iso_risk_matrix_runs`: corrida de matriz por tenant, norma y version.
- `iso_risk_matrix_items`: riesgos sugeridos, niveles inherente/residual, trazabilidad y estado de revision.
- `iso_risk_matrix_actions`: acciones recomendadas como candidatos. No crea `action_plans`.
- `iso_risk_matrix_audit_log`: trazabilidad de generacion, revision y archivo.

Vistas:

- `v_iso_risk_matrix_latest_runs`: ultima matriz por tenant/norma/version.
- `v_iso_risk_matrix_summary`: resumen de riesgos por matriz.
- `v_iso_risk_matrix_by_asset`: concentracion de riesgos por activo.
- `v_iso_risk_matrix_actions_summary`: acciones sugeridas por matriz.

## Fuentes

El motor lee:

- `iso_risk_templates`
- `iso_controls`
- `iso_control_catalog_links`
- `iso_evidence_expectations`
- `iso_express_assessments`
- `iso_express_assessment_gaps`
- `assets`
- `asset_standards`
- `asset_risks`
- `tenant_controls`
- `control_health_scores`
- `evidences`

No escribe en esas tablas. Solo escribe en `iso_risk_matrix_*`.

## Scoring

Cada riesgo parte de `default_likelihood` y `default_impact` en `iso_risk_templates`.

El motor ajusta:

- aumenta impacto si el activo es critico o alto;
- aumenta probabilidad si hay brecha critica/alta;
- aumenta probabilidad si falta evidencia esperada;
- aumenta probabilidad si el control esta deteriorado;
- usa efectividad del control para calcular riesgo residual.

Niveles:

- `bajo`: 1-4
- `medio`: 5-9
- `alto`: 10-15
- `critico`: 16-25

Tratamiento sugerido:

- critico/alto: `mitigar`
- medio: `monitorear`
- bajo: `aceptar`

## Endpoints

Base: `/api/iso-risk-matrix`

- `GET /:tenantId/options`
- `POST /:tenantId/generate`
- `GET /:tenantId/runs`
- `GET /:tenantId/runs/:runId`
- `GET /:tenantId/runs/:runId/items`
- `GET /:tenantId/runs/:runId/actions`
- `GET /:tenantId/latest`
- `GET /:tenantId/summary`
- `POST /:tenantId/items/:itemId/review`
- `POST /:tenantId/runs/:runId/archive`

## Dry Run

`POST /generate` soporta `dry_run=true`. En ese modo no escribe nada en BD y devuelve:

- resumen;
- riesgos candidatos;
- acciones candidatas;
- advertencias normativas.

Ejemplo:

```bash
curl -s -X POST "$API/api/iso-risk-matrix/$TENANT_ID/generate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "standard_code":"ISO9001",
    "version_code":"2015",
    "run_type":"automated",
    "include_assets":true,
    "include_diagnostic_gaps":true,
    "include_existing_asset_risks":true,
    "dry_run":true
  }' | jq
```

## Aplicacion Real

Solo se escribe cuando `dry_run=false`. La escritura queda limitada a:

- `iso_risk_matrix_runs`
- `iso_risk_matrix_items`
- `iso_risk_matrix_actions`
- `iso_risk_matrix_audit_log`

No se crean `action_plans`, `findings` ni no conformidades.

## ISO9001 2026_FDIS

ISO9001 `2026_FDIS` solo se permite como `transition_readiness`.

Reglas:

- `certifiable_version=false`;
- no se habla de certificacion final;
- los riesgos se enfocan en preparacion, caveats, cambios documentales y reversibilidad;
- requiere mantener ISO9001:2015 como base certificable.

## ISO42001

ISO42001 puede generar matriz preliminar aunque no haya mapeo operativo suficiente. En ese caso la respuesta advierte que se requiere revision humana y prioriza riesgos de:

- inventario IA;
- impacto IA;
- supervision humana;
- datos/modelos;
- proveedores IA;
- monitoreo de sesgo y desempeno.

## Seguridad Multitenant

Cada endpoint valida acceso al `tenantId` contra el JWT, salvo roles plataforma. El `tenant_id` del body no se acepta como fuente de verdad. Las consultas son parametrizadas y no devuelven rutas de archivos de evidencias.

## Validacion

```bash
node -c backend/src/services/isoRiskMatrix.service.js
node -c backend/src/routes/iso-risk-matrix.routes.js
node -c backend/src/app.js
node -c backend/src/middleware/rbac.middleware.js

grep -RIn "DROP TABLE\|DROP COLUMN\|TRUNCATE\|DELETE FROM\|ALTER TABLE standards\|ALTER TABLE controls_catalog\|ALTER TABLE tenant_controls\|ALTER TABLE tenant_standards\|ALTER TABLE evidences\|ALTER TABLE audits\|ALTER TABLE action_plans\|ALTER TABLE users\|ALTER TABLE tenants\|ALTER TABLE assets\|ALTER TABLE asset_risks" database/migrations/20260506_iso_risk_matrix.sql || true
```

Aplicar migracion:

```bash
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f database/migrations/20260506_iso_risk_matrix.sql
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT USAGE ON SCHEMA public TO tecdex_user;"
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT SELECT, INSERT, UPDATE ON iso_risk_matrix_runs, iso_risk_matrix_items, iso_risk_matrix_actions, iso_risk_matrix_audit_log TO tecdex_user;"
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT SELECT ON v_iso_risk_matrix_latest_runs, v_iso_risk_matrix_summary, v_iso_risk_matrix_by_asset, v_iso_risk_matrix_actions_summary TO tecdex_user;"
```

Validar API:

```bash
export API="http://192.168.100.120:3000"
export TOKEN="PEGAR_TOKEN_VALIDO"
export TENANT_ID="PEGAR_TENANT_ID_VALIDO"

bash scripts/validate-iso-risk-matrix.sh
```

Para generar matriz real ISO9001:2015 durante validacion:

```bash
export APPLY_REAL=true
bash scripts/validate-iso-risk-matrix.sh
```

## Que No Hace Todavia

- No crea planes de accion reales.
- No crea hallazgos.
- No crea no conformidades.
- No modifica `asset_risks`.
- No modifica `tenant_controls`.
- No modifica `evidences`.
- No usa `ai-engine`.

## Proximos Pasos

La siguiente fase natural es convertir acciones sugeridas aceptadas en candidatos revisables para `action_plans`, con aprobacion explicita y trazabilidad, o conectar la matriz con reportes ejecutivos.
