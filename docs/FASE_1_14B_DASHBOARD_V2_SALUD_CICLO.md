# Fase 1.14B - Dashboard v2 Salud ISO y Ciclo de Vida

## Objetivo

Integrar dentro de `/dashboard-v2` las capacidades operativas de Salud ISO y Ciclo de Vida, manteniendo vivas las rutas actuales `/health` y `/ciclo-vida`.

No se reemplaza `/dashboard`.

## Componentes Revisados

### Salud ISO

Vista actual:

- `frontend/src/app/health/page.tsx`

Endpoints usados por la vista actual:

- `GET /health/dashboard`
- `GET /health/standards`
- `GET /health/root-causes`
- `GET /health/root-causes/standards`
- `GET /health/controls-risk`
- `GET /health/remediation-summary`
- `GET /health/remediation-plan`
- `GET /health/evidence-approval-queue`
- `GET /health/controls-recovered`
- `GET /health/audit-log`
- `POST /health/refresh`
- `POST /health/remediation-plan/create-action`

### Ciclo de Vida

Vista actual:

- `frontend/src/app/ciclo-vida/page.tsx`

Endpoints usados por la vista actual:

- `GET /api/tenant-standards/scope/:tenantId`
- `GET /api/lifecycle/board/:tenantId`
- `GET /api/lifecycle/history/:tenantId`
- `POST /api/lifecycle/request-move`
- `POST /api/lifecycle/requests/:requestId/review`

## Implementacion

Se crearon componentes internos para Dashboard v2:

- `DashboardV2HealthSection`
- `DashboardV2LifecycleSection`

Estos componentes reutilizan los mismos endpoints existentes y no eliminan ni modifican las vistas originales.

## Capacidades Integradas

### Salud ISO Consolidada

Incluye:

- salud global;
- salud por norma contratada;
- controles saludables, en atencion y criticos/deteriorados;
- causas raiz;
- controles en riesgo;
- plan de remediacion sugerido;
- creacion explicita de plan de accion desde remediacion;
- evidencias pendientes;
- bitacora operacional;
- recalculo manual de salud.

### Ciclo de Vida

Incluye:

- etapas completas;
- tablero por etapa;
- filtros por norma y operacion;
- resumen de tarjetas, madurez, pendientes y deterioro;
- historial;
- detalle de tarjeta;
- links a controles, planes y auditorias;
- solicitud explicita de avance de etapa;
- confirmacion/rechazo de solicitudes pendientes segun permisos existentes.

## Regla de Normas Contratadas

Las subvistas se alimentan de endpoints que ya filtran por `tenant_standards`.

Ademas, el componente de ciclo de vida vuelve a filtrar en frontend contra `scope.standards` activo para evitar mostrar normas no contratadas.

`ISO9001 / 2026_FDIS` no se muestra como norma certificable operativa.

## Seguridad

- Todos los endpoints requieren JWT/RBAC.
- No se crean datos por abrir `/dashboard-v2`.
- Salud ISO solo escribe al usar explicitamente:
  - recalcular salud;
  - crear plan de remediacion.
- Ciclo de Vida solo escribe al usar explicitamente:
  - solicitar avance;
  - confirmar/rechazar solicitud.
- No se crean evidencias.
- No se crean `tenant_controls`.
- No se activan normas.

## Validaciones

```bash
node -c backend/src/app.js
node -c backend/src/middleware/rbac.middleware.js
bash -n scripts/validate-dashboard-v2-health-lifecycle.sh
cd frontend
npm run build
npx eslint src/app/dashboard-v2/page.tsx src/components/dashboard-v2
```

Validacion funcional:

```bash
bash scripts/validate-dashboard-v2-health-lifecycle.sh
```

## Conteos Criticos

La validacion compara antes/despues cuando existe `DATABASE_URL`:

- `standards`: 26
- `tenant_standards`: 23
- `tenant_controls`: 1358
- `evidences`: 205

## Limitaciones

- No se hizo drag & drop dentro de Dashboard v2; se ofrece solicitud de avance desde detalle de tarjeta para mantener control.
- No se reemplaza `/health` ni `/ciclo-vida`.
- No se migra aun toda la visualidad avanzada de la pagina original, pero si las capacidades principales y endpoints operativos.

## Proxima Fase

Fase 1.14C:

- integrar Acciones, Riesgos, KPIs y Alertas con detalle completo dentro de Dashboard v2;
- mejorar persistencia de layout por usuario;
- evaluar reemplazo gradual de `/dashboard` si Dashboard v2 se valida con usuarios.
