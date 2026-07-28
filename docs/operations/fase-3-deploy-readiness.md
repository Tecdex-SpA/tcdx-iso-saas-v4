# Fase 3 - Preparación de deploy

## Separación de roles

- `MIGRATION_DATABASE_URL`: conexión administrativa usada solo por scripts de migración.
- `DATABASE_URL` y variables `DB_*`: conexión DML del backend; nunca se usan como
  fallback para DDL.
- El hotfix admite temporalmente `postgres`. El estado objetivo es un rol dedicado de
  migraciones con ownership/DDL, manteniendo `tecdex_user` exclusivamente para runtime.
- No transferir ownership al usuario runtime ni otorgarle privilegios globales.

## Orden

1. Confirmar `main` limpio y SHA aprobado.
2. Crear temporalmente en `bk-v4` el archivo protegido
   `/home/tecdex/.config/tcdx/migration.env`, propiedad de `tecdex` y modo `600`.
3. Ejecutar desde el Mac `./scripts/deploy-vms.sh`.
4. El deploy sincroniza el SHA backend sin reiniciar el servicio.
5. Valida la presencia de `MIGRATION_DATABASE_URL` y ejecuta el preflight administrativo.
6. El runner toma advisory lock, verifica checksum/ledger y aplica Fase 3 si corresponde.
7. Solo después del estado `applied` o `already_applied` se ejecuta el wrapper backend.
8. Luego actualiza AI Engine y frontend mediante sus wrappers oficiales.
9. Ejecuta las validaciones post-deploy incluidas y el plan web Fase 3.

Ante cualquier fallo de migración, `set -Eeuo pipefail` detiene el deploy antes de
reiniciar backend o intervenir AI Engine/frontend. Reejecutar el deploy es seguro:
una migración aplicada con el mismo checksum no repite DDL; un checksum distinto para
el mismo `migration_id` bloquea la ejecución.

## Dependencias

- Fase 1 core aplicada.
- Fase 2 integrada aplicada.
- `pgcrypto`.
- Tenant `70000000-0000-0000-0000-000000000701`.
- `MIGRATION_DATABASE_URL` administrativa disponible solo durante la migración.

## Riesgos

- La extensión de checks de `grc_phase2_relations` requiere que los datos existentes
  respeten los tipos declarados por Fase 2.
- La migración agrega índices; debe observarse tiempo de aplicación en producción.
- No ejecutar loaders ni seeds junto con la migración.
- No conservar la credencial temporal después de aplicar y verificar la migración.

## Forward-fix

El runner ejecuta el DDL y las postcondiciones en una transacción. Ante error,
PostgreSQL revierte el cambio y registra un intento `failed` sin guardar secretos.
Los ajustes posteriores deben usar una nueva migración forward-fix; no borrar datos,
resetear el esquema ni modificar el checksum de una migración registrada.
