# Fase 5 — Operations runbook

Migración:

```bash
npm run phase5:migration:checksum
MIGRATION_DATABASE_URL=postgresql://... npm run phase5:migration:preflight
MIGRATION_DATABASE_URL=postgresql://... npm run phase5:migration:apply
```

Deploy oficial:

```bash
./scripts/deploy-vms.sh
```

El deploy ejecuta Fases 3, 4 y 5 por allowlist declarativa, luego backend, AI Engine, frontend y validaciones.

Validación local:

```bash
npm run phase5:check
```
