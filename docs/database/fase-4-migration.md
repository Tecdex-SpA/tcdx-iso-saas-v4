# Fase 4 - Migración comercial

Migración: `database/migrations/20260729_phase4_commercial_product.sql`.

Runner: `scripts/phase4/apply-phase4-migration.js`.

Uso:

```bash
npm run phase4:migration:checksum
MIGRATION_DATABASE_URL='<url administrativa>' npm run phase4:migration:preflight
MIGRATION_DATABASE_URL='<url administrativa>' npm run phase4:migration:apply
```

`MIGRATION_DATABASE_URL` es obligatoria para DDL. No se usa `DATABASE_URL` como fallback. El runner calcula checksum SHA-256, usa advisory lock, registra `schema_migrations`, valida postcondiciones y no imprime credenciales.
