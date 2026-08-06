# Fase 5-C2 — runbook de merge, deploy y auditoría post-deploy

Este runbook se ejecuta solo después de aprobación humana del PR draft. No contiene secretos y no autoriza merge ni deploy por sí mismo.

## 1. Revisión y merge autorizado

1. Confirmar que el PR sigue draft hasta que CI y revisión principal estén verdes.
2. Confirmar que base es `main`, que no incluye 5-C3, infraestructura, rate limiting ni migraciones.
3. Repetir en la rama:

   ```bash
   git status --short
   git diff --check origin/main...HEAD
   npm --prefix backend test
   npm --prefix frontend run lint
   npm --prefix frontend run typecheck
   npm --prefix frontend run build
   npm run phase5-c2:contracts-check
   npm run phase5-c2:security-check
   npm run phase5-c2:postgres
   ```

4. Marcar ready for review y obtener aprobación de Andrés Barouh.
5. Fusionar por el flujo oficial del repositorio, sin auto-merge no supervisado. Registrar el merge SHA.
6. En el clon canónico:

   ```bash
   git switch main
   git fetch origin --prune
   git pull --ff-only origin main
   git status --short
   git rev-parse HEAD
   ```

   El árbol debe estar limpio y HEAD debe coincidir con el merge SHA.

## 2. Deploy oficial

Desde `/Users/andresbarouh/repos/tcdx-iso-saas-v4`, con `main` limpio y solo tras autorización explícita:

```bash
bash -n scripts/deploy-vms.sh
./scripts/deploy-vms.sh
```

No ejecutar scripts residuales que hagan commits. Este cambio no agrega migraciones ni requiere SQL manual. Conservar el log completo, SHA desplegado, hora de inicio/fin y health checks del deploy oficial.

## 3. Auditoría estricta post-deploy

Ejecutar Playwright 1.62.x secuencialmente, un worker, retries 0, contra `https://tcdx-iso.tecdex.net`, con las cuatro cuentas autorizadas. Para cada perfil visitar `/dashboard`, `/evidencias`, `/bi`, `/usuarios` y `/configuracion`. Capturar request URL/method/status, policy headers, consola, hidratación e identidad de `/api/user/me`.

Criterios obligatorios, todos simultáneos:

```text
0 errores de consola
0 HTTP 5xx
0 errores de hidratación
máximo 1 GET /api/me/modules por carga completa
0 GET /api/users para auditores
0 GET /api/dashboards para auditores
0 HTTP 400 en /configuracion
/api/user/me = 200 en ambos tenants
user_id y tenant_id separados
login inválido bloqueado con 429
Retry-After > 0
X-RateLimit-Policy = public_auth_login
```

Para admins, confirmar además máximo una carga inicial de `/api/users` y `/api/dashboards`, operaciones/asociaciones visibles para procesos válidos y ausencia de pérdida del proceso `a6534ef8-2a87-2d80-38bb-bcea295a9a1e`. No ejecutar un burst adicional contra producción fuera de la calibración autorizada; reutilizar el procedimiento estricto aprobado para el control anti-bruteforce.

Publicar evidencia con fecha, SHA desplegado, perfiles, conteos y resultados. Solo entonces declarar el cierre productivo de esta deuda.

## 4. Rollback

Disparadores: cualquier 5xx nuevo, pérdida de aislamiento, acceso administrativo de auditor, regresión de login/rate limit, errores de hidratación persistentes o pérdida de procesos/asociaciones.

1. Detener la auditoría y registrar evidencia; no modificar datos.
2. Identificar el último SHA bueno anterior al merge.
3. Crear un revert explícito del merge en Git mediante PR de emergencia revisado; no usar `reset --hard` ni force-push.
4. Tras autorización, desplegar el revert con `./scripts/deploy-vms.sh`.
5. Repetir health, `/api/user/me`, aislamiento, RBAC y anti-bruteforce.

No hay rollback de base de datos porque este PR no contiene migraciones ni muta datos. No improvisar SQL productivo.

## 5. Desbloqueo de 5-C3

5-C3 permanece bloqueada hasta que merge, deploy y auditoría anterior estén verdes. Después:

```bash
git switch main
git fetch origin --prune
git pull --ff-only origin main
git switch -c phase5/c3-indicators-trust-snapshots
```

No reutilizar la rama `fix/phase5-c2-postdeploy-audit-debt` y no transportar cambios no fusionados.
