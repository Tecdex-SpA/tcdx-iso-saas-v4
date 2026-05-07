# Fase 1.14 - Dashboard consolidado ISO con paridad funcional

## Objetivo

Completar el nuevo Dashboard para que actue como vista principal ejecutiva y operativa, sin eliminar todavia las vistas antiguas ni los accesos actuales del sidebar.

La vista sigue disponible en:

- `/dashboard-v2`

El nombre funcional de la experiencia es **Dashboard**. No se crea un nombre comercial separado.

## Alcance consolidado

El Dashboard consolida:

- resumen ejecutivo y readiness de auditoria;
- normas activas/contratadas del tenant;
- Salud ISO consolidada;
- Ciclo de Vida ISO;
- KPIs ejecutivos;
- Acciones recomendadas y trabajo pendiente;
- Riesgos ISO prioritarios y listado completo interno;
- Alertas criticas/inteligentes;
- personalizacion visual por usuario.

Se mantienen separadas:

- Evidencias;
- Generacion de documentos.

El Dashboard puede mostrar accesos o contadores minimos hacia esas vistas, pero no integra su operacion principal en esta fase.

## Correccion del error 42703

Sintoma previo:

```text
Calidad de datos Parcial
No se pudo consultar tenant: 42703
```

Causa:

`dashboardV2.service.js` consultaba columnas opcionales de `tenants`, incluyendo `legal_name`, que no necesariamente existen en el esquema real.

Correccion:

- `getTenant()` ahora consulta `information_schema.columns`.
- El `SELECT` se arma solo con columnas reales de `tenants`.
- Los campos opcionales tienen fallback seguro.
- Los errores tecnicos se registran en logs backend.
- El frontend recibe una nota funcional, no codigos SQL crudos.

Columnas opcionales soportadas:

- `name`
- `business_name`
- `legal_name`
- `company_name`
- `razon_social`
- `service_status`
- `status`
- `updated_at`
- `created_at`
- `logo_url`
- `logo`

## Endpoints usados

Dashboard v2:

- `GET /api/dashboard-v2/summary`
- `GET /api/dashboard-v2/actions`
- `GET /api/dashboard-v2/risks`
- `GET /api/dashboard-v2/kpis`
- `GET /api/dashboard-v2/alerts`
- `GET /api/dashboard-v2/preferences`
- `PUT /api/dashboard-v2/preferences`
- `DELETE /api/dashboard-v2/preferences`

Capacidades consolidadas reutilizadas:

- `/health/dashboard`
- `/health/standards`
- `/api/lifecycle/board/:tenantId`
- `/api/iso-operational-execution/*`
- `/api/iso-recommended-actions/*`
- `/api/iso-risk-matrix/*`
- `/api/kpis/dashboard/:tenantId`

## Paridad funcional

### Salud ISO

Se reutiliza la seccion integrada de Salud ISO del Dashboard v2, conectada a endpoints existentes de salud. Mantiene informacion de salud general, salud por norma, controles saludables, en atencion, deteriorados/criticos y criterios visuales equivalentes a la vista actual.

### Ciclo de Vida

Se reutiliza la seccion integrada de Ciclo de Vida, conectada al board existente. Mantiene estados, tarjetas, etapas, acciones de cambio cuando corresponden y restricciones del modulo actual.

### KPIs

Se integran KPIs ejecutivos dentro del Dashboard v2:

- score KPI;
- KPIs medidos;
- verdes/amarillos/rojos/grises;
- resumen por norma contratada;
- indicadores que requieren mirada.

La vista KPI completa sigue disponible.

### Acciones recomendadas

Se muestran como bloque compacto y expandible:

- total;
- criticas;
- vencidas;
- pendientes de aprobacion;
- convertidas;
- ultimas acciones;
- trabajo pendiente relacionado.

La conversion segura se mantiene en `/acciones-recomendadas`, con dry-run, preview y confirmacion explicita.

### Riesgos ISO

Se muestran:

- riesgos criticos;
- riesgos altos;
- riesgos sin responsable;
- riesgos sin tratamiento;
- top riesgos prioritarios;
- listado completo interno con boton “Ver todos los riesgos ISO”.

La edicion profunda sigue en `/matriz-riesgo`.

### Readiness y alertas

Readiness aparece al entrar al Dashboard y se recalcula/refresca desde el backend. Las alertas se generan de forma deterministica desde readiness, brechas, riesgos, acciones, salud y KPIs.

## Normas contratadas

La regla de visibilidad usa `tenant_standards` como fuente:

- solo normas activas/contratadas del tenant;
- no se muestran normas no contratadas;
- no se muestran tarjetas 0% para normas fuera del alcance;
- ISO9001 `2026_FDIS` no aparece como certificable operativa.

## Personalizacion por usuario

La tabla `user_dashboard_preferences` guarda:

- `tenant_id`;
- `user_id`;
- `dashboard_key`;
- `layout_json`.

La clave unica `tenant_id + user_id + dashboard_key` evita que el orden de un usuario afecte a otro usuario del mismo tenant.

El layout permite:

- reordenar widgets;
- colapsar/expandir;
- guardar;
- restaurar predeterminado.

## Validacion

Script nuevo:

```bash
bash scripts/validate-dashboard-consolidated-functional-parity.sh
```

Valida:

- backend responde;
- frontend responde;
- endpoints de Dashboard v2 responden con JWT;
- no aparece `42703`;
- no aparece `undefined_column`;
- no aparece `No se pudo consultar tenant`;
- Salud ISO responde;
- Ciclo de Vida responde;
- preferencias responden;
- solo aparecen normas activas del tenant;
- ISO9001 2026_FDIS no aparece como certificable operativa;
- GET del Dashboard no crea objetos operativos;
- conteos criticos intactos.

## Pendientes para 1.14E

- Reemplazo controlado de `/dashboard` por Dashboard v2.
- Reduccion progresiva de botones redundantes del sidebar.
- Mantener rutas antiguas como detalle/compatibilidad.
- Mejoras dedicadas de Evidencias.
- Mejora dedicada de Documentos generados/sugeridos y aprobacion documental.
