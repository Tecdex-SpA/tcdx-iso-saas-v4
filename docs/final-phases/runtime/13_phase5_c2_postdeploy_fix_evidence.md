# Fase 5-C2 — evidencia local de corrección post-deploy

Fecha: 2026-08-06. Rama: `fix/phase5-c2-postdeploy-audit-debt`. Esta evidencia demuestra cierre local; no declara cierre productivo.

## Conteos antes y después

| Ruta / control | Perfil | Auditoría post-deploy anterior | Resultado local corregido |
|---|---|---:|---:|
| todas las rutas auditadas, `GET /api/me/modules` | 4 perfiles | 2 por carga | máximo 1 por carga completa |
| `/bi`, `GET /api/dashboards` | tenant 1/2 auditor | 2 y ambos 403 | 0 |
| `/bi`, `GET /api/dashboards` | tenant 1/2 admin | dos consumidores | 1 carga inicial |
| `/bi`, catálogo oficial | 4 perfiles | 3 | 1 request single-flight por carga |
| `/usuarios`, `GET /api/users` | tenant 1/2 auditor | 1 y 403 timing-dependiente | 0 |
| `/usuarios`, `GET /api/users` | tenant 1/2 admin | podía duplicarse | 1 carga inicial |
| `/configuracion`, links de `a6534ef8-2a87-2d80-38bb-bcea295a9a1e` | tenant 2 admin | 1 y 400 | 1 y 200 en contrato browser; validación/query backend verde |

## Matriz browser dirigida

Comando:

```bash
cd frontend
npx playwright test --config=playwright.phase5-c2-postdeploy.config.ts
```

Resultado: `5 passed`, Chromium, un worker, retries 0. Perfiles: tenant 1 admin/auditor y tenant 2 admin/auditor. Rutas por perfil: `/dashboard`, `/evidencias`, `/bi`, `/usuarios`, `/configuracion`. El quinto escenario navega `/dashboard` → `/evidencias` y confirma una solicitud de módulos por cada carga completa.

La prueba intercepta el límite HTTP del navegador, no reemplaza los componentes: monta las páginas, layouts, guards, sidebars, workspace, cockpit, builder y panel de configuración reales. Verifica Authorization distinto por perfil, respuestas tenant-scoped, conteo de requests, ausencia de HTTP >=400, ausencia de `RBAC_DENIED`, errores de recurso e hidratación. Los fixtures usan únicamente las identidades de auditoría autorizadas como referencia de prueba.

## Pruebas focalizadas

```bash
node frontend/tests/unit/accessBootstrap.test.mjs
node backend/src/services/tenantProcessLinks.service.test.js
```

Resultados:

- `accessBootstrap tests passed`: dos consumidores concurrentes = 1 request; misma sesión reutiliza resultado; token de otro tenant = request nueva; invalidación explícita = request nueva.
- `tenantProcessLinks.service tests passed`: el ID legacy observado es aceptado, entrada no hexadecimal es rechazada, la query usa `$1::uuid` para tenant y `$2::uuid` para proceso, tenant B no puede ver el proceso de tenant A.

## Gates ejecutados

```text
npm --prefix backend test                                      PASS
npm --prefix frontend run lint                                PASS
npm --prefix frontend run typecheck                           PASS
npm --prefix frontend test                                    PASS
npm --prefix frontend run build                               PASS
npm run phase5-c2:contracts-check                             PASS
npm run phase5-c2:security-check                              PASS
npm run phase5-c2:scripts-check                               PASS
npm run phase5-c2:migration:checksum                          PASS
npm run phase5-c2:unit                                        PASS (32 assertions)
npm run phase5-c2:postgres                                    PASS
node backend/src/services/tenantProcessLinks.service.test.js  PASS
node frontend/tests/unit/accessBootstrap.test.mjs             PASS
git diff --check                                              PASS
```

PostgreSQL informó `VERIFIED_PHASE5_C2_POSTGRES`, incluyendo aislamiento tenant, idempotencia, inmutabilidad y rechazo de checksum divergente. El suite backend completo incluye y aprobó `authenticatedRateLimit.middleware.test.js`, `publicRateLimit.middleware.test.js` y RBAC. No se editó ningún archivo de rate limiting ni la policy `public_auth_login`.

El runner histórico `scripts/phase0/check-tenant-isolation.js` requiere credenciales externas (`API_BASE_URL` y cuentas A/B) no presentes en el entorno. No se sustituyó por un skip: el aislamiento relevante se cubrió localmente en PostgreSQL, en el test parametrizado del servicio y en la matriz browser de tokens/tenants separados. La validación estricta contra runtime público queda reservada al gate post-deploy.

## Contratos preservados

- RBAC backend sigue negando `/api/users` y `/api/dashboards` a roles no autorizados; la UI deja de emitir la solicitud prohibida.
- Todas las queries de process links conservan tenant derivado de JWT y parámetros tipados; no se relajó el tenant scope.
- El contrato de `uuid` PostgreSQL se acepta sin exigir bits RFC de versión/variante que el schema no exige.
- Login anti-bruteforce, `Retry-After`, buckets, límites y clasificación `public_auth_login` no cambiaron.
- No hubo SQL productivo, migración nueva, deploy, merge ni inicio de 5-C3.

## Estado de cierre

Deuda local conocida: 0. Cierre productivo pendiente de auditoría post-deploy: SÍ.
