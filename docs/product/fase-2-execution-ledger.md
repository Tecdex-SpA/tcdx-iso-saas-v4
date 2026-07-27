# Fase 2 — Execution ledger

## Estados

Estados válidos: `pending`, `in_progress`, `verified_local`, `verified_runtime`,
`blocked_external` y `failed`.

## Baseline de ejecución

Baseline registrado el `2026-07-27T16:20:56Z` desde el checkout autorizado
`/Users/andresbarouh/repos/tcdx-iso-saas-v4`.

| Control | Estado | Evidencia |
|---|---|---|
| Fetch remoto | verified_local | `git fetch origin --prune` exitoso |
| Rama y origen | verified_local | `HEAD`, `main` y `origin/main` = `d01c1f4729d0790a0601806e76249c528d14c600`; sin divergencia posterior |
| Worktree Mac inicial | verified_local | Limpio antes de ejecutar gates; rama `main` |
| Backend VM | verified_runtime | SHA `d01c1f4729d0790a0601806e76249c528d14c600`, rama `main`, worktree limpio, `tecdex-backend` activo, root HTTP 200 y endpoint protegido HTTP 401 |
| Frontend VM | verified_runtime | SHA `d01c1f4729d0790a0601806e76249c528d14c600`, rama `main`, worktree limpio, `tcdx-frontend.service` activo y HTTP 200 |
| AI Engine VM | verified_runtime | SHA `d01c1f4729d0790a0601806e76249c528d14c600`, rama `main`, `ai-engine.service` activo y `/health` HTTP 200 |
| Runtime público | verified_runtime | `https://tcdx-iso.tecdex.net/login` HTTP 200 y `/api/auth/me` HTTP 401 sin sesión |
| Evidencia cierre Fase 1 | verified_local | `/tmp/tcdx-phase1-evidence/phase1-d01c1f4729d0-20260727T160350Z`: `VERIFIED_RUNTIME`, targeted 13/13, full 30/30, retries 0 y cleanup `CLEANED` |
| Manifest activo Fase 1 | verified_runtime | Ausente en `artifacts/fase-1/phase1-qa-manifest.json` de backend VM |
| Residuos principales Fase 1 | verified_runtime | Workflows QA = 0, solicitudes de evidencia QA = 0 y bootstrap runs del run cerrado = 0 |
| Triggers de inmutabilidad | verified_runtime | Los tres triggers esperados existen con `tgenabled = O` |
| Credenciales/configuración QA temporal | verified_runtime | Archivo protegido temporal `phase1-runtime-qa.env` ausente después del cierre; no se imprimieron secretos |
| Gate consolidado Fase 1 | verified_local | `npm run phase1:check` exitoso: contratos, migraciones PostgreSQL 16 aplicadas dos veces, integración, cleanup idempotente, permisos, tenant, backend, frontend, build y discovery de 30 pruebas |

### Condición preexistente de AI Engine

La VM de AI Engine tiene tres archivos históricos no rastreados:

- `ai-engine/requirements.from-ai-v3-freeze.txt`
- `ai-engine/requirements.from-local-v3-backup-freeze.txt`
- `ai-engine/requirements.from-v3-freeze.txt`

No alteran el SHA desplegado, no pertenecen al manifest ni al run QA de Fase 1 y
no se borran sin una autorización específica de limpieza. Esta condición no está
presente en las VMs de backend o frontend.

## Progreso

| Etapa | Estado | Evidencia de cierre |
|---|---|---|
| A. Preflight | verified_local | Baseline anterior y gate consolidado exitoso |
| B. Remediación inicial de dependencias | verified_local | Backend, runtime frontend y sync agent en 0; excepción dev-only documentada; tests, lint y build exitosos |
| C. Arquitectura común | verified_local | Migración repetible: 44 tablas/extensiones, 22 permisos, FK/checks/índices, relaciones, eventos y reglas |
| D. Privacidad | verified_local | Actividad versionada, DPIA, solicitudes, consentimientos, brechas, 360, reglas y métricas |
| E. Incidentes | verified_local | Severidad explicable, lifecycle, timeline, impacto, notificación, causa, postmortem, eficacia y cierre |
| F. TPRM | verified_local | Proveedor, servicios, contratos, cuestionario, evaluación humana, monitoreo y salida |
| G. Portal de proveedores | verified_local | Token/sesión hash, DTO limitado, archivos allowlist/hash/dedupe y aislamiento |
| H. Framework de conectores | verified_local | Cifrado, OAuth/refresh, scheduler, webhook HMAC, cursor, retry/dead-letter, idempotencia y salud |
| I. Adapters prioritarios | verified_local | Microsoft, Google Workspace, Jira/Confluence y GitHub en sandbox determinista; live sujeto a OAuth externo |
| J. Vistas, métricas y reportes | verified_local | Cuatro vistas 360, overview/portafolios/salud, ejecutivo global y 11 reportes tenant-scoped |
| K. QA completa | in_progress | Gate local consolidado completo: PostgreSQL, contratos, reglas, backend, lint/build de 57 rutas y discovery exacto 16 targeted/46 full; runtime pendiente |
| L. Seguridad de dependencias final | verified_local | Auditorías finales: backend 0, frontend producción 0 y sync agent 0; excepción dev-only de ESLint/minimatch documentada con mitigación |
| M. Commit y push | pending | Pendiente |
| N. Deploy oficial | pending | Pendiente |
| O. Runtime closeout | pending | Pendiente |
| P. Cleanup y evidencia | pending | Pendiente |
