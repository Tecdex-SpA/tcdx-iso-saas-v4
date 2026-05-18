# Fase 1.14C - Dashboard v2 Operacion ISO

## Objetivo

Integrar en `/dashboard-v2` los paneles operativos que faltaban para uso diario:

- acciones recomendadas y trabajo pendiente;
- riesgos ISO prioritarios y vista interna de todos los riesgos;
- KPIs ejecutivos dentro del Dashboard v2;
- alertas inteligentes accionables.

La fase mantiene separadas las vistas de evidencias y documentos. El Dashboard v2 solo puede mostrar senales o contadores minimos cuando esos datos afectan readiness o alertas.

## Endpoints

Se extendio el modulo `dashboard-v2` con endpoints read-only:

- `GET /api/dashboard-v2/summary`
- `GET /api/dashboard-v2/actions`
- `GET /api/dashboard-v2/risks`
- `GET /api/dashboard-v2/kpis`
- `GET /api/dashboard-v2/alerts`

Todos requieren JWT/RBAC y resuelven el `tenant_id` desde el usuario autenticado. No aceptan un `tenant_id` arbitrario por query.

## Fuentes de datos

Los paneles usan datos existentes:

- `tenant_standards` como fuente de normas activas/contratadas.
- `iso_operational_suggestions` para acciones recomendadas.
- `iso_recommended_action_conversions` para conversiones trazadas.
- `action_plans`, `findings`, `tenant_nonconformities` para trabajo pendiente relacionado.
- `iso_risk_matrix_items` para riesgos ISO.
- `kpi_snapshots` y `kpi_definitions` para KPIs.
- Datos consolidados desde `isoCommandCenter.service.js` para readiness, prioridades y alertas base.

## Regla de normas contratadas

Los endpoints y la UI filtran por normas activas del tenant. No se muestran normas no contratadas ni tarjetas con 0% para normas fuera del alcance. ISO9001 `2026_FDIS` queda excluida de paneles operativos certificables y sigue siendo preparacion/transicion no certificable.

## Acciones

El panel muestra:

- total de acciones;
- criticas;
- vencidas;
- pendientes de aprobacion;
- convertidas;
- ultimas acciones relevantes;
- trabajo pendiente conectado a planes, hallazgos y no conformidades.

La conversion real no ocurre en el Dashboard v2. El enlace lleva a `/acciones-recomendadas`, donde sigue el flujo seguro de dry-run, preview y confirmacion.

## Riesgos

El panel muestra:

- riesgos criticos y altos;
- riesgos sin responsable;
- riesgos sin tratamiento;
- resumen por norma;
- riesgos prioritarios;
- tabla expandible con todos los riesgos ISO del tenant.

La edicion profunda se mantiene en `/matriz-riesgo`.

## KPIs

El panel interno de KPIs muestra:

- score ejecutivo de KPIs;
- KPIs medidos;
- verdes, amarillos, rojos y grises;
- resumen por norma contratada;
- lista de indicadores que requieren mirada.

La administracion y vista completa de KPIs se mantiene en `/dashboard-kpi`.

## Alertas inteligentes

Las alertas se calculan de forma deterministica desde datos existentes:

- readiness bajo;
- brechas abiertas;
- riesgos criticos;
- riesgos sin tratamiento;
- acciones vencidas;
- acciones listas para revisar;
- KPIs en rojo;
- alertas base del Command Center.

Si no hay datos suficientes, la UI muestra estado vacio seguro.

## Seguridad

Esta fase es de lectura/consolidacion:

- no modifica `standards`;
- no modifica `tenant_standards`;
- no modifica `tenant_controls`;
- no modifica `evidences`;
- no crea evidencias;
- no convierte acciones;
- no crea riesgos;
- no activa normas.

## Validacion

Script:

```bash
bash scripts/validate-dashboard-v2-operational-panels.sh
```

Variables:

```bash
export API_URL="http://bk.tcdx.int:3000"
export FRONTEND_URL="https://181.212.166.187:8443"
export TEST_EMAIL="admin@rieltec.com"
export TEST_PASSWORD="123456"
```

Validaciones esperadas:

- `/dashboard-v2` responde.
- Endpoints `actions`, `risks`, `kpis`, `alerts` responden.
- Payloads solo contienen normas activas del tenant.
- No cambian conteos criticos.
- No cambian conteos de sugerencias, conversiones ni riesgos por consultas read-only.

## Limitaciones

- Riesgos proximos a vencer quedan en 0 mientras la matriz no tenga fecha calendario de vencimiento por item.
- Riesgos sin responsable se infieren por `reviewer_user_id IS NULL`.
- Documentos y evidencias no se integran como bloque principal por decision de alcance.

## Proxima fase sugerida

Fase 1.14D: personalizacion visual persistente del Dashboard v2, con orden de tarjetas por usuario y layout configurable sin romper el dashboard actual.
