# Demo Tecdex ISO/GRC

## Alcance

La migración `database/migrations/20260803_demo_tenant_iso_grc.sql` crea datos sintéticos para el tenant `Demo Tecdex` (`demo-tecdex`) sin tocar tenants reales ni insertar binarios falsos. La carga está separada del deploy general y solo se ejecuta con `MIGRATION_DATABASE_URL`.

## Modelo auditado

- Identidad: `tenants`, `tenant_company_profiles`, `users`.
- RBAC: `app_roles`, `permissions`, `role_permissions`, `user_has_permission(...)`.
- Comercial: `commercial_plan_versions`, `tenant_subscriptions`, `commercial_technical_capabilities`, `tenant_feature_overrides`, `tenant_usage_limits`, `v_commercial_tenant_capabilities`.
- ISO/GRC: `standards`, `tenant_standards`, `tenant_operations`, `tenant_processes`, `controls_catalog`, `tenant_controls`, `evidences`, `audits`, `findings`, `action_plans`, `assets`, `asset_risks`.
- Phase 5: `data_domains`, `data_sources`, `data_elements`, `metric_definitions`, `metric_formula_versions`, `metric_measurements`, `metric_snapshots`, `data_snapshots`, `data_lineage_edges`, `dashboard_definitions`, `dashboard_widgets`, `report_definitions`, `report_generations`, `survey_definitions`, `assurance_test_definitions`, `loss_events`.
- Capa semántica: `data_source_contracts`, `data_source_contract_versions`, `data_source_field_mappings`, `grc_observations`, `grc_observation_relations`.

## Entitlement efectivo

El tenant queda con suscripción activa al plan publicado `enterprise`. La capability `data.semantic_layer` se habilita además con un override tenant-scoped activo y auditable en `tenant_feature_overrides`, porque el resolver comercial admite plan, override y trial y la capacidad observada estaba bloqueada por resolución backend.

El override queda limitado al tenant demo:

- `tenant_id`: UUID determinístico del tenant Demo Tecdex.
- `capability_key`: `data.semantic_layer`.
- `enabled`: `true`.
- `source`: `override` en el resolver efectivo.
- `reason`: demo comercial ISO/GRC.

## Contenido poblado

- 1 tenant activo.
- 2 usuarios: administrador y auditor, con hash bcrypt compatible con backend.
- 2 normas activas: ISO 9001:2015 e ISO/IEC 27001:2022.
- 10 procesos/operaciones.
- 8 activos.
- 24 riesgos con distribución crítica/alta/media/baja.
- 55 controles integrados.
- 80 evidencias lógicas sin archivo físico falso.
- 5 auditorías.
- 18 hallazgos.
- 24 acciones.
- 12 métricas publicadas con 12 meses de mediciones cada una.
- Contratos, versiones, mappings y observaciones semánticas.
- Lineage control-evidencia, riesgo-control, hallazgo-acción y medición-métrica.
- 4 dashboards publicados con widgets.
- 4 reportes publicados y generaciones por PDF/DOCX/XLSX sin `report_artifacts` falsos.
- 1 encuesta/campaña de proveedor.
- 12 tests de assurance con ejecuciones.
- 6 eventos de pérdida con pérdida neta calculada por trigger.

## Ejecución

```bash
MIGRATION_DATABASE_URL='postgres://...' npm run demo:migration:preflight
MIGRATION_DATABASE_URL='postgres://...' npm run demo:migration:apply
```

La migración usa ledger `schema_migrations`, checksum SHA-256, advisory lock y postcondiciones.

## Reversibilidad

```bash
MIGRATION_DATABASE_URL='postgres://...' npm run demo:remove
```

La reversa elimina solo datos cuyo `tenant_id` o relación pertenece al tenant Demo Tecdex. No usa `TRUNCATE`. Para observaciones semánticas demo, el script desactiva y reactiva el trigger append-only dentro de una transacción y borra únicamente filas del tenant demo.

## Validaciones esperadas

- `npm run demo:validate`.
- `npm run demo:postgres-check`.
- `npm run demo:migration:checksum`.
- `MIGRATION_DATABASE_URL=... npm run demo:migration:preflight`.
- `MIGRATION_DATABASE_URL=... npm run demo:migration:apply`.
- Segunda ejecución de `apply` debe resolver como aplicada/idempotente.
- `MIGRATION_DATABASE_URL=... npm run demo:remove` debe borrar solo `Demo Tecdex`.

## Evidencia local 2026-08-03

- `npm run demo:validate`: OK.
- `npm run demo:postgres-check`: OK sobre `postgres:16-alpine`.
- Conteos verificados por el check: 2 usuarios, 2 normas, 24 riesgos, 55 controles, 80 evidencias, 144 mediciones, 4 dashboards, 4 reportes.
- `data.semantic_layer`: permitido por vista comercial (`plan` y `override` en el entorno de prueba).
- `user_roles`: 2 asignaciones reales verificadas.
- Tenant B sintético: 0 mediciones demo visibles.
- Hash bcrypt: compatible con backend para ambos usuarios.
- Login backend: `auth.service.login` emitió tokens válidos para admin y auditor con `tenant_id` demo.
- Idempotencia: segunda ejecución detectó migración aplicada.
- Reversa: eliminó el tenant demo y datos asociados en DB efímera.

No se agregó esta carga al deploy oficial.
