# Hotfix - Acceso a subflujos funcionales MVP

Fecha: 2026-06-15
Rama: `hotfix/tenant-admin-functional-subflows-access`

## Problema

Despues del deploy de cleanup B.8 e IA.3-C, usuarios tenant con rol `admin`
podian entrar a las rutas principales MVP, pero al abrir tarjetas internas desde
`/cumplimiento-auditoria`, `/riesgos` y `/planes-accion` eran redirigidos a
`/dashboard`.

## Causa raiz

Las rutas internas enlazadas desde esos modulos estaban declaradas en
`INTERNAL_CLIENT_HIDDEN_ROUTES`. `AppLayout` trataba toda ruta de esa lista como
bloqueada para usuarios tenant no platform/dealer y ejecutaba fallback al home
del rol, que para `admin` tenant es `/dashboard`.

La lista cumplia el objetivo de mantenerlas fuera del sidebar, pero tambien
bloqueaba subflujos funcionales que deben seguir accesibles desde modulos MVP.

## Nota de base local

Codex no pudo hacer pull por SSH/publickey; se trabajo sobre `main` local
autorizado por el responsable, validando commits base requeridos:

| Commit | Estado |
|---|---|
| B.8 `05de4d4` | Presente en `main`. |
| IA.2 `cfb9ec2` | Presente en `main`. |
| Merge IA.2 `c139bf4` | Presente en `main`. |
| IA.3-C `93f7959` | Presente en `main` mediante merge `61eb803`. |

No se hizo `git pull`, `git push`, cambios SSH, deploy ni cambios remotos desde
Codex.

## Modulos afectados

| Modulo MVP | Ruta principal | Subflujos afectados |
|---|---|---|
| Cumplimiento y Auditoria | `/cumplimiento-auditoria` | `/diagnostico`, `/health`, `/controles`, `/soa`, `/ciclo-vida`, `/auditorias`, `/hallazgos`, `/no-conformidades` |
| Riesgos | `/riesgos` | `/matriz-riesgo`, `/activos` |
| Planes de accion | `/planes-accion` | `/plan-accion`, `/acciones-recomendadas` |

## Rutas restauradas

| Ruta o tarjeta | Ruta destino detectada | Existe `page.tsx` | Bloqueada por guard antes | Bloqueada por permiso antes | Accion |
|---|---|---:|---:|---:|---|
| Diagnostico de cumplimiento | `/diagnostico` | Si | Si | No | Restaurar como subflujo compliance. |
| Salud del sistema | `/health` | Si | Si | No | Restaurar como subflujo compliance. |
| Controles | `/controles` | Si | Si | No | Restaurar como subflujo compliance. |
| SoA | `/soa` | Si | Si | No | Restaurar como subflujo compliance. |
| Ciclo de vida ISO | `/ciclo-vida` | Si | Si | No | Restaurar como subflujo compliance. |
| Auditorias | `/auditorias` | Si | Si | No | Restaurar como subflujo compliance. |
| Hallazgos | `/hallazgos` | Si | Si | No | Restaurar como subflujo compliance. |
| No conformidades | `/no-conformidades` | Si | Si | No | Restaurar como subflujo compliance. |
| Matriz de riesgos | `/matriz-riesgo` | Si | Si | No | Restaurar como subflujo risks. |
| Activos | `/activos` | Si | Si | No | Restaurar como subflujo risks. |
| Plan de accion | `/plan-accion` | Si | Si | No | Restaurar como subflujo action_plans. |
| Acciones recomendadas | `/acciones-recomendadas` | Si | Si | No | Restaurar como subflujo action_plans. |

## Rutas que siguen bloqueadas

Se mantienen bloqueadas como hidden/post-MVP o rutas internas no solicitadas:

- `/dashboard-v2`
- `/documentos`
- `/ejecucion-iso`
- `/ia`
- `/ia-auditor`
- `/auditorias/ia`
- `/auditorias/ejecucion`
- `/administrar-kpis`
- rutas platform: `/admin-saas`, `/empresas`
- rutas dealer: `/dealer`, `/cotizador`, `/prefacturacion`

## Roles autorizados

Los subflujos funcionales MVP quedan disponibles para los grupos tenant:

| Roles reales | Grupo MVP | Acceso |
|---|---|---|
| `admin`, `tenant_admin`, `admin_cumplimiento`, `compliance_admin` | `admin` | Permitido |
| `auditor` | `auditor` | Permitido |
| `operativo`, `responsable_area`, `area_owner` | `area_owner` | Permitido |

## Roles bloqueados

| Roles reales | Grupo MVP | Estado |
|---|---|---|
| `viewer`, `cliente`, `client`, `read_only`, `readonly`, `solo_lectura`, `ejecutivo` | `executive` | Bloqueado en subflujos operativos. Conserva acceso a rutas principales permitidas. |
| `dealer` | `dealer` | Bloqueado fuera de consola dealer. |
| rol desconocido | `unknown` | Bloqueado por falta de feature. |

## Implementacion

- Se agrego `FUNCTIONAL_MVP_SUBFLOW_ROUTES` en `mvpPermissions.ts`.
- Se agregaron features internas:
  - `compliance.functional_subflows.read`
  - `risks.functional_subflows.read`
  - `action_plans.functional_subflows.read`
- `AppLayout` conserva el guard global, pero no redirige los subflujos
  funcionales por estar en `INTERNAL_CLIENT_HIDDEN_ROUTES`.
- Las tarjetas de los modulos MVP usan las nuevas features internas para no
  mostrarse a roles executive.
- `Sidebar` no agrega items nuevos; solo marca el modulo padre como activo
  cuando el usuario esta dentro de un subflujo.

## Validaciones

| Validacion | Resultado |
|---|---|
| `git status --short --branch` | PASS; rama `hotfix/tenant-admin-functional-subflows-access`, cambios esperados antes del commit. |
| `bash scripts/qa/qa-official-surface.sh` | PASS. |
| `PATH="/usr/bin:/bin:/usr/sbin:/sbin" bash scripts/qa/qa-official-surface.sh` | PASS. |
| `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS. |
| `cd frontend && npm run lint` | PASS; 0 errores, 636 warnings conocidos. |
| `cd frontend && npm run check` | PASS; Next build con 42 paginas. |
| `cd frontend && npx tsc --noEmit --pretty false` | PASS; sin salida de error. |
| `git diff --check` | PASS. |

## Validacion manual

No se ejecuto validacion manual con usuario real desde Codex porque no hay una
sesion autenticada disponible en el entorno. La verificacion pendiente en
staging/local debe cubrir:

- admin tenant accede desde tarjetas a los 12 subflujos restaurados;
- viewer/cliente queda bloqueado o redirigido en `/matriz-riesgo`, `/activos`,
  `/acciones-recomendadas` y `/no-conformidades`;
- ninguno de los subflujos aparece como item principal nuevo del Sidebar.

## Riesgos remanentes

- No se ejecuto validacion manual con usuario real desde Codex porque no hay
  sesion/browser autenticado.
- Los subflujos siguen fuera del sidebar por diseno; usuarios pueden entrar por
  tarjeta o deep link autorizado.
- `/auditorias/ejecucion` y `/auditorias/ia` siguen bloqueadas; si producto las
  requiere como continuidad inmediata de `/auditorias`, debe abrirse una fase
  separada con criterio de permisos propio.
