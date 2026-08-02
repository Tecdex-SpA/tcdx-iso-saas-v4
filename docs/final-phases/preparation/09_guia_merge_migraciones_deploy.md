# Guía de merge, migraciones y deploy desde el Mac

## 1. Alcance de este PR

La rama `docs/final-phases-audit-and-execution-design` es exclusivamente documental. No agrega ni modifica migraciones, runners, backend, frontend, AI Engine, infraestructura o scripts de deploy. Por lo tanto, fusionar este PR no exige un deploy para cambiar el runtime.

Esta guía describe el procedimiento seguro para el próximo release que sí deba desplegarse. El único comando oficial de despliegue continúa siendo:

```bash
./scripts/deploy-vms.sh
```

No se deben aplicar migraciones manualmente antes de ese comando. El script sincroniza el SHA exacto en backend, ejecuta preflight y apply de todos los runners registrados y solo después reinicia servicios.

## 2. Condiciones para fusionar

Antes del merge:

1. PR aprobado y checks GitHub Actions verdes.
2. Rama sin commits ajenos al alcance documental.
3. Sin conflictos con `main`.
4. Confirmación explícita de que no se requiere migración por este PR.
5. Merge realizado por el responsable autorizado; no usar force push.

Después del merge, verificar desde el Mac:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git rev-parse origin/main
git remote get-url origin
```

Requisitos: status vacío, ambos SHA iguales y origin `https://github.com/Tecdex-SpA/tcdx-iso-saas-v4.git`.

## 3. Migraciones que ejecuta hoy el deploy oficial

`scripts/deploy-vms.sh` registra tres runners y los ejecuta en este orden:

| Orden | Runner | Migration IDs gestionados |
|---:|---|---|
| 1 | `scripts/phase3/apply-phase3-migration.js` | `20260728_phase3_operational_grc`, `20260729_phase3_operational_onboarding`, `20260730_universal_excel_import` |
| 2 | `scripts/phase4/apply-phase4-migration.js` | `20260729_phase4_commercial_product` |
| 3 | `scripts/phase5/apply-phase5-migration.js` | `20260729_phase5_data_metrics_bi_reporting`, `20260730_phase5_tenant_shell_grc_data_integration`, `20260730_phase5_5_official_math_governance`, `20260730_phase5_5_snapshot_contract_hotfix` |

Para cada runner, el script ejecuta primero `--preflight` y luego `--apply`. Los runners usan `public.schema_migrations`, checksum SHA-256, advisory lock, estado y postcondiciones. Una migración `applied` con el mismo checksum se reutiliza; un checksum distinto para una migración aplicada detiene el proceso. Un estado `failed` puede reintentarse con el DDL corregido y el runner correspondiente.

No editar manualmente `schema_migrations`, no cambiar checksums y no alterar SQL ya aplicado. Una corrección posterior se implementa como forward migration.

## 4. Preparación adicional antes del único comando

### 4.1 Ventana y recuperación

Registrar antes de iniciar:

- SHA a desplegar;
- responsable y ventana;
- último backup verificado, fecha y checksum;
- procedimiento de rollback de código;
- contacto para base de datos y disponibilidad de las tres VMs.

Un backup no verificado no se considera recuperable. No ejecutar restore como parte del deploy normal.

### 4.2 Acceso a hosts

Desde el Mac:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 tecdex@bk-v4.tcdx.int 'echo backend-reachable'
ssh -o BatchMode=yes -o ConnectTimeout=10 tecdex@www-v4.tcdx.int 'echo frontend-reachable'
ssh -o BatchMode=yes -o ConnectTimeout=10 tecdex@ai-v4.tcdx.int 'echo ai-reachable'
```

No continuar si un host no responde de forma estable.

### 4.3 Archivo administrativo de migración

El backend espera, por defecto:

```text
/home/tecdex/.config/tcdx/migration.env
```

Debe pertenecer al usuario `tecdex`, tener modo `600` o `400` y definir `MIGRATION_DATABASE_URL`. Verificar sin imprimir su contenido:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 tecdex@bk-v4.tcdx.int '
  set -Eeuo pipefail
  f="$HOME/.config/tcdx/migration.env"
  test -r "$f"
  mode="$(stat -c "%a" "$f")"
  owner="$(stat -c "%U" "$f")"
  test "$mode" = 600 -o "$mode" = 400
  test "$owner" = "$(id -un)"
  set -a
  source "$f"
  set +a
  test -n "${MIGRATION_DATABASE_URL:-}"
  unset MIGRATION_DATABASE_URL
  printf "migration-env=ready mode=%s owner=%s\n" "$mode" "$owner"
'
```

No usar `cat`, `set -x`, `env`, `printenv` ni comandos que expongan la URL.

La conexión debe usar un rol administrativo de migración con ownership/DDL. `tecdex_user` permanece como usuario DML/runtime. No transferir ownership al usuario runtime ni otorgarle privilegios globales.

Si se usa temporalmente `postgres`, la credencial debe rotarse y el archivo debe eliminarse después del cierre. La opción recomendada es un rol de migración dedicado con secreto protegido y política de rotación.

### 4.4 Validación local mínima

Antes de desplegar el release aprobado:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
test "$(git branch --show-current)" = main
test -z "$(git status --porcelain)"
git fetch origin --prune
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
bash -n scripts/deploy-vms.sh
npm run phase3:migration:checksum
npm run phase4:migration:checksum
npm run phase5:migration:checksum
```

Los comandos de checksum no acceden a producción. Conservar la salida como evidencia del SHA sin incluir secretos.

## 5. Ejecución oficial

Desde el checkout estable del Mac:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
./scripts/deploy-vms.sh
```

