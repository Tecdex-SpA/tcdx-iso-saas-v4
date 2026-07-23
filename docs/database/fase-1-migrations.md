# Fase 1 - Migración del núcleo GRC

## Archivo y política

`database/migrations/20260722_phase1_grc_core.sql` es aditiva, transaccional y deny-by-default. Crea 47 tablas `grc_*`, 20 índices observados en PostgreSQL, permisos, constraints/FKs, inmutabilidad, scheduler, escalamiento y exports. No contiene `DROP`, `TRUNCATE`, `DELETE FROM` ni `ALTER TABLE ... DROP`, y no modifica datos históricos.

## Gate PostgreSQL efímero

```bash
npm run phase1:migration-check
```

`scripts/phase1/check-phase1-migration.sh` crea una base vacía desechable (servidor local completo o contenedor PostgreSQL 16), aplica el fixture base y la migración dos veces, y valida tablas, índices, constraints, FKs validadas, función/triggers de inmutabilidad, 18 permisos, nueve frameworks/versiones y `grc_phase1_core = false`. Un `trap` detiene y elimina exclusivamente el entorno temporal.

Resultado local del 2026-07-22: dos aplicaciones exitosas; 47 tablas GRC, 20 índices, 305 constraints, 157 FKs validadas, cero operaciones destructivas. Evidencia: `artifacts/fase-1/phase1-migration-check.json`.

## Aplicación QA

Usar el wrapper backend del deploy oficial. Si se aplica manualmente en QA:

```bash
test "${EXPECTED_ENV}" = "qa"
psql "${QA_DATABASE_URL}" -v ON_ERROR_STOP=1 -f database/migrations/20260722_phase1_grc_core.sql
```

No ejecutar contra producción desde una rama ni almacenar `QA_DATABASE_URL` en el repositorio. El rollback operacional consiste en deshabilitar el feature flag y preparar una migración compensatoria revisada; no se eliminan tablas ni historia.
