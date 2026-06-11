# Matriz RBAC de rutas para Sprint 2

Fecha: 2026-06-11
Estado: S2-01 implementado y validado; casos opcionales documentados como SKIP

## Objetivo

Separar el dominio de reportes en permisos trazables de lectura, descarga,
generacion y administracion. El Bloque 2 implementa el gate backend y el
aislamiento de descarga sin modificar frontend ni base de datos.

Permisos propuestos:

- `reports:read`: listar tipos, clientes autorizados, cobertura e historial.
- `reports:download`: descargar un export ya generado y autorizado.
- `reports:generate`: crear preview, narrativa, PDF, ZIP o un trabajo de
  generacion.
- `reports:admin`: programar reportes, administrar reglas o actuar sobre
  multiples tenants dentro del alcance autorizado.

## Implementacion Bloque 2

El route real montado es:

```text
/api/reports -> backend/src/routes/reports.routes.js
```

`backend/src/routes/report.routes.js` permanece sin montar y no fue modificado.

`rbac.middleware.js` clasifica ahora las operaciones de reportes antes de las
reglas genericas:

- `reports:read`: GET/HEAD/OPTIONS de metadata, tipos, clientes, standards,
  sources, health e historial.
- `reports:download`: `GET /api/reports/download/:id`.
- `reports:generate`: preview, narrativa, export PDF/ZIP, generate y consulta de
  jobs de generacion.
- `reports:admin`: schedules.

Los aliases de roles usados por reportes se normalizan hacia las reglas
persistidas existentes:

- compliance/admin cumplimiento -> `admin`;
- cliente/viewer/ejecutivo -> `viewer`;
- operativo/responsable de area -> `operativo`.

No se creo ni ejecuto migracion.

## Brechas diagnosticadas y tratamiento

### Regla global demasiado amplia

Antes del Bloque 2, `backend/src/middleware/rbac.middleware.js` trataba
`/api/reports` como un unico prefijo e incluia a viewer en lectura y escritura.
La regla fue reemplazada por permisos por operacion. Viewer conserva lectura y
descarga, pero recibe `403` para generacion y administracion.

### Panel premium visible a viewer

`frontend/src/app/exportes/page.tsx` marca al viewer como solo lectura para la
pestana de generacion tradicional, pero mantiene visible
`PremiumReportsPanel`. Ese panel ofrece:

- `POST /api/reports/preview`
- `POST /api/reports/narrative`
- `POST /api/reports/export/pdf`
- `POST /api/reports/export/zip`

El backend bloquea esas operaciones para viewer. El Bloque 6 retiro las rutas
no MVP de la navegacion principal y mantuvo `/exportes` como lectura para
viewer/operativo. La visibilidad interna de controles premium dentro de la
pagina requiere smoke visual con esos roles.

### Discrepancia de roles

Las fuentes actuales no usan una matriz unica:

- `operativo` aparece como lectura de reportes en documentacion y en la pagina
  `/exportes`, pero `mvpPermissions.ts` no le concede `reports.read`.
- `admin_cumplimiento` y `compliance_admin` forman parte de roles admin en
  frontend y en otras reglas backend, pero no aparecen en
  `TENANT_REPORT_ROLES`.
- Los servicios de plantillas convierten roles a aliases como
  `responsable_area`, `admin_cumplimiento` y `ejecutivo_cliente`, diferentes de
  los grupos usados por el middleware global.

El backend de reportes normaliza estas equivalencias sin crear roles
comerciales nuevos. El gating de navegacion frontend usa las reglas MVP
existentes; la comprobacion visual por rol queda como riesgo residual.

### Descarga por `requested_by`

La funcion de acceso a exportes acepta actualmente, para un usuario tenant:

```text
row.tenant_id == userTenantId OR row.requested_by == userId
```

Para usuarios tenant, la descarga exige ahora que `row.tenant_id` coincida con
el tenant JWT. `requested_by` queda como dato de auditoria y ya no funciona como
bypass de aislamiento tenant.

Platform y dealer mantienen reglas separadas: plataforma por alcance global y
dealer por asignacion activa al tenant.

### Limitacion del modelo persistido

`report_access_rules` expresa:

- `can_view`
- `can_generate`
- `can_schedule`

No expresa permisos independientes de `download` ni `admin`. El Bloque 2
implementa esos gates en middleware/rutas sin migracion. Cualquier cambio futuro
de esquema requerira aprobacion explicita y plan de rollback.

## Matriz backend final

| Rol | `reports:read` | `reports:download` | `reports:generate` | `reports:admin` |
|---|---:|---:|---:|---:|
| Plataforma | Si | Si | Si | Si |
| Dealer asignado | Si | Si | Si | Solo programacion autorizada |
| Admin/compliance tenant | Si | Si | Si | No |
| Auditor | Si | Si | Si | No |
| Operativo/area owner | Si | Si | No | No |
| Viewer | Si | Si | No | No |

## Aplicacion propuesta por rutas

