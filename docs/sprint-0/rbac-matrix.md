# Sprint 0 - RBAC y permisos

## Fuentes reales
- Backend: `backend/src/middleware/auth.js`, `backend/src/middleware/rbac.middleware.js`, `backend/src/middleware/roleAuth.js`.
- Frontend: `frontend/src/components/AppLayout.tsx`, `frontend/src/components/Sidebar.tsx`, `frontend/src/utils/auth.ts`.

## Roles detectados
- Plataforma: `superadmin`, `super_admin`, `platform_admin`, `admin_global`, `global_admin`, `owner`.
- Tenant operación: `admin`, `tenant_admin`, `auditor`, `operativo`, `viewer`.
- Cliente/ejecutivo frontend: `cliente`, `client`, `viewer`, `read_only`, `readonly`, `solo_lectura`, `ejecutivo`.
- Partner: `dealer`.
- Técnico: `internal_ai` solo para `/api/ai-compliance/knowledge/internal-search` con token interno.

## Endpoints protegidos
- `/api/**` después de `app.use('/api', auth, enforceApiAccess)`.
- `/health/**` con `auth, enforceApiAccess`.
- `/api/auth/login/register/validate` maneja auth propia antes del middleware global.

## Endpoints a revisar por exposición o regla especial
- `/api/document-integrations/google` y `/api/document-integrations/zoho` se montan antes del middleware global para OAuth; revisar ruta por ruta.
- `/api/agent` se monta antes del middleware global y usa token de agente propio.
- Static uploads `/uploads/logos`, `/uploads/profiles`, `/uploads/tenant-logos` y endpoint público `/uploads/tenants/:fileName`.
- `/` backend responde público `API funcionando`.

## Matriz recomendada MVP
| Módulo | Ejecutivo cliente | Admin cumplimiento | Auditor | Superadmin | Partner |
|---|---|---|---|---|---|
| Dashboard | Visible | Visible | Visible | Visible | Oculto |
| Cumplimiento / Controles | Limitado | Visible | Limitado | Visible | Oculto |
| Diagnóstico | Oculto | Visible | Limitado | Visible | Oculto |
| Evidencias | Limitado | Visible | Visible | Visible | Oculto |
| Brechas / Hallazgos / NC | Limitado | Visible | Visible | Visible | Oculto |
| Riesgos | Limitado | Visible | Limitado | Visible | Oculto |
| Auditoría | Limitado | Visible | Visible | Visible | Oculto |
| Planes de Acción | Limitado | Visible | Limitado | Visible | Oculto |
| Reportes | Visible | Visible | Visible | Visible | Limitado |
| IA Compliance | Limitado | Visible | Oculto o limitado | Visible | Oculto |
| KPIs / Health avanzado | Visible resumido | Visible | Visible lectura | Visible | Oculto |
| Configuración tenant | Oculto | Visible | Oculto | Visible | Oculto |
| Admin SaaS | Oculto | Oculto | Oculto | Visible | Oculto |
| Billing / prefacturación | Oculto | Oculto | Oculto | Visible | Limitado |
| Dealer / cotizador | Oculto | Oculto | Oculto | Visible | Visible |
| AI traces / Knowledge base / Lookup externo | Oculto | Oculto | Oculto | Visible | Oculto |

## Recomendaciones
- Mantener `enforceApiAccess` como lista positiva; cualquier ruta nueva debe entrar con regla explícita.
- Unificar nombres frontend/backend para roles ejecutivo/viewer y documentar equivalencias.
- Para demo MVP, ocultar por menú y reforzar por backend los módulos internos, no solo por Sidebar.
