# Fase 1.14A - Dashboard v2 Base

## Objetivo

Crear una base tecnica y visual para un nuevo Dashboard v2, sin reemplazar todavia `/dashboard` ni romper rutas existentes.

La vista se llama **Nuevo Dashboard** durante la implementacion y queda disponible en `/dashboard-v2`.

## Alcance

- Nueva pagina frontend `/dashboard-v2`.
- Nuevo endpoint agregado `GET /api/dashboard-v2/summary`.
- Tarjetas por norma contratada/activa del tenant.
- Encabezado ejecutivo con empresa, salud general, readiness de auditoria y ultima actualizacion.
- Subvistas internas preparadas:
  - Resumen
  - Salud ISO
  - Ciclo de vida
  - Acciones
  - Riesgos
  - KPIs
  - Alertas
- Base declarativa para personalizacion futura de tarjetas ordenables y layout por usuario.

## Reglas Multi-Tenant

La fuente para visibilidad normativa es `tenant_standards`.

Dashboard v2:

- no muestra normas no contratadas;
- no muestra tarjetas en cero para normas fuera del tenant;
- no acepta `tenant_id` arbitrario desde query;
- usa el tenant del JWT;
- no crea `tenant_standards`;
- no modifica `tenant_controls`;
- no crea evidencias;
- no activa normas.

`ISO9001 / 2026_FDIS` no se muestra como norma operativa certificable. Si aparece en la capa agregadora como transicion, se mantiene fuera de `active_standards`.

## Endpoint

### `GET /api/dashboard-v2/summary`

Requiere JWT/RBAC.

Devuelve:

- `tenant`
- `executive_readiness`
- `general_health`
- `audit_readiness`
- `active_standards`
- `summary`
- `work`
- `alerts`
- `priorities`
- `tabs`
- `customization`
- `data_quality`

## Fuentes

El endpoint reutiliza el agregador existente del Command Center ISO:

- `isoCommandCenter.getUnified`
- `tenant_standards`
- diagnostico ISO express si existe;
- matriz de riesgos si existe;
- documentos ISO si existen;
- acciones recomendadas y conversiones;
- planes de accion, hallazgos y no conformidades;
- KPIs si existe `kpi_snapshots`.

Si alguna fuente opcional no existe, se devuelve `data_quality=partial` o `limited`.

## Frontend

Ruta:

`/dashboard-v2`

Componentes:

- `DashboardV2`
- `DashboardV2Header`
- `DashboardV2Tabs`
- `DashboardV2StandardCard`
- `DashboardV2Panel`

La vista usa `AppLayout`, conserva sidebar/header y no reemplaza `/dashboard`.

## Validacion

Backend:

```bash
node -c backend/src/services/dashboardV2.service.js
node -c backend/src/routes/dashboard-v2.routes.js
node -c backend/src/app.js
node -c backend/src/middleware/rbac.middleware.js
```

Frontend:

```bash
cd frontend
npm run build
npx eslint src/app/dashboard-v2/page.tsx src/components/dashboard-v2
```

Script:

```bash
bash -n scripts/validate-dashboard-v2-base.sh
bash scripts/validate-dashboard-v2-base.sh
```

Conteos criticos esperados:

- `standards`: 26
- `tenant_standards`: 23
- `tenant_controls`: 1358
- `evidences`: 205

## Riesgos y Limitaciones

- No implementa drag & drop todavia.
- No persiste layout por usuario todavia.
- Algunos paneles quedan preparados para 1.14B/1.14C.
- KPIs dependen de disponibilidad de snapshots.
- No reemplaza `/dashboard`.

## Proximos Pasos

Fase 1.14B:

- Conectar subvistas con mas detalle operativo.
- Persistir preferencias de layout por usuario.
- Mejorar KPIs y alertas inteligentes.
- Evaluar si `/dashboard-v2` reemplaza gradualmente `/dashboard`.
