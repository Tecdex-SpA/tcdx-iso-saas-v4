# Base de Conocimiento ISO Multinorma

## Objetivo

Crear una capa normativa global, versionada y gobernada para TCDX ISO Compliance sin reemplazar el modelo operativo actual. Esta base sirve como columna vertebral para diagnostico express, generadores documentales, IA Auditor Senior, riesgos, evidencias, controles, reportes premium, preparacion de certificacion y transicion ISO 9001.

La fase 1.1 no modifica datos de tenants, no inicializa controles operativos y no toca frontend ni ai-engine.

## Tablas creadas

- `iso_standards`: familias normativas globales.
- `iso_standard_versions`: versiones por norma, con estado de publicacion y bandera `certifiable`.
- `iso_clauses`: clausulas o dominios resumidos por version.
- `iso_controls`: controles o requisitos operativos versionados.
- `iso_control_catalog_links`: puente futuro entre `iso_controls` y `controls_catalog`.
- `iso_control_mappings`: crosswalks entre normas y versiones.
- `iso_evidence_expectations`: evidencias esperadas por control.
- `iso_policy_templates`: plantillas base de politicas.
- `iso_procedure_templates`: plantillas base de procedimientos.
- `iso_risk_templates`: riesgos tipicos por norma.
- `iso_audit_questions`: preguntas base para auditoria.
- `iso_gap_rules`: reglas para deteccion de brechas.
- `iso_maturity_rules`: criterios de madurez.
- `iso_transition_guidance`: guia de transicion entre versiones.
- `iso_ai_guidance`: instrucciones gobernadas para IA.
- `iso_catalog_sync_status`: estado liviano de sincronizacion futura.

## Por que `iso_*`

El prefijo `iso_*` separa la fuente normativa maestra de las tablas operativas. La plataforma ya usa `standards`, `controls_catalog`, `tenant_standards`, `tenant_controls`, `evidences`, `ai_knowledge_*` e `iso_clause_guides` para operaciones reales. Esta fase agrega una capa normativa reusable sin cambiar esas tablas.

## Relacion con tablas existentes

`standards` sigue siendo el catalogo simple usado por modulos existentes.

`controls_catalog` sigue siendo el catalogo operativo actual de controles. No se reemplaza ni se migra en esta fase.

`controls_catalog_standards` sigue relacionando controles operativos con normas actuales.

`tenant_standards` sigue representando normas activas por tenant. La base `iso_*` no crea ni modifica activaciones por tenant.

`tenant_controls` sigue representando estado operativo de controles por tenant. La base `iso_*` no inicializa controles.

`ai_knowledge_*` sigue siendo la base IA existente. En fases futuras puede sincronizarse o enriquecerse desde `iso_*`, dejando trazabilidad.

`iso_clause_guides` sigue siendo una tabla existente compatible. No se modifica en esta fase.

`iso_control_catalog_links` es el puente no destructivo para mapear controles normativos `iso_controls` hacia `controls_catalog`. En esta fase queda preparado y el estado de avance se documenta en `iso_catalog_sync_status`.

## Regla ISO 9001:2026_FDIS

ISO 9001:2026_FDIS se registra solo como preparacion de transicion:

- `publication_status = 'transition_prep'`.
- `certifiable = false`.
- No reemplaza operativamente a ISO 9001:2015.
- No habilita certificacion final.
- No crea `tenant_standards`.
- No crea `tenant_controls`.
- No debe presentarse como version final certificable.

ISO 9001:2015 permanece como version certificable vigente en esta fase.

## Migracion

Archivo:

```bash
database/migrations/20260506_iso_knowledge_base.sql
```

Aplicar:

```bash
psql "$DATABASE_URL" -f database/migrations/20260506_iso_knowledge_base.sql
```

La migracion es no destructiva: crea extension `pgcrypto`, tablas `iso_*`, indices y comentarios. No altera tablas operativas.

## Seeds

Aplicar en este orden:

```bash
psql "$DATABASE_URL" -f database/seeds/20260506_seed_iso_knowledge_base.sql
psql "$DATABASE_URL" -f database/seeds/20260506_seed_iso9001_2015.sql
psql "$DATABASE_URL" -f database/seeds/20260506_seed_iso9001_2026_fdis.sql
psql "$DATABASE_URL" -f database/seeds/20260506_seed_iso27001_2022.sql
psql "$DATABASE_URL" -f database/seeds/20260506_seed_iso42001_2023.sql
psql "$DATABASE_URL" -f database/seeds/20260506_seed_iso_crosswalks.sql
psql "$DATABASE_URL" -f database/seeds/20260506_seed_iso_catalog_sync_status.sql
```

Los seeds usan resumentes operativos propios, no textos oficiales extensos de normas ISO. Insertan solo en tablas `iso_*`.

## Endpoints

Todos los endpoints son `GET`, requieren JWT y pasan por `enforceApiAccess`:

