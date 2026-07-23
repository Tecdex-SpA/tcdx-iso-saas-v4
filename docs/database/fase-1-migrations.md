# Fase 1/1R - Migraciones

## Orden

1. `database/migrations/20260722_phase1_grc_core.sql`
2. `database/migrations/20260723_phase1r_operational_closeout.sql`

La segunda migración es aditiva: crea `grc_tenant_configurations`, `grc_bootstrap_runs`, su índice, agrega `metadata` a mappings y registra nueve raíces identificadoras sin copiar cláusulas licenciadas. No habilita módulos ni crea datos de negocio.

## Gate PostgreSQL 16

```bash
npm run phase1:migration-check
npm run phase1:postgres-integration
```

El script resuelve rutas desde su ubicación, comprueba todos los archivos antes de iniciar, usa `grep`/`awk` portables y no depende de `rg`. Levanta PostgreSQL 16 real, aplica el fixture contractual y cada migración dos veces, valida tablas, índices, constraints, FKs, permisos, frameworks, funciones, triggers y flag `false`. El `trap` elimina servidor/contenedor y temporales también ante error.

`tests/fixtures/phase1-base-schema.sql` es un contrato sintético mínimo de las dependencias reales preexistentes; no es un dump, no contiene credenciales, tenants reales ni datos productivos. La integración agrega datos sintéticos dentro de la base desechable.

## Operación

Precondiciones: backup verificado, SHA aprobado, PostgreSQL 16 y `ON_ERROR_STOP=1`. Aplicar en el orden anterior. Validar tablas/configuración y mantener el flag apagado hasta activación tenant autorizada. El rollback operacional es deshabilitar el flag y, si se requiere esquema, emitir una migración compensatoria revisada. Se prohíben `DROP`, `TRUNCATE`, eliminación de historia y edición silenciosa de migraciones desplegadas.
