# Sprint 0 - Controllers y services backend

## Controllers existentes
| Controller | Usado | Dependencias |
| --- | --- | --- |
| backend/src/controllers/auditPreparation.controller.js | sí | ../services/auditPreparation.service |
| backend/src/controllers/kpi.controller.js | sí | ../config/db, ../services/applicabilityScope.service |
| backend/src/controllers/notifications.controller.js | sí | ../config/db |
| backend/src/controllers/search.controller.js | sí | ../config/db |

## Services existentes
| Servicio | Usado | Módulo |
| --- | --- | --- |
| backend/src/services/aiContextBuilder.service.js | sí | Revisar |
| backend/src/services/aiEngineClient.service.js | sí | Revisar |
| backend/src/services/aiOperationalReview.service.js | sí | Revisar |
| backend/src/services/aiRuntimeMetrics.service.js | sí | Revisar |
| backend/src/services/applicabilityScope.service.js | sí | Revisar |
| backend/src/services/asyncJob.service.js | sí | Revisar |
| backend/src/services/auditDocumentConversion.service.js | sí | Revisar |
| backend/src/services/auditDocumentRenderer.service.js | sí | Revisar |
| backend/src/services/auditOcr.service.js | sí | Revisar |
| backend/src/services/auditPreparation.service.js | sí | Revisar |
| backend/src/services/auditPreparationContext.service.js | sí | Revisar |
| backend/src/services/auditZipExtraction.service.js | sí | Revisar |
| backend/src/services/auth.service.js | sí | Core MVP / base SaaS |
| backend/src/services/companyProfile.service.js | sí | Revisar |
| backend/src/services/companyProfileApplicabilityEngine.service.js | sí | Revisar |
| backend/src/services/companyProfileImpact.service.js | sí | Revisar |
| backend/src/services/dashboardV2.service.js | sí | Core MVP |
| backend/src/services/documentAiAnalysis.service.js | sí | Revisar |
| backend/src/services/documentContentExtraction.service.js | sí | Revisar |
| backend/src/services/documentGoogleFolders.service.js | sí | Revisar |
| backend/src/services/documentGoogleSync.service.js | sí | Revisar |
| backend/src/services/evidence-ai.service.js | sí | Revisar |
| backend/src/services/governance.service.js | sí | Revisar |
| backend/src/services/isoAuditor.service.js | sí | Diferenciador |
| backend/src/services/isoCommandCenter.service.js | sí | Revisar |
| backend/src/services/isoControlMapping.service.js | sí | Revisar |
| backend/src/services/isoDocumentGenerator.service.js | sí | Revisar |
| backend/src/services/isoExpressDiagnostic.service.js | sí | Core MVP |
| backend/src/services/isoKnowledge.service.js | sí | Revisar |
| backend/src/services/isoOperationalExecution.service.js | sí | Revisar |
| backend/src/services/isoRecommendedActions.service.js | sí | Revisar |
| backend/src/services/isoRiskMatrix.service.js | sí | Diferenciador |
| backend/src/services/kpi.engine.js | sí | Diferenciador |
| backend/src/services/mountedShareDocumentSource.service.js | sí | Revisar |
| backend/src/services/providers/googleDrive.provider.js | sí | Revisar |
| backend/src/services/reportAiEnrichment.service.js | sí | Revisar |
| backend/src/services/seniorAuditorSuggestions.service.js | sí | Revisar |
| backend/src/services/tenantAiSettings.service.js | sí | Revisar |
| backend/src/services/zohoWorkdriveClient.service.js | sí | Revisar |

## Dependencias routes/controllers/services
- Rutas con controller claro: `auditPreparation.routes.js`, `kpi.routes.js`, `notifications.routes.js`, `search.routes.js`.
- La mayoría de rutas implementa queries/controladores inline y requiere services específicos solo cuando el módulo creció: IA, reportes, dashboard v2, company profile, document integrations, ISO knowledge/mapping/risk/document generator.
- Servicios críticos MVP: `auth.service.js`, `aiContextBuilder.service.js`, `aiEngineClient.service.js`, `dashboardV2.service.js`, `evidence-ai.service.js`, `isoExpressDiagnostic.service.js`, `kpi.engine.js`, `reportAiEnrichment.service.js`, `tenantAiSettings.service.js`.

## Hallazgos
- No hay una separación uniforme controller/service: varios módulos core siguen con lógica SQL en route files grandes. Esto es aceptable para Sprint 0, pero aumenta riesgo de cambios futuros.
- `auditOcr.service.js` y `auditDocumentConversion.service.js` usan `execFile`; revisar hardening operativo antes de exponer procesamiento documental amplio.
- Servicios marcados como `no aparente` pueden estar preparados para uso dinámico o futuro; no borrar sin búsqueda adicional, pruebas y validación funcional.
