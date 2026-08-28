# Commercial Plan Capability Matrix

Status: `COMMERCIAL_PLAN_MATRIX_APPROVED_LOCAL`

Production modified: `NO`

## Rule

```text
ISO = ONLY_ISO
ISO_RISK = ISO + OPERATIONAL_RISK_ONLY
GRC = ALL_TENANT_COMMERCIAL_CAPABILITIES
```

Effective authorization remains:

```text
tenant active
AND subscription active
AND plan enables capability
AND module active
AND RBAC permission
AND scope
```

## Capability Matrix

| Capability | Dominio | ISO | ISO + Riesgo | GRC | Modulo | Permiso |
|---|---|---:|---:|---:|---|---|
| `core.dashboard` | ISO_ONLY | YES | YES | YES | `core` | `dashboards.read` |
| `core.reports` | ISO_ONLY | YES | YES | YES | `core` | `reports.read` |
| `iso.compliance` | ISO_ONLY | YES | YES | YES | `iso` | `framework.read` |
| `iso.risk` | ISO_ONLY | YES | YES | YES | `risks` | `risk_matrix.view` |
| `iso.actions` | ISO_ONLY | YES | YES | YES | `iso` | `actions.read` |
| `evidence.library` | ISO_ONLY | YES | YES | YES | `evidences` | `evidences.view` |
| `iso.health` | ISO_ONLY | YES | YES | YES | `health` | `framework.read` |
| `grc.phase3` | OPERATIONAL_RISK_EXTENSION | NO | YES | YES | `operations_grc` | `operations.dashboard.read` |
| `imports.excel` | OPERATIONAL_RISK_EXTENSION | NO | YES | YES | `operations_grc` | `operations.import` |
| `risk.quantitative` | OPERATIONAL_RISK_EXTENSION | NO | YES | YES | `risk_manager` | `quantitative_risk.read` |
| `methodology.risk` | OPERATIONAL_RISK_EXTENSION | NO | YES | YES | `risk_manager` | `quantitative_risk.read` |
| `loss.events` | OPERATIONAL_RISK_EXTENSION | NO | YES | YES | `operational_losses` | `loss_events.read` |
| `grc.phase1` | GRC_ADVANCED | NO | NO | YES | `grc_core` | `workflow.read` |
| `grc.phase2` | GRC_ADVANCED | NO | NO | YES | `integrated_grc` | `workflow.read` |
| `tprm.suppliers` | GRC_ADVANCED | NO | NO | YES | `integrated_grc` | `suppliers.read` |
| `data.governance` | GRC_ADVANCED | NO | NO | YES | `data_governance` | `data.catalog.read` |
| `metrics.catalog` | GRC_ADVANCED | NO | NO | YES | `metrics_bi` | `metrics.read` |
| `metrics.engine` | GRC_ADVANCED | NO | NO | YES | `metrics_bi` | `metrics.measure` |
| `metrics.data_trust` | GRC_ADVANCED | NO | NO | YES | `data_governance` | `data.quality.read` |
| `data.lineage` | GRC_ADVANCED | NO | NO | YES | `data_governance` | `data.lineage.read` |
| `data.impact_graph` | GRC_ADVANCED | NO | NO | YES | `data_governance` | `data.lineage.read` |
| `data.semantic_layer` | GRC_ADVANCED | NO | NO | YES | `data_governance` | `semantic.contracts.read` |
| `surveys.engine` | GRC_ADVANCED | NO | NO | YES | `surveys_assessments` | `surveys.read` |
| `assurance.testing` | GRC_ADVANCED | NO | NO | YES | `assurance_loss` | `assurance_tests.read` |
| `bi.dashboard_builder` | GRC_ADVANCED | NO | NO | YES | `metrics_bi` | `dashboards.read` |
| `bi.executive_dashboards` | GRC_ADVANCED | NO | NO | YES | `metrics_bi` | `dashboards.read` |
| `reporting.studio` | GRC_ADVANCED | NO | NO | YES | `report_studio` | `reports.read` |
| `reporting.pdf` | GRC_ADVANCED | NO | NO | YES | `report_studio` | `reports.generate` |
| `reporting.docx` | GRC_ADVANCED | NO | NO | YES | `report_studio` | `reports.generate` |
| `reporting.xlsx` | GRC_ADVANCED | NO | NO | YES | `report_studio` | `reports.generate` |
| `reporting.scheduled` | GRC_ADVANCED | NO | NO | YES | `report_studio` | `reports.schedule` |
| `reports.premium` | GRC_ADVANCED | NO | NO | YES | `premium_reports` | `grc.export.generate` |
| `workpapers.audit` | GRC_ADVANCED | NO | NO | YES | `audit_workpapers` | `commercial.workpaper.read` |
| `ai.compliance` | GRC_ADVANCED | NO | NO | YES | `ai_compliance` | `ai_compliance.read` |
| `ai.auditor` | GRC_ADVANCED | NO | NO | YES | `ai_compliance` | `audit.review` |
| `metrics.indicators.read` | GRC_ADVANCED | NO | NO | YES | `metrics_bi` | `metrics.read` |
| `metrics.indicators.technical` | GRC_ADVANCED | NO | NO | YES | `metrics_bi` | `data.lineage.read` |
| `metrics.methodology.manage` | GRC_ADVANCED | NO | NO | YES | `metrics_bi` | `metrics.manage` |
| `metrics.methodology.review` | GRC_ADVANCED | NO | NO | YES | `metrics_bi` | `metrics.validate` |
| `metrics.methodology.publish` | GRC_ADVANCED | NO | NO | YES | `metrics_bi` | `metrics.publish` |
| `metrics.snapshots.publish` | GRC_ADVANCED | NO | NO | YES | `metrics_bi` | `metrics.measure` |
| `metrics.comparisons.read` | GRC_ADVANCED | NO | NO | YES | `metrics_bi` | `metrics.read` |
| `metrics.actions.propose` | GRC_ADVANCED | NO | NO | YES | `metrics_bi` | `metrics.measure` |
| `metrics.actions.review` | GRC_ADVANCED | NO | NO | YES | `metrics_bi` | `metrics.validate` |
| `metrics.jobs.run` | GRC_ADVANCED | NO | NO | YES | `metrics_bi` | `metrics.recalculate` |

