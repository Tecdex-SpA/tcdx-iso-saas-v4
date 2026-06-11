# Database and QA Scripts Manifest

Fecha: 2026-06-11
Rama: `chore/operational-governance-cleanup`
Base: `13b5721`

## Objetivo

Este manifiesto clasifica scripts DB, QA, deploy, repair, rollback, runtime y
agente detectados para Sprint 3. Su proposito es reducir riesgo operativo antes
de ejecutar cualquier script manualmente.

Regla general:

- **NO EJECUTAR SIN APROBACION** cualquier script que altere DB, uploads,
  tenants, permisos, datos demo, datos runtime, estado de produccion o deploy.
- No ejecutar migraciones, seeds, qa-fixes, rollback, repair, deploy ni scripts
  destructivos sin aprobacion explicita, backup cuando aplique y ventana de
  rollback.
- Las categorias y propositos son inferidos por nombre/ruta; cuando no hay
  certeza se marca como `unknown` o `requiere revision manual`.

## Leyenda

| Campo | Valores usados |
|---|---|
| Categoria | migration, seed/demo, qa-fix, repair, rollback, backup/restore, deploy, validation, runtime, legacy, unknown |
| Ambiente | lab, demo, pilot, production |
| Riesgo | bajo, medio, alto, critico |
| Reversible | si, no, desconocido |
| Owner sugerido | DB, Backend, Frontend, AI, DevOps, QA, Producto |

## Resumen por categoria

| Categoria | Cantidad | Politica |
|---|---:|---|
| migration | 36 | NO EJECUTAR SIN APROBACION; no modificar migraciones aplicadas. |
| seed/demo | 17 | NO EJECUTAR SIN APROBACION si toca datos; solo lab/demo salvo plan aprobado. |
| qa-fix | 3 | NO EJECUTAR SIN APROBACION; requiere revision DB y backup previo si altera datos/objetos. |
| rollback | 1 | NO EJECUTAR SIN APROBACION; solo con plan de rollback probado. |
| backup/restore | 2 | Requiere owner DevOps; restore siempre con aprobacion y evidencia de backup. |
| deploy | 8 | NO EJECUTAR SIN APROBACION; puede afectar produccion. |
| repair | 10 | NO EJECUTAR SIN APROBACION; puede alterar codigo, DB o datos de tenant. |
| validation | 69 | Permitido si usa entorno seguro y no imprime secretos; algunos requieren tokens. |
| runtime | 8 | Operacion/monitoreo; revisar alcance antes de production. |
| legacy | 3 | Mantener por compatibilidad; no borrar sin dependency scan. |
| unknown | 0 | Requiere revision manual antes de ejecutar. |

## Database migrations

Todos los archivos bajo `database/migrations/*.sql` se clasifican como
`migration`. Ambiente permitido: lab/demo/pilot/production solo mediante proceso
formal. Riesgo: alto. Reversible: desconocido salvo rollback especifico.
Requiere aprobacion: si. Requiere backup previo: si. Condicion de ejecucion:
ventana aprobada, backup verificado, revision SQL y plan de rollback. Owner:
DB/DevOps. Observacion: **NO EJECUTAR SIN APROBACION** y no modificar si ya
fueron aplicadas.

