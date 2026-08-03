# Auditoría de compatibilidad productiva del seed Demo Tecdex

## Alcance y fuentes

La auditoría cubre las 48 tablas permanentes que reciben `INSERT` o `UPDATE` desde `20260803_demo_tenant_iso_grc.sql`. La fuente primaria del contrato es el catálogo PostgreSQL consultado por el runner (`information_schema.columns`, `pg_constraint`, `pg_index`, `pg_type`, `pg_enum` y `pg_trigger`). Como respaldo versionado se usaron `docs/database-live-map`, las migraciones estructurales de Fases 4, 5 y 5-C2, y el manifiesto `scripts/demo/demo-seed-compatibility.manifest.json`.

Tablas auditadas: `tenants`, `users`, `roles`, `user_roles`, `app_roles`, `permissions`, `role_permissions`, `standards`, `tenant_standards`, `tenant_company_profiles`, `tenant_subscriptions`, `tenant_feature_overrides`, `tenant_usage_limits`, `tenant_processes`, `tenant_operations`, `assets`, `asset_risks`, `controls_catalog`, `tenant_controls`, `evidences`, `audits`, `findings`, `action_plans`, `data_domains`, `data_sources`, `data_elements`, `metric_definitions`, `metric_formula_versions`, `metric_measurements`, `metric_snapshots`, `data_snapshots`, `data_lineage_edges`, `data_source_contracts`, `data_source_contract_versions`, `data_source_field_mappings`, `grc_observations`, `grc_observation_relations`, `dashboard_definitions`, `dashboard_widgets`, `report_definitions`, `report_generations`, `survey_definitions`, `survey_versions`, `assessment_campaigns`, `assurance_test_definitions`, `assurance_test_executions`, `loss_events` y `commercial_events`.

El preflight también inspecciona `metric_sufficiency_rules.status`, aunque el seed no inserta esa entidad, porque forma parte del contrato semántico desplegado.

## Hallazgos y valores categóricos