- `GET /api/iso-knowledge/standards`
- `GET /api/iso-knowledge/standards/:standardCode/versions`
- `GET /api/iso-knowledge/:standardCode/:version/clauses`
- `GET /api/iso-knowledge/:standardCode/:version/controls`
- `GET /api/iso-knowledge/:standardCode/:version/evidence-expectations`
- `GET /api/iso-knowledge/:standardCode/:version/policy-templates`
- `GET /api/iso-knowledge/:standardCode/:version/procedure-templates`
- `GET /api/iso-knowledge/:standardCode/:version/risk-templates`
- `GET /api/iso-knowledge/:standardCode/:version/audit-questions`
- `GET /api/iso-knowledge/:standardCode/:version/gap-rules`
- `GET /api/iso-knowledge/:standardCode/:version/maturity-rules`
- `GET /api/iso-knowledge/:standardCode/:version/ai-guidance`
- `GET /api/iso-knowledge/:standardCode/:version/catalog-links`
- `GET /api/iso-knowledge/crosswalks`
- `GET /api/iso-knowledge/transition/iso9001-2026`
- `GET /api/iso-knowledge/sync-status`

Versiones permitidas en fase 1.1:

- `ISO9001 / 2015`
- `ISO9001 / 2026_FDIS`
- `ISO27001 / 2022`
- `ISO42001 / 2023`

## Validaciones curl

```bash
export API="http://bk.tcdx.int:3000"
export TOKEN="PEGAR_TOKEN_VALIDO"

curl -s "$API/api/iso-knowledge/standards" \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s "$API/api/iso-knowledge/standards/ISO9001/versions" \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s "$API/api/iso-knowledge/ISO9001/2026_FDIS/ai-guidance" \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s "$API/api/iso-knowledge/transition/iso9001-2026" \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s "$API/api/iso-knowledge/sync-status" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Tambien existe:

```bash
chmod +x scripts/validate-iso-knowledge.sh
API="http://bk.tcdx.int:3000" TOKEN="$TOKEN" bash scripts/validate-iso-knowledge.sh
```

## Consultas SQL de validacion

```sql
SELECT s.standard_code, v.version_code, v.publication_status, v.certifiable
FROM iso_standards s
JOIN iso_standard_versions v ON v.standard_id = s.id
ORDER BY s.standard_code, v.version_code;
```

```sql
SELECT standard_code, version_code, COUNT(*) AS controls
FROM iso_controls
GROUP BY standard_code, version_code
ORDER BY standard_code, version_code;
```

```sql
SELECT standard_code, version_code, COUNT(*) AS evidence_expectations
FROM iso_evidence_expectations
GROUP BY standard_code, version_code
ORDER BY standard_code, version_code;
```

```sql
SELECT standard_code, version_code, sync_target, sync_status, linked_controls_count, total_iso_controls_count
FROM iso_catalog_sync_status
ORDER BY standard_code, version_code, sync_target;
```

Conteos operativos que no deben cambiar:

```sql
SELECT 'standards' AS table_name, COUNT(*) FROM standards
UNION ALL SELECT 'tenant_standards', COUNT(*) FROM tenant_standards
UNION ALL SELECT 'controls_catalog', COUNT(*) FROM controls_catalog
UNION ALL SELECT 'tenant_controls', COUNT(*) FROM tenant_controls
UNION ALL SELECT 'evidences', COUNT(*) FROM evidences;
```

Valores base conocidos:

- `standards`: 26
- `tenant_standards`: 23
- `controls_catalog`: 3237
- `tenant_controls`: 1358
- `evidences`: 205

## Validacion anti-riesgo

```bash
grep -RIn "DROP TABLE\|DROP COLUMN\|TRUNCATE\|DELETE FROM\|ALTER TABLE standards\|ALTER TABLE controls_catalog\|ALTER TABLE tenant_controls\|ALTER TABLE tenant_standards\|ALTER TABLE evidences\|ALTER TABLE audits\|ALTER TABLE action_plans\|ALTER TABLE users\|ALTER TABLE tenants" database/migrations/20260506_iso_knowledge_base.sql || true
```

Lo esperado es no obtener resultados.

## Que no toca esta fase

- Frontend, Sidebar, AppLayout y rutas Next.js.
- ai-engine.
- Diagnostico ISO Express.
- Generador de politicas o procedimientos en UI/API productiva.
- Matriz automatizada de riesgos operativa.
- Reportes nuevos.
- Datos de tenants.
- Tablas operativas existentes.
- Migracion de controles existentes.
- Activacion automatica de normas por tenant.

## Riesgo de doble fuente de verdad

El riesgo principal es que `iso_*` y `controls_catalog` contengan conceptos parecidos. Se evita asi:

- `iso_*` es fuente normativa versionada global.
- `controls_catalog` sigue siendo fuente operativa actual.
- `tenant_controls` sigue siendo estado operativo por tenant.
- `iso_control_catalog_links` documenta equivalencias futuras.
- `iso_catalog_sync_status` declara estado de sincronizacion y evita asumir cobertura completa.

## Estrategia futura de mapeo

1. Revisar `controls_catalog` por norma y clausula.
2. Crear mapeos manuales de alta confianza en `iso_control_catalog_links`.
3. Marcar relaciones como `equivalent`, `partial`, `supports`, `related`, `transition` o `legacy_catalog`.
4. Mantener confidence y notes por link.
5. Solo despues habilitar consumo cruzado en diagnostico, generadores, IA y reportes.

## Proximos pasos

La siguiente fase recomendada es el mapeo controlado entre `iso_controls` y `controls_catalog`, partiendo por ISO 9001:2015 e ISO27001:2022. Eso habilita diagnostico y generadores sin romper la operacion actual.
