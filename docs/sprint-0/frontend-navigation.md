# Sprint 0 - Navegación frontend

## Fuentes revisadas
- `frontend/src/components/Sidebar.tsx`: menú lateral, roles, módulos contratables y norma activa.
- `frontend/src/components/AppLayout.tsx`: guards frontend por rol, módulos y entitlements IA.
- `frontend/src/utils/auth.ts`: lectura de JWT desde `localStorage.token`.

## Rutas visibles en Sidebar
- `/dashboard`
- `/ciclo-vida`
- `/health`
- `/exportes`
- `/administrar-kpis`
- `/diagnostico`
- `/controles`
- `/matriz-riesgo`
- `/activos`
- `/soa`
- `/plan-accion`
- `/acciones-recomendadas`
- `/no-conformidades`
- `/auditorias`
- `/evidencias`
- `/hallazgos`
- `/ia-compliance`
- `/usuarios`
- `/perfil-empresa`
- `/admin-saas`
- `/cotizador`
- `/prefacturacion`
- `/dealer`

## Rutas en navegación sin página
- Ninguna por inventario.

## Páginas existentes que no aparecen directamente en Sidebar
- `/auditor-iso`
- `/auditorias/ejecucion`
- `/auditorias/ia`
- `/centro-control-iso`
- `/command-center-iso`
- `/dashboard-kpi`
- `/dashboard-v2`
- `/documentos`
- `/ejecucion-iso`
- `/empresas`
- `/ia`
- `/ia-auditor`
- `/ia-compliance/sugerencias`
- `/perfil`

## Roles y flags usados
- Plataforma: `superadmin`, `super_admin`, `platform_admin`, `admin_global`, `global_admin` ve Admin SaaS, cotizador, usuarios, prefacturación, health y exportes.
- Dealer: `dealer` ve dealer, cotizador, prefacturación y exportes.
- Cliente/admin: `admin`, `tenant_admin` ve administración de usuarios/perfil empresa y módulos operativos habilitados.
- Auditor: ve módulos de auditoría pero queda bloqueado en `/ia-compliance`, `/ia`, usuarios, perfil empresa y KPIs por `AppLayout`.
- Ejecutivo/viewer/read-only: `viewer`, `cliente`, `client`, `solo_lectura`, `read_only`, `readonly`, `ejecutivo` queda limitado a dashboard, dashboard v2, command centers, ciclo de vida, health, exportes, auditorías, auditor ISO, acciones recomendadas y perfil.
- Feature/module flags: `/api/me/modules` controla `ai`, `risks`, `audits`, `evidences`, `kpis`; `useTenantEntitlements` controla IA.

## Menú MVP recomendado, solo documentación
1. Dashboard
2. Cumplimiento
3. Evidencias
4. Riesgos
5. Auditoría
6. Planes de Acción
7. Reportes
8. IA Compliance
9. Configuración

## Recomendación sin implementar
Agrupar pantallas actuales bajo esos nombres y ocultar en MVP cliente: Admin SaaS, billing/prefacturación, dealer/cotizador, command centers, benchmark/traces/knowledge base, lookup externo, objetivos si no está maduro y rutas técnicas/experimentales.
