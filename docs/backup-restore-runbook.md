# Backup & Restore Runbook — TCDX ISO SaaS

## Objetivo

Definir un procedimiento operativo para respaldar y probar restauración del SaaS ISO/TCDX sin tocar datos productivos de forma destructiva.

## Qué respalda

- Base de datos PostgreSQL en formato custom `.dump`.
- SQL plano opcional.
- Carpeta de uploads del backend.
- Manifiesto de ejecución.
- Versiones de runtime.
- Hashes SHA256.

## Qué no respalda automáticamente

- `.env` reales, salvo procedimiento manual fuera de Git.
- Secretos.
- Certificados privados.
- Backups históricos.
- Object Storage externo.

## Script principal

```bash
BACKUP_DIR=/home/tecdex/backups \
ENV_FILE=/home/tecdex/backend/.env \
UPLOADS_DIR=/home/tecdex/backend/uploads \
bash ./scripts/backup-runtime.sh
```

Modo dry-run:

```bash
DRY_RUN=true bash ./scripts/backup-runtime.sh
```

## Variables relevantes

| Variable | Uso |
|---|---|
| `BACKUP_DIR` | Destino fuera del repo |
| `ENV_FILE` | Archivo `.env` a cargar sin imprimir secretos |
| `BACKUP_DB` | `true/false` |
| `BACKUP_UPLOADS` | `true/false` |
| `BACKUP_PLAIN_SQL` | genera SQL plano adicional |
| `UPLOADS_DIR` | carpeta uploads |
| `DATABASE_URL` | conexión PostgreSQL opcional |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | conexión PostgreSQL por partes |

## Restore-test seguro

Nunca restaurar sobre `tecdex_saas`.

```bash
DUMP_FILE=/home/tecdex/backups/tcdx-backup-YYYYMMDD_HHMMSS/tecdex_saas_YYYYMMDD_HHMMSS.dump \
ENV_FILE=/home/tecdex/backend/.env \
bash ./scripts/restore-test.sh
```

Eliminar DB temporal al terminar:

```bash
DROP_TEST_DB=true DUMP_FILE=/ruta/backup.dump ENV_FILE=/home/tecdex/backend/.env bash ./scripts/restore-test.sh
```

Dry-run:

```bash
DRY_RUN=true bash ./scripts/restore-test.sh
```

## Inventario operativo

```bash
bash ./scripts/collect-runtime-inventory.sh
```

Salida:

```text
qa-results/runtime-inventory-YYYYMMDD_HHMMSS.txt
```

## Backup de `.env` fuera de Git

Ejecutar manualmente en cada VM:

```bash
TS="$(date '+%Y%m%d_%H%M%S')"
mkdir -p /home/tecdex/secure-backups/env-$TS
cp /home/tecdex/backend/.env /home/tecdex/secure-backups/env-$TS/backend.env
chmod 600 /home/tecdex/secure-backups/env-$TS/*.env
```

No copiar esta carpeta al repo.

## Integridad

Cada archivo relevante debe tener SHA256:

```bash
sha256sum archivo.tar.gz
sha256sum archivo.dump
```

En macOS puede usarse:

```bash
shasum -a 256 archivo.tar.gz
```

## Periodicidad recomendada

- DB: diario.
- Uploads: diario o incremental.
- `.env`: cada cambio.
- Restore-test: mensual o antes de migración.
- Inventario: después de deploy mayor.

## Errores comunes

| Error | Acción |
|---|---|
| `pg_dump: command not found` | Instalar cliente PostgreSQL |
| `password authentication failed` | Revisar `.env` fuera de Git |
| `UPLOADS_DIR no existe` | Validar ruta `/home/tecdex/backend/uploads` |
| backup dentro del repo | Cambiar `BACKUP_DIR` a `/home/tecdex/backups` |
| restore intenta usar DB productiva | Usar `RESTORE_TEST_DB=tecdex_saas_restore_test_*` |

## Rollback

1. Detener escritura de usuarios.
2. Respaldar estado actual antes de restaurar.
3. Restaurar dump validado en ventana controlada.
4. Restaurar uploads.
5. Reiniciar backend.
6. Ejecutar QA security, RBAC e IA Auditor.
