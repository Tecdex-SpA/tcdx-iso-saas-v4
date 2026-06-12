# MVP route to backend map

Fecha: 2026-06-12
Rama: `chore/cleanup-stage-3a-official-surface`

| Ruta frontend MVP | Backend esperado | Datos reales requeridos | RBAC requerido | Tenant requerido | Riesgo | Observacion |
| ----------------- | ---------------- | ----------------------- | -------------- | ---------------- | ------ | ----------- |
| `/dashboard` | `/api/dashboard`, `/api/kpi` o `/api/kpis`, `/api/health` segun widgets | Tenant, normas, controles, KPIs, salud ISO | `dashboard.read`, KPI/health read | Si | Medio | `/dashboard` es canonical; no crear otro dashboard. |
| `/cumplimiento-auditoria` | `/api/controls`, `/api/tenant-standards`, `/api/findings`, `/api/nonconformities`, `/api/audits`, `/api/policy`, `/api/iso-scope` | Normas contratadas, controles, brechas/hallazgos, auditorias | `compliance.read`, escrituras limitadas por rol | Si | Medio | Agregador MVP; rutas detalladas quedan ocultas como drilldown/enterprise. |
| `/evidencias` | `/api/evidences`, `/api/evidence-library`, `/api/document-integrations` | Evidencias, documentos, fuentes, asociaciones | `evidences.read/upload`, `evidence_library.*` | Si | Alto | Superficie upload/provider sensible; conservar lifecycle. |
| `/riesgos` | `/api/iso-risk-matrix`, `/api/assets` | Riesgos, activos si aplica, matriz | `risks.read/write` | Si | Medio | `/activos` y `/matriz-riesgo` quedan ocultas como detalle. |
| `/planes-accion` | `/api/action-plans`, `/api/iso-recommended-actions` | Acciones, responsables, fechas, estado, evidencia vinculada | `action_plans.read/write` | Si | Medio | `/plan-accion` y `/acciones-recomendadas` quedan ocultas/duplicadas. |
| `/exportes` | `/api/reports` | Report types, exports, fuentes, jobs, archivos generados | `reports:read/download/generate/admin` | Si | Alto | Reportes son core MVP; `report.routes.js` no montado queda en review. |
| `/ia-compliance` | `/api/ai-compliance`, `/api/ai-feedback` | Contexto tenant, controles, evidencias, hallazgos, acciones | `ai_compliance.read/suggest`; modulo `ai` | Si | Alto | Unica IA cliente visible; outputs accionables requieren revision humana. |
| `/configuracion` | `/api/me`, `/api/users`, `/api/company-profile`, `/api/tenant-processes`, `/api/tenant-operations`, `/api/tenant-process-links`, `/api/tenant-standards` | Usuario, modulos, perfil empresa, procesos, operaciones, normas | `configuration.users.manage` y admin tenant | Si | Medio | Superficie administrativa tenant. |
| `/perfil-empresa` | `/api/company-profile`, `/api/tenant-processes`, `/api/tenant-operations` | Datos empresa, procesos, operaciones, alcance | Admin tenant | Si | Medio | Parte de configuracion contextual; no item principal de Sidebar. |
| `/usuarios` | `/api/users`, `/api/me/modules` | Usuarios, roles, modulos, estado tenant | Admin tenant | Si | Medio | Parte de configuracion; controlar RBAC estricto. |

## Brechas no resueltas en 3A

- No se probo runtime con datos reales porque esta etapa no levanta servicios ni usa DB.
- No se modificaron endpoints backend.
- No se resolvieron warnings frontend existentes.
- OAuth, Sync Agent, traces IA y external lookup quedan para revision de seguridad posterior.