| Ruta | Proposito inferido |
|---|---|
| `database/migrations/20260430_audits_summary_support.sql` | Soporte summary auditorias. |
| `database/migrations/20260430_final7_audits_ai_billing.sql` | Auditorias, IA y billing. |
| `database/migrations/20260430_fix_audit_review_friendly_labels.sql` | Ajuste labels revision auditoria. |
| `database/migrations/20260430_reportes_rbac_access.sql` | Acceso RBAC reportes. |
| `database/migrations/20260502_ai_bootstrap_knowledge.sql` | Tablas/conocimiento bootstrap IA. |
| `database/migrations/20260504_3k_ai_auditor_runs.sql` | Runs IA auditor. |
| `database/migrations/20260504_3m_ai_auditor_human_review.sql` | Revision humana IA auditor. |
| `database/migrations/20260506_iso_control_catalog_mapping.sql` | Mapeo catalogo controles ISO. |
| `database/migrations/20260506_iso_control_mapping_apply_log.sql` | Log aplicacion mapeo controles. |
| `database/migrations/20260506_iso_document_generator.sql` | Generador documental ISO. |
| `database/migrations/20260506_iso_express_diagnostic.sql` | Diagnostico express ISO. |
| `database/migrations/20260506_iso_knowledge_base.sql` | Knowledge base ISO. |
| `database/migrations/20260506_iso_operational_execution.sql` | Ejecucion operacional ISO. |
| `database/migrations/20260506_iso_risk_matrix.sql` | Matriz riesgo ISO. |
| `database/migrations/20260507_dashboard_v2_user_preferences.sql` | Preferencias dashboard v2. |
| `database/migrations/20260507_iso_recommended_action_conversions.sql` | Conversion acciones recomendadas. |
| `database/migrations/20260507_iso_recommended_action_workflow.sql` | Workflow acciones recomendadas. |
| `database/migrations/20260512_001_centro_inteligente_evidencias_base.sql` | Centro inteligente evidencias. |
| `database/migrations/20260512_02_document_suggestions_pending_control_unique.sql` | Unicidad sugerencias pendientes. |
| `database/migrations/20260515_ai_knowledge_tables_minimal.sql` | Tablas minimas AI knowledge. |
| `database/migrations/20260515_audit_preparation_documentary_sources.sql` | Fuentes documentales auditoria. |
| `database/migrations/20260515_audit_preparation_formats_versioning.sql` | Formatos/versionado preparacion. |
| `database/migrations/20260515_audit_preparation_iso9001.sql` | Preparacion auditoria ISO9001. |
| `database/migrations/20260519_tcdx_async_jobs.sql` | Jobs asincronos. |
| `database/migrations/20260520_ai_auditor_pdf_cache.sql` | Cache PDF IA auditor. |
| `database/migrations/20260520_tenant_company_profiles.sql` | Perfil empresa tenant. |
| `database/migrations/20260522_tenant_applicability_universe.sql` | Universo aplicabilidad tenant. |
| `database/migrations/20260525_ai_entitlements_applicability_consistency.sql` | Consistencia entitlements IA/aplicabilidad. |
| `database/migrations/20260525_harden_applicability_calculations_and_rbac.sql` | Hardening calculos aplicabilidad y RBAC. |
| `database/migrations/20260525_tenant_ai_entitlements.sql` | Entitlements IA tenant. |
| `database/migrations/20260526_tenant_scoped_document_sources_connectors.sql` | Conectores documentales tenant-scoped. |
| `database/migrations/20260604_sprint2_tenant_processes_operations.sql` | Procesos/operaciones tenant Sprint 2. |
| `database/migrations/20260604_sprint3_5_unified_evidence_library_semantic.sql` | Biblioteca evidencias semantica. |
| `database/migrations/20260604_sprint3_process_operational_links.sql` | Links operacionales procesos. |
| `database/migrations/20260608_document_index_exclusions_hardening.sql` | Hardening exclusiones document index. |
| `database/migrations/20260608_normalize_document_index_updated_status.sql` | Normalizacion status document index. |

## Database seeds and demo data

Ambiente permitido: lab/demo; pilot/production solo con aprobacion explicita.
Riesgo: alto porque altera datos/catalogos. Reversible: desconocido. Requiere
aprobacion: si. Requiere backup previo: si en pilot/production. Condicion:
tenant/dataset objetivo confirmado y plan de rollback. Owner: DB/Producto.
Observacion: **NO EJECUTAR SIN APROBACION**.

