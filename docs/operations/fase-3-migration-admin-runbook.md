# Fase 3 - Migración administrativa

## Propósito

Validar `20260728_phase3_operational_grc` y aplicar el forward-fix
`20260729_phase3_operational_onboarding` con un usuario administrativo separado del
runtime, sin exponer credenciales ni repetir DDL.

## Controles del runner

`scripts/phase3/apply-phase3-migration.js`:

- exige `MIGRATION_DATABASE_URL`; no acepta `DATABASE_URL` como fallback;
- usa una conexión `pg.Client` independiente del pool backend;
- valida usuario, ownership, creación de tablas/índices, catálogos y `pgcrypto`;
- toma un advisory lock de sesión antes de crear/consultar el ledger;
- calcula SHA-256 de ambos archivos SQL y conserva el checksum productivo
  `2dd9376e49937795bc7dbd03332536e26f4e8bfbc883d731818dda9fa620bb50`
  para la migración base;
- rechaza un checksum distinto para el mismo `migration_id`;
- ejecuta DDL, postcondiciones y estado `applied` en una transacción;
- registra `running`, `applied` o `failed` en `public.schema_migrations`;
- libera el lock y cierra la conexión incluso ante error;
- sanitiza errores y nunca imprime URL, contraseña ni token.

El ledger contiene:

```text
migration_id
checksum
applied_at
applied_by
duration_ms
status
details
```

No contiene secretos.

## Preparar la credencial temporal

Ejecutar en `bk-v4` con el usuario de deploy. La entrada oculta no queda escrita en
el historial:

```bash
umask 077
mkdir -p "$HOME/.config/tcdx"
read -rsp "MIGRATION_DATABASE_URL: " MIGRATION_DATABASE_URL
printf '\n'
printf 'MIGRATION_DATABASE_URL=%q\n' "$MIGRATION_DATABASE_URL" \
  > "$HOME/.config/tcdx/migration.env"
unset MIGRATION_DATABASE_URL
chmod 600 "$HOME/.config/tcdx/migration.env"
```

No mostrar el archivo ni ejecutar comandos que impriman su contenido.

## Ejecución oficial

Desde el Mac, con `main` limpio y sincronizado:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
./scripts/deploy-vms.sh
```

El wrapper realiza secuencialmente:

1. sincronización del SHA backend sin reiniciar;
2. carga protegida de `MIGRATION_DATABASE_URL`;
3. `npm run phase3:migration:preflight`;
4. `npm run phase3:migration:apply`;
5. deploy/reinicio backend;
6. deploy AI Engine y frontend;
7. validación de servicios.

Un error en los pasos 1-4 detiene todo el deploy. La migración base debe devolver
`status=already_applied`; el forward-fix devuelve `status=applied` en su primera
ejecución y `status=already_applied` en las siguientes.

## Ejecución administrativa aislada

Solo para recuperación controlada, después de sincronizar el SHA aprobado:

```bash
cd /home/tecdex/tcdx-iso-saas-v4
set -a
source "$HOME/.config/tcdx/migration.env"
set +a
npm run phase3:migration:preflight
npm run phase3:migration:apply
unset MIGRATION_DATABASE_URL
```

La salida permitida contiene únicamente metadata de privilegios, migration ID,
checksum, estado y duración. No copiar una salida que contenga información distinta.

## Cierre de credencial

Después de obtener `status=applied` o `status=already_applied` y verificar las
postcondiciones:

1. rotar inmediatamente la contraseña temporal de `postgres` mediante el canal
   administrativo aprobado;
2. eliminar `$HOME/.config/tcdx/migration.env`;
3. confirmar que ningún servicio de aplicación contiene `MIGRATION_DATABASE_URL`;
4. comprobar sin imprimir coincidencias que shell history y logs no contienen URLs;
5. verificar backend, frontend, AI Engine y validación web Fase 3.

No reutilizar la contraseña temporal.

## Estado objetivo

Crear un rol dedicado de migración:

```text
rol de migración dedicado -> ownership y DDL
tecdex_user                -> DML y runtime
```

No ejecutar `ALTER TABLE ... OWNER TO tecdex_user`, no otorgar `GRANT ALL` al
runtime y no configurar `postgres` como credencial permanente de la aplicación.
