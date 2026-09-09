# DB-N01 CONTROL IDENTITY NORMALIZATION

Fecha: 2026-09-04

## Status

`DB_N01_HARDENING_READY_FOR_REVIEW`

## Git

- Branch: `codex/db-n01-control-identity-normalization`
- HEAD inicial: `11003dd92385dcca1caf5365fa437be3aee1f648`
- HEAD actual: `11003dd92385dcca1caf5365fa437be3aee1f648`
- Working tree: dirty esperado, sin commit/push/merge/deploy.
- Directorio no trackeado preservado sin inspeccion: `tcdx-iso-saas-v4/`.

## Archivos modificados

- `backend/src/utils/tenantControlIdentity.js`
- `backend/src/utils/tenantControlIdentity.test.js`
- `backend/src/routes/findings.routes.js`
- `backend/src/routes/action-plans.routes.js`
- `backend/src/routes/evidences.routes.js`
- `backend/src/routes/controlIdentityRoutes.test.js`
- `backend/src/routes/controls.routes.js`
- `backend/src/services/diagnosticAcceptance.service.js`
- `backend/src/services/grc/grc.service.js`
- `backend/src/services/grc/grc.service.test.js`
- `backend/src/services/isoOperationalExecution.service.js`
- `backend/src/services/isoRecommendedActions.service.js`
- `backend/src/services/soaIntelligence.service.js`
- `database/migrations/20260904_dbn01_control_identity_normalization.sql`
- `scripts/normalization/apply-db-n01-control-identity-migration.test.js`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/DECISIONS.md`
- `docs/handoffs/DB-N01_CONTROL_IDENTITY_NORMALIZATION.md`

## Modelo before/after

Before:

- `controls_catalog.id` era catalogo.
- `controls.id` legacy aparecia como identidad operacional en algunas rutas.
- `tenant_controls.id` ya existia, pero no era aplicado consistentemente a `findings.tenant_control_id`, `evidences.tenant_control_id` y `action_plans.tenant_control_id`.

After:

- `controls_catalog.id` = identidad de catalogo.
- `tenant_controls.control_id` = enlace a catalogo.
- `tenant_controls.id` = identidad operacional canonica runtime.
- `controls.id` queda solo como compatibilidad legacy de lectura/transicion.

## Inventario consumidores

Canonical writes:

- `findings.routes.js`: create/update persiste `resolvedControl.tenant_control_id_moderno`.
- `action-plans.routes.js`: create normaliza `tenant_control_id` y `source_id` de control a `tenant_controls.id`.
- `evidences.routes.js`: upload persiste `tenantControlId` resuelto y conserva `control_id` como catalogo.
- `controls.routes.js`: quick finding/action plan persisten `control.tenant_control_id`.
- `diagnosticAcceptance.service.js`: findings/action plans diagnosticos persisten `control.tenant_control_id`.
- `isoOperationalExecution.service.js`: conversion a finding persiste `tenantControl.tenant_control_id`.
- `grc.service.js`: workflow selector/control y mappings validan `tenant_controls.id`.

Legacy read compatibility:

- `tenantControlIdentity.js` resuelve moderno, legacy `controls.id` y catalogo, con `strict` bloqueando ambiguedad.
- `findings.routes.js` lectura enriquecida acepta `findings.tenant_control_id` moderno o legacy y proyecta control moderno cuando es univoco.
- `action-plans.routes.js` resuelve findings legacy al crear/reutilizar planes.
- `controls.routes.js` mantiene dedupe/contadores compatibles con `controls_id_legacy`.
- `evidences.routes.js` lista evidencias legacy-only solo cuando el catalogo resuelve a un unico `tenant_controls`.
- `isoOperationalExecution.service.js` acepta findings modernos directos y findings legacy por `controls.id` solo si hay un unico candidato moderno.
- `soaIntelligence.service.js` conserva lectura/proyeccion SoA legacy basada en `controls` con conteos `COUNT DISTINCT` compatibles contra `tenant_controls`.

Fixed dependencies:

- Nuevas escrituras runtime ya no usan `controls.id` como `tenant_control_id`.
- `isoRecommendedActions.service.js` ya no exige `legacy_control_id` para convertir recomendacion a finding.
- `evidences.routes.js` ya no usa resolver local catalog-only permisivo.
- Migracion DB-N01 ya no usa `LIMIT 1`, `max()` ni `min()` para resolver identidad de control.

Remaining dependencies:

- `controls` sigue requerido para compatibilidad historica, SoA legacy, rutas legacy y dedupe temporal.
- `evidences.control_id` se preserva por compatibilidad y auditoria.
- `soa.routes.js`, `_legacy/2evidences.routes.js` y partes de `soaIntelligence.service.js` siguen siendo superficies legacy fuera del DROP de `controls`.

## Findings

- Runtime write: canonico a `tenant_controls.id`.
- Runtime read: moderno por `f.tenant_control_id = tenant_controls.id`; legacy por `f.tenant_control_id = controls.id` y luego `controls.catalog_control_id = tenant_controls.control_id`.
- Ambiguedad: no se elige arbitrariamente; sugerencias ISO excluyen legacy ambiguo sin crear filas nuevas.
- Migracion: bloquea findings ambiguos salvo decision manual explicita via `tcdx.dbn01_manual_decisions`.
- Casos QA ambiguos conocidos: `00aec659-9b21-4acd-a60a-97d7c1546617`, `6b609fde-705a-440f-b708-9273664dad73`, `73dba950-1ee4-4a71-ae6d-780f86c3b392`, `f08aca5e-6f85-4411-946a-e54dbd8b55`.
- Resultado esperado para esos 4: `REQUIRES_MANUAL_DECISION` si no existe evidencia deterministica.

## Evidencias

- Upload acepta `tenant_control_id`, `control_id` o `action_plan_id`.
- `control_id` pasa por resolver central `resolveTenantControl(..., mode: 'strict')`.
- Si hay multiples `tenant_controls` para el mismo catalogo, devuelve 409 `TENANT_CONTROL_ID_AMBIGUOUS`.
- `getOperationalTenantControlContext` ya no puede escoger silenciosamente por `ORDER BY ... LIMIT 1` cuando solo recibe catalogo y hay multiples candidatos; hace `LIMIT 2`, detecta ambiguedad y falla.
- Listados/recomendaciones legacy-only solo proyectan cuando no existe otro candidato operativo activo para el mismo catalogo.
- QA conocido: 33 evidencias legacy-only requieren migracion deterministica o decision manual si son ambiguas/orphan.

## Action plans

- Identidad canonica: `action_plans.tenant_control_id = tenant_controls.id`.
- Nuevas rutas normalizan input legacy/catalogo antes de persistir.
- Dedupe mantiene compatibilidad contra legacy para no duplicar planes historicos.
- Migracion valida que todos los `action_plans.tenant_control_id` existentes apunten a `tenant_controls.id`.

## GRC / Workflows

- Selector de entidad `control`: `tenant_controls`.
- Persistencia de workflow/control: valida entidad tenant-scoped antes de insertar.
- `grc.service.test.js` cubre selector `control` y tenant binding.
- `grcRuntimeAdapters` sigue leyendo `tenant_controls` para entity type `control`.

## isoOperationalExecution

Old behavior:

- La lectura de findings partia de `findings.tenant_control_id = controls.id` y traducia a `tenant_controls`.

New behavior:

- Primero intenta match directo moderno `direct_tc.id = f.tenant_control_id`.
- Solo si no hay match moderno, intenta legacy `controls.id = f.tenant_control_id` con mismo tenant.
- Legacy se resuelve a `tenant_controls` por catalogo solo si hay un candidato.
- No usa `OR` que multiplique filas.
- No usa `max(uuid)` como selector.
- Nuevos findings creados por conversion usan `tenant_controls.id`.

Ambiguity behavior:

- Directo moderno gana si existe.
- Legacy con 0 o mas de 1 candidatos no produce sugerencia runtime.
- La migracion bloquea los casos ambiguos para no normalizar silenciosamente.

## isoRecommendedActions

- Conversion preview exige control operativo canonico para findings.
- Conversion real delega en `isoOperationalExecution`, que ahora persiste `tenant_controls.id`.
- `legacy_control_id` solo queda como dato de compatibilidad contextual.

## soaIntelligence

- Sigue basado en `controls`/`control_soa` legacy como proyeccion SoA.
- Conteos de evidencias/findings aceptan modernos y legacy con `COUNT DISTINCT`.
- Clasificacion: `LEGACY_READ_COMPATIBILITY`.
- No se reescribio SoA completo en DB-N01 para no abrir modelo SoA fuera de alcance.

## Migracion

- Archivo: `database/migrations/20260904_dbn01_control_identity_normalization.sql`.
- Transaccional: `BEGIN`/`COMMIT`.
- Lock: advisory xact lock.
- Preflight antes de `UPDATE`.
- No `DROP TABLE controls`.
- No `DROP COLUMN evidences.control_id`.
- No `DELETE`.
- No `LIMIT 1`.
- No `max()`/`min()` para resolver IDs.
- Findings ambiguos bloquean salvo manual decision aprobada que matchee candidato.
- Evidencias orphan/ambiguas bloquean salvo manual decision aprobada.
- Auditabilidad: `dbn01_control_identity_audit`.
- FK finales: `findings`, `evidences`, `action_plans` -> `tenant_controls(id)` con `ON DELETE RESTRICT`.
- Idempotencia: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, constraints guarded.
- Tenant IDs hardcodeados: ninguno.
- Ejecutada sobre db-v4: NO.

## Tests

PASS:

- `node backend/src/utils/tenantControlIdentity.test.js`
- `node backend/src/routes/controlIdentityRoutes.test.js`
- `node scripts/normalization/apply-db-n01-control-identity-migration.test.js`
- `node backend/src/services/grc/grc.service.test.js`
- `node backend/src/services/soaIntelligence.service.test.js`
- `node --check` para todos los JS modificados listados en el prompt.
- `git diff --check`

Full backend suite:

- `npm test` desde `backend/` fallo antes de Math Governance en `commercial.service.test.js` con `Commercial test server did not bind to a TCP port`.
- Re-ejecucion focal directa de `node backend/src/services/commercial/commercial.service.test.js` PASS.
- Reproduccion directa de `node backend/src/services/math-governance/grcDecisionCenter.test.js` FAIL en linea 51: `persisted` fue `true` cuando el test esperaba `false`.
- Clasificacion `grcDecisionCenter.test.js`: `PREEXISTING_OR_UNRELATED`; DB-N01 no toca Math Governance ni esa prueba.

## Constraints / No Ejecutado

- No commit.
- No push.
- No merge.
- No deploy.
- No `git reset`.
- No `git clean`.
- No migracion ejecutada en `db-v4`.
- No `ALTER/UPDATE/DELETE/DROP` runtime contra `db-v4`.
- No inicio DB-N02.

## Legacy residual / Bloqueos para DROP controls

- `controls` aun es usado por SoA legacy, dedupe historico, reportes/rutas legacy y compatibilidad de lectura en findings/evidences.
- `evidences.control_id` sigue vivo para historia y mapeo catalogo/legacy.
- Antes de DROP controls se requiere: aplicar DB-N01 con decisiones manuales, migrar/remediar SoA legacy, retirar rutas `_legacy`, validar reportes y eliminar dependencias runtime catalogadas.

## Recomendacion final

Review humano de DB-N01, decidir manualmente los 4 findings ambiguos y cualquier evidencia legacy-only ambigua/orphan, luego ejecutar preflight/aplicacion de migracion en entorno autorizado. No iniciar DB-N02 hasta cerrar aplicacion/revision DB-N01.

## DB-N01 HARDENING FINAL

Status: `DB_N01_HARDENING_READY_FOR_REVIEW`.

Manual decisions hardening:

- `tcdx.dbn01_manual_decisions` ahora se parsea una sola vez en `dbn01_manual_decisions`, relacion temporal `ON COMMIT DROP`.
- Formato validado: `table_name`, `record_id`, `selected_tenant_control_id`, `approved_by`, `reason`.
- Tablas permitidas: `findings`, `evidences`.
- Unicidad: falla temprano si existen dos o mas decisiones para el mismo `(table_name, record_id)`, aunque sean identicas.
- Validaciones tempranas antes de updates: `table_name` permitido, `record_id` existente, `selected_tenant_control_id` existente, mismo tenant, mismo catalogo esperado y mismo contexto operacional cuando el registro ya es canonico.
- Comportamiento invalido: `RAISE EXCEPTION` transaccional; no hay updates parciales.

PostgreSQL isolated test:

- Harness: `scripts/normalization/db-n01-control-identity.postgres.test.js`.
- Mecanismo: cluster PostgreSQL local temporal con `/opt/homebrew/opt/postgresql@16/bin/initdb`, `pg_ctl` y `psql`, socket local en `/var/folders/.../T/db-n01-pg-*/socket`, cleanup al finalizar.
- PostgreSQL version: `16.14 (Homebrew)`.
- Aislamiento: no usa `192.168.2.40`, `db-v4`, `tecdex_saas QA`, SSH ni `MIGRATION_DATABASE_URL`.
- Fixtures minimos: `tenants`, `controls_catalog`, `controls`, `tenant_controls`, `findings`, `evidences`, `action_plans`, UUIDs sinteticos generados por hash de labels de test.

Scenarios:

- F01 PASS: finding ya moderno conserva `tenant_controls.id`.
- F02 PASS: finding legacy con un candidato migra a `tenant_controls.id`.
- F03 PASS: finding legacy con 0 candidatos falla seguro por unresolved.
- F04 PASS: finding legacy con 2 candidatos sin decision falla seguro por ambiguous.
- F05 PASS: finding ambiguo con decision valida migra a `selected_tenant_control_id`.
- F06 PASS: finding ambiguo con decision invalida falla seguro.
- E01 PASS: evidence ya moderna conserva `tenant_controls.id`.
- E02 PASS: evidence legacy-only con un candidato migra automaticamente.
- E03 PASS: evidence legacy-only con 0 candidatos falla seguro.
- E04 PASS: evidence legacy-only con 2 candidatos falla seguro.
- E05 PASS: evidence ambigua con decision valida migra.
- MD01 PASS: sin decision mantiene comportamiento normal de preflight.
- MD02 PASS: una decision valida permite resolver ambiguedad.
- MD03 PASS: dos decisiones identicas para el mismo `(table_name, record_id)` fallan por duplicate decision.
- MD04 PASS: dos decisiones diferentes para el mismo `(table_name, record_id)` fallan por duplicate decision.
- MD05 PASS: `selected_tenant_control_id` inexistente falla.
- MD06 PASS: `selected_tenant_control_id` de otro tenant falla.
- MD07 PASS: `selected_tenant_control_id` de otro catalogo falla.
- MD08 PASS: `table_name` invalido falla.
- MD09 PASS: `record_id` inexistente falla.

Re-run / idempotencia:

- Primera migracion PASS.
- Segunda migracion sobre la misma BD local PASS.
- Resultado: safe re-run/idempotente en estado semantico; no cambia outputs, no duplica audit rows y conserva constraints.

Post-migration integrity:

- `findings.tenant_control_id -> tenant_controls.id`: PASS (`findings_fk=0`).
- `evidences.tenant_control_id -> tenant_controls.id`: PASS (`evidences_fk=0`).
- `action_plans.tenant_control_id -> tenant_controls.id`: PASS (`action_plans_fk=0`).
- Cross-tenant references: PASS (`cross_tenant=0`).
- Orphan `tenant_controls.control_id`: PASS (`orphan_tenant_controls=0`).
- Registros migrados sin resolucion: PASS (`unresolved_rows=0`).
- Legacy preservado: `controls` existe y `evidences.control_id` existe.

Tests final hardening:

- PASS `node backend/src/utils/tenantControlIdentity.test.js`
- PASS `node backend/src/routes/controlIdentityRoutes.test.js`
- PASS `node scripts/normalization/apply-db-n01-control-identity-migration.test.js`
- PASS `node scripts/normalization/db-n01-control-identity.postgres.test.js`
- PASS `node backend/src/services/grc/grc.service.test.js`
- PASS `node backend/src/services/soaIntelligence.service.test.js`
- PASS `node --check` sobre JS modificados y test PostgreSQL nuevo.
- PASS `git diff --check`.
- Full suite: `npm test` desde `backend/` no PASS por `backend/src/services/math-governance/grcDecisionCenter.test.js:51` (`persisted` true vs false). Clasificacion: `PREEXISTING_OR_UNRELATED`; DB-N01 no toca Math Governance.

UUID correction:

- Findings ambiguos confirmados exactamente: `00aec659-9b21-4acd-a60a-97d7c1546617`, `6b609fde-705a-440f-b708-9273664dad73`, `73dba950-1ee4-4a71-ae6d-780f86c3b392`, `f08aca5e-6f85-4411-946a-e54dbd8b55`.

Residual risk:

- La ejecucion productiva sigue requiriendo decisiones manuales reales para filas ambiguas/orphan detectadas en entorno autorizado.
- DB-N01 no elimina `controls` ni `evidences.control_id`; DB-N02 no debe iniciar hasta cerrar revision/aplicacion autorizada de DB-N01.