| Ruta | Categoria | Proposito inferido |
|---|---|---|
| `database/demo/demo_comercial_tcdx.sql` | seed/demo | Datos demo comercial. |
| `database/demo/demo_comercial_tcdx_maturity_patch.sql` | seed/demo | Patch de madurez demo comercial. |
| `database/seeds/001_extend_iso9001_coverage.sql` | seed/demo | Ampliar cobertura ISO9001. |
| `database/seeds/002_extend_iso27001_coverage.sql` | seed/demo | Ampliar cobertura ISO27001. |
| `database/seeds/003_create_iso42001_operational_controls.sql` | seed/demo | Crear controles operacionales ISO42001. |
| `database/seeds/004_refresh_iso_catalog_sync_status.sql` | seed/demo | Refrescar sync catalogo ISO. |
| `database/seeds/20260506_seed_iso27001_2022.sql` | seed/demo | Seed ISO27001:2022. |
| `database/seeds/20260506_seed_iso42001_2023.sql` | seed/demo | Seed ISO42001:2023. |
| `database/seeds/20260506_seed_iso9001_2015.sql` | seed/demo | Seed ISO9001:2015. |
| `database/seeds/20260506_seed_iso9001_2026_fdis.sql` | seed/demo | Seed ISO9001 2026 FDIS. |
| `database/seeds/20260506_seed_iso_catalog_sync_status.sql` | seed/demo | Estado sync catalogo ISO. |
| `database/seeds/20260506_seed_iso_control_catalog_links_initial.sql` | seed/demo | Links iniciales catalogo controles. |
| `database/seeds/20260506_seed_iso_crosswalks.sql` | seed/demo | Crosswalks ISO. |
| `database/seeds/20260506_seed_iso_knowledge_base.sql` | seed/demo | Knowledge base ISO. |
| `database/seeds/20260515_seed_ai_knowledge_iso9001_audit_documents.sql` | seed/demo | Knowledge IA documentos auditoria ISO9001. |
| `database/seeds/20260515_seed_audit_document_templates_iso27001.sql` | seed/demo | Templates auditoria ISO27001. |
| `database/seeds/20260515_seed_audit_document_templates_iso9001.sql` | seed/demo | Templates auditoria ISO9001. |

## Database QA fixes and rollback

Ambiente permitido: lab/demo para diagnostico; pilot/production solo con
aprobacion explicita. Riesgo: alto o critico. Reversible: desconocido, excepto
rollback nombrado que igualmente requiere prueba previa. Requiere aprobacion:
si. Requiere backup previo: si si altera DB. Owner: DB/QA. Observacion:
**NO EJECUTAR SIN APROBACION**.

| Ruta | Categoria | Riesgo | Proposito inferido | Condicion de ejecucion |
|---|---|---:|---|---|
| `database/qa-fixes/20260513_create_iso_effective_health_view.sql` | qa-fix | alto | Crear vista health efectiva. | Solo si falta vista y hay backup. |
| `database/qa-fixes/20260513_create_iso_effective_kpi_summary_view.sql` | qa-fix | alto | Crear vista KPI summary. | Solo si falta vista y hay backup. |
| `database/qa-fixes/20260513_fix_iso_operational_links.sql` | repair | alto | Reparar links operacionales ISO. | Revision manual de datos objetivo. |
| `database/qa-fixes/20260513_fix_iso_operational_links_v2.sql` | repair | alto | Reparar links operacionales ISO v2. | No ejecutar sin entender version previa. |
| `database/qa-fixes/20260513_fix_iso_operational_links_v3.sql` | repair | alto | Reparar links operacionales ISO v3. | No ejecutar sin entender version previa. |
| `database/qa-fixes/20260513_fix_iso_operational_links_v4.sql` | repair | alto | Reparar links operacionales ISO v4. | No ejecutar sin entender version previa. |
| `database/qa-fixes/20260513_fix_iso_remaining_integrity.sql` | repair | alto | Reparar integridad ISO restante. | Requiere diagnostico DB y backup. |
| `database/qa-fixes/20260513_qa_iso_integrity_audit.sql` | validation | medio | Auditoria integridad ISO. | Ejecutar solo read-only si se confirma SQL. |
| `database/qa-fixes/20260513_qa_iso_integrity_audit_v2.sql` | validation | medio | Auditoria integridad ISO v2. | Ejecutar solo read-only si se confirma SQL. |
| `database/qa-fixes/20260513_qa_pending_detail.sql` | validation | medio | Detalle QA pendiente. | Ejecutar solo read-only si se confirma SQL. |
| `database/qa-fixes/20260513_refresh_health_kpis.sql` | qa-fix | alto | Refrescar health KPIs. | Puede alterar objetos/datos; requiere backup. |
| `database/qa-fixes/20260513_rollback_iso_operational_links.sql` | rollback | critico | Rollback links operacionales ISO. | Solo dentro de plan de rollback aprobado. |

## Shell and Python scripts

