# Official frontend surface

Fecha: 2026-06-12
Rama de baseline: `chore/cleanup-b8-final-baseline`
Base de baseline: `f58b9e7`

Fuente inspeccionada: `frontend/src/app/**/page.tsx`, `frontend/src/utils/mvpPermissions.ts`, `frontend/src/components/Sidebar.tsx`, `frontend/src/components/AppLayout.tsx`.

| Ruta | Archivo | Clasificacion | Visible cliente MVP | Rol permitido | Modulo/feature | Motivo | Accion futura |
| ---- | ------- | ------------- | ------------------: | ------------- | -------------- | ------ | ------------- |
| `/` | `frontend/src/app/page.tsx` | requires_product_decision | No | Publico/redireccion | N/A | Entrada raiz; no es modulo SaaS autenticado. | Confirmar si debe redirigir siempre a login/dashboard. |
| `/acciones-recomendadas` | `frontend/src/app/acciones-recomendadas/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | action_plans | Ruta secundaria; MVP usa `/planes-accion`. | Consolidar en `/planes-accion` o eliminar en etapa agresiva. |
| `/activos` | `frontend/src/app/activos/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | risks | Ruta secundaria de riesgos; MVP usa `/riesgos`. | Consolidar en `/riesgos`. |
| `/admin-saas` | `frontend/src/app/admin-saas/page.tsx` | platform_only | No | Platform | admin_saas.internal | Consola plataforma. | Conservar como plataforma. |
| `/administrar-kpis` | `frontend/src/app/administrar-kpis/page.tsx` | internal_admin | No | Interno/platform por guard oculto | kpis | Administracion KPI fuera de MVP cliente. | Revisar si se elimina o migra a admin. |
| `/auditor-iso` | `frontend/legacy-pages-archive/auditor-iso/page.tsx` | legacy_candidate | No | Fuera del App Router y de `frontend/src` | ai/audit | Redirect legacy desacoplado y archivado; deep links usan `/cumplimiento-auditoria`. | Conservar temporalmente para rollback; evaluar borrado definitivo en etapa posterior. |
| `/auditorias` | `frontend/src/app/auditorias/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | audits | Flujo operativo detallado fuera de superficie MVP agregada. | Mantener oculto o consolidar en `/cumplimiento-auditoria`. |
| `/auditorias/ejecucion` | `frontend/src/app/auditorias/ejecucion/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | audits | Ejecucion detallada fuera de MVP cliente. | Consolidar o mantener enterprise. |
| `/auditorias/ia` | `frontend/src/app/auditorias/ia/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | ai/audits | IA auditoria fuera de IA cliente basica. | Mantener oculto hasta decision enterprise. |
| `/centro-control-iso` | `frontend/legacy-pages-archive/centro-control-iso/page.tsx` | legacy_candidate | No | Fuera del App Router y de `frontend/src` | command-center | Redirect legacy desacoplado y archivado; QA y demo usan `/dashboard`. | Conservar temporalmente para rollback; evaluar borrado definitivo en etapa posterior. |
| `/ciclo-vida` | `frontend/src/app/ciclo-vida/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | lifecycle | Flujo detallado fuera de MVP agregador. | Consolidar en cumplimiento si aplica. |
| `/command-center-iso` | `frontend/legacy-pages-archive/command-center-iso/page.tsx` | legacy_candidate | No | Fuera del App Router y de `frontend/src` | command-center | Redirect legacy desacoplado y archivado; QA y demo usan `/dashboard`. | Conservar temporalmente para rollback; evaluar borrado definitivo en etapa posterior. |
| `/configuracion` | `frontend/src/app/configuracion/page.tsx` | visible_mvp_cliente | Si | Admin tenant | configuration.users.manage | Configuracion tenant y usuarios. | Conservar. |
| `/controles` | `frontend/src/app/controles/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | compliance | Detalle operacional; MVP entra por `/cumplimiento-auditoria`. | Consolidar o mantener como drilldown controlado. |
| `/cotizador` | `frontend/src/app/cotizador/page.tsx` | dealer_only | No | Dealer | dealer.console | Cotizador comercial interno. | Conservar dealer. |
| `/cumplimiento-auditoria` | `frontend/src/app/cumplimiento-auditoria/page.tsx` | visible_mvp_cliente | Si | Admin, auditor, area owner, executive | compliance.read | Agregador del flujo norma-control-brecha-auditoria. | Conservar como superficie oficial. |
| `/dashboard` | `frontend/src/app/dashboard/page.tsx` | visible_mvp_cliente | Si | Admin, area owner, executive | dashboard.read | Dashboard oficial cliente. | Conservar como dashboard canonical. |
| `/dashboard-kpi` | `frontend/legacy-pages-archive/dashboard-kpi/page.tsx` | duplicate_candidate | No | Fuera del App Router y de `frontend/src` | dashboard/kpi | Redirect legacy desacoplado y archivado; QA y demo usan `/dashboard`. | Conservar temporalmente para rollback; evaluar borrado definitivo en etapa posterior. |
| `/dashboard-v2` | `frontend/src/app/dashboard-v2/page.tsx` | duplicate_candidate | No | Interno/platform por guard oculto | dashboard | Redirect puro a `/dashboard`; validadores y docs QA/demo mantienen la URL como contrato vigente. | `kept_temporarily`; desacoplar contrato QA/demo antes de cuarentena. |
| `/dealer` | `frontend/src/app/dealer/page.tsx` | dealer_only | No | Dealer | dealer.console | Portal dealer. | Conservar dealer. |
| `/diagnostico` | `frontend/src/app/diagnostico/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | compliance | Diagnostico detallado fuera de MVP agregado. | Consolidar en cumplimiento. |
| `/documentos` | `frontend/src/app/documentos/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | documents | Generador documental persistente con deep links vivos; no es duplicado simple de Evidencias. | `blocked_by_backend_contract_review`; mantener hasta resolver enlaces y contrato enterprise. |
| `/ejecucion-iso` | `frontend/src/app/ejecucion-iso/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | execution | Flujo funcional de generacion, aprobacion y rechazo de sugerencias. | `kept_enterprise_post_mvp`; definir acceso de producto antes de cambios. |
| `/empresas` | `frontend/src/app/empresas/page.tsx` | platform_only | No | Platform | admin_saas.internal | Gestion plataforma/empresas. | Conservar plataforma. |
| `/evidencias` | `frontend/src/app/evidencias/page.tsx` | visible_mvp_cliente | Si | Admin, auditor, area owner | evidences/evidence_library | Evidencias y biblioteca documental. | Conservar. |
| `/exportes` | `frontend/src/app/exportes/page.tsx` | visible_mvp_cliente | Si | Admin, auditor, area owner, executive read; export limitado | reports.read/export | Reportes y exportes. | Conservar. |
| `/hallazgos` | `frontend/src/app/hallazgos/page.tsx` | enterprise_post_mvp | No | Interno/platform por guard oculto | compliance | Detalle de hallazgos; MVP agregado en cumplimiento. | Consolidar en cumplimiento. |
| `/health` | `frontend/src/app/health/page.tsx` | internal_admin | No | Interno/platform por guard oculto | operational/health | Salud tecnica/operacional no cliente MVP. | Mantener oculto. |
| `/ia` | `frontend/src/app/ia/page.tsx` | legacy_candidate | No | Interno/platform por guard oculto | ai | Recomendaciones legacy sobre controles; IA.3 reemplazo apply directo por borrador revisable, pero persiste drift de lectura frente a IA Compliance. | `blocked_pending_ia4_read_migration_or_archive`; IA.4 debe migrar lectura util o documentar paridad antes de cuarentena. |
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

