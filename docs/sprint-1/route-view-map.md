# Sprint 1 Route to MVP View Map

Date: 2026-06-03

## Client MVP Navigation

The client demo flow is consolidated into 8 visible views:

| MVP view | Primary route | Existing routes grouped under the view |
|---|---|---|
| Dashboard | `/dashboard` | `/dashboard` |
| Compliance and Audit | `/cumplimiento-auditoria` | `/diagnostico`, `/controles`, `/soa`, `/ciclo-vida`, `/auditorias`, `/auditorias/ejecucion`, `/hallazgos`, `/no-conformidades` |
| Evidences | `/evidencias` | `/evidencias` |
| Risks | `/riesgos` | `/matriz-riesgo`, `/activos` |
| Action Plans | `/planes-accion` | `/plan-accion`, `/acciones-recomendadas` |
| Reports | `/exportes` | `/exportes` |
| AI Compliance | `/ia-compliance` | `/ia-compliance`, `/ia-compliance/sugerencias` |
| Configuration | `/configuracion` | `/usuarios`, `/perfil-empresa` |

## Hidden From Client MVP Navigation

The routes below are not deleted. They are hidden or blocked from the client MVP flow unless the user is platform/internal or another explicit rule applies:

- `/admin-saas`
- `/empresas`
- `/dealer`
- `/cotizador`
- `/prefacturacion`
- `/administrar-kpis`
- `/centro-control-iso`
- `/command-center-iso`
- `/dashboard-kpi`
- `/dashboard-v2`
- `/documentos`
- `/ejecucion-iso`
- `/health`
- `/ia`
- `/ia-auditor`
- `/auditorias/ia`
- `/auditor-iso`

## Notes

- TCDX Superadmin keeps a separated internal navigation.
- Partner/Dealer keeps a separated channel navigation.
- No route or module was deleted in Sprint 1.
- Compliance and Audit is a shell that links to existing stable modules instead of rewriting them.