| Ruta | Categoria | Proposito inferido | Ambiente permitido | Riesgo | Reversible | Aprobacion | Backup previo | Condicion de ejecucion | Owner | Observacion |
|---|---|---|---|---:|---|---|---|---|---|---|
| `scripts/apply-ai-bootstrap-knowledge-db.sh` | repair | Aplicar bootstrap knowledge IA en DB. | lab/demo/pilot/production con aprobacion | alto | desconocido | si | si | DB objetivo y rollback aprobados. | DB/AI | NO EJECUTAR SIN APROBACION. |
| `scripts/backup-runtime.sh` | backup/restore | Generar backup runtime DB/uploads. | demo/pilot/production | medio | si | si en prod | no | Verificar destino, permisos y espacio. | DevOps | No imprime secretos por contrato esperado. |
| `scripts/check-ai-engine.sh` | validation | Check AI Engine. | lab/demo/pilot/production | bajo | si | no | no | Entorno sin secretos impresos. | AI/QA | Validacion no destructiva inferida. |
| `scripts/check-backend.sh` | validation | Check backend. | lab/demo/pilot/production | bajo | si | no | no | Entorno configurado. | Backend/QA | Validacion no destructiva inferida. |
| `scripts/check-db-objects.sh` | validation | Verificar objetos DB. | lab/demo/pilot/production | medio | si | si en prod | no | Confirmar consultas read-only antes de production. | DB/QA | Puede requerir credenciales DB. |
| `scripts/check-demo-readiness.sh` | validation | Readiness demo. | demo/pilot | bajo | si | no | no | Usar entorno demo seguro. | QA/Producto | No usar como deploy gate unico. |
| `scripts/check-frontend.sh` | validation | Check frontend. | lab/demo/pilot/production | bajo | si | no | no | Entorno configurado. | Frontend/QA | Validacion no destructiva inferida. |
| `scripts/check-rbac.sh` | validation | Check RBAC. | demo/pilot/production | medio | si | no | no | Requiere tokens seguros. | QA/Security | No imprimir tokens. |
| `scripts/check-secrets-runtime.sh` | runtime | Verificar secretos runtime por SSH/longitudes. | pilot/production | medio | si | si | no | Solo con acceso autorizado; no imprimir valores. | DevOps/Security | Puede tocar hosts remotos; aprobar en prod. |
| `scripts/collect-ops-logs.sh` | runtime | Recolectar logs operativos. | demo/pilot/production | medio | si | si en prod | no | Sanitizar logs antes de compartir. | DevOps | Riesgo de datos sensibles en logs. |
| `scripts/collect-runtime-inventory.sh` | runtime | Inventario runtime. | demo/pilot/production | medio | si | si en prod | no | Sanitizar salidas. | DevOps | No versionar evidencia sensible. |
| `scripts/deploy-vms.sh` | deploy | Deploy VMs. | demo/pilot/production | critico | desconocido | si | si | Ventana de deploy y rollback aprobados. | DevOps | NO EJECUTAR SIN APROBACION. |
| `scripts/env-check.sh` | validation | Gate env por perfil/capa. | lab/demo/pilot/production | bajo | si | no | no | Variables cargadas, sin imprimir valores. | DevOps/Security | Gate Sprint 2. |
| `scripts/generate-deep-report-cli.sh` | runtime | Generar reporte profundo via API. | demo/pilot | medio | desconocido | si | no | Confirmar tenant/datos y no exponer resultados. | QA/Producto | Puede generar artefactos. |
| `scripts/monitor-runtime.sh` | runtime | Monitoreo runtime. | demo/pilot/production | bajo | si | no | no | Entorno autorizado. | DevOps | No usar para cambios. |
| `scripts/patch_action_plans_direct_evidence.py` | repair | Patch action plans/evidencia directa. | lab/demo solo salvo aprobacion | alto | desconocido | si | si | Revisar codigo y alcance tenant. | Backend/DB | NO EJECUTAR SIN APROBACION. |
| `scripts/patch_controls_workbench_effective_health_view.py` | repair | Patch workbench health view. | lab/demo solo salvo aprobacion | alto | desconocido | si | si | Revisar codigo y alcance DB. | Backend/DB | NO EJECUTAR SIN APROBACION. |
| `scripts/patch_controls_workbench_map_effective_health.py` | repair | Patch mapeo health workbench. | lab/demo solo salvo aprobacion | alto | desconocido | si | si | Revisar codigo y alcance DB. | Backend/DB | NO EJECUTAR SIN APROBACION. |
| `scripts/patch_controls_workbench_operational_scope.py` | repair | Patch scope operacional workbench. | lab/demo solo salvo aprobacion | alto | desconocido | si | si | Revisar codigo y alcance DB. | Backend/DB | NO EJECUTAR SIN APROBACION. |
| `scripts/preventa-check.sh` | validation | Check preventa. | demo/pilot | bajo | si | no | no | Entorno demo controlado. | QA/Producto | No sustituye QA core. |
| `scripts/push-deploy.sh` | deploy | Push/deploy. | demo/pilot/production | critico | desconocido | si | si | Aprobacion explicita de push/deploy. | DevOps | NO EJECUTAR SIN APROBACION. |
| `scripts/qa-ai-auditor-full.sh` | validation | QA IA auditor full. | lab/demo/pilot | medio | si | no | no | Requiere tokens/tenant seguros. | QA/AI | No imprimir tokens. |
| `scripts/qa-ai-locale-consistency.sh` | validation | QA consistencia locale IA. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA/AI | No destructivo inferido. |
| `scripts/qa-backup-readiness.sh` | validation | QA readiness backup. | demo/pilot/production | medio | si | si en prod | no | Confirmar que no ejecute restore. | DevOps/QA | No sustituye restore-test. |
| `scripts/qa-bilingual-full.sh` | validation | QA bilingue full. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA | No destructivo inferido. |
| `scripts/qa-cloud-readiness.sh` | validation | QA cloud readiness. | demo/pilot/production | medio | si | si en prod | no | No ejecutar cambios cloud. | DevOps/QA | Revision manual requerida. |
| `scripts/qa-cross-tenant-core.sh` | validation | QA aislamiento tenant core. | demo/pilot/production | bajo | si | no | no | Requiere tokens seguros; no imprimirlos. | QA/Security | Gate Sprint 1/2. |
| `scripts/qa-e2e-minimal.sh` | validation | E2E minima API. | demo/pilot/production | bajo | si | no | no | Requiere token seguro. | QA | Gate Sprint 2. |
| `scripts/qa-i18n-db-display.sh` | validation | QA i18n DB display. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA/Frontend | No destructivo inferido. |
| `scripts/qa-i18n-english-full.sh` | validation | QA i18n ingles full. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA/Frontend | No destructivo inferido. |
| `scripts/qa-observability.sh` | validation | QA observabilidad. | demo/pilot/production | bajo | si | no | no | Entorno seguro. | QA/DevOps | No destructivo inferido. |
| `scripts/qa-phase4-final.sh` | validation | QA fase 4 final. | lab/demo/pilot | medio | si | no | no | Revisar alcance antes de prod. | QA | Posible suite amplia. |
| `scripts/qa-rbac-basic.sh` | validation | QA RBAC basico. | demo/pilot/production | bajo | si | no | no | Requiere tokens seguros. | QA/Security | No imprimir tokens. |
| `scripts/qa-reports-rbac-p1.sh` | validation | QA RBAC reportes P1. | demo/pilot/production | bajo | si | no | no | Requiere tokens seguros. | QA/Security | Gate Sprint 2. |
| `scripts/qa-security-basic.sh` | validation | QA seguridad basica. | demo/pilot/production | bajo | si | no | no | Entorno seguro. | QA/Security | No destructivo inferido. |
| `scripts/qa-tenant-path-p1.sh` | validation | QA tenant path P1. | demo/pilot/production | bajo | si | no | no | Requiere tokens seguros. | QA/Security | Gate Sprint 2. |
| `scripts/restore-test.sh` | backup/restore | Test restore. | lab/demo/pilot | alto | desconocido | si | si | Nunca contra production sin plan formal. | DevOps/DB | NO EJECUTAR SIN APROBACION. |
| `scripts/sprint1-npm-audit-summary.sh` | validation | Resumen npm audit Sprint 1. | lab/demo/pilot/production | bajo | si | no | no | No aplicar fixes automaticos. | QA/Security | No usar `audit fix --force`. |
| `scripts/test-ai-engine-process-map.sh` | validation | Test AI engine process map. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA/AI | No destructivo inferido. |
| `scripts/test-ai-entitlements-hardening-flow.sh` | validation | Test hardening entitlements IA. | lab/demo/pilot | medio | desconocido | si | no | Confirmar si escribe antes de prod. | QA/AI | Requiere revision manual. |
| `scripts/test-ai-ui-entitlements-flow.sh` | validation | Test UI entitlements IA. | lab/demo/pilot | medio | desconocido | si | no | Confirmar si escribe. | QA/Frontend | Requiere revision manual. |
| `scripts/test-company-profile-ai-flow.sh` | validation | Test perfil empresa IA. | lab/demo/pilot | medio | desconocido | si | no | Puede generar analisis. | QA/AI | Requiere tenant demo. |
| `scripts/test-company-profile-applicability-universe.sh` | validation | Test universo aplicabilidad company profile. | lab/demo/pilot | medio | desconocido | si | no | Confirmar si reconstruye datos. | QA/Backend | Requiere revision manual. |
| `scripts/test-company-profile-impact-flow.sh` | validation | Test impacto company profile. | lab/demo/pilot | medio | desconocido | si | no | Confirmar si escribe. | QA/Backend | Requiere revision manual. |
| `scripts/test-company-profile-operational-impact-full-flow.sh` | validation | Test impacto operacional full. | lab/demo/pilot | medio | desconocido | si | no | Puede generar PDF/artefactos. | QA/Backend | Requiere revision manual. |
| `scripts/test-controls-applicability-flow.sh` | validation | Test aplicabilidad controles. | lab/demo/pilot | medio | desconocido | si | no | Confirmar si escribe. | QA/Backend | Requiere revision manual. |
| `scripts/test-db-applicability-consistency.sh` | validation | Test consistencia DB aplicabilidad. | lab/demo/pilot | medio | si | si en prod | no | Confirmar read-only. | QA/DB | Requiere credenciales DB. |
| `scripts/test-document-sources-tenant-isolation-flow.sh` | validation | Test aislamiento fuentes documentales. | lab/demo/pilot | medio | desconocido | si | no | Puede crear fuentes demo. | QA/Security | Requiere revision manual. |
| `scripts/test-document-suggestion-evidence-mapping-flow.sh` | validation | Test sugerencias/evidencia. | lab/demo/pilot | medio | desconocido | si | no | Puede crear asociaciones. | QA/Backend | Requiere revision manual. |
| `scripts/test-google-drive-document-source-lifecycle.sh` | validation | Test lifecycle Google Drive source. | lab/demo/pilot | medio | desconocido | si | no | Requiere credenciales OAuth demo. | QA/Integraciones | No usar secretos en logs. |
| `scripts/test-health-applicability-flow.sh` | validation | Test health aplicabilidad. | lab/demo/pilot | medio | desconocido | si | no | Confirmar si refresca calculos. | QA/Backend | Requiere revision manual. |
| `scripts/test-kpi-applicability-flow.sh` | validation | Test KPI aplicabilidad. | lab/demo/pilot | medio | desconocido | si | no | Confirmar si refresca calculos. | QA/Backend | Requiere revision manual. |
| `scripts/test-market-readiness-flow.sh` | validation | Test market readiness. | lab/demo/pilot | medio | desconocido | si | no | Puede tocar datos demo. | QA/Producto | Requiere revision manual. |
| `scripts/test-rbac-health-flow.sh` | validation | Test RBAC health. | lab/demo/pilot | bajo | si | no | no | Requiere tokens seguros. | QA/Security | No imprimir tokens. |
| `scripts/test-report-applicability-flow.sh` | validation | Test report/applicability. | lab/demo/pilot | medio | desconocido | si | no | Puede generar reportes. | QA/Backend | Requiere revision manual. |
| `scripts/test-tcdx-system-master.sh` | validation | Suite master sistema. | lab/demo/pilot | alto | desconocido | si | no | Revisar flags; puede llamar IA/deploy checks. | QA/DevOps | NO EJECUTAR SIN APROBACION en prod. |
| `scripts/test-tenant-ai-entitlements-flow.sh` | validation | Test entitlements IA tenant. | lab/demo/pilot | medio | desconocido | si | no | Puede alterar entitlements demo. | QA/AI | Requiere revision manual. |
| `scripts/validate-ai-knowledge.sh` | validation | Validar knowledge IA. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA/AI | No destructivo inferido. |
| `scripts/validate-dashboard-consolidated-functional-parity.sh` | validation | Validar paridad dashboard consolidado. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA/Frontend | No destructivo inferido. |
| `scripts/validate-dashboard-operational-replacement.sh` | validation | Validar reemplazo operacional dashboard. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA/Frontend | No destructivo inferido. |
| `scripts/validate-dashboard-v2-base.sh` | validation | Validar dashboard v2 base. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA/Frontend | No destructivo inferido. |
| `scripts/validate-dashboard-v2-health-lifecycle.sh` | validation | Validar health/lifecycle dashboard v2. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA/Frontend | No destructivo inferido. |
| `scripts/validate-dashboard-v2-operational-panels.sh` | validation | Validar paneles operacionales dashboard v2. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA/Frontend | No destructivo inferido. |
| `scripts/validate-dashboard-v2-preferences.sh` | validation | Validar preferencias dashboard v2. | lab/demo/pilot | medio | desconocido | si | no | Puede escribir preferencias; usar tenant demo. | QA/Frontend | Requiere revision manual. |
| `scripts/validate-dashboard-visual-kpi-salud.sh` | validation | Validar visual KPI salud. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA/Frontend | No destructivo inferido. |
| `scripts/validate-iso-action-workflow.sh` | validation | Validar workflow acciones ISO. | lab/demo/pilot | medio | desconocido | si | no | Puede crear/actualizar acciones. | QA/Backend | Requiere revision manual. |
| `scripts/validate-iso-auditor.sh` | validation | Validar ISO auditor. | lab/demo/pilot | medio | desconocido | si | no | Puede invocar IA. | QA/AI | Requiere revision manual. |
| `scripts/validate-iso-command-center.sh` | legacy | Validar command center ISO. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA/Frontend | Legacy/alias. |
| `scripts/validate-iso-control-mapping.sh` | validation | Validar mapeo controles ISO. | lab/demo/pilot | medio | desconocido | si | no | Confirmar si aplica cambios. | QA/DB | Requiere revision manual. |
| `scripts/validate-iso-coverage-extension.sh` | validation | Validar extension cobertura ISO. | lab/demo/pilot | medio | desconocido | si | no | Puede depender de seeds. | QA/DB | Requiere revision manual. |
| `scripts/validate-iso-document-generator.sh` | validation | Validar generador documental ISO. | lab/demo/pilot | medio | desconocido | si | no | Puede generar documentos. | QA/Backend | Requiere revision manual. |
| `scripts/validate-iso-express-diagnostic.sh` | validation | Validar diagnostico express ISO. | lab/demo/pilot | medio | desconocido | si | no | Puede crear diagnosticos. | QA/Backend | Requiere revision manual. |
| `scripts/validate-iso-knowledge.sh` | validation | Validar knowledge ISO. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA/AI | No destructivo inferido. |
| `scripts/validate-iso-operational-execution.sh` | validation | Validar ejecucion operacional ISO. | lab/demo/pilot | medio | desconocido | si | no | Puede crear/actualizar ejecucion. | QA/Backend | Requiere revision manual. |
| `scripts/validate-iso-phase-1-11-1-13.sh` | legacy | Validar fase ISO historica. | lab/demo | medio | desconocido | si | no | Solo referencia historica. | QA | Legacy. |
| `scripts/validate-iso-recommended-action-conversions.sh` | validation | Validar conversion acciones recomendadas. | lab/demo/pilot | medio | desconocido | si | no | Puede crear conversiones. | QA/Backend | Requiere revision manual. |
| `scripts/validate-iso-recommended-actions.sh` | validation | Validar acciones recomendadas. | lab/demo/pilot | medio | desconocido | si | no | Puede crear sugerencias/acciones. | QA/Backend | Requiere revision manual. |
| `scripts/validate-iso-risk-matrix.sh` | validation | Validar matriz riesgo ISO. | lab/demo/pilot | medio | desconocido | si | no | Puede crear runs. | QA/Backend | Requiere revision manual. |
| `scripts/validate-iso-unified-command-center.sh` | legacy | Validar command center unificado. | lab/demo | bajo | si | no | no | Ruta legacy/alias. | QA/Frontend | Legacy. |

