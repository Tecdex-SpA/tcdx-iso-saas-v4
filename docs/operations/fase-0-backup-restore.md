# Fase 0 — Backup, restore, RPO y RTO

## Seguridad

`scripts/phase0/backup-restore-qa.sh` rechaza producción y exige `EXPECTED_ENV=qa|test|testing|staging`. El nombre de la base fuente también debe contener `qa`, `test`, `testing` o `staging`. La base de restore debe ser distinta y llamarse `tcdx_restore_smoke_*`. La base temporal se elimina mediante trap incluso ante fallo.

El restore es destructivo sobre la base temporal designada. Por esa razón no forma parte del workflow de pull request ni de `phase0-runtime-qa.yml`. Se ejecuta de manera explícita, con autorización operativa y credenciales QA protegidas, después de que el SHA desplegado pase runtime QA.

## Variables

```text
EXPECTED_ENV=qa
QA_DATABASE_URL=postgresql://<user>:<password>@<qa-host>:5432/<qa-db>
RESTORE_DATABASE_URL=postgresql://<user>:<password>@<qa-host>:5432/tcdx_restore_smoke_<id>
BACKUP_DIR=/ruta/externa/segura
```

No versionar ni imprimir las URLs. El operador debe disponer de `pg_dump`, `pg_restore`, `psql`, `createdb` y `dropdb`.

## Orden operativo

1. Aprobar y mergear el PR con CI verde.
2. Actualizar `main` en el Mac.
3. Ejecutar `./scripts/deploy-vms.sh`.
4. Ejecutar `phase0-runtime-qa.yml` para el SHA desplegado y exigir resultado verde.
5. Autorizar y ejecutar el restore QA separado.
6. Revisar checksum, smoke tenant, RPO, RTO y limpieza de la base temporal.
7. Cambiar el ledger a `verified_vm` solo cuando runtime y restore tengan evidencia válida.

## Ejecución y evidencia

```bash
EXPECTED_ENV=qa \
QA_DATABASE_URL='postgresql://...' \
RESTORE_DATABASE_URL='postgresql://.../tcdx_restore_smoke_phase0' \
BACKUP_DIR='/ruta/qa/backups' \
npm run phase0:restore-check
```

El flujo genera dump custom, checksum SHA-256, crea la base temporal, restaura, valida tablas y al menos dos tenants QA distintos, mide RPO como antigüedad del snapshot al iniciar restore y RTO como duración del restore, limpia la base y escribe `artifacts/fase-0/backup-restore-result.json`.

Separar PR, runtime y restore no elimina ni flexibiliza validaciones: ubica cada control en el ambiente donde su evidencia es válida.
