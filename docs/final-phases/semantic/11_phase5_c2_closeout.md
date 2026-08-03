# Closeout Fase 5-C2

Estado: `READY_FOR_REVIEW`.

## Alcance cerrado

- Migración aditiva `20260803_phase5_c2_semantic_layer`, runner administrativo, ledger, checksum, advisory lock, preflight y postcondiciones.
- Seis tablas semánticas nuevas; snapshots, lineage, jobs, capabilities y límites existentes fueron extendidos sin crear motores paralelos.
- Bootstrap idempotente de 17 contratos globales y sus versiones publicadas. Cada tenant debe aportar mappings físicos válidos antes de que una fuente pueda declararse disponible.
- Transformaciones tipadas, joins allowlisted y tenant-scoped, observaciones canónicas append-only, relaciones, calidad, freshness, suficiencia, snapshots y lineage.
- Reconciliación legacy explícita: `equivalent`, `adapted`, `mapping_required` o `missing`; no existen ceros ni estados `source_ready` inferidos por publicación.
- API autorizada, jobs compartidos y workspace técnico `/datos/semantica`; usuarios de negocio no reciben tablas, columnas ni adapter keys como experiencia principal.

## Validación local

- `npm run phase5-c2:full-check`: aprobado.
- PostgreSQL 16 real efímero: 6 tablas, 17 contratos/versiones, primera y segunda ejecución, retry desde `failed`, checksum incompatible rechazado, triggers de inmutabilidad y Tenant A/B aprobados.
- Unidad: 32 aserciones.
- Backend: suite completa aprobada.
- Frontend: lint, typecheck y build de 84 rutas aprobados.
- Chromium C2: 1/1 flujo integral, cero retries, skips, flaky o respuestas 500 semánticas.
- Compatibilidad Fase 5.5: 10/10 escenarios Chromium aprobados; checks Fase 3, 4, 5 y 5.5 aprobados.
- `git diff --check`: aprobado.

## Límite de fase

Trust y comparativas funcionales completas pertenecen a 5-C3; Impact Graph definitivo pertenece a 5-C6; runtime VM, backup/restore y producción pertenecen a 5-C11. No se implementó 5-C3, no se ejecutó merge, deploy ni acceso a producción.