## scripts/qa subdirectory

| Ruta | Categoria | Proposito inferido | Ambiente permitido | Riesgo | Reversible | Aprobacion | Backup previo | Condicion de ejecucion | Owner | Observacion |
|---|---|---|---|---:|---|---|---|---|---|---|
| `scripts/qa/test-ai-engine-contracts.sh` | validation | Contratos AI Engine. | lab/demo/pilot | bajo | si | no | no | Entorno seguro. | QA/AI | No destructivo inferido. |
| `scripts/qa/test-company-profile-flow.sh` | validation | Flow company profile. | lab/demo/pilot | medio | desconocido | si | no | Puede escribir datos de perfil demo. | QA/Backend | Requiere revision manual. |
| `scripts/qa/test-html-pdf-renderer.js` | validation | Test renderer HTML/PDF. | lab/demo | bajo | si | no | no | Salida temporal controlada. | QA/Backend | No versionar artefactos. |
| `scripts/qa/test-ia-auditor-pdf-layout.js` | validation | Test layout PDF IA auditor. | lab/demo | bajo | si | no | no | Salida temporal controlada. | QA/AI | No versionar artefactos. |

## deploy

Ambiente permitido: demo/pilot/production solo con aprobacion explicita. Riesgo:
critico si afecta hosts reales. Reversible: desconocido. Backup previo: si para
production. Owner: DevOps. Observacion: **NO EJECUTAR SIN APROBACION**.