## Functional Validation Matrix

| Functional capability | Technical capability_key | Module | Routes | Backend endpoints/services | Expected plan | Actual plan | Overexposure | Underexposure | Validation evidence | Result |
|---|---|---|---|---|---|---|---:|---:|---|---|
| Dashboard base del tenant | `core.dashboard` | `core` | `/dashboard` | `/api/dashboard`; `/api/me/entitlements` | ISO, ISO + Riesgo, GRC | ISO, ISO + Riesgo, GRC | NO | NO | contract test + route matrix | MATCH |
| Reportes/exportes estrictamente ISO | `core.reports` | `core` | `/exportes` | `/api/reports` | ISO, ISO + Riesgo, GRC | ISO, ISO + Riesgo, GRC | NO | NO | contract test + route matrix | MATCH |
| Gestion ISO, diagnostico, controles, SOA, auditorias, hallazgos y no conformidades | `iso.compliance` | `iso` | `/cumplimiento-auditoria`; `/diagnostico`; `/controles`; `/soa`; `/ciclo-vida`; `/auditorias`; `/auditorias/ejecucion`; `/ejecucion-iso`; `/hallazgos`; `/no-conformidades` | `/api/diagnostic`; `/api/controls`; `/api/soa`; `/api/lifecycle`; `/api/audits`; `/api/audit-execution`; `/api/findings`; `/api/nonconformities` | ISO, ISO + Riesgo, GRC | ISO, ISO + Riesgo, GRC | NO | NO | contract test + route matrix | MATCH |
| Riesgos ISO y matriz de riesgo ISO | `iso.risk` | `risks` | `/riesgos`; `/matriz-riesgo`; `/activos` | `/api/iso-risk-matrix`; `/api/assets` | ISO, ISO + Riesgo, GRC | ISO, ISO + Riesgo, GRC | NO | NO | contract test + route matrix | MATCH |
| Planes de accion y acciones recomendadas de cumplimiento ISO | `iso.actions` | `iso` | `/planes-accion`; `/plan-accion`; `/acciones-recomendadas` | `/api/action-plans`; `/api/iso-recommended-actions` | ISO, ISO + Riesgo, GRC | ISO, ISO + Riesgo, GRC | NO | NO | contract test + route matrix | MATCH |
| Biblioteca de evidencias y documentos normativos ISO | `evidence.library` | `evidences` | `/evidencias`; `/documentos` | `/api/evidences`; `/api/evidence-library` | ISO, ISO + Riesgo, GRC | ISO, ISO + Riesgo, GRC | NO | NO | contract test + route matrix | MATCH |
| Health/estado ISO y KPIs minimos ISO | `iso.health` | `health` | `/iso-health`; `/health`; `/administrar-kpis` | `/api/health`; `/api/kpi`; `/api/kpis` | ISO, ISO + Riesgo, GRC | ISO, ISO + Riesgo, GRC | NO | NO | contract test + route matrix | MATCH |
| Operacion, procesos, unidades, servicios, BIA, continuidad, crisis e indicadores operacionales | `grc.phase3` | `operations_grc` | `/operaciones-grc`; `/unidades`; `/procesos`; `/servicios`; `/bia`; `/continuidad`; `/crisis`; `/indicadores` | `/api/grc/phase3` | ISO + Riesgo, GRC | ISO + Riesgo, GRC | NO | NO | contract test + route matrix | MATCH |
| Importacion operacional | `imports.excel` | `operations_grc` | `/importaciones`; `/operaciones-grc/importar` | `/api/imports` | ISO + Riesgo, GRC | ISO + Riesgo, GRC | NO | NO | contract test + route matrix | MATCH |
| Riesgo cuantitativo operacional | `risk.quantitative` | `risk_manager` | `/riesgo-cuantitativo` | `/api/operational-risks` | ISO + Riesgo, GRC | ISO + Riesgo, GRC | NO | NO | contract test + route matrix | MATCH |
| Metodologias de riesgo operacional | `methodology.risk` | `risk_manager` | `/riesgo-cuantitativo` | `/api/operational-risks` | ISO + Riesgo, GRC | ISO + Riesgo, GRC | NO | NO | contract test + route matrix | MATCH |
| Eventos de perdida operacional | `loss.events` | `operational_losses` | `/eventos-perdida` | `/api/loss-events` | ISO + Riesgo, GRC | ISO + Riesgo, GRC | NO | NO | contract test + route matrix | MATCH |
| Workflow GRC transversal, readiness y auditoria avanzada | `grc.phase1` | `grc_core` | `/grc-global` | `/api/grc` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Privacidad, incidentes, conectores y GRC integrado | `grc.phase2` | `integrated_grc` | `/grc-global`; `/privacidad`; `/incidentes`; `/conectores` | `/api/grc/phase2` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Proveedores, terceros y TPRM | `tprm.suppliers` | `integrated_grc` | `/proveedores`; `/portal-proveedor` | `/api/grc/phase2/suppliers`; `/api/supplier-portal` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Gobierno de datos y catalogo | `data.governance` | `data_governance` | `/grc`; `/datos`; `/datos/catalogo` | `/api/data`; `/api/grc/overview` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Catalogo de metricas GRC avanzadas | `metrics.catalog` | `metrics_bi` | `/metricas`; `/metricas/[id]`; `/metricas/constructor` | `/api/metrics`; `/api/grc/official/analytics` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Motor de metricas GRC avanzadas | `metrics.engine` | `metrics_bi` | `/metricas/constructor` | `/api/metrics/:id/calculate`; `/api/grc/official/recalculate` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Data Trust avanzado | `metrics.data_trust` | `data_governance` | `/datos/calidad` | `/api/data/quality` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Lineage de datos | `data.lineage` | `data_governance` | `/datos/lineage` | `/api/data/lineage` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Impact Graph GRC | `data.impact_graph` | `data_governance` | `/grc` | `/api/data/impact`; `/api/grc/impact` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Semantica de datos | `data.semantic_layer` | `data_governance` | `/datos/semantica` | `/api/semantic` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Encuestas y evaluaciones GRC | `surveys.engine` | `surveys_assessments` | `/encuestas`; `/encuestas/[id]`; `/evaluaciones` | `/api/surveys`; `/api/survey-campaigns`; `/api/survey-responses` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Assurance y tests GRC avanzados | `assurance.testing` | `assurance_loss` | `/tests` | `/api/assurance-tests` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Constructor de dashboards BI | `bi.dashboard_builder` | `metrics_bi` | `/bi/dashboards/[id]` | `/api/dashboards` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Dashboards ejecutivos BI | `bi.executive_dashboards` | `metrics_bi` | `/bi` | `/api/dashboards` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Report Studio avanzado | `reporting.studio` | `report_studio` | `/reportes/studio`; `/reportes/generaciones` | `/api/reports`; `/api/report-generations` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Generacion PDF avanzada | `reporting.pdf` | `report_studio` | `/reportes/generaciones` | `/api/report-generations/:id/download` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Generacion DOCX avanzada | `reporting.docx` | `report_studio` | `/reportes/generaciones` | `/api/report-generations` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Generacion XLSX avanzada | `reporting.xlsx` | `report_studio` | `/reportes/generaciones` | `/api/report-generations` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Reportes programados avanzados | `reporting.scheduled` | `report_studio` | `/reportes/studio` | `/api/report-schedules` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Premium reports y ZIP/PDF ejecutivo | `reports.premium` | `premium_reports` | `/reportes/studio` | `/api/reports` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Papeles de trabajo avanzados de auditoria | `workpapers.audit` | `audit_workpapers` | `/auditorias/ia` | `/api/audit-preparation` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| IA Compliance avanzada | `ai.compliance` | `ai_compliance` | `/ia`; `/ia-compliance`; `/ia-compliance/sugerencias` | `/api/ai-compliance` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| IA Auditor avanzada | `ai.auditor` | `ai_compliance` | `/ia-auditor`; `/auditorias/ia` | `/api/ai-auditor` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Indicadores oficiales avanzados | `metrics.indicators.read` | `metrics_bi` | `/metricas` | `/api/metrics` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Detalle tecnico de indicadores | `metrics.indicators.technical` | `metrics_bi` | `/metricas/[id]` | `/api/metrics` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Administrar metodologia de indicadores | `metrics.methodology.manage` | `metrics_bi` | `/metricas/constructor` | `/api/metrics` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Revisar metodologia de indicadores | `metrics.methodology.review` | `metrics_bi` | `/metricas/constructor` | `/api/metrics` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Publicar metodologia de indicadores | `metrics.methodology.publish` | `metrics_bi` | `/metricas/constructor` | `/api/metrics` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Publicar snapshots oficiales | `metrics.snapshots.publish` | `metrics_bi` | `/metricas/[id]` | `/api/metrics` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Comparaciones de indicadores | `metrics.comparisons.read` | `metrics_bi` | `/metricas/[id]` | `/api/metrics` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Propuestas de acciones desde indicadores | `metrics.actions.propose` | `metrics_bi` | `/metricas/[id]` | `/api/metrics` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Revision de acciones propuestas desde indicadores | `metrics.actions.review` | `metrics_bi` | `/metricas/[id]` | `/api/metrics` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |
| Jobs de indicadores | `metrics.jobs.run` | `metrics_bi` | `/metricas` | `/api/metrics` | GRC | GRC | NO | NO | contract test + route matrix | MATCH |

## Internal Routes

These are not granted by tenant commercial plan modules:

| Capability | Classification | Routes |
|---|---|---|
| `core.profile` | PLATFORM_INTERNAL | `/perfil` |
| `tenant.admin` | PLATFORM_INTERNAL | `/configuracion`; `/usuarios`; `/perfil-empresa` |
| `platform.admin` | PLATFORM_INTERNAL | `/admin-saas`; `/empresas` |
| `dealer.console` | DEALER_INTERNAL | `/dealer`; `/cotizador`; `/prefacturacion` |

## Routes

Generated route matrix:

```text
artifacts/rbac02-route-audit/route_access_matrix.csv
routes=97
mapped=97
missing=0
```

Administrative platform, dealer and profile routes are mapped for authorization evidence, but they are not assigned as common tenant commercial modules.

## Result

```text
OVEREXPOSED=0
UNDEREXPOSED=0
MISCLASSIFIED=0
GRC_COVERAGE=45/45 tenant commercial capabilities
```
