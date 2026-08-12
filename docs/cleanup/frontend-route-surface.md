# Frontend route surface - cleanup stage 1

Fecha: 2026-06-12  
Rama: `chore/cleanup-stage-1-inventory`  
Alcance: inventario estatico sobre `frontend/src/app`, `Sidebar`, `AppLayout` y `mvpPermissions`.

| Ruta frontend | Archivo | Visible en Sidebar | Guard AppLayout | Clasificacion MVP | Accion recomendada |
| ------------- | ------- | -----------------: | --------------: | ----------------- | ------------------ |
| `/` | `frontend/src/app/page.tsx` | No | No | visible_mvp_cliente | Conservar como landing/redireccion. |
| `/acciones-recomendadas` | `frontend/src/app/acciones-recomendadas/page.tsx` | No directo | Si | visible_mvp_cliente | Conservar si es alias de planes; confirmar visibilidad. |
| `/activos` | `frontend/src/app/activos/page.tsx` | No directo | Si | visible_mvp_cliente | Conservar como ruta de riesgos agrupada. |
| `/admin-saas` | `frontend/src/app/admin-saas/page.tsx` | Si para plataforma | Si | visible_superadmin | Conservar; no cliente MVP. |
| `/administrar-kpis` | `frontend/src/app/administrar-kpis/page.tsx` | No | Si oculto cliente | legacy_probable | Mantener oculto; confirmar si dashboard principal lo reemplaza. |
| `/auditor-iso` | `frontend/src/app/auditor-iso/page.tsx` | No | Si oculto cliente | legacy_probable | Mantener oculto; revisar duplicidad con IA Auditor/ISO Auditor. |
| `/auditorias` | `frontend/src/app/auditorias/page.tsx` | No directo | Si | visible_mvp_cliente | Conservar como ruta compliance secundaria. |
| `/auditorias/ejecucion` | `frontend/src/app/auditorias/ejecucion/page.tsx` | No directo | Si | visible_mvp_cliente | Conservar si flujo auditoria operativa esta en MVP. |
| `/auditorias/ia` | `frontend/src/app/auditorias/ia/page.tsx` | No | Si oculto cliente/AI entitlement | ocultar_cliente_mvp | Mantener oculto; clasificar enterprise. |
| `/centro-control-iso` | `frontend/src/app/centro-control-iso/page.tsx` | No | Si oculto cliente | legacy_probable | Mantener oculto; candidato a legacy. |
| `/ciclo-vida` | `frontend/src/app/ciclo-vida/page.tsx` | No directo | Si | visible_mvp_cliente | Conservar como compliance lifecycle. |
| `/command-center-iso` | `frontend/src/app/command-center-iso/page.tsx` | No | Si oculto cliente | legacy_probable | Mantener oculto; candidato a legacy. |
| `/configuracion` | `frontend/src/app/configuracion/page.tsx` | Si para admin tenant | Si | visible_admin_tenant | Conservar. |
| `/controles` | `frontend/src/app/controles/page.tsx` | No directo | Si | visible_mvp_cliente | Conservar. |
| `/cotizador` | `frontend/src/app/cotizador/page.tsx` | Si para dealer | Si | visible_superadmin | Conservar para dealer; no cliente MVP. |
| `/cumplimiento-auditoria` | `frontend/src/app/cumplimiento-auditoria/page.tsx` | Si cliente MVP | Si | visible_mvp_cliente | Conservar. |
| `/dashboard` | `frontend/src/app/dashboard/page.tsx` | Si cliente MVP | Si | visible_mvp_cliente | Conservar como dashboard canonical. |
| `/dashboard-kpi` | `frontend/src/app/dashboard-kpi/page.tsx` | No | Si oculto cliente | duplicada_probable | Mantener oculto; migrar valor a `/dashboard` si falta. |
| `/dealer` | `frontend/src/app/dealer/page.tsx` | Si dealer | Si | visible_superadmin | Conservar para dealer; no cliente MVP. |
| `/diagnostico` | `frontend/src/app/diagnostico/page.tsx` | No directo | Si | visible_mvp_cliente | Conservar si es parte compliance. |
| `/documentos` | `frontend/src/app/documentos/page.tsx` | No | Si oculto cliente | legacy_probable | Mantener oculto; revisar solape con evidencias/evidence library. |
| `/ejecucion-iso` | `frontend/src/app/ejecucion-iso/page.tsx` | No | Si oculto cliente | legacy_probable | Mantener oculto; revisar solape con ejecucion/auditorias. |
| `/empresas` | `frontend/src/app/empresas/page.tsx` | No directo | Si plataforma | visible_superadmin | Conservar plataforma; no cliente MVP. |
| `/evidencias` | `frontend/src/app/evidencias/page.tsx` | Si cliente MVP | Si | visible_mvp_cliente | Conservar. |
| `/exportes` | `frontend/src/app/exportes/page.tsx` | Si cliente MVP | Si | visible_mvp_cliente | Conservar. |
| `/hallazgos` | `frontend/src/app/hallazgos/page.tsx` | No directo | Si | visible_mvp_cliente | Conservar si usado por compliance. |
| `/health` | `frontend/src/app/health/page.tsx` | No directo | Si | visible_mvp_cliente | Conservar si es salud ISO cliente; evitar confundir con health tecnico. |
| `/ia` | `frontend/src/app/ia/page.tsx` | No | Si oculto cliente/AI entitlement | legacy_probable | Mantener oculto; revisar reemplazo por `/ia-compliance`. |
| `/ia-auditor` | `frontend/src/app/ia-auditor/page.tsx` | No | Si oculto cliente/AI entitlement | ocultar_cliente_mvp | Mantener oculto; clasificar enterprise. |
| `/ia-compliance` | `frontend/src/app/ia-compliance/page.tsx` | Si cliente MVP si modulo IA | Si | visible_mvp_cliente | Conservar como IA cliente trazable basica. |
| `/ia-compliance/sugerencias` | `frontend/src/app/ia-compliance/sugerencias/page.tsx` | No directo | Si | enterprise_post_mvp | Confirmar producto; revisar revision humana. |
| `/login` | `frontend/src/app/login/page.tsx` | No | No | visible_mvp_cliente | Conservar. |
| `/matriz-riesgo` | `frontend/src/app/matriz-riesgo/page.tsx` | No directo | Si | visible_mvp_cliente | Conservar como ruta de riesgos agrupada. |
| `/no-conformidades` | `frontend/src/app/no-conformidades/page.tsx` | No directo | Si | visible_mvp_cliente | Conservar. |
| `/perfil` | `frontend/src/app/perfil/page.tsx` | No directo | Si | visible_mvp_cliente | Conservar. |
| `/perfil-empresa` | `frontend/src/app/perfil-empresa/page.tsx` | No directo | Si | visible_admin_tenant | Conservar admin tenant. |
| `/plan-accion` | `frontend/src/app/plan-accion/page.tsx` | No directo | Si | duplicada_probable | Conservar alias; confirmar canonical `/planes-accion`. |
| `/planes-accion` | `frontend/src/app/planes-accion/page.tsx` | Si cliente MVP | Si | visible_mvp_cliente | Conservar canonical. |
| `/prefacturacion` | `frontend/src/app/prefacturacion/page.tsx` | Si dealer | Si | visible_superadmin | Conservar dealer; no cliente MVP. |
| `/riesgos` | `frontend/src/app/riesgos/page.tsx` | Si cliente MVP | Si | visible_mvp_cliente | Conservar canonical. |
| `/soa` | `frontend/src/app/soa/page.tsx` | No directo | Si | visible_mvp_cliente | Conservar dentro de compliance. |
| `/usuarios` | `frontend/src/app/usuarios/page.tsx` | No directo | Si | visible_admin_tenant | Conservar admin tenant. |

## Hallazgos

- `CLIENT_MVP_NAV_ITEMS` expone al cliente: `/dashboard`, `/cumplimiento-auditoria`, `/evidencias`, `/riesgos`, `/planes-accion`, `/exportes`, `/ia-compliance`, `/configuracion`.
- `INTERNAL_CLIENT_HIDDEN_ROUTES` oculta rutas legacy/internas a usuarios tenant no plataforma/dealer: `/administrar-kpis`, `/centro-control-iso`, `/command-center-iso`, `/dashboard-kpi`, `/documentos`, `/ejecucion-iso`, `/ia`, `/ia-auditor`, `/auditorias/ia`, `/auditor-iso`.
- Rutas dealer visibles solo para dealer: `/dealer`, `/cotizador`, `/prefacturacion`.
- Rutas plataforma: `/admin-saas`, `/empresas`.
- No se eliminaron paginas; cualquier baja requiere confirmacion de producto y busqueda de referencias.