| Ruta | Categoria | Proposito inferido | Condicion de ejecucion |
|---|---|---|---|
| `deploy/templates/nginx/tcdx-backend-api.conf` | deploy | Template Nginx backend API. | Revisar template y ambiente objetivo antes de aplicar. |
| `deploy/templates/nginx/tcdx-frontend-http.conf` | deploy | Template Nginx frontend HTTP. | Revisar template y ambiente objetivo antes de aplicar. |
| `deploy/templates/nginx/tcdx-frontend-https.conf` | deploy | Template Nginx frontend HTTPS. | Revisar certificados y hostnames antes de aplicar. |
| `deploy/templates/systemd/ai-engine.service` | deploy | Template systemd AI Engine. | Revisar usuario, rutas y variables antes de aplicar. |
| `deploy/templates/systemd/tecdex-backend.service` | deploy | Template systemd backend. | Respetar systemd tecdex-backend; no usar PM2. |
| `deploy/templates/systemd/tecdex-frontend.service` | deploy | Template systemd frontend. | Revisar rutas y usuario antes de aplicar. |
| `scripts/deploy-vms.sh` | deploy | Deploy VMs. | Ventana aprobada y rollback. |
| `scripts/push-deploy.sh` | deploy | Push/deploy runtime. | Aprobacion explicita de push/deploy. |

