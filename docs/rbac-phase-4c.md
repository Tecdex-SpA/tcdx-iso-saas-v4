# Fase 4C — RBAC y permisos finos productivos

## Objetivo

Establecer una línea base verificable de RBAC para TCDX ISO SaaS sin tocar base de datos, sin migraciones y sin bloquear al administrador actual.

Esta fase es conservadora: valida y documenta el modelo existente, crea QA repetible y deja preparado el endurecimiento granular posterior.

## Diagnóstico del estado actual

### Autenticación

El middleware `auth` valida JWT, soporta token Bearer, carga el payload en `req.user` y valida el estado del tenant para usuarios tenant. Roles de plataforma y `dealer` no se bloquean por estado del tenant.

Campos observados en token/código:

- `role`
- `user_role`
- `userRole`
- `tenant_id`
- `tenantId`
- `company_id`
- `companyId`
- `user_id`
- `userId`
- `id`

### RBAC backend

Existe `backend/src/middleware/rbac.middleware.js` con:

- `enforceApiAccess`
- normalización de rol
- roles de plataforma
- roles tenant de lectura, operación y administración
- reglas explícitas por prefijo API

La aplicación monta:

```js
app.use('/api/auth', express.json({ limit: jsonBodyLimit }), authRoutes);
app.use('/api', auth, enforceApiAccess);
```

Esto significa que la mayoría de rutas `/api/*` pasa por autenticación + RBAC después de `/api/auth`.

### Módulos del usuario

Existen endpoints:

- `GET /api/me/session`
- `GET /api/me/governance`
- `GET /api/me/permissions`
- `GET /api/me/modules`

`/api/me/modules` usa `saas_modules` y `v_tenant_modules` para devolver módulos habilitados por tenant o acceso completo en roles de plataforma.

### Roles detectados en código

Roles o equivalentes observados:

- `superadmin`
- `super_admin`
- `platform_admin`
- `admin_global`
- `global_admin`
- `owner`
- `admin`
- `tenant_admin`
- `auditor`
- `operativo`
- `viewer`
- `dealer`

No se fuerza la incorporación de roles nuevos en esta fase.

## Matriz conceptual de permisos

| Rol | Alcance esperado |
|---|---|
| Superadmin / Platform Admin | Administración SaaS global, tenants, módulos, usuarios, reportes, gobierno |
| Admin / Tenant Admin | Administración y operación de su tenant |
| Auditor | Auditorías, reportes, lectura operativa, IA Auditor según reglas actuales |
| Operativo | Operación diaria sobre controles, evidencias, planes y hallazgos |
| Viewer | Lectura limitada |
| Dealer | Portal dealer/cotizador/reportes permitidos |

## Endpoints sensibles

Se consideran sensibles:

- `/api/admin-saas`
- `/api/users`
- `/api/tenants`
- `/api/billing`
- `/api/kpi`
- `/api/kpis`
- `/api/quotes`
- `/api/reports`
- `/api/evidences`
- `/api/ai-auditor`
- `/api/ai-compliance`

## Cambios aplicados en 4C

- Se crea `scripts/qa-rbac-basic.sh`.
- Se documenta el estado real de RBAC.
- No se aplican cambios destructivos.
- No se crean migraciones.
- No se modifica DB.
- No se cambia la lógica de roles existente.
- No se toca frontend runtime.

## QA RBAC

Ejecutar:

```bash
API_URL=http://192.168.100.120:3000 \
FRONTEND_URL=http://192.168.100.130:3000 \
EMAIL=admin@rieltec.com \
PASSWORD=123456 \
bash ./scripts/qa-rbac-basic.sh
```

El script valida:

- login del admin actual;
- `/api/me/session`;
- `/api/me/modules`;
- `/api/me/permissions`;
- endpoints sensibles sin token;
- endpoints sensibles con token del admin actual;
- IA Auditor;
- IA Compliance;
- rutas frontend principales.

## Criterio de aceptación

- QA RBAC sin FAIL.
- WARN permitidos cuando una ruta base no existe o no expone GET directo.
- QA Security sin FAIL.
- QA IA Auditor sin FAIL.
- Admin actual no queda bloqueado.
- No hay `.env` reales en cambios.
- No se toca DB.
- No se crean migraciones.

## Riesgos identificados

- El modelo actual mezcla roles globales, tenant y dealer en reglas por prefijo.
- Algunos endpoints base pueden no responder a `GET /api/<modulo>` aunque existan rutas internas.
- El frontend puede ocultar módulos, pero la seguridad real debe mantenerse en backend.
- Una fase futura puede requerir matriz persistente de permisos en DB.

## Pendientes recomendados

### 4C.2 — Enforcement granular

- Revisar ruta por ruta con usuarios reales por rol.
- Alinear sidebar con `/api/me/modules` y permisos.
- Crear pruebas con credenciales de viewer/auditor/operativo/dealer.
- Endurecer rutas sensibles específicas si aparecen brechas.

### 4D — Cloud readiness operativa

- Nginx 80/443.
- TLS.
- variables cloud.
- Oracle private networking.
- backup/restore.