## Baseline final B.8

### Superficie MVP cliente

`/dashboard`, `/cumplimiento-auditoria`, `/evidencias`, `/riesgos`,
`/planes-accion`, `/exportes`, `/ia-compliance`, `/configuracion`,
`/perfil-empresa` y `/usuarios`.

### Superficies separadas del cliente MVP

- Plataforma: `/admin-saas`, `/empresas`.
- Dealer/comercial: `/dealer`, `/cotizador`, `/prefacturacion`.
- Internas o administracion: por ejemplo `/health` y `/administrar-kpis`.
- Enterprise/post-MVP: rutas operativas detalladas marcadas como
  `enterprise_post_mvp` en la tabla.

### Archivadas fuera del App Router

`/dashboard-kpi`, `/centro-control-iso`, `/command-center-iso` y
`/auditor-iso` permanecen en `frontend/legacy-pages-archive/`.

### Retenidas por bloqueo explicito

- `/dashboard-v2`: `kept_temporarily_qa_demo_dependency`.
- `/ia`: `blocked_pending_ia4_read_migration_or_archive`.
- `/ejecucion-iso`: `kept_enterprise_post_mvp`.
- `/documentos`: `blocked_by_backend_contract_review`.

El build esperado para este baseline es de 42 paginas. El control automatizado
oficial es `scripts/qa/qa-official-surface.sh`, ejecutable con `rg` o con el
fallback de herramientas POSIX.