## Agent

| Ruta | Categoria | Proposito inferido | Ambiente permitido | Riesgo | Reversible | Aprobacion | Backup previo | Condicion de ejecucion | Owner | Observacion |
|---|---|---|---|---:|---|---|---|---|---|---|
| `agent/tcdx-sync-agent/agent.js` | runtime | Agente local de sincronizacion documental tenant-scoped. | lab/demo/pilot/production | medio | desconocido | si en prod | no | Revisar config, token agente y tenant antes de ejecutar. | Integraciones/DevOps | No imprimir token agente. |
| `agent/tcdx-sync-agent/package.json` | runtime | Manifest Node del agente. | lab/demo/pilot/production | bajo | si | no | no | No ejecutar install/run sin revisar entorno. | Integraciones | Archivo de soporte. |
| `agent/tcdx-sync-agent/package-lock.json` | runtime | Lockfile agente. | lab/demo/pilot/production | bajo | si | no | no | Mantener para reproducibilidad. | Integraciones | Archivo de soporte. |

## Decisiones operativas iniciales

- No borrar scripts legacy sin dependency scan.
- No mover scripts sin actualizar runbooks y referencias.
- No ejecutar SQL desde `database/` sin aprobacion explicita.
- No ejecutar repair/rollback/deploy en Sprint 3 sin bloque separado y plan de
  rollback.
- Las suites QA pueden ejecutarse solo cuando el entorno seguro este cargado y
  los scripts no impriman tokens ni cabeceras Authorization.
- Los resultados de QA deben escribirse en `qa-results/` y no versionarse.
