# Baseline ejecutivo final de cleanup B.8

Fecha: 2026-06-12

Rama: `chore/cleanup-b8-final-baseline`

Commit base: `f58b9e7`

## Resumen

Las etapas de cleanup consolidaron la superficie oficial del producto sin
alterar logica productiva en B.8. El baseline final mantiene diez rutas cliente
MVP, archiva cuatro redirects legacy fuera del App Router y conserva rutas
activas por dependencias o valor funcional pendiente. El cleanup pre-Phase 7
retiro `/dashboard-v2` y sus contratos de compatibilidad.

## Que se limpio

- Artefactos QA historicos y basura de sistema operativo fueron retirados en
  etapas anteriores.
- La navegacion cliente MVP quedo separada de rutas internas, plataforma,
  dealer y enterprise.
- Redirects legacy desacoplados dejaron de generar paginas Next.
- El guard oficial quedo reproducible con y sin `rg`.

## Que se archivo

`/dashboard-kpi`, `/centro-control-iso`, `/command-center-iso` y
`/auditor-iso` se preservan en `frontend/legacy-pages-archive/`.

## Que se mantuvo

- `/ia` por funcionalidad aun no cubierta por IA Compliance.
- `/ejecucion-iso` como enterprise/post-MVP.
- `/documentos` hasta revisar su contrato backend e integraciones.
- Superficies platform, dealer e internas con sus guards actuales.

## Que no se toco

Backend, DB, AI Engine, agent, OAuth Google/Zoho, Sync Agent, IA traces,
external lookup, rutas de reportes, scripts operativos, SQL, deploy, backup,
restore y archivos `.env`.

## Estado final del App Router

- Build Next: sin contrato por conteo fijo de paginas; validar por rutas
  canonical y guards.
- Superficie MVP cliente: 10 rutas.
- Redirects archivados: 4 rutas fuera del App Router.
- Rutas retenidas activas: 3, ocultas para cliente MVP.
- Guard oficial: `scripts/qa/qa-official-surface.sh`.

## Estado final por frente

| Frente | Estado final | Decision | Proxima fase |
| ------ | ------------ | -------- | ------------ |
| Frontend MVP surface | Cerrado | Diez rutas oficiales protegidas por guard. | Gobierno de superficie continuo. |
| Frontend legacy archived | Cerrado con retencion | Cuatro redirects fuera de App Router y `src`. | Definir periodo de retencion/borrado. |
| `/dashboard-v2` | Retirado | App route, componentes, API, service y validadores V2 retirados antes de Phase 7. | Ninguna. |
| `/ia` | Bloqueado | `blocked_pending_mvp_merge`. | Fase IA. |
| `/ejecucion-iso` | Retenido | `kept_enterprise_post_mvp`. | Decision producto enterprise. |
| `/documentos` | Bloqueado | `blocked_by_backend_contract_review`. | Documentos/integraciones. |
| `report.routes.js` | Pendiente | No montada; conservada por duda operativa. | Backend routes. |
| Scripts legacy | Pendiente | Referencias y usos reales no resueltos. | Fase scripts. |
| `database/qa-fixes` | Diferido | No ejecutar ni mezclar con migraciones normales. | Fase DBA. |
| Seeds/migraciones destructivas | Diferido | Requieren clasificacion y runbook DBA. | Fase DBA. |
| OAuth Google/Zoho | Diferido | Superficie sensible de auth, state y tenant. | Seguridad/integraciones. |
| Sync Agent | Diferido | Token, pairing, uploads y tenant binding. | Seguridad/integraciones. |
| IA traces/external lookup | Diferido | Riesgo de exposicion de contexto y datos tenant. | Seguridad IA. |
| Warnings frontend | Aceptado temporalmente | 636 warnings preexistentes, 0 errores. | Calidad frontend. |
| `env-check` local | Aceptado temporalmente | WARN por variables no cargadas, 0 FAIL. | Baseline de entorno/CI. |

## Estado final de QA y validaciones ejecutadas

| Validacion | Resultado B.8 |
| ---------- | -------------- |
| Guard oficial con `rg` | PASS |
| Guard oficial con PATH minimo | PASS |
| Inventario cleanup | PASS |
| Frontend lint | PASS, 0 errores y 636 warnings |
| Next build | PASS; validar por rutas canonical y guards, no por conteo fijo de paginas |
| TypeScript | PASS |
| Backend test | PASS |
| AI compile | PASS |
| `env-check.sh` | WARN aceptable, 46 WARN y 0 FAIL |
| `git diff --check` | PASS |

Las validaciones se ejecutaron el 2026-06-12 sin cargar `.env`, instalar
dependencias, iniciar servicios ni ejecutar SQL.

## Deuda remanente

La deuda detallada y priorizada se mantiene en
`docs/cleanup/cleanup-debt-register-b8.md`. Ninguna deuda debe resolverse
mezclando cambios de IA, integraciones, backend, DBA, scripts y calidad
frontend en una sola fase.

## Proximas fases recomendadas

1. Fusion IA.
2. Documentos e integraciones.
3. Backend routes.
4. DBA.
5. Scripts.
6. Seguridad e integraciones.
7. Calidad frontend.
