# Fase 0 — Backup/restore runbook

## Fuentes existentes

- `scripts/ops/backup-postgres.sh`
- `scripts/ops/restore-postgres-smoke-test.sh`
- `scripts/backup-runtime.sh`
- `scripts/restore-test.sh`
- `docs/operations/backup-restore-runbook.md`

## Regla de seguridad

Nunca restaurar sobre producción. Usar base temporal aislada, checksum, smoke tests y destrucción controlada posterior.
