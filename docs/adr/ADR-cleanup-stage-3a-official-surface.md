# ADR: Cleanup stage 3A official surface

Fecha: 2026-06-12
Rama: `chore/cleanup-stage-3a-official-surface`
Estado: Accepted

## Contexto

Etapa 1 inventario la superficie del repo y Etapa 2 archivo basura segura, movio `qa-results`, cuarenteno `2evidences.routes.js` y oculto `/health`. Aun quedaban rutas frontend secundarias y legacy accesibles por reglas MVP aunque no fueran parte de la superficie cliente aprobada.

## Decision

La superficie cliente MVP se define como rutas agregadoras y comercialmente demostrables. Las rutas detalladas, duplicadas, legacy, platform/dealer y enterprise quedan documentadas y controladas por guards, pero no se eliminan en 3A.

## Superficie MVP cliente

- `/dashboard`
- `/cumplimiento-auditoria`
- `/evidencias`
- `/riesgos`
- `/planes-accion`
- `/exportes`
- `/ia-compliance`
- `/configuracion`
- `/perfil-empresa`
- `/usuarios`

`/perfil-empresa` y `/usuarios` pertenecen a Configuracion aunque no sean items principales del Sidebar.

## Superficie interna/plataforma

- `/admin-saas`
- `/empresas`
- `/health`
- Rutas tecnicas o de soporte protegidas por `INTERNAL_CLIENT_HIDDEN_ROUTES`.

## Superficie dealer/comercial

- `/dealer`
- `/cotizador`
- `/prefacturacion`

## Superficie enterprise/post-MVP

- Auditorias detalladas.
- Matriz/activos/riesgos detallados.
- Ciclo de vida.
- Recomendaciones/acciones detalladas.
- IA Auditor y subflujos IA avanzados.
- Generador documental/diagnosticos/command centers si se mantienen.

## Superficie legacy/candidata a eliminacion futura

- `/dashboard-v2`
- `/dashboard-kpi`
- `/ia`
- `/auditor-iso`
- `/centro-control-iso`
- `/command-center-iso`
- `/ejecucion-iso`
- `/documentos`
- `backend/src/routes/_legacy/2evidences.routes.js`
- `backend/src/routes/report.routes.js` queda en `requires_review`, no eliminado.

## Que no se elimino y por que

- No se borraron paginas frontend porque pueden servir como referencia o flujo enterprise.
- No se borro `report.routes.js` por duda operativa y documentacion vigente.
- No se tocaron OAuth Google/Zoho, Sync Agent, IA traces, external lookup ni SQL porque son superficies de seguridad/DB diferidas.
- No se modifico backend runtime.

## Consecuencias

- `qa-official-surface.sh` puede fallar si una ruta no MVP vuelve a aparecer en nav cliente.
- El MVP cliente queda mas estricto: rutas detalladas pasan a ocultas salvo plataforma/dealer.
- Producto debe decidir en 3B/4 que rutas legacy se eliminan, migran o quedan enterprise.

## Proximas decisiones para Etapa 3B/4

1. Eliminar o mover rutas frontend legacy ya ocultas.
2. Resolver `report.routes.js`.
3. Consolidar dashboard KPI/v2 en `/dashboard`.
4. Auditar OAuth Google/Zoho y Sync Agent.
5. Auditar IA traces/external lookup.
6. Revisar `database/qa-fixes` y seeds destructivos con DBA.
