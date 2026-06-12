# Scripts manifest

Fecha: 2026-06-12
Rama: `chore/cleanup-stage-3a-official-surface`

| Script | Clasificacion | Uso esperado | Riesgo | Accion futura |
| ------ | ------------- | ------------ | ------ | ------------- |
| `agent/tcdx-sync-agent/agent.js` | deploy_runtime | Agente local de sincronizacion documental | Alto: tokens/uploads locales | Revisar en etapa seguridad Sync Agent. |
| `agent/tcdx-sync-agent/package-lock.json` | deploy_runtime | Lockfile agente | Bajo | Conservar. |
| `agent/tcdx-sync-agent/package.json` | deploy_runtime | Scripts/deps agente | Bajo | Conservar. |
| `scripts/apply-ai-bootstrap-knowledge-db.sh` | unknown_requires_review | Carga conocimiento IA en DB | Alto: DB write | No ejecutar sin aprobacion DBA/AI. |
| `scripts/backup-runtime.sh` | backup_runtime | Backup runtime | Alto si entorno incorrecto | Ejecutar solo con runbook. |
| `scripts/check-ai-engine.sh` | qa_manual | Check AI Engine | Bajo/medio | Conservar QA manual. |
| `scripts/check-backend.sh` | qa_manual | Check backend | Bajo | Conservar QA manual. |
| `scripts/check-db-objects.sh` | security_check | Inspeccion DB/objetos | Medio/alto | Ejecutar solo con credenciales seguras y alcance aprobado. |
| `scripts/check-demo-readiness.sh` | qa_manual | Readiness demo | Bajo/medio | Conservar. |
| `scripts/check-frontend.sh` | qa_manual | Check frontend | Bajo | Conservar. |
| `scripts/check-rbac.sh` | security_check | Validacion RBAC | Medio: requiere tokens/entorno | Conservar; no imprimir secretos. |
| `scripts/check-secrets-runtime.sh` | security_check | Secret hygiene runtime | Medio | Conservar seguridad. |
| `scripts/collect-ops-logs.sh` | deploy_runtime | Recoleccion logs ops | Medio: logs sensibles | Revisar redaccion/no secretos. |
| `scripts/collect-runtime-inventory.sh` | deploy_runtime | Inventario runtime | Medio | Conservar con cuidado de secretos. |
| `scripts/deploy-vms.sh` | deploy_runtime | Deploy VM | Alto | Ejecutar solo con aprobacion deploy. |
| `scripts/env-check.sh` | security_check | Validacion entorno | Bajo | Fuente vigente para variables. |
| `scripts/generate-deep-report-cli.sh` | qa_manual | Generacion reporte via API | Medio: tokens/reportes | Mantener QA manual. |
| `scripts/monitor-runtime.sh` | deploy_runtime | Monitor runtime | Medio | Conservar ops. |
| `scripts/patch_action_plans_direct_evidence.py` | legacy_candidate | Patch puntual historico | Medio | Mover a legacy tras revision. |
| `scripts/patch_controls_workbench_effective_health_view.py` | legacy_candidate | Patch puntual dashboard/controles | Medio | Mover a legacy tras revision. |
| `scripts/patch_controls_workbench_map_effective_health.py` | legacy_candidate | Patch puntual dashboard/controles | Medio | Mover a legacy tras revision. |
| `scripts/patch_controls_workbench_operational_scope.py` | legacy_candidate | Patch puntual dashboard/controles | Medio | Mover a legacy tras revision. |
| `scripts/preventa-check.sh` | qa_manual | Check preventa | Bajo/medio | Conservar si sigue en demo. |
| `scripts/push-deploy.sh` | deploy_runtime | Push/deploy | Alto | Ejecutar solo con aprobacion. |
| `scripts/qa-ai-auditor-full.sh` | qa_manual | QA IA Auditor | Medio | Mantener manual/enterprise. |
| `scripts/qa-ai-locale-consistency.sh` | qa_manual | QA i18n IA | Bajo | Conservar. |
| `scripts/qa-backup-readiness.sh` | backup_runtime | Readiness backup | Medio/alto | Ejecutar con runbook. |
| `scripts/qa-bilingual-full.sh` | qa_manual | QA bilingue | Bajo/medio | Conservar. |
| `scripts/qa-cloud-readiness.sh` | qa_manual | Readiness cloud | Medio | Conservar si cloud aplica. |
| `scripts/qa-cross-tenant-core.sh` | security_check | Cross-tenant smoke | Alto valor; requiere tokens | Conservar como QA seguridad. |
| `scripts/qa-e2e-minimal.sh` | qa_manual | E2E minima | Medio | Conservar. |
| `scripts/qa-i18n-db-display.sh` | qa_manual | QA i18n DB display | Bajo | Conservar. |
| `scripts/qa-i18n-english-full.sh` | qa_manual | QA ingles | Bajo | Conservar. |
| `scripts/qa-observability.sh` | qa_manual | QA observabilidad | Medio | Conservar. |
| `scripts/qa-phase4-final.sh` | legacy_candidate | QA fase historica | Bajo/medio | Revisar vigencia. |
| `scripts/qa-rbac-basic.sh` | security_check | RBAC smoke | Medio | Conservar. |
| `scripts/qa-reports-rbac-p1.sh` | security_check | Reportes RBAC | Medio | Conservar. |
| `scripts/qa-security-basic.sh` | security_check | Seguridad basica | Medio | Conservar. |
| `scripts/qa-tenant-path-p1.sh` | security_check | Tenant path | Medio | Conservar. |
| `scripts/qa/qa-cleanup-stage-1-inventory.sh` | ci_candidate | Inventario cleanup | Bajo | Conservar. |
| `scripts/qa/qa-official-surface.sh` | ci_candidate | Control superficie oficial | Bajo | Agregar a QA recurrente. |
| `scripts/qa/test-ai-engine-contracts.sh` | qa_manual | Contratos AI Engine | Medio | Conservar. |
| `scripts/qa/test-company-profile-flow.sh` | qa_manual | Flujo company profile | Medio | Conservar. |
| `scripts/qa/test-html-pdf-renderer.js` | qa_manual | Renderer PDF | Bajo/medio | Conservar. |
| `scripts/qa/test-ia-auditor-pdf-layout.js` | qa_manual | Layout PDF IA Auditor | Bajo/medio | Conservar. |
| `scripts/restore-test.sh` | backup_runtime | Restore test | Alto | Ejecutar solo con runbook. |
| `scripts/sprint1-npm-audit-summary.sh` | security_check | npm audit summary | Bajo | Conservar. |
| `scripts/test-ai-engine-process-map.sh` | qa_manual | AI process map | Medio | Conservar si sigue vigente. |
| `scripts/test-ai-entitlements-hardening-flow.sh` | security_check | AI entitlements | Medio | Conservar. |
| `scripts/test-ai-ui-entitlements-flow.sh` | security_check | AI UI entitlements | Medio | Conservar. |
| `scripts/test-company-profile-ai-flow.sh` | qa_manual | Company profile AI | Medio | Conservar. |
| `scripts/test-company-profile-applicability-universe.sh` | qa_manual | Applicability universe | Medio | Conservar. |
| `scripts/test-company-profile-impact-flow.sh` | qa_manual | Impact flow | Medio | Conservar. |
| `scripts/test-company-profile-operational-impact-full-flow.sh` | qa_manual | Operational impact | Medio | Conservar. |
| `scripts/test-controls-applicability-flow.sh` | qa_manual | Controls applicability | Medio | Conservar. |
| `scripts/test-db-applicability-consistency.sh` | security_check | DB consistency | Alto: DB read | Ejecutar solo con alcance aprobado. |
| `scripts/test-document-sources-tenant-isolation-flow.sh` | security_check | Tenant isolation document sources | Alto valor | Conservar. |
| `scripts/test-document-suggestion-evidence-mapping-flow.sh` | qa_manual | Evidence suggestions | Medio | Conservar. |
| `scripts/test-google-drive-document-source-lifecycle.sh` | security_check | Google Drive lifecycle | Alto: OAuth/docs | Conservar; ejecutar solo con entorno autorizado. |
| `scripts/test-health-applicability-flow.sh` | qa_manual | Health applicability | Medio | Conservar. |
| `scripts/test-kpi-applicability-flow.sh` | qa_manual | KPI applicability | Medio | Conservar. |
| `scripts/test-market-readiness-flow.sh` | qa_manual | Market readiness | Medio | Conservar. |
| `scripts/test-rbac-health-flow.sh` | security_check | RBAC health | Medio | Conservar. |
| `scripts/test-report-applicability-flow.sh` | qa_manual | Report applicability | Medio | Conservar. |
| `scripts/test-tcdx-system-master.sh` | qa_manual | Master smoke | Alto por amplitud | Revisar antes de ejecutar. |
| `scripts/test-tenant-ai-entitlements-flow.sh` | security_check | Tenant AI entitlements | Medio | Conservar. |
| `scripts/validate-ai-knowledge.sh` | legacy_candidate | Validacion fase IA knowledge | Bajo/medio | Revisar vigencia. |
| `scripts/validate-dashboard-consolidated-functional-parity.sh` | qa_manual | Dashboard parity | Medio | Conservar mientras se consolida dashboard. |
| `scripts/validate-dashboard-operational-replacement.sh` | legacy_candidate | Dashboard fase historica | Bajo/medio | Revisar vigencia. |
| `scripts/validate-dashboard-v2-base.sh` | legacy_candidate | Dashboard v2 legacy | Bajo/medio | Candidato tras consolidar `/dashboard`. |
| `scripts/validate-dashboard-v2-health-lifecycle.sh` | legacy_candidate | Dashboard v2 legacy | Bajo/medio | Candidato tras consolidar `/dashboard`. |
| `scripts/validate-dashboard-v2-operational-panels.sh` | legacy_candidate | Dashboard v2 legacy | Bajo/medio | Candidato tras consolidar `/dashboard`. |
| `scripts/validate-dashboard-v2-preferences.sh` | legacy_candidate | Dashboard v2 legacy | Bajo/medio | Candidato tras consolidar `/dashboard`. |
| `scripts/validate-dashboard-visual-kpi-salud.sh` | qa_manual | Dashboard/KPI visual | Bajo/medio | Conservar si cubre `/dashboard`. |
| `scripts/validate-iso-action-workflow.sh` | legacy_candidate | Fase ISO workflow | Bajo/medio | Revisar vigencia. |
| `scripts/validate-iso-auditor.sh` | legacy_candidate | ISO auditor legacy | Bajo/medio | Revisar enterprise. |
| `scripts/validate-iso-command-center.sh` | legacy_candidate | Command center legacy | Bajo/medio | Candidato 3B/4. |
| `scripts/validate-iso-control-mapping.sh` | qa_manual | Control mapping | Medio | Conservar si usado por backend. |
| `scripts/validate-iso-coverage-extension.sh` | qa_manual | Coverage extension | Medio | Revisar. |
| `scripts/validate-iso-document-generator.sh` | qa_manual | Document generator | Medio | Enterprise/manual. |
| `scripts/validate-iso-express-diagnostic.sh` | qa_manual | Diagnostic | Medio | Enterprise/manual. |
| `scripts/validate-iso-knowledge.sh` | qa_manual | ISO knowledge | Medio | Conservar manual. |
| `scripts/validate-iso-operational-execution.sh` | legacy_candidate | Operational execution | Medio | Candidato enterprise/legacy. |
| `scripts/validate-iso-phase-1-11-1-13.sh` | legacy_candidate | Fase historica | Bajo/medio | Candidato legacy. |
| `scripts/validate-iso-recommended-action-conversions.sh` | qa_manual | Recommended actions | Medio | Conservar si usado. |
| `scripts/validate-iso-recommended-actions.sh` | qa_manual | Recommended actions | Medio | Conservar si usado. |
| `scripts/validate-iso-risk-matrix.sh` | qa_manual | Risk matrix | Medio | Conservar. |
| `scripts/validate-iso-unified-command-center.sh` | legacy_candidate | Command center legacy | Bajo/medio | Candidato 3B/4. |

## Regla

Ningun script se elimino en esta etapa. Deploy, backup, DB y OAuth-related scripts requieren aprobacion explicita y entorno seguro.
