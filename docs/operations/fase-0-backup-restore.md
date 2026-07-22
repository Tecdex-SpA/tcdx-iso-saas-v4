# Fase 0 — Backup, restore, RPO y RTO

## Seguridad

`scripts/phase0/backup-restore-qa.sh` rechaza producción y exige `EXPECTED_ENV=qa|test|testing|staging`. El nombre de la base fuente también debe contener `qa`, `test`, `testing` o `staging`. La base de restore debe ser distinta y llamarse `tcdx_restore_smoke_*`. La base temporal se elimina mediante trap incluso ante fallo.

## Variables

```text
EXPECTED_ENV=qa
QA_DATABASE_URL=postgresql://<user>:<password>@<qa-host>:5432/<qa-db>
RESTORE_DATABASE_URL=postgresql://<user>:<password>@<qa-host>:5432/tcdx_restore_smoke_<id>
BACKUP_DIR=/ruta/externa/segura
```

No versionar ni imprimir las URLs. El usuario debe disponer de `pg_dump`, `pg_restore`, `psql`, `createdb` y `dropdb`.

## Ejecución y evidencia

```bash
bash scripts/phase0/backup-restore-qa.sh
```

El flujo genera dump custom, checksum SHA-256, crea la base temporal, restaura, valida tablas y al menos dos tenants QA distintos, mide RPO como antigüedad del snapshot al iniciar restore y RTO como duración del restore, limpia la base y escribe `artifacts/fase-0/backup-restore-result.json`.