Orden interno esperado:

1. preflight local de ruta, rama `main`, worktree, origin y SHA;
2. preflight SSH, repositorios, wrappers y servicios en backend, AI Engine y frontend;
3. sincronización del backend al SHA exacto, sin reiniciar;
4. Fase 3 `--preflight` y `--apply`;
5. Fase 4 `--preflight` y `--apply`;
6. Fase 5 `--preflight` y `--apply`;
7. deploy/reinicio backend;
8. deploy/reinicio AI Engine;
9. build/deploy/reinicio frontend;
10. health checks locales en las tres VMs.

No ejecutar procesos paralelos ni abrir una segunda instancia del deploy.

## 6. Qué hacer si falla

### Falla antes de desplegar servicios

Si falla sincronización, preflight o migración, el script termina antes del backend/AI/frontend. No parchear la VM ni editar el ledger. Corregir la causa, confirmar mismo SHA y rerun del comando oficial; la idempotencia evita repetir migraciones aplicadas.

### Checksum distinto en estado applied

Detener. No sustituir el SQL aplicado ni modificar el checksum. Crear una forward migration revisada, agregarla al runner correcto, probarla en PostgreSQL temporal y desplegar un nuevo SHA.

### Estado failed

Conservar el mensaje sanitizado, identificar la incompatibilidad, corregir mediante nuevo SHA y reintentar. El runner puede reemplazar el ledger `failed` durante el reintento; nunca tratarlo como `applied`.

### Falla de wrapper después de migraciones

Las migraciones confirmadas permanecen aplicadas. Resolver el wrapper/servicio y rerun del comando oficial con el mismo SHA. Los runners deben informar `already applied` o `pending=none`.

### Repositorio remoto sucio o SHA distinto

Detener e investigar. No usar reset destructivo ni descartar cambios sin autoría confirmada.

### Salud pública 502

Esperar de forma acotada y revisar servicio/recursos. No cambiar código por una caída transitoria. El estado final aceptable es login `200` y endpoint protegido sin sesión `401`.

## 7. Validación posterior

### 7.1 Salud pública

```bash
curl -sS --max-time 10 -o /dev/null -w 'login=%{http_code}\n' https://tcdx-iso.tecdex.net/login
curl -sS --max-time 10 -o /dev/null -w 'api_auth_me=%{http_code}\n' https://tcdx-iso.tecdex.net/api/auth/me
```

Esperado:

```text
login=200
api_auth_me=401
```

### 7.2 Servicio, SHA y worktree por host

```bash
ssh tecdex@bk-v4.tcdx.int '
  systemctl is-active tecdex-backend.service &&
  cd /home/tecdex/tcdx-iso-saas-v4 &&
  git rev-parse HEAD &&
  test -z "$(git status --porcelain)"
'

ssh tecdex@www-v4.tcdx.int '
  systemctl is-active tcdx-frontend.service &&
  cd /home/tecdex/tcdx-iso-saas-v4 &&
  git rev-parse HEAD &&
  test -z "$(git status --porcelain)"
'

ssh tecdex@ai-v4.tcdx.int '
  systemctl is-active ai-engine.service &&
  cd /home/tecdex/tcdx-iso-saas-v4 &&
  git rev-parse HEAD &&
  test -z "$(git status --porcelain)"
'
```

Los tres SHA deben coincidir con `origin/main` y el worktree de cada host debe estar limpio.

### 7.3 Revalidación segura de migraciones

El deploy ya ejecuta postcondiciones. Si se requiere evidencia adicional, repetir solo los preflights en backend, sin imprimir la conexión:

```bash
ssh tecdex@bk-v4.tcdx.int '
  set -Eeuo pipefail
  cd /home/tecdex/tcdx-iso-saas-v4
  set -a
  source "$HOME/.config/tcdx/migration.env"
  set +a
  node scripts/phase3/apply-phase3-migration.js --preflight
  node scripts/phase4/apply-phase4-migration.js --preflight
  node scripts/phase5/apply-phase5-migration.js --preflight
  unset MIGRATION_DATABASE_URL
'
```

El resultado esperado es preflight correcto y ninguna migración pendiente. No volver a ejecutar `--apply` manualmente si el deploy finalizó correctamente.

## 8. Cierre de credencial y evidencia

Después de confirmar migraciones, servicios y SHA:

1. si la cuenta fue temporal, rotar la contraseña por el canal administrativo aprobado;
2. eliminar el archivo temporal de migración sin mostrarlo;
3. confirmar que los servicios no reciben `MIGRATION_DATABASE_URL`;
4. registrar SHA, fecha, responsable, backup, migration IDs/estados, duración, hosts y health;
5. ejecutar la validación funcional definida para el release, separada del deploy;
6. no ejecutar restore salvo incidente aprobado y runbook específico.

## 9. Checklist ejecutivo

```text
[ ] PR aprobado y CI verde
[ ] main local = origin/main
[ ] worktree Mac limpio
[ ] backup verificado y checksum registrado
[ ] tres hosts accesibles
[ ] migration.env protegido y conexión administrativa válida
[ ] checksums locales registrados
[ ] un solo deploy-vms.sh ejecutado desde el Mac
[ ] migraciones Fase 3, 4 y 5 sin pendientes
[ ] backend, AI Engine y frontend activos
[ ] SHA idéntico en Mac y VMs
[ ] login 200 y auth/me 401
[ ] worktrees remotos limpios
[ ] credencial temporal rotada/eliminada
[ ] validación funcional y evidencia cerradas
```
