# Fase 1.14D - Personalizacion visual Dashboard v2

## Objetivo

Permitir que cada usuario adapte visualmente `/dashboard-v2` sin afectar a otros usuarios del mismo tenant.

La personalizacion cubre:

- orden de bloques;
- bloques colapsados/expandidos;
- modo edicion;
- guardar cambios;
- restaurar predeterminado.

El encabezado ejecutivo y el mensaje principal de readiness permanecen arriba como contexto fijo.

## Modelo de datos

Migracion:

`database/migrations/20260507_dashboard_v2_user_preferences.sql`

Tabla:

`user_dashboard_preferences`

Campos principales:

- `tenant_id`
- `user_id`
- `dashboard_key`
- `layout_json`
- `created_at`
- `updated_at`

Constraint unico:

```sql
tenant_id, user_id, dashboard_key
```

Esto garantiza preferencias independientes por usuario dentro del mismo tenant.

## Endpoints

Se extendio `/api/dashboard-v2`:

- `GET /api/dashboard-v2/preferences`
- `PUT /api/dashboard-v2/preferences`
- `DELETE /api/dashboard-v2/preferences`
- `POST /api/dashboard-v2/preferences/reset`

Todos requieren JWT/RBAC. El backend resuelve `tenant_id` y `user_id` desde el token/sesion y no acepta `user_id` arbitrario desde frontend.

## Estructura de layout_json

```json
{
  "version": 1,
  "order": [
    "standards",
    "salud_iso",
    "ciclo_vida",
    "acciones",
    "riesgos",
    "kpis",
    "alertas"
  ],
  "collapsed": {
    "acciones": false,
    "alertas": true
  },
  "updated_at": "2026-05-07T00:00:00.000Z"
}
```

Bloques permitidos:

- `standards`
- `salud_iso`
- `ciclo_vida`
- `acciones`
- `riesgos`
- `kpis`
- `alertas`

El backend normaliza el layout:

- elimina bloques desconocidos;
- evita duplicados;
- reinyecta bloques faltantes;
- fuerza `layout_json` como objeto;
- limita el tamano del JSON.

## Frontend

En `/dashboard-v2` se agrego:

- boton `Personalizar dashboard`;
- arrastre de bloques en modo edicion;
- boton `Guardar cambios`;
- boton `Restaurar predeterminado`;
- aviso de cambios sin guardar;
- carga de preferencias al ingresar.

Si las preferencias fallan o no existen, la vista usa el layout predeterminado sin romper el dashboard.

## Seguridad multi-tenant

La preferencia se guarda por:

```text
tenant_id + user_id + dashboard_key
```

Un usuario no puede leer ni modificar preferencias de otro usuario porque el backend no toma `user_id` desde el request.

## No hace

Esta fase no:

- reemplaza `/dashboard`;
- elimina rutas existentes;
- modifica sidebar;
- crea evidencias;
- modifica `tenant_controls`;
- modifica `tenant_standards`;
- crea acciones operativas;
- cambia datos ISO del tenant.

## Validacion

Script:

```bash
bash scripts/validate-dashboard-v2-preferences.sh
```

Valida:

- GET preferencias;
- PUT layout;
- GET posterior;
- reset;
- restauracion del layout original si existia;
- `/dashboard-v2` responde;
- conteos criticos intactos;
- datos operativos intactos.

## Proximos pasos

Fase posterior sugerida:

- preparar reemplazo controlado de `/dashboard` por Dashboard v2;
- mantener rutas antiguas como detalle;
- simplificar sidebar progresivamente;
- extender layout persistente a tarjetas internas y densidad visual por usuario.
