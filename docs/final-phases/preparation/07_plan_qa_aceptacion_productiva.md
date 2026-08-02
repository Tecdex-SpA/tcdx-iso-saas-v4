# Plan QA y aceptación productiva

Estado actual: diseño completo; ejecución runtime `NO_VERIFICADO_RUNTIME`.

## Ambientes y evidencia

| Ambiente | Uso | Datos | Evidencia |
|---|---|---|---|
| Local | Unit, contratos, lint/build | Fixtures sintéticos | JUnit/JSON y logs sanitizados |
| PostgreSQL efímero | Migraciones, integración, tenant/partner isolation | Tenants A/B y partners A/B sintéticos | Schema checksum, test report |
| QA VM | E2E, jobs, archivos, reportes, conectores sandbox | Manifiesto QA identificable | Playwright, artifacts, cleanup report |
| Provider sandbox | OAuth/scopes/sync live controlado | Cuentas sandbox del tenant | Run IDs, health, mapping y revoke |
| Producción read-only | 5-C1 baseline | Metadatos mínimos autorizados | SHA, fecha, conteos sin contenido sensible |
| UAT | Aceptación Credex/Tecdex/Demo | Casos acordados por tenant | Acta por rol y flujo |

## Suites obligatorias: 150 casos

Cada suite contiene diez casos. Los IDs son contratos de aceptación para los prompts de ejecución.

| Rango | Suite | Casos explícitos | Gate |
|---|---|---|---|
| QA-001–010 | Baseline e inventario | migraciones; ledger/checksum; tablas/columnas; FK/check/index; rutas montadas; endpoints; páginas; jobs; capabilities/limits; consumidores | 100% clasificado sin afirmar runtime por archivo |
| QA-011–020 | Contratos de fuente | versión publicada; mapping exacto; campo alternativo; estado alternativo; severidad; timezone; unidad; schema incompatible; source unavailable; checksum distinto | Sin fallback silencioso ni SQL configurable |
| QA-021–030 | Observaciones y datasets | tenant scope; período; duplicado; null; rango; referencia huérfana; fecha futura; coverage; freshness; hash idempotente | Dataset válido o error funcional trazable |
| QA-031–040 | Indicadores | cálculo conocido; unidad; precisión; redondeo; zero division; unmeasured; dependencia; suficiencia; recalculation; formula version | Mismo resultado determinista |
| QA-041–050 | Trust y snapshots | completeness; accuracy; consistency; freshness; lineage; coverage; unknown; snapshot immutable; comparison; checksum | Trust explica componentes; unknown no es normal |
| QA-051–060 | Centros y vistas 360 | Centro Ejecutivo; Operativo; Riesgo 360; Control 360; Cumplimiento 360; Data Center; filtros; drill-down; acción; detalle técnico por rol | Valor/unidad/período/trust coherentes y sin fórmula visible |
| QA-061–070 | Impacto y acción | edge válido; self-loop; ciclo; profundidad; propagación; priority score; decisión; plan; re-test; before/after | Ningún cierre sin verificación |
| QA-071–080 | Encuestas | definición; versión; branching; no aplica; campaña; recipient; respuesta; scoring; Cronbach válido/inaplicable; consecuencia aprobada | Flujo E2E sin respuesta ausente como cero |
| QA-081–090 | Assurance | definición; población; sample size; selección; ejecución; evidence; exception; finding/action; approval; re-test | Inconclusive no cuenta pass; independencia válida |
| QA-091–100 | Pérdidas y continuidad | gross/recovery; net no negativo; currency isolation; expected loss; VaR assumptions; Monte Carlo seed; availability; MTBF/MTTR; SLA timezone; RTO/RPO unit | Sin mezcla de monedas ni supuestos ocultos |
| QA-101–110 | BI y reporting | dashboard CRUD; widget oficial; filtros; snapshot; report definition; PDF; DOCX; XLSX; approval; schedule/segunda emisión | Artefactos válidos y misma medición que origen |
| QA-111–120 | Seguridad comercial | auth; RBAC positive; RBAC negative; capability off; entitlement off; limit; downgrade; tenant IDOR; file/report IDOR; audit/request_id | Backend autoritativo y sin fuga |
| QA-121–130 | Integration Hub | install; secret reference; OAuth state; scopes; full sync; incremental/checkpoint; duplicate hash; mapping preview/publish; DLQ/replay; health/usage | Dato externo llega a observación sin secreto expuesto |
| QA-131–140 | MSP | partner A/B; tenant A/B; engagement; assignment; access request/approval; expiry; support session; integration assignment; offboarding; audit/transfer | Engagement no equivale a permiso; acceso revocado |
| QA-141–150 | Operación y UX | health/ready/live; logs correlation; alert; backup; restore/RPO/RTO; performance; accessibility; responsive; cleanup; Git/SHA/service state | Cero procesos/datos QA, servicios y repos limpios |

