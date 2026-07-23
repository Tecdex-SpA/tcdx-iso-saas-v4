# Fase 1 - Migración del núcleo GRC

## Archivo y política

`database/migrations/20260722_phase1_grc_core.sql` es aditiva, transaccional y deny-by-default. Crea 47 tablas `grc_*`, 20 índices observados en PostgreSQL, permisos, constraints/FKs, inmutabilidad, scheduler, escalamiento y exports. No contiene `DROP`, `TRUNCATE`, `DELETE FROM` ni `ALTER TABLE ... DROP`, y no modifica datos históricos.

## Gate PostgreSQL efímero

```bash
npm run phase1:migration-check
```

`scripts/phase1/check-phase1-migration.sh` resuelve todos los paths desde su propia ubicación, comprueba antes de iniciar PostgreSQL que la migración, el writer y `tests/fixtures/phase1-base-schema.sql` existen y son legibles, y usa `grep` POSIX para el control destructivo, sin depender de `rg`. Crea una base vacía desechable sobre PostgreSQL 16 (servidor local completo o contenedor con puerto efímero), aplica el fixture base y la migración dos veces, y valida tablas, índices, constraints, FKs validadas, función/triggers de inmutabilidad, 18 permisos, nueve frameworks/versiones y `grc_phase1_core = false`. Un `trap` detiene el servidor y elimina el contenedor y el directorio temporal incluso ante errores, informando cualquier fallo de limpieza.

El fixture base está versionado explícitamente pese a la regla global `*.sql`. Es un contrato sintético mínimo, no un dump ni un seed de aplicación: declara únicamente las tablas, columnas, FKs y roles preexistentes que la migración Fase 1 referencia (`tenants`, `users`, RBAC, módulos, auditoría, evidencias, jobs, controles, auditorías, hallazgos y acciones). No contiene secretos, credenciales, datos reales ni contenido de tenants. El repositorio no tiene una cadena de migraciones SQL que construya ese baseline completo; las migraciones históricas disponibles presuponen el esquema de aplicación, por lo que este fixture mantiene el gate aislado sin inventar funcionalidad GRC.

Resultado local del 2026-07-22: dos aplicaciones exitosas; 47 tablas GRC, 20 índices, 305 constraints, 157 FKs validadas, cero operaciones destructivas. Evidencia: `artifacts/fase-1/phase1-migration-check.json`.

## Aplicación QA

Usar el wrapper backend del deploy oficial. Si se aplica manualmente en QA:

```bash
test "${EXPECTED_ENV}" = "qa"
psql "${QA_DATABASE_URL}" -v ON_ERROR_STOP=1 -f database/migrations/20260722_phase1_grc_core.sql
```

No ejecutar contra producción desde una rama ni almacenar `QA_DATABASE_URL` en el repositorio. El rollback operacional consiste en deshabilitar el feature flag y preparar una migración compensatoria revisada; no se eliminan tablas ni historia.
