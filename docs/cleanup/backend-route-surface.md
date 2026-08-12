# Backend route surface - cleanup stage 1

Fecha: 2026-06-12  
Rama: `chore/cleanup-stage-1-inventory`  
Alcance: inventario estatico. No se eliminaron rutas, no se ejecuto SQL y no se reiniciaron servicios.

| Archivo ruta | Montada en app.js | Base path | Clasificacion | Auth/RBAC esperado | Tenant esperado | Accion recomendada |
| ------------ | ----------------: | --------- | ------------- | ------------------ | --------------- | ------------------ |
| `backend/src/routes/2evidences.routes.js` | No | N/A | legacy_probable | N/A | N/A | `mover_a_legacy` tras confirmar que no hay imports externos. |
| `backend/src/routes/action-plans.routes.js` | Si | `/api/action-plans` | core_mvp | JWT + RBAC global | Tenant por path/body/query y validacion local esperada | Conservar; cubrir con pruebas tenant negativas. |
| `backend/src/routes/admin-saas.routes.js` | Si | `/api/admin-saas` | admin_interno | JWT + RBAC global; plataforma/dealer parcial | Plataforma/dealer/tenant segun endpoint | Conservar; revisar superficie por tamano y permisos. |
| `backend/src/routes/ai-answer.routes.js` | Si | `/api/ai-compliance/answer` | enterprise_post_mvp | JWT + RBAC global | Tenant requerido por contexto | Ocultar cliente MVP si no es flujo basico; revisar gobernanza IA. |
| `backend/src/routes/ai-auditor.routes.js` | Si | `/api/ai-auditor` | enterprise_post_mvp | JWT + RBAC global | Tenant requerido | Conservar como enterprise; no visible MVP sin aprobacion producto. |
| `backend/src/routes/ai-benchmark.routes.js` | Si | `/api/ai-compliance/benchmark` | riesgo_seguridad | JWT + RBAC global deny currently expected | No tenant publico esperado | Mantener interno/oculto; revisar si debe estar montado en produccion. |
| `backend/src/routes/ai-compliance.routes.js` | Si | `/api/ai-compliance` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar; documentar contrato de outputs trazables. |
| `backend/src/routes/ai-external-lookup.routes.js` | Si | `/api/ai-external-lookup`, `/ai-external-lookup` | riesgo_seguridad | JWT + RBAC global deny currently expected | Tenant/contexto si se habilita | Mantener oculto; revisar exposicion, cuotas y logging. |
| `backend/src/routes/ai-feedback.routes.js` | Si | `/api/ai-feedback`, `/ai-feedback` | admin_interno | JWT + RBAC global | Tenant requerido | Conservar como soporte de trazabilidad; revisar duplicidad de base paths. |
| `backend/src/routes/ai-knowledge.routes.js` | Si | `/api/ai-compliance/knowledge` | admin_interno | JWT + RBAC global deny except internal search | Interno | Conservar interno; revisar token/rol `internal_ai`. |
| `backend/src/routes/ai-tenant-search.routes.js` | Si | `/api/ai-compliance/tenant-search` | enterprise_post_mvp | JWT + RBAC global | Tenant requerido | Conservar; ocultar al cliente MVP si no es flujo basico. |
| `backend/src/routes/ai-traces.routes.js` | Si | `/api/ai-traces` | riesgo_seguridad | JWT + RBAC global deny currently expected | Interno | Revisar seguridad; evitar exposicion de trazas con datos sensibles. |
| `backend/src/routes/ai.routes.js` | Si | `/api/ai` | duplicada_probable | JWT + RBAC global | Tenant requerido | Revisar solape con IA Compliance/AI Auditor; conservar hasta mapear consumidores. |
| `backend/src/routes/assets.routes.js` | Si | `/api/assets` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar; pruebas tenant path. |
| `backend/src/routes/audit-execution.routes.js` | Si | `/api/audit-execution` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar; revisar cobertura RBAC. |
| `backend/src/routes/auditPreparation.routes.js` | Si | `/api/audit-preparation` | enterprise_post_mvp | JWT + RBAC global | Tenant esperado por paquete/fuente | Conservar; revisar uploads ZIP/documentos. |
| `backend/src/routes/audits.routes.js` | Si | `/api/audits` | core_mvp | JWT + RBAC global | Tenant por path y validacion local esperada | Conservar; pruebas cross-tenant. |
| `backend/src/routes/auth.routes.js` | Si | `/api/auth` | core_mvp | Publica para login/register con rate limit | N/A | Conservar; revisar respuestas de error y rate limit. |
| `backend/src/routes/billing.routes.js` | Si | `/api/billing` | admin_interno | JWT + RBAC global dealer | Dealer/tenant asignado | Conservar; revisar exposicion cliente MVP. |
| `backend/src/routes/company-profile.routes.js` | Si | `/api/company-profile` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar. |
| `backend/src/routes/controls.routes.js` | Si | `/api/controls` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar; alto valor para pruebas por tamano. |
| `backend/src/routes/dashboard-controls.routes.js` | Si | `/api/dashboard-controls` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar; revisar solape con dashboard. |
| `backend/src/routes/dashboard.routes.js` | Si | `/api/dashboard` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar como dashboard principal. |
| `backend/src/routes/diagnostic.routes.js` | Si | `/api/diagnostic`, `/api/diagnostics` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar; alias duplicado aceptado por compatibilidad. |
| `backend/src/routes/document-integrations-analysis.routes.js` | Si | `/api/document-integrations` | enterprise_post_mvp | JWT + RBAC global | Tenant/source requerido | Conservar; pruebas provider/tenant. |
| `backend/src/routes/document-integrations-folders.routes.js` | Si | `/api/document-integrations` | enterprise_post_mvp | JWT + RBAC global | Tenant/source requerido | Conservar; proteger navegacion por UUID interno. |
| `backend/src/routes/document-integrations-google.routes.js` | Si | `/api/document-integrations/google` | riesgo_seguridad | Montada antes de auth global; auth local en rutas sensibles esperado | Tenant via state/source | Revisar OAuth antes de global; conservar si callbacks publicos estan justificados. |
| `backend/src/routes/document-integrations-sync.routes.js` | Si | `/api/document-integrations` | enterprise_post_mvp | JWT + RBAC global | Tenant/source requerido | Conservar; revisar lifecycle. |
| `backend/src/routes/document-integrations-zoho.routes.js` | Si | `/api/document-integrations/zoho` | riesgo_seguridad | Montada antes de auth global; auth local en rutas sensibles esperado | Tenant via state/source | Revisar OAuth antes de global; conservar si callbacks publicos estan justificados. |
| `backend/src/routes/document-integrations.routes.js` | Si | `/api/document-integrations` | enterprise_post_mvp | JWT + RBAC global | Tenant/source requerido | Conservar; revisar solape con subrutas. |
| `backend/src/routes/evidence-library.routes.js` | Si | `/api/evidence-library` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar; revisar uploads y lifecycle. |
| `backend/src/routes/evidences.routes.js` | Si | `/api/evidences` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar; revisar superficie upload. |
| `backend/src/routes/findings.routes.js` | Si | `/api/findings` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar. |
| `backend/src/routes/health.js` | Si | `/health`, `/api/health` | core_mvp | JWT + RBAC global | Tenant requerido para endpoints tenant | Conservar; separar health publico vs tenant si aplica. |
| `backend/src/routes/iso-auditor.routes.js` | Si | `/api/iso-auditor` | enterprise_post_mvp | JWT + RBAC global | Tenant requerido | Ocultar cliente MVP; revisar solape con AI Auditor. |
| `backend/src/routes/iso-command-center.routes.js` | Si | `/api/iso-command-center` | enterprise_post_mvp | JWT + RBAC global | Tenant requerido | Ocultar cliente MVP; confirmar producto. |
| `backend/src/routes/iso-control-mapping.routes.js` | Si | `/api/iso-control-mapping` | admin_interno | JWT + RBAC global | Tenant/contexto | Conservar como soporte tecnico. |
| `backend/src/routes/iso-document-generator.routes.js` | Si | `/api/iso-document-generator` | enterprise_post_mvp | JWT + RBAC global | Tenant requerido | Conservar; revisar permisos de generacion. |
| `backend/src/routes/iso-express-diagnostic.routes.js` | Si | `/api/iso-express-diagnostic` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar si alimenta diagnostico visible. |
| `backend/src/routes/iso-knowledge.routes.js` | Si | `/api/iso-knowledge` | admin_interno | JWT + RBAC global read-only | N/A/tenant segun query | Conservar como catalogo; revisar si debe exponerse a cliente. |
| `backend/src/routes/iso-operational-execution.routes.js` | Si | `/api/iso-operational-execution` | enterprise_post_mvp | JWT + RBAC global | Tenant requerido | Ocultar cliente MVP; confirmar producto. |
| `backend/src/routes/iso-recommended-actions.routes.js` | Si | `/api/iso-recommended-actions` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar si soporta acciones recomendadas. |
| `backend/src/routes/iso-risk-matrix.routes.js` | Si | `/api/iso-risk-matrix` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar si soporta riesgos. |
| `backend/src/routes/iso-scope.routes.js` | Si | `/api/iso-scope` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar. |
| `backend/src/routes/kpi.routes.js` | Si | `/api/kpi`, `/api/kpis` | duplicada_probable | JWT + RBAC global | Tenant requerido | Conservar alias; documentar canonical path. |
| `backend/src/routes/lifecycle.routes.js` | Si | `/api/lifecycle` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar. |
| `backend/src/routes/me-modules.routes.js` | Si | `/api/me` | core_mvp | JWT + RBAC global | Tenant de JWT | Conservar; comparte base path con `me.routes.js`. |
| `backend/src/routes/me.routes.js` | Si | `/api/me` | core_mvp | JWT + RBAC global | Tenant de JWT | Conservar. |
| `backend/src/routes/nonconformities.routes.js` | Si | `/api/nonconformities` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar. |
| `backend/src/routes/notifications.routes.js` | Si | `/api/notifications` | enterprise_post_mvp | JWT + RBAC global | Tenant requerido | Confirmar producto; ocultar si no MVP. |
| `backend/src/routes/objectives.routes.js` | Si | `/api/objectives` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar; pruebas tenant path. |
| `backend/src/routes/policy.routes.js` | Si | `/api/policy` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar. |
| `backend/src/routes/quotes.routes.js` | Si | `/api/quotes` | admin_interno | JWT + RBAC global dealer | Dealer | Conservar para dealer; no visible cliente. |
| `backend/src/routes/report.routes.js` | No | N/A | legacy_probable | N/A | N/A | `mover_a_legacy` tras confirmar no hay imports externos; probable ruta singular reemplazada por `reports.routes.js`. |
| `backend/src/routes/reports.routes.js` | Si | `/api/reports` | core_mvp | JWT + report permission local + RBAC global | Tenant/dealer validado por ruta | Conservar; alto valor para pruebas RBAC. |
| `backend/src/routes/search.routes.js` | Si | `/api/search` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar; revisar data exposure. |
| `backend/src/routes/soa.routes.js` | Si | `/api/soa` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar. |
| `backend/src/routes/sync-agent.routes.js` | Si | `/api/agent` | riesgo_seguridad | Montada antes de auth global; pairing/bearer propio | Tenant/source via token de agente | Conservar; revisar rate limit, pairing y uploads. |
| `backend/src/routes/tenant-files.routes.js` | Si | `/api/files/tenant` | riesgo_seguridad | JWT + RBAC global | Tenant path esperado | Conservar; revisar path traversal y autorizacion. |
| `backend/src/routes/tenant-operations.routes.js` | Si | `/api/tenant-operations` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar. |
| `backend/src/routes/tenant-process-links.routes.js` | Si | `/api/tenant-process-links` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar. |
| `backend/src/routes/tenant-processes.routes.js` | Si | `/api/tenant-processes` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar. |
| `backend/src/routes/tenant-standards.routes.js` | Si | `/api/tenant-standards` | core_mvp | JWT + RBAC global | Tenant requerido | Conservar. |
| `backend/src/routes/tenants.routes.js` | Si | `/api/tenants` | admin_interno | JWT + RBAC global plataforma | Tenant administrado | Conservar; revisar uploads logo. |
| `backend/src/routes/user.routes.js` | Si | `/api/user` | core_mvp | JWT + RBAC global | Usuario/tenant JWT | Conservar. |
| `backend/src/routes/users.routes.js` | Si | `/api/users` | visible_admin_tenant | JWT + RBAC global | Tenant requerido | Conservar para admin tenant. |

## Hallazgos

- Rutas no montadas detectadas: `backend/src/routes/2evidences.routes.js`, `backend/src/routes/report.routes.js`.
- Alias/duplicidades funcionales a revisar: `/api/kpi` + `/api/kpis`, `/api/diagnostic` + `/api/diagnostics`, `/api/me` compartido, multiples subrutas bajo `/api/document-integrations`, multiples superficies IA.
- Rutas montadas antes del middleware global requieren revision de auth local: Google OAuth, Zoho OAuth, Sync Agent y `/api/auth`.
- No se recomienda eliminar rutas en esta etapa. Primero confirmar consumidores frontend, scripts QA, docs vigentes y contratos externos.
