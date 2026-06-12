# Official frontend surface

Fecha: 2026-06-12
Rama: `chore/cleanup-stage-3a-official-surface`
Base: `be10f25`

Fuente inspeccionada: `frontend/src/app/**/page.tsx`, `frontend/src/utils/mvpPermissions.ts`, `frontend/src/components/Sidebar.tsx`, `frontend/src/components/AppLayout.tsx`.

| Ruta | Archivo | Clasificacion | Visible cliente MVP | Rol permitido | Modulo/feature | Motivo | Accion futura |
| ---- | ------- | ------------- | ------------------: | ------------- | -------------- | ------ | ------------- |
| `/` | `frontend/src/app/page.tsx` | requires_product_decision | No | Publico/redireccion | N/A | Entrada raiz; no es modulo SaaS autenticado. | Confirmar si debe redirigir siempre a login/dashboard. |
| `/acciones-recomendadas` | `frontend/src/app/acciones-recomendadas/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | action_plans | Ruta secundaria; MVP usa `/planes-accion`. | Consolidar en `/planes-accion` o eliminar en etapa agresiva. |
| `/activos` | `frontend/src/app/activos/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | risks | Ruta secundaria de riesgos; MVP usa `/riesgos`. | Consolidar en `/riesgos`. |
| `/admin-saas` | `frontend/src/app/admin-saas/page.tsx` | platform_only | No | Platform | admin_saas.internal | Consola plataforma. | Conservar como plataforma. |
| `/administrar-kpis` | `frontend/src/app/administrar-kpis/page.tsx` | internal_admin | No | Interno/platform por guard oculto | kpis | Administracion KPI fuera de MVP cliente. | Revisar si se elimina o migra a admin. |
| `/auditor-iso` | `frontend/src/app/auditor-iso/page.tsx` | legacy_candidate | No | Interno/platform por guard oculto | ai/audit | Redirect legacy desacoplado; deep links usan `/cumplimiento-auditoria`. | Cuarentenar fuera del App Router en B.4. |
| `/auditorias` | `frontend/src/app/auditorias/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | audits | Flujo operativo detallado fuera de superficie MVP agregada. | Mantener oculto o consolidar en `/cumplimiento-auditoria`. |
| `/auditorias/ejecucion` | `frontend/src/app/auditorias/ejecucion/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | audits | Ejecucion detallada fuera de MVP cliente. | Consolidar o mantener enterprise. |
| `/auditorias/ia` | `frontend/src/app/auditorias/ia/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | ai/audits | IA auditoria fuera de IA cliente basica. | Mantener oculto hasta decision enterprise. |
| `/centro-control-iso` | `frontend/src/app/centro-control-iso/page.tsx` | legacy_candidate | No | Interno/platform por guard oculto | command-center | Redirect legacy desacoplado; QA y demo usan `/dashboard`. | Cuarentenar fuera del App Router en B.4. |
| `/ciclo-vida` | `frontend/src/app/ciclo-vida/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | lifecycle | Flujo detallado fuera de MVP agregador. | Consolidar en cumplimiento si aplica. |
| `/command-center-iso` | `frontend/src/app/command-center-iso/page.tsx` | legacy_candidate | No | Interno/platform por guard oculto | command-center | Redirect legacy desacoplado; QA y demo usan `/dashboard`. | Cuarentenar fuera del App Router en B.4. |
| `/configuracion` | `frontend/src/app/configuracion/page.tsx` | visible_mvp_cliente | Si | Admin tenant | configuration.users.manage | Configuracion tenant y usuarios. | Conservar. |
| `/controles` | `frontend/src/app/controles/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | compliance | Detalle operacional; MVP entra por `/cumplimiento-auditoria`. | Consolidar o mantener como drilldown controlado. |
| `/cotizador` | `frontend/src/app/cotizador/page.tsx` | dealer_only | No | Dealer | dealer.console | Cotizador comercial interno. | Conservar dealer. |
| `/cumplimiento-auditoria` | `frontend/src/app/cumplimiento-auditoria/page.tsx` | visible_mvp_cliente | Si | Admin, auditor, area owner, executive | compliance.read | Agregador del flujo norma-control-brecha-auditoria. | Conservar como superficie oficial. |
| `/dashboard` | `frontend/src/app/dashboard/page.tsx` | visible_mvp_cliente | Si | Admin, area owner, executive | dashboard.read | Dashboard oficial cliente. | Conservar como dashboard canonical. |
| `/dashboard-kpi` | `frontend/src/app/dashboard-kpi/page.tsx` | duplicate_candidate | No | Interno/platform por guard oculto | dashboard/kpi | Redirect legacy desacoplado; QA y demo usan `/dashboard`. | Cuarentenar fuera del App Router en B.4. |
| `/dashboard-v2` | `frontend/src/app/dashboard-v2/page.tsx` | duplicate_candidate | No | Interno/platform por guard oculto | dashboard | Dashboard duplicado. | Consolidar en `/dashboard`. |
| `/dealer` | `frontend/src/app/dealer/page.tsx` | dealer_only | No | Dealer | dealer.console | Portal dealer. | Conservar dealer. |
| `/diagnostico` | `frontend/src/app/diagnostico/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | compliance | Diagnostico detallado fuera de MVP agregado. | Consolidar en cumplimiento. |
| `/documentos` | `frontend/src/app/documentos/page.tsx` | legacy_candidate | No | Interno/platform por guard oculto | documents | Solapa con Evidencias/Evidence Library. | Confirmar eliminacion futura. |
| `/ejecucion-iso` | `frontend/src/app/ejecucion-iso/page.tsx` | legacy_candidate | No | Interno/platform por guard oculto | execution | Flujo legacy. | Candidato a eliminacion futura. |
| `/empresas` | `frontend/src/app/empresas/page.tsx` | platform_only | No | Platform | admin_saas.internal | Gestion plataforma/empresas. | Conservar plataforma. |
| `/evidencias` | `frontend/src/app/evidencias/page.tsx` | visible_mvp_cliente | Si | Admin, auditor, area owner | evidences/evidence_library | Evidencias y biblioteca documental. | Conservar. |
| `/exportes` | `frontend/src/app/exportes/page.tsx` | visible_mvp_cliente | Si | Admin, auditor, area owner, executive read; export limitado | reports.read/export | Reportes y exportes. | Conservar. |
| `/hallazgos` | `frontend/src/app/hallazgos/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | compliance | Detalle de hallazgos; MVP agregado en cumplimiento. | Consolidar en cumplimiento. |
| `/health` | `frontend/src/app/health/page.tsx` | internal_admin | No | Interno/platform por guard oculto | operational/health | Salud tecnica/operacional no cliente MVP. | Mantener oculto. |
| `/ia` | `frontend/src/app/ia/page.tsx` | legacy_candidate | No | Interno/platform por guard oculto | ai | IA legacy; IA cliente oficial es `/ia-compliance`. | Eliminar tras confirmar consumidores. |
| `/ia-auditor` | `frontend/src/app/ia-auditor/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | ai/auditor | IA Auditor senior/enterprise. | Mantener oculto. |
| `/ia-compliance` | `frontend/src/app/ia-compliance/page.tsx` | visible_mvp_cliente | Si | Admin, auditor con modulo `ai` | ai_compliance.read | IA cliente trazable basica. | Conservar. |
| `/ia-compliance/sugerencias` | `frontend/src/app/ia-compliance/sugerencias/page.tsx` | enterprise_post_mvp | No | Admin/auditor con modulo `ai` | ai_compliance.suggest | Subflujo dependiente de IA Compliance; no nav principal MVP. | Mantener controlado por modulo IA. |
| `/login` | `frontend/src/app/login/page.tsx` | requires_product_decision | No | Publico | auth | Entrada autenticacion. | Conservar. |
| `/matriz-riesgo` | `frontend/src/app/matriz-riesgo/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | risks | Detalle de matriz; MVP usa `/riesgos`. | Consolidar en `/riesgos`. |
| `/no-conformidades` | `frontend/src/app/no-conformidades/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | compliance | Detalle NC; MVP agregado en cumplimiento. | Consolidar. |
| `/perfil` | `frontend/src/app/perfil/page.tsx` | admin_tenant | No | Usuario autenticado | configuration.profile.self | Perfil propio; no aparece en nav MVP principal. | Conservar como configuracion contextual. |
| `/perfil-empresa` | `frontend/src/app/perfil-empresa/page.tsx` | visible_mvp_cliente | Si | Admin tenant | configuration.users.manage | Configuracion contextual de tenant. | Conservar bajo Configuracion. |
| `/plan-accion` | `frontend/src/app/plan-accion/page.tsx` | duplicate_candidate | No | Interno/platform por guard oculto | action_plans | Alias/duplicado; MVP usa `/planes-accion`. | Consolidar. |
| `/planes-accion` | `frontend/src/app/planes-accion/page.tsx` | visible_mvp_cliente | Si | Admin, auditor, area owner, executive read | action_plans.read | Acciones correctivas y planes. | Conservar. |
| `/prefacturacion` | `frontend/src/app/prefacturacion/page.tsx` | dealer_only | No | Dealer | dealer.console | Prefacturacion comercial. | Conservar dealer. |
| `/riesgos` | `frontend/src/app/riesgos/page.tsx` | visible_mvp_cliente | Si | Admin, auditor, area owner, executive | risks.read | Riesgos visibles si modulo `risks` esta habilitado. | Conservar. |
| `/soa` | `frontend/src/app/soa/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | compliance | Detalle SoA fuera del MVP agregado. | Consolidar en cumplimiento. |
| `/usuarios` | `frontend/src/app/usuarios/page.tsx` | visible_mvp_cliente | Si | Admin tenant | configuration.users.manage | Gestion de usuarios bajo Configuracion. | Conservar bajo Configuracion. |

## Navegacion oficial cliente MVP

`CLIENT_MVP_NAV_ITEMS` queda limitado a: `/dashboard`, `/cumplimiento-auditoria`, `/evidencias`, `/riesgos`, `/planes-accion`, `/exportes`, `/ia-compliance`, `/configuracion`.

Las rutas `/perfil-empresa` y `/usuarios` son parte de la superficie MVP bajo Configuracion, aunque no aparezcan como items principales del Sidebar.
