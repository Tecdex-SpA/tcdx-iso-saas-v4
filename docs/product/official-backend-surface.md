# Official backend surface

Fecha: 2026-06-12
Rama: `chore/cleanup-stage-3a-official-surface`
Base: `be10f25`

Fuente inspeccionada: `backend/src/app.js`, `backend/src/routes/**`, `backend/src/routes/_legacy/**`, `backend/src/middleware/rbac.middleware.js`, manifiestos de cleanup.

| Endpoint base | Archivo ruta | Clasificacion | Modulo frontend asociado | Auth/RBAC esperado | Tenant esperado | Estado | Accion futura |
| ------------- | ------------ | ------------- | ------------------------ | ------------------ | --------------- | ------ | ------------- |
| `/api/auth` | `backend/src/routes/auth.routes.js` | core_mvp | `/login` | Publico con rate limit/auth local | N/A | Oficial | Conservar. |
| `/api/me` | `backend/src/routes/me.routes.js`, `me-modules.routes.js` | core_mvp | AppLayout, Sidebar, Configuracion | JWT + RBAC global | Tenant JWT | Oficial | Conservar. |
| `/api/user` | `backend/src/routes/user.routes.js` | core_mvp | `/perfil` | JWT + RBAC global | Usuario/tenant JWT | Oficial | Conservar. |
| `/api/users` | `backend/src/routes/users.routes.js` | core_mvp | `/usuarios`, `/configuracion` | JWT + admin tenant RBAC | Tenant requerido | Oficial | Conservar. |
| `/api/company-profile` | `backend/src/routes/company-profile.routes.js` | core_mvp | `/perfil-empresa`, `/configuracion` | JWT + admin tenant RBAC | Tenant requerido | Oficial | Conservar. |
| `/api/dashboard` | `backend/src/routes/dashboard.routes.js` | core_mvp | `/dashboard` | JWT + RBAC global | Tenant requerido | Oficial | Conservar canonical. |
| `/api/dashboard-v2` | `backend/src/routes/dashboard-v2.routes.js` | duplicate_candidate | `/dashboard-v2` oculto | JWT + RBAC global | Tenant requerido | Montado oculto | Consolidar en `/api/dashboard`. |
| `/api/dashboard-controls` | `backend/src/routes/dashboard-controls.routes.js` | enterprise_post_mvp | Dashboard/control drilldown | JWT + RBAC global | Tenant requerido | Montado | Mantener hasta consolidacion. |
| `/api/controls` | `backend/src/routes/controls.routes.js` | core_mvp | `/cumplimiento-auditoria` | JWT + RBAC global | Tenant requerido | Oficial core | Conservar backend aunque frontend detalle este oculto. |
| `/api/tenant-standards` | `backend/src/routes/tenant-standards.routes.js` | core_mvp | `/cumplimiento-auditoria`, `/configuracion` | JWT + RBAC global | Tenant requerido | Oficial | Conservar. |
| `/api/iso-scope` | `backend/src/routes/iso-scope.routes.js` | core_mvp | `/cumplimiento-auditoria` | JWT + RBAC global | Tenant requerido | Oficial | Conservar. |
| `/api/diagnostic`, `/api/diagnostics` | `backend/src/routes/diagnostic.routes.js` | enterprise_post_mvp | `/diagnostico` oculto, cumplimiento | JWT + RBAC global | Tenant requerido | Montado | Consolidar consumo en cumplimiento. |
| `/api/evidences` | `backend/src/routes/evidences.routes.js` | core_mvp | `/evidencias` | JWT + RBAC global | Tenant requerido | Oficial | Conservar; upload-sensitive. |
| `/api/evidence-library` | `backend/src/routes/evidence-library.routes.js` | core_mvp | `/evidencias` | JWT + RBAC global | Tenant requerido | Oficial | Conservar; upload/provider-sensitive. |
| `/api/document-integrations` | `document-integrations*.routes.js` | enterprise_post_mvp | `/evidencias` integrations | JWT + RBAC global for protected mounts | Tenant/source requerido | Montado | Conservar; revisar lifecycle. |
| `/api/document-integrations/google` | `document-integrations-google.routes.js` | internal_security_review | OAuth/connectors | Auth local/callback + JWT where applicable | Tenant via state/source | Montado pre-auth global | Security review; no tocar en 3A. |
| `/api/document-integrations/zoho` | `document-integrations-zoho.routes.js` | internal_security_review | OAuth/connectors | Auth local/callback + JWT where applicable | Tenant via state/source | Montado pre-auth global | Security review; no tocar en 3A. |
| `/api/agent` | `backend/src/routes/sync-agent.routes.js` | internal_security_review | Sync Agent | Pairing/bearer propio | Tenant/source via token | Montado pre-auth global | Security review; no tocar en 3A. |
| `/api/assets` | `backend/src/routes/assets.routes.js` | enterprise_post_mvp | `/riesgos` oculto detail | JWT + RBAC global | Tenant requerido | Montado | Consolidar bajo `/riesgos`. |
| `/api/iso-risk-matrix` | `backend/src/routes/iso-risk-matrix.routes.js` | core_mvp | `/riesgos` | JWT + RBAC global | Tenant requerido | Oficial | Conservar. |
| `/api/action-plans` | `backend/src/routes/action-plans.routes.js` | core_mvp | `/planes-accion` | JWT + RBAC global | Tenant requerido | Oficial | Conservar. |
| `/api/iso-recommended-actions` | `backend/src/routes/iso-recommended-actions.routes.js` | enterprise_post_mvp | `/planes-accion`, recomendaciones ocultas | JWT + RBAC global | Tenant requerido | Montado | Consolidar o mantener enterprise. |
| `/api/findings` | `backend/src/routes/findings.routes.js` | core_mvp | `/cumplimiento-auditoria` | JWT + RBAC global | Tenant requerido | Oficial backend | Conservar. |
| `/api/nonconformities` | `backend/src/routes/nonconformities.routes.js` | core_mvp | `/cumplimiento-auditoria` | JWT + RBAC global | Tenant requerido | Oficial backend | Conservar. |
| `/api/audits` | `backend/src/routes/audits.routes.js` | core_mvp | `/cumplimiento-auditoria` | JWT + RBAC global | Tenant requerido | Oficial backend | Conservar. |
| `/api/audit-execution` | `backend/src/routes/audit-execution.routes.js` | enterprise_post_mvp | auditorias ocultas | JWT + RBAC global | Tenant requerido | Montado | Mantener enterprise. |
| `/api/audit-preparation` | `backend/src/routes/auditPreparation.routes.js` | enterprise_post_mvp | preparacion auditoria | JWT + RBAC global | Tenant/package/source | Montado | Mantener enterprise; upload-sensitive. |
| `/api/policy` | `backend/src/routes/policy.routes.js` | core_mvp | `/cumplimiento-auditoria` | JWT + RBAC global | Tenant requerido | Oficial backend | Conservar. |
| `/api/soa` | `backend/src/routes/soa.routes.js` | enterprise_post_mvp | `/soa` oculto | JWT + RBAC global | Tenant requerido | Montado | Consolidar bajo cumplimiento. |
| `/api/lifecycle` | `backend/src/routes/lifecycle.routes.js` | enterprise_post_mvp | `/ciclo-vida` oculto | JWT + RBAC global | Tenant requerido | Montado | Mantener enterprise o consolidar. |
| `/api/objectives` | `backend/src/routes/objectives.routes.js` | enterprise_post_mvp | objetivos/operacion | JWT + RBAC global | Tenant requerido | Montado | Confirmar producto. |
| `/api/reports` | `backend/src/routes/reports.routes.js` | core_mvp | `/exportes` | JWT + reports RBAC local/global | Tenant/dealer/platform autorizado | Oficial | Conservar canonical. |
| N/A | `backend/src/routes/report.routes.js` | requires_review | Reportes legacy | N/A no montada | N/A | No montado | Mantener por duda operativa; decidir en 3B/4. |
| `/api/ai-compliance` | `backend/src/routes/ai-compliance.routes.js` | core_mvp | `/ia-compliance` | JWT + RBAC global | Tenant requerido | Oficial IA cliente | Conservar. |
| `/api/ai-compliance/answer` | `backend/src/routes/ai-answer.routes.js` | enterprise_post_mvp | IA answer | JWT + RBAC global | Tenant requerido | Montado | Mantener controlado. |
| `/api/ai-compliance/tenant-search` | `backend/src/routes/ai-tenant-search.routes.js` | enterprise_post_mvp | IA search | JWT + RBAC global | Tenant requerido | Montado | Revisar exposure. |
| `/api/ai-compliance/benchmark` | `backend/src/routes/ai-benchmark.routes.js` | internal_security_review | benchmark IA | RBAC deny expected | Interno | Montado | Mantener interno/deny. |
| `/api/ai-compliance/knowledge` | `backend/src/routes/ai-knowledge.routes.js` | internal_security_review | knowledge IA | RBAC deny except internal flow | Interno | Montado | Mantener interno. |
| `/api/ai` | `backend/src/routes/ai.routes.js` | duplicate_candidate | IA legacy | JWT + RBAC global | Tenant requerido | Montado | Consolidar con IA Compliance. |
| `/api/ai-auditor` | `backend/src/routes/ai-auditor.routes.js` | enterprise_post_mvp | IA Auditor oculto | JWT + RBAC global | Tenant requerido | Montado | Mantener enterprise. |
| `/api/ai-feedback`, `/ai-feedback` | `backend/src/routes/ai-feedback.routes.js` | enterprise_post_mvp | feedback IA | JWT + RBAC global | Tenant requerido | Montado | Conservar trazabilidad controlada. |
| `/api/ai-external-lookup`, `/ai-external-lookup` | `backend/src/routes/ai-external-lookup.routes.js` | internal_security_review | external lookup | RBAC deny expected | Tenant/contexto si habilita | Montado | Security review; no tocar. |
| `/api/ai-traces` | `backend/src/routes/ai-traces.routes.js` | internal_security_review | traces IA | RBAC deny expected | Interno | Montado | Security review; no tocar. |
| `/api/iso-knowledge` | `backend/src/routes/iso-knowledge.routes.js` | enterprise_post_mvp | catalogo ISO | JWT + read-only RBAC | N/A/tenant segun query | Montado | Mantener controlado. |
| `/api/iso-control-mapping` | `backend/src/routes/iso-control-mapping.routes.js` | enterprise_post_mvp | mapping ISO | JWT + RBAC global | Tenant/contexto | Montado | Mantener tecnico. |
| `/api/iso-express-diagnostic` | `backend/src/routes/iso-express-diagnostic.routes.js` | enterprise_post_mvp | diagnostico oculto | JWT + RBAC global | Tenant requerido | Montado | Consolidar si aplica. |
| `/api/iso-document-generator` | `backend/src/routes/iso-document-generator.routes.js` | enterprise_post_mvp | generador documental | JWT + RBAC global | Tenant requerido | Montado | Mantener enterprise. |
| `/api/iso-operational-execution` | `backend/src/routes/iso-operational-execution.routes.js` | enterprise_post_mvp | ejecucion ISO | JWT + RBAC global | Tenant requerido | Montado | Mantener oculto. |
| `/api/iso-command-center` | `backend/src/routes/iso-command-center.routes.js` | legacy_candidate | command center legacy | JWT + RBAC global | Tenant requerido | Montado | Candidato 3B/4. |
| `/api/iso-auditor` | `backend/src/routes/iso-auditor.routes.js` | enterprise_post_mvp | auditor ISO oculto | JWT + RBAC global | Tenant requerido | Montado | Mantener enterprise. |
| `/api/search` | `backend/src/routes/search.routes.js` | enterprise_post_mvp | busqueda | JWT + RBAC global | Tenant requerido | Montado | Revisar data exposure. |
| `/api/notifications` | `backend/src/routes/notifications.routes.js` | enterprise_post_mvp | notificaciones | JWT + RBAC global | Tenant requerido | Montado | Confirmar producto. |
| `/api/kpi`, `/api/kpis` | `backend/src/routes/kpi.routes.js` | duplicate_candidate | dashboard/KPI | JWT + RBAC global | Tenant requerido | Montado | Definir canonical; conservar compat. |
| `/health`, `/api/health` | `backend/src/routes/health.js` | internal_security_review | health oculto | JWT + RBAC global | Tenant para endpoints tenant | Montado | Revisar exposicion tecnica. |
| `/api/admin-saas` | `backend/src/routes/admin-saas.routes.js` | admin_platform | `/admin-saas`, `/empresas` | JWT + plataforma/dealer RBAC | Segun endpoint | Oficial interno | Conservar plataforma. |
| `/api/tenants` | `backend/src/routes/tenants.routes.js` | admin_platform | platform/admin | JWT + plataforma RBAC | Tenant administrado | Montado | Conservar interno. |
| `/api/billing` | `backend/src/routes/billing.routes.js` | dealer_commercial | `/prefacturacion` | JWT + dealer RBAC | Dealer/tenant asignado | Montado | Conservar dealer. |
| `/api/quotes` | `backend/src/routes/quotes.routes.js` | dealer_commercial | `/cotizador` | JWT + dealer RBAC | Dealer | Montado | Conservar dealer. |
| `/api/tenant-processes` | `backend/src/routes/tenant-processes.routes.js` | core_mvp | `/configuracion`, `/perfil-empresa` | JWT + admin tenant RBAC | Tenant requerido | Montado | Conservar configuracion. |
| `/api/tenant-operations` | `backend/src/routes/tenant-operations.routes.js` | core_mvp | `/configuracion`, `/perfil-empresa` | JWT + admin tenant RBAC | Tenant requerido | Montado | Conservar configuracion. |
| `/api/tenant-process-links` | `backend/src/routes/tenant-process-links.routes.js` | core_mvp | `/configuracion`, compliance | JWT + RBAC global | Tenant requerido | Montado | Conservar. |
| `/api/files/tenant` | `backend/src/routes/tenant-files.routes.js` | internal_security_review | archivos tenant | JWT + RBAC global | Tenant path | Montado | Revisar path/security. |
| N/A | `backend/src/routes/_legacy/2evidences.routes.js` | legacy_candidate | N/A | N/A | N/A | Cuarentenado | Eliminar solo en etapa agresiva con rollback. |

## Riesgos diferidos no endpoint

`database/qa-fixes/*.sql` y seeds con `DELETE FROM` quedan diferidos a revision DBA; no aplican como endpoint pero son riesgo operacional documentado.
