# Runbook: gate backup + restore antes de piloto/cliente/migracion

Fecha: 2026-06-10

## Objetivo

Ningun piloto con datos reales, primer cliente asistido o migracion de riesgo debe avanzar sin un backup reciente y un restore-test exitoso en base temporal.

Este runbook no contiene credenciales. Todas las credenciales deben venir de variables de entorno, gestor de secretos o archivo externo al repo.

## Alcance

Incluye:

- Backup DB PostgreSQL.
- Backup uploads/runtime files.
- Checksums.
- Restore-test temporal.
- Smoke test posterior.
- Evidencia minima del restore-test.
- Go/no-go.

Excluye:

- Reinicio de servicios sin aprobacion explicita.
- Migraciones destructivas.
- Subida de backups, dumps, `.env`, llaves o evidencias reales al repo.

## Responsables

- Operador tecnico: ejecuta backup, restore-test y smoke test.
- Responsable proyecto: aprueba go/no-go.
- Responsable seguridad/infra: valida ubicacion externa de backups y rotacion de credenciales si aplica.

## Ubicacion de backups

Guardar backups fuera del repositorio, por ejemplo:

```text
/home/tecdex/backups/
/mnt/backup/tcdx/
s3://<bucket-privado>/<ambiente>/
```

Prohibido:

```text
./backups/
./docs/backups/
./database/dumps/
./qa-results/backups/
```

## Variables esperadas

Ejemplo, no copiar valores reales a archivos versionables:

```bash
export BACKUP_DIR="/home/tecdex/backups"
export UPLOADS_DIR="/home/tecdex/backend/uploads"
export DB_HOST="<db-host>"
export DB_PORT="5432"
export DB_NAME="<db-name>"
export DB_USER="<db-user>"
export DB_PASSWORD="<db-password>"
```

Si se usa `DATABASE_URL`, definirla solo en la sesion del operador o en gestor de secretos.

## Paso 1 - Pre-check

1. Confirmar rama/commit a desplegar.
2. Confirmar que no hay migraciones destructivas.
3. Confirmar espacio disponible en destino externo.
4. Confirmar que `BACKUP_DIR` esta fuera del repo.
5. Confirmar herramientas:

```bash
command -v pg_dump
command -v pg_restore
command -v psql
command -v tar
command -v shasum || command -v sha256sum
```

## Paso 2 - Backup DB y uploads

Dry-run seguro:

```bash
DRY_RUN=true BACKUP_DIR="/home/tecdex/backups" bash scripts/backup-runtime.sh
```

Ejecucion real, solo en entorno autorizado:

```bash
BACKUP_DIR="/home/tecdex/backups" \
UPLOADS_DIR="/home/tecdex/backend/uploads" \
DB_HOST="<db-host>" \
DB_PORT="5432" \
DB_NAME="<db-name>" \
DB_USER="<db-user>" \
DB_PASSWORD="<db-password>" \
bash scripts/backup-runtime.sh
```

El script debe generar:

- Dump PostgreSQL custom (`*.dump`).
- Backup uploads (`uploads_*.tar.gz`) si existe `UPLOADS_DIR`.
- `manifest.txt`.
- Checksums `*.sha256`.
- Tar final si `COMPRESS_FINAL=true`.

## Paso 3 - Verificacion de checksums

Desde el directorio externo de backup:

```bash
find "/home/tecdex/backups" -name "*.sha256" -maxdepth 3 -print
```

Validar segun herramienta disponible:

```bash
sha256sum -c "<archivo>.sha256"
```

o:

```bash
shasum -a 256 -c "<archivo>.sha256"
```

## Paso 4 - Restore-test temporal

No restaurar sobre la DB productiva. El nombre temporal debe comenzar con:

```text
tecdex_saas_restore_test_
```

Dry-run:

```bash
DRY_RUN=true DUMP_FILE="/home/tecdex/backups/<backup>/<db>.dump" bash scripts/restore-test.sh
```

Restore-test real:

```bash
DUMP_FILE="/home/tecdex/backups/<backup>/<db>.dump" \
DB_HOST="<db-host>" \
DB_PORT="5432" \
DB_NAME="<db-name-productiva>" \
DB_USER="<db-user>" \
DB_PASSWORD="<db-password>" \
DROP_TEST_DB=false \
bash scripts/restore-test.sh
```

`DROP_TEST_DB=false` conserva la base temporal para inspeccion. Eliminarla despues de registrar evidencia si no se necesita.

## Paso 5 - Smoke test posterior

Contra ambiente autorizado y sin imprimir tokens:

```bash
bash scripts/qa-security-basic.sh
bash scripts/qa-rbac-basic.sh
bash scripts/qa-cross-tenant-core.sh
```

La suite cross-tenant requiere:

```bash
export API_BASE_URL="<api-url>"
export TENANT_A_ID="<tenant-a>"
export TENANT_B_ID="<tenant-b>"
export TENANT_A_TOKEN="<token-a>"
export TENANT_B_TOKEN="<token-b>"
```

## Paso 6 - Evidencia minima

Registrar fuera del repo o en sistema documental interno:

- Fecha/hora.
- Ambiente.
- Commit desplegado.
- Operador.
- Ruta externa del backup.
- Nombre del dump.
- Resultado checksum.
- Nombre DB temporal restaurada.
- Conteo de tablas reportado por `restore-test.sh`.
- Resultado smoke test.
- Decision go/no-go.

No adjuntar secretos, dumps, backups, tokens ni datos de cliente al repo.

## Go/no-go

Go solo si:

- Backup DB OK.
- Backup uploads OK o justificacion documentada si no aplica.
- Checksums OK.
- Restore-test temporal OK.
- Smoke test post-restore/post-backup OK.
- No hay secretos nuevos en diff.
- Responsable proyecto aprueba.

No-go si:

- Falla dump, checksum o restore-test.
- No se puede ubicar backup fuera del repo.
- Hay dudas de credenciales demo activas.
- Se detecta migracion destructiva no aprobada.
- La suite cross-tenant falla en rutas core.

## Rollback

Si un despliegue o migracion falla:

1. Detener cambios adicionales.
2. No ejecutar `git reset --hard` ni borrar datos.
3. Revertir codigo por branch/commit aprobado si aplica.
4. Restaurar desde backup solo si hay perdida/corrupcion de datos y con aprobacion del responsable.
5. Registrar causa, impacto, comandos usados y resultado.

## Scripts revisados

- `scripts/backup-runtime.sh`: ya valida que `BACKUP_DIR` no este dentro del repo y genera manifest/checksums.
- `scripts/restore-test.sh`: ya impide restaurar sobre DB productiva y exige prefijo seguro para DB temporal.

No se ejecutaron backups ni restore-tests contra produccion durante Sprint 1.
