# Sprint 5 - Health del sistema y KPIs por norma/proceso

## Objetivo

Implementar una lectura deterministica, reproducible y auditable de salud del sistema de gestion por tenant, norma y proceso. Health no es certificacion, no aprueba cumplimiento y no usa IA para decidir el score.

## Alcance

Sprint 5 agrega:

- Health global 0-100.
- Health por norma activa.
- Health por proceso u operacion.
- KPIs minimos reproducibles.
- Resumen liviano para Dashboard.
- Vista operativa en `/health`, integrada a Cumplimiento y Auditoria.

No se implementan reportes PDF premium, Sync Agent, automatizaciones periodicas ni cambios a Google/Zoho/carga manual.

## Formula inicial

```
Health Score =
35% Cobertura de controles
20% Estado de evidencias
15% Brechas
15% Acciones
10% Riesgos
5% Ciclo ISO / Auditoria
```

Dimensiones:

- `control_coverage`: controles cubiertos + controles parciales ponderados + controles en revision.
- `evidence`: penaliza controles sin evidencia activa o candidata suficiente.
- `gaps`: penaliza brechas, hallazgos y no conformidades abiertas.
- `actions`: penaliza acciones abiertas y vencidas.
- `risks`: penaliza riesgos residuales altos o criticos pendientes.
- `lifecycle_audit`: señal base del estado del ciclo ISO disponible.

Semaforo:

| Score | Estado | Label |
|---:|---|---|
| 85-100 | high | Salud alta |
| 70-84 | acceptable | Salud aceptable |
| 50-69 | medium | Salud media |
| 30-49 | low | Salud baja |
| 0-29 | critical | Salud critica |

## KPIs minimos

| Codigo | KPI |
|---|---|
| HLT-01 | Salud global ISO |
| HLT-02 | Salud por norma |
| HLT-03 | Salud por proceso |
| KPI-01 | Cobertura de controles |
| KPI-02 | Evidencias faltantes |
| KPI-03 | Brechas abiertas |
| KPI-04 | Acciones vencidas |
| KPI-05 | Riesgo residual alto |
| KPI-06 | Evidencias excluidas |
| KPI-07 | Diagnosticos pendientes |
| KPI-08 | No conformidades abiertas |
| KPI-09 | Madurez documental |
| KPI-10 | Avance ciclo ISO |

## Backend

Servicio creado:

- `backend/src/services/health.service.js`

Rutas extendidas:

- `backend/src/routes/health.js`
- `backend/src/app.js`
- `backend/src/middleware/rbac.middleware.js`

Endpoints Sprint 5:

- `GET /api/health/summary`
- `GET /api/health/dashboard`
- `GET /api/health/standards`
- `GET /api/health/processes`
- `GET /api/health/process-detail?standard_id=<id>&process_id=<id>`
- `GET /api/health/kpis`

Compatibilidad:

- Las rutas legacy `/health/*` se mantienen.
- El contrato Sprint 5 se activa bajo `/api/health/*`.

## Seguridad

- `/api/health/*` queda bajo `auth`, `enforceApiAccess` y `enforceTenantRequestScope`.
- El servicio usa `diagnosticService.buildDiagnostic`, que aplica tenant scope, rol y visibilidad por area/responsable cuando existe.
- No se cuentan evidencias excluidas como cobertura activa.
- No se exponen chunks, prompts ni traces IA.
- No se aceptan `provider_file_id` externos para operaciones internas.

## Dashboard

Dashboard reemplaza la experiencia visible "Centro Control ISO" por **Salud del sistema**.

Consume:

- `GET /api/health/dashboard`

Muestra:

- score global;
- semaforo;
- explicacion breve;
- alertas principales;
- salud por norma resumida;
- top procesos criticos;
- CTA `Ver salud completa` hacia `/health`.

No muestra formulas extensas, chunks ni trazas.

## Cumplimiento y Auditoria

La vista consolidada `/cumplimiento-auditoria` agrega acceso a:

- `/health` - Salud del sistema

`/health` queda habilitada como ruta de `compliance.read` y no se agrega al sidebar como modulo suelto.

La vista completa muestra:

- health global;
- health por norma;
- health por proceso;
- KPIs minimos;
- filtros por norma/proceso;
- explicacion de calculo;
- drivers del score;
- links a diagnostico, evidencias, planes y riesgos.

Texto visible obligatorio:

> Health es un indicador calculado de gestion, no certificacion ni aprobacion automatica.

## Pruebas manuales

Dashboard:

1. Abrir `/dashboard`.
2. Confirmar que no aparece "Centro Control ISO".
3. Confirmar que aparece "Salud del sistema".
4. Confirmar score global y semaforo.
5. Confirmar alertas principales y top procesos criticos.
6. Confirmar que `Ver salud completa` navega a `/health`.

Health completo:

1. Abrir `/health`.
2. Confirmar integracion visual con Cumplimiento y Auditoria.
3. Ver health global.
4. Ver health por norma.
5. Ver health por proceso.
6. Filtrar por norma.
7. Filtrar por proceso.
8. Ver KPIs minimos.
9. Ver explicacion de calculo y drivers.
10. Confirmar texto de no certificacion.

Seguridad:

1. Sin token debe devolver 401.
2. Rol sin permiso debe devolver 403.
3. Token de tenant A no debe ver tenant B.
4. Responsable de area solo ve procesos visibles por `diagnosticService`.
5. Evidencia excluida no cuenta como cobertura.
6. Dashboard no expone chunks IA ni traces.

## Riesgos pendientes

- Las pruebas cross-tenant requieren tokens reales de tenants distintos.
- La granularidad de Responsable Area depende de ownership existente en controles, procesos u operaciones.
- KPI-07 usa recomendaciones pendientes derivadas del diagnostico deterministico; si en Sprint futuro existe tabla formal de sugerencias revisadas, debe conectarse a esa fuente.
- La madurez documental usa `document_index` disponible y devuelve warning si faltan columnas/estado suficiente.
