# Diagnostico ISO Express

## Objetivo

La Fase 1.4 agrega un diagnostico express multinorma que usa la base normativa versionada `iso_*` y los links gobernados hacia `controls_catalog`. El flujo crea snapshots por tenant para mostrar preparacion, brechas, evidencias faltantes y un plan 30/60/90 sin modificar controles operativos.

## Modelo de Datos

Tablas nuevas:

- `iso_express_assessments`: cabecera del diagnostico y resumen ejecutivo.
- `iso_express_assessment_items`: resultado por control ISO evaluado.
- `iso_express_assessment_gaps`: brechas calculadas por el motor.
- `iso_express_assessment_answers`: respuestas manuales futuras.
- `iso_express_assessment_audit_log`: trazabilidad de calculo y archivo.

Vistas nuevas:

- `v_iso_express_tenant_standard_readiness`: normas/versiones evaluables por tenant.
- `v_iso_express_latest_assessments`: ultimo diagnostico por tenant/norma/version.
- `v_iso_express_gap_summary`: resumen de brechas por diagnostico.

Esta fase no crea `tenant_controls`, no crea `findings`, no crea `action_plans` y no modifica `controls_catalog`.

## Fuentes Usadas

El motor lee:

- `iso_standard_versions`
- `iso_controls`
- `iso_evidence_expectations`
- `iso_gap_rules`
- `iso_risk_templates`
- `iso_control_catalog_links`
- `v_iso_control_catalog_coverage`
- `tenant_standards`
- `tenant_controls`
- `evidences`
- `control_health_scores`

El cruce operativo siempre pasa por `iso_control_catalog_links`. Si un control ISO no tiene link gobernado, se reporta como brecha de mapeo en vez de asumir equivalencias.

## Scoring

El score por control parte de estas reglas:

- Control mapeado, existente para el tenant y con evidencia suficiente: score alto.
- Control mapeado pero sin evidencia: score medio.
- Control mapeado pero no inicializado para el tenant: score bajo.
- Control sin mapeo operativo: score critico/preliminar.
- Health deteriorado penaliza el score.

El score global promedia los controles y aplica penalizaciones por cobertura baja y brechas. Los niveles son:

- `listo`: 85-100
- `avanzado`: 70-84
- `en_progreso`: 50-69
- `inicial`: 30-49
- `critico`: 0-29

Para transicion se usan niveles `transicion_*`.

## Regla ISO9001 2026_FDIS

`ISO9001 / 2026_FDIS` se trata solo como preparacion de transicion:

- `certifiable_version=false`
- `assessment_type=transition_readiness`
- no reemplaza ISO9001:2015
- no genera controles operativos
- no habilita diagnostico de certificacion final

## Regla ISO42001

`ISO42001 / 2023` puede evaluarse de forma preliminar desde `iso_*`, pero si no hay mapeo operativo suficiente se muestra advertencia de cobertura. No se fuerzan links ni controles tenant.

## Endpoints

Todos los endpoints requieren JWT/RBAC:

- `GET /api/iso-express-diagnostic/options/:tenantId`
- `POST /api/iso-express-diagnostic/:tenantId/calculate`
- `GET /api/iso-express-diagnostic/:tenantId/latest`
- `GET /api/iso-express-diagnostic/:tenantId/:assessmentId`
- `GET /api/iso-express-diagnostic/:tenantId/:assessmentId/gaps`
- `GET /api/iso-express-diagnostic/:tenantId/:assessmentId/plan`
- `POST /api/iso-express-diagnostic/:tenantId/:assessmentId/archive`
- `GET /api/iso-express-diagnostic/:tenantId/readiness`

## Seguridad Multitenant

El `tenantId` viene de la URL y se valida contra `req.user.tenant_id`, salvo roles plataforma permitidos. El body no se usa como fuente de tenant. Las consultas son parametrizadas y no se devuelven rutas de archivos ni secretos.

## Aplicar Migracion

```bash
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f database/migrations/20260506_iso_express_diagnostic.sql
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT SELECT, INSERT, UPDATE ON iso_express_assessments, iso_express_assessment_items, iso_express_assessment_gaps, iso_express_assessment_answers, iso_express_assessment_audit_log TO tecdex_user;"
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT SELECT ON v_iso_express_tenant_standard_readiness, v_iso_express_latest_assessments, v_iso_express_gap_summary TO tecdex_user;"
```

## Validar BD

```bash
psql "$DATABASE_URL_ADMIN" -c "\\dt public.iso_express*"

psql "$DATABASE_URL_ADMIN" -c "
SELECT 'standards' AS table_name, COUNT(*) FROM standards
UNION ALL SELECT 'tenant_standards', COUNT(*) FROM tenant_standards
UNION ALL SELECT 'controls_catalog', COUNT(*) FROM controls_catalog
UNION ALL SELECT 'tenant_controls', COUNT(*) FROM tenant_controls
UNION ALL SELECT 'evidences', COUNT(*) FROM evidences;
"
```

Los conteos operativos esperados siguen siendo:

- `standards`: 26
- `tenant_standards`: 23
- `controls_catalog`: 3237
- `tenant_controls`: 1358
- `evidences`: 205

## Validar API

```bash
export API="http://bk.tcdx.int:3000"
export TOKEN="PEGAR_TOKEN_VALIDO"
export TENANT_ID="PEGAR_TENANT_ID_VALIDO"

bash scripts/validate-iso-express-diagnostic.sh
```

Ejemplos:

```bash
curl -s "$API/api/iso-express-diagnostic/options/$TENANT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s -X POST "$API/api/iso-express-diagnostic/$TENANT_ID/calculate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"standard_code":"ISO9001","version_code":"2015","assessment_type":"express","answers":[]}' | jq

curl -s -X POST "$API/api/iso-express-diagnostic/$TENANT_ID/calculate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"standard_code":"ISO9001","version_code":"2026_FDIS","assessment_type":"transition_readiness","answers":[]}' | jq
```

## Frontend

La vista `frontend/src/app/diagnostico/page.tsx` mantiene el diagnostico operativo existente y agrega un panel de Diagnostico ISO Express. No toca Sidebar, Header ni AppLayout.

## Que No Hace Esta Fase

- No genera politicas.
- No genera procedimientos.
- No crea planes de accion.
- No crea hallazgos.
- No inicializa `tenant_controls`.
- No modifica catalogos operativos.
- No toca `ai-engine`.

## Proximos Pasos

La siguiente fase recomendada es usar estos snapshots para generar reporte ejecutivo premium y, despues, conectar brechas seleccionadas con sugerencias de accion revisables por usuario.