## Consistencia entre canales

Una medición seleccionada se consulta en Portal GRC, vista de dominio, dashboard, PDF, DOCX y XLSX. Deben coincidir valor, unidad, fórmula interna/version, período, coverage, trust y calculation run/snapshot. El usuario de negocio ve nombre funcional; la metadata técnica queda en artifact metadata y panel autorizado.

## Matriz de navegadores y viewports

- Chromium, Firefox y WebKit en rutas críticas.
- 1600×900, 1440×900, 1366×768, 1280×800, 1024×768, 768×1024 y 390×844.
- Cero superposición, scroll horizontal global, acciones perdidas o modales fuera de viewport.

## Rendimiento y resiliencia

| Escenario | Volumen | Criterio inicial a confirmar en C1 |
|---|---:|---|
| Mediciones | 100.000 | consulta paginada p95 <1,5 s; job sin timeout |
| Observaciones | 1.000.000 | ingestión idempotente y consulta indexada |
| Acciones | 10.000 | cola operativa p95 <1,5 s |
| Tenants | 500 | ningún query global sin scope |
| Integraciones concurrentes | 100 | backpressure, retries y DLQ estables |
| Partners | 50 | aislamiento y dashboard paginado |
| Reporte grande | 100 páginas / 50k filas XLSX | async, progreso, checksum y cleanup |

Los SLO definitivos se fijan después de medir baseline; no se relajan para aprobar.

## Seguridad

- OWASP: IDOR, SQLi, XSS, CSRF, SSRF, upload, signed URLs, rate limits y headers.
- Secret scanning y dependency scanning sin `audit fix --force`.
- Manipulación de `tenant_id`, `partner_id`, entity ID, report ID, snapshot ID y job ID.
- Access session partner con propósito, duración, revocación y audit.
- Connector tokens nunca aparecen en body de lectura, logs, artifacts o errores.

## CI bloqueante

1. Diff hygiene y secret/debt scans.
2. Backend unit/check/test y PostgreSQL integration.
3. Frontend lint/typecheck/test/build.
4. Migraciones idempotentes y checksums.
5. Contratos y matrices RBAC/capability.
6. Playwright discovery en PR; E2E local/QA según costo y environment.
7. Artifact validation, tenant/partner isolation y cross-channel consistency.
8. Runtime QA post-deploy manual-dispatch; restore separado y protegido.

## UAT productiva

Cada tenant valida solo sus datos y roles. El acta registra SHA, fecha, ambiente, usuario/rol, caso, resultado, evidencia, defecto y aprobación. Fase 5 exige Credex, Tecdex y Demo; Fase 6 exige al menos un sandbox autorizado por provider implementado; Fase 7 exige partner A/B y tenant A/B sintéticos antes de cualquier cliente real.

## Baseline 5-C1 completada localmente

La ejecución local usó PostgreSQL descartable, tenants sintéticos A/B, Chromium real y artefactos reales. La evidencia no sustituye UAT productiva ni pruebas de VM. Los resultados, escenarios y límites están en `docs/final-phases/runtime/` y deben usarse como precondición, no como reemplazo, de 5-C11.

## Criterio de cierre

150/150 casos aplicables pasan; cero skipped/retry oculto; todos los findings P0/P1 cerrados; cleanup exitoso; credenciales temporales revocadas; CI verde; UAT aprobada; backup/restore medido; documentación coincide con resultados reales.
