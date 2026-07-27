# Fase 1R - Cierre operacional local

## Causa raíz

Fase 1 tenía persistencia, servicios y gates, pero la UI exponía solo un panel informativo con pocas mutaciones y sin bootstrap tenant. Tampoco invalidaba de forma explícita el cache de módulos en administración, las acciones no daban confirmación perceptible y la evidencia E2E era principalmente API/discovery. El esquema presuponía configuración tenant que no se creaba mediante una operación controlada.

## Remediación

- migración aditiva para configuración y ledger de bootstrap;
- bootstrap explícito, confirmado, transaccional, idempotente, bloqueado por tenant y auditado;
- siete workflows base y reglas/políticas operacionales sin datos de negocio;
- panel de Configuración para estado, inicialización, validación, versionado, instancias y transiciones;
- operaciones web de entrega/versionado/revisión/calidad/vínculos de evidencia;
- mappings tenant con revisión y defensa cross-tenant;
- ejecución de auditoría con independencia, conflictos, programa, muestra, papeles, evidencia, informe, seguimiento y cierre bloqueante;
- feedback accesible y refresh tras mutaciones;
- endpoint administrativo canónico, actor, estado global/tenant e invalidación de cache;
- upsert SaaS validado con columnas `enabled_by`/`disabled_by` y catálogo basado en el setting tenant real;
- PostgreSQL 16 real para bootstrap, scheduler, escalamiento, export y Tenant A/B;
- métricas estables por operación;
- 30 contratos Playwright, 13 críticos y runner VM con evidencia derivada y limpieza transaccional.

## Estado verificable

Localmente se validan contratos, migraciones, PostgreSQL, permisos, tenant, backend, frontend y discovery. La ejecución real se delega a `npm run phase1:closeout` sobre el SHA desplegado. El artifact de cada run, no este texto estático, determina `VERIFIED_RUNTIME`.

El runner usa únicamente cuentas y fixtures QA controlados, conserva evidencia no sensible y elimina sus registros antes de declarar éxito.
