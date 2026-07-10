# Backup and restore runbook

## Objetivo

Dejar un procedimiento minimo, verificable y seguro para respaldar PostgreSQL y
probar restore sin tocar la base productiva de TCDX ISO SaaS v4.

## Alcance

- Aplica a pilotos Credex y Tecdex.
- Aplica a backup logico PostgreSQL con `pg_dump -Fc`.
- Aplica a restore smoke test sobre una base temporal.
- No autoriza restore sobre `tecdx_saas`.
- No autoriza cambios de infraestructura, cron productivo ni cargas masivas.

## Variables requeridas

Exportar las variables antes de ejecutar scripts. No cargar `backend/.env` con
`source`.

```bash
export PGHOST=<db-host>
export PGPORT=5432
export PGDATABASE=tecdx_saas
export PGUSER=<db-user>
export PGPASSWORD=<db-password>
export BACKUP_DIR=/tmp/tcdx-backups
```

`PGPASSWORD` no debe imprimirse ni guardarse en documentos. Si se usa `.pgpass`,
validar permisos del archivo antes.

## Backup logico

Ejecutar desde el repo estable:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
bash scripts/ops/backup-postgres.sh
```

El script:

- Verifica `pg_dump`.
- Verifica readiness con `pg_isready` o `psql`.
- Crea `BACKUP_DIR` si no existe.
- Genera un archivo `*.dump` en formato custom.
- No usa `--clean`.
- Genera checksum `*.sha256` si `sha256sum` o `shasum` existe.
- Imprime ruta y tamano del backup sin imprimir secretos.

## Verificacion de archivo

```bash
ls -lh "$BACKUP_DIR"
pg_restore -l "$BACKUP_DIR/<archivo>.dump" >/tmp/tcdx-backup-list.txt
wc -l /tmp/tcdx-backup-list.txt
```

Si existe checksum:

```bash
cd "$BACKUP_DIR"
shasum -a 256 -c <archivo>.dump.sha256
```

En Linux con `sha256sum`:

```bash
cd "$BACKUP_DIR"
sha256sum -c <archivo>.dump.sha256
```

## Restore smoke test

Nunca restaurar sobre `tecdx_saas`. Probar en una base temporal:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
bash scripts/ops/restore-postgres-smoke-test.sh "$BACKUP_DIR/<archivo>.dump"
```

El script crea una base con nombre seguro:

```text
tcdx_restore_smoke_YYYYMMDD_HHMMSS
```

Luego ejecuta `pg_restore` y valida conteos si existen estas tablas:

```text
tenants
users
tenant_controls
control_soa
control_soa_assessments
control_soa_change_log
evidences
findings
action_plans
audits
```

## Limpieza controlada

Por defecto, la base temporal queda disponible para inspeccion. El script
imprime el comando manual de limpieza:

```bash
dropdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "<restore_test_db>"
```

Para eliminarla automaticamente al terminar, se exige variable explicita:

```bash
DROP_RESTORE_TEST_DB=true bash scripts/ops/restore-postgres-smoke-test.sh "$BACKUP_DIR/<archivo>.dump"
```

## Frecuencia y retencion

- Backup recomendado: diario durante piloto y antes de cada deploy.
- Restore smoke test recomendado: semanal y antes de cambios de mayor riesgo.
- Retencion sugerida: 7 diarios, 4 semanales y 3 mensuales, ajustable por
  capacidad y politica contractual.

## Copia fuera de VM

Guardar una copia fuera de la VM de DB:

- almacenamiento interno seguro de Tecdex;
- bucket privado con cifrado y acceso limitado;
- repositorio de backups offline controlado por Operaciones.

No guardar backups en Git ni en carpetas publicas del frontend.

## Advertencias

- No ejecutar restore sobre produccion.
- No usar `--clean` contra produccion.
- No borrar `tecdx_saas`.
- No compartir dumps sin cifrado y control de acceso.
- No documentar passwords ni URLs con credenciales.