| Metodo/path | Permiso minimo | Regla tenant |
|---|---|---|
| `GET /api/reports/templates` | `reports:read` | Plantillas filtradas por rol. |
| `GET /api/reports/types` | `reports:read` | Tipos filtrados por rol y reglas persistidas. |
| `GET /api/reports/clients` | `reports:read` | Tenant propio, clientes dealer asignados o plataforma. |
| `GET /api/reports/standards` | `reports:read` | Tenant JWT o target autorizado para plataforma/dealer. |
| `GET /api/reports/exports` | `reports:read` | Historial limitado al tenant o asignaciones autorizadas. |
| `GET /api/reports/sources` | `reports:read` | Tenant JWT; detalle sensible limitado por rol. |
| `GET /api/reports/health` | `reports:read` | Tenant JWT o target autorizado. |
| `GET /api/reports/download/:id` | `reports:download` | Tenant coincidente; dealer asignado; plataforma global. |
| `GET /api/reports/jobs/:job_id` | `reports:generate` | Job del usuario/tenant autorizado. |
| `GET /api/reports/jobs/:job_id/result` | `reports:generate` | Job del usuario/tenant autorizado. |
| `POST /api/reports/preview` | `reports:generate` | Tenant JWT; sin bypass por body. |
| `POST /api/reports/narrative` | `reports:generate` | Tenant JWT; IA supervisada. |
| `POST /api/reports/export/pdf` | `reports:generate` | Tenant JWT y confirmacion de revision humana. |
| `POST /api/reports/export/zip` | `reports:generate` | Tenant JWT y confirmacion de revision humana. |
| `POST /api/reports/generate/start` | `reports:generate` | Tenant JWT o target autorizado. |
| `POST /api/reports/generate` | `reports:generate` | Tenant JWT o target autorizado. |
| `POST /api/reports/schedules` | `reports:admin` | Solo plataforma o dealer con programacion autorizada. |

## Reglas de interfaz

- Viewer y operativo pueden abrir `/exportes`, consultar historial y descargar
  exportes autorizados.
- Viewer y operativo no deben ver controles activos de preview, narrativa,
  exportacion premium ni generacion tradicional.
- Ocultar botones no sustituye el bloqueo backend.
- La interfaz debe basarse en la misma matriz que el backend o en permisos
  devueltos por una API contractual.
- Los resultados IA y narrativas requieren revision humana antes de convertirse
  en documentos oficiales.

La interfaz no fue modificada en el Bloque 2. El Bloque 6 ajusto el gating de
navegacion sin cambiar los endpoints ni relajar el enforcement backend.

## QA Bloque 2

Se agrego `scripts/qa-reports-rbac-p1.sh`. Requiere:

- `API_BASE_URL`
- `TENANT_A_ID`
- `TENANT_B_ID`
- `TENANT_A_TOKEN`
- `TENANT_B_TOKEN`

Variables opcionales:

- `VIEWER_TOKEN`: si falta, la prueba de generacion denegada para viewer queda
  `SKIP`.
- `REPORT_EXPORT_ID`: si falta, las pruebas download same-tenant y cross-tenant
  quedan `SKIP`.

El probe de generacion autorizado envia un payload deliberadamente incompleto.
Un `400` funcional por `report_type_code` ausente confirma que el rol supero el
gate RBAC sin iniciar una generacion real. Un `403` falla esa prueba.

Los resultados se guardan bajo
`qa-results/reports-rbac-p1-<timestamp>/summary.md`, fuera de Git.

La ejecucion runtime contra `https://tcdx-iso.tecdex.net` finalizo con
PASS 3, FAIL 0 y SKIP 3. Los SKIP aceptados corresponden a `VIEWER_TOKEN` y
`REPORT_EXPORT_ID` ausentes; no se imprimieron tokens.

## Criterios de aceptacion S2-01

1. Viewer recibe `403` ante preview, narrativa, export PDF/ZIP, generate y
   schedules.
2. Viewer puede listar y descargar un reporte de su tenant cuando existe.
3. Operativo/area owner puede leer y descargar, pero no generar ni administrar.
4. Admin/compliance tenant y auditor pueden generar segun la matriz y las reglas
   del tipo de reporte.
5. Dealer solo accede a tenants con asignacion activa.
6. `REPORT_EXPORT_ID` same-tenant responde `200` o el estado funcional esperado.
7. `REPORT_EXPORT_ID` cross-tenant responde `403` o `404`, nunca `500`.
8. Para usuario tenant, `requested_by` no permite descargar un export de otro
   tenant.
9. Backend usa equivalencias documentadas para `operativo`,
   `admin_cumplimiento` y `compliance_admin`; frontend queda para el bloque de
   gating.
10. No se ejecuta migracion para completar S2-01 salvo aprobacion explicita.

## Estado S2-01

**Completado para Sprint 2.** El enforcement backend y el gate QA estan
implementados, la ejecucion runtime no presento fallas y los casos opcionales
sin `VIEWER_TOKEN` o `REPORT_EXPORT_ID` quedan registrados como SKIP aceptados.
El modelo persistido sigue sin columnas independientes para download/admin y
no se ejecuto migracion.