| Tabla | Columna | Valor usado por el seed | Constraint o enum | Permitidos relevantes | Estado | Corrección | Fuente |
|---|---|---|---|---|---|---|---|
| `tenants` | `ai_plan` | `enterprise` | `tenants_ai_plan_check` | `none`, `basic`, `standard`, `pro`, `premium`, `enterprise` | compatible | `demo_enterprise` fue reemplazado | mapa productivo + catálogo runtime |
| `tenants` | `service_status` | `active` | sin CHECK | allowlist del manifiesto | compatible | ninguna | columnas productivas |
| `tenant_standards` | `catalog_mode` | `mixed` | `chk_tenant_standards_catalog_mode` | `generic`, `personalized`, `mixed` | compatible | `demo_integrated` fue reemplazado | mapa productivo + catálogo runtime |
| `tenant_standards` | `lifecycle_status` | `active` | sin CHECK | allowlist del manifiesto | compatible | ninguna | columnas productivas |
| `controls_catalog` | `source_type` | `personalized` | `chk_controls_catalog_source_type` | `generic`, `personalized` | compatible | `tenant_demo` fue reemplazado | mapa productivo + catálogo runtime |
| `tenant_controls` | `status` | `implementado`, `parcial`, `pendiente` | sin CHECK | allowlist del manifiesto | compatible | ninguna | columnas productivas |
| `tenant_controls` | `priority` | `alta`, `media`, `baja` | sin CHECK | allowlist del manifiesto | compatible | ninguna | columnas productivas |
| `evidences` | `status` | `aprobada`, `pendiente`, `vencida`, `proxima_a_vencer`, `reemplazada` | sin CHECK | allowlist del manifiesto | compatible | ninguna | columnas productivas |
| `evidences` | `evidence_type` | `registro`, `politica`, `acta`, `reporte`, `certificado` | sin CHECK | allowlist del manifiesto | compatible | se usa el nombre físico real, no `type` | columnas productivas |
| `audits` | `status` | `cerrada`, `en_revision` | sin CHECK | allowlist del manifiesto | compatible | ninguna | columnas productivas |
| `audits` | `auditor_type` | `interno`, `proveedor` | sin CHECK | allowlist del manifiesto | compatible | se usa el nombre físico real, no `type` | columnas productivas |
| `findings` | `finding_type` | `no conformidad`, `observacion`, `oportunidad de mejora`, `fortaleza` | `chk_findings_type` | los cuatro valores anteriores | compatible | se eliminaron aliases con guion bajo no admitidos | mapa productivo + catálogo runtime |
| `findings` | `status` | `abierto`, `en revision`, `cerrado` | `chk_findings_status` | `abierto`, `en revision`, `accion definida`, `cerrado` | compatible | `en_progreso` fue reemplazado | mapa productivo + catálogo runtime |
| `findings` | `severity` | `alta`, `media`, `baja` | `chk_findings_severity` | `alta`, `media`, `baja` | compatible | ninguna | mapa productivo + catálogo runtime |
| `action_plans` | `status` | `completado`, `en progreso`, `abierto` | `chk_action_plans_status` | `abierto`, `en progreso`, `bloqueado`, `completado`, `cancelado` | compatible | `cerrado`, `en_progreso` y `planificado` fueron normalizados | mapa productivo + catálogo runtime |
| `action_plans` | `priority` | `alta`, `media`, `baja` | `chk_action_plans_priority` | `alta`, `media`, `baja` | compatible | ninguna | mapa productivo + catálogo runtime |
| `metric_definitions` | tipo/dirección/agregación/frecuencia/estado | valores del catálogo demo | CHECK por columna | contrato Fase 5 | compatible | ninguna | migración Fase 5 + catálogo runtime |
| `metric_measurements` | calidad/freshness/trust/validación | `valid|estimated`, `current|aging`, `trusted|attention`, `approved` | CHECK por columna | contrato Fase 5 | compatible | no existe una columna física genérica `status` | migración Fase 5 + catálogo runtime |
| `metric_snapshots` | `status` | no aplica | columna inexistente | no aplica | verificado | el snapshot es inmutable y no modela estado | columnas runtime |
| `data_lineage_edges` | `relation_type` | `measured_from`, `supported_by`, `affects` | `data_lineage_edges_relation_type_check` | contrato ampliado Fase 5 hotfix | compatible | ninguna | migración hotfix + catálogo runtime |
| `data_source_contracts` | `status` | `published` | CHECK de status | `draft`, `reviewed`, `approved`, `published`, `retired` | compatible | ninguna | migración Fase 5-C2 |
| `data_source_contract_versions` | `status` | `published` | CHECK de status + trigger de inmutabilidad | mismo catálogo | compatible | `ON CONFLICT DO NOTHING` evita actualizar versiones publicadas | migración Fase 5-C2 |
| `data_source_field_mappings` | tipo/estado | `direct`, `active` | CHECK por columna | contrato Fase 5-C2 | compatible | ninguna | migración Fase 5-C2 |
| `grc_observations` | calidad/freshness | `valid|attention`, `fresh|attention` | CHECK por columna + trigger append-only | contrato Fase 5-C2 | compatible | no existe una columna física genérica `status` | migración Fase 5-C2 |
| `metric_sufficiency_rules` | `status` | sin filas demo | `metric_sufficiency_rules_status_check` | `draft`, `reviewed`, `approved`, `published`, `retired` | contrato validado | ninguna | migración Fase 5-C2 |
| dashboards, reportes, encuestas, assurance y pérdidas | columnas categóricas | valores publicados/activos/generados | CHECK por columna | contratos Fase 5 | compatible | ninguna | migración Fase 5 + catálogo runtime |

`asset_risks` no contiene columnas físicas `status`, `category` ni `treatment` en el esquema auditado; el seed solo escribe `risk`, `impact`, `probability` y `level`. `tenant_controls` tampoco contiene columnas físicas `control_type`, `frequency` o `effectiveness`; esos atributos demostrativos permanecen en `metadata` y no se presentan como columnas contractuales. Esta diferencia se documenta en lugar de inventar campos.

## Integridad, idempotencia y triggers

El manifiesto exige FKs críticas para identidad, normas, controles, evidencia, hallazgos, acciones, métricas, widgets, reportes, contratos semánticos y assurance. También exige claves únicas utilizadas por `ON CONFLICT`, entre ellas email de usuario, norma por tenant, override por capability, límites, código de métrica, versiones de fórmula, dashboards, reportes, encuestas, tests y pérdidas.

La firma de esquema incorpora columnas, tipos, nulabilidad, defaults, columnas generadas, constraints, índices únicos, enums y triggers no internos para todas las tablas auditadas. Un cambio entre dry-run y apply invalida la atestación.

Los triggers de fórmulas, versiones de encuesta, versiones semánticas, observaciones y snapshots son respetados: el seed usa UUIDs determinísticos y evita actualizar registros publicados/inmutables.

## Ejecución segura

La secuencia autorizada es:

```bash
npm run demo:migration:preflight
npm run demo:migration:dry-run
npm run demo:migration:apply
```

El dry-run ejecuta todo el SQL y sus postcondiciones dentro de una transacción y termina con rollback. Una segunda conexión confirma ausencia de tenant/usuarios, ledger sin cambios y firma persistente idéntica. La atestación dura 30 minutos y queda ligada a checksum, base y firma de esquema. `--apply` se bloquea si falta, expiró o no coincide.
