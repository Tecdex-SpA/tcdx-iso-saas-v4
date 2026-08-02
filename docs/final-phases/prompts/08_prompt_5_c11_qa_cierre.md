# Prompt 5-C11 — QA integral y cierre de Fase 5

## Rol

Actúa como release owner, principal QA engineer, SRE y revisor independiente de seguridad GRC.

## Contexto y objetivo

Valida integralmente Fase 5 contra los criterios C1-C10. No implementes nuevas capacidades; corrige causas raíz de regresiones dentro del alcance y produce evidencia suficiente para una decisión de cierre sin afirmaciones no probadas.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase5/c11-qa-closeout
```

Registra SHA actual y exige worktree limpio. Verifica acceso QA sin imprimir secretos.

## Restricciones

- No skips, errores suprimidos, mocks de auth/tenant ni datos reales.
- No ampliar alcance a Fase 6.
- No declarar cierre con bloqueo runtime, deuda alta/crítica o cleanup incompleto.
- No producción, merge ni deploy desde este prompt.

## Alcance

Ejecutar el plan de 150 casos, regresión de Fases 3/4/5, migraciones, PostgreSQL, API, frontend, navegador, artefactos, jobs, seguridad, tenant A/B, accesibilidad, rendimiento, observabilidad, backup/restore QA y revisión adversarial.

## Modelo de datos y migración

No diseñar nuevas entidades. Aplicar migraciones en base efímera y QA autorizada, verificar ledger/checksum/idempotencia/inmutabilidad/rollback, constraints, índices y cleanup. Corregir solo defectos demostrados.

## Backend y frontend

- Backend: contratos, autorizaciones, cálculos, jobs, snapshots, lineage, artefactos y errores.
- Frontend: flujos críticos completos, consistencia multicanal, estados, responsive, accesibilidad y ausencia de detalle técnico primario.

## Seguridad, permisos, capabilities y límites

Ejecutar matriz positiva/negativa/cross-tenant, platform-admin, archivos, descargas, jobs y concurrencia de límites. Confirmar que un tenant sin capability permanece bloqueado.

## Jobs y operación

Verificar scheduler, retry, timeout, dead letter, replay, idempotencia, métricas, alertas y correlation ID. Cleanup por manifest y cero procesos huérfanos.

## Pruebas y CI

CI debe incluir checks deterministas locales; runtime QA queda protegido post-deploy. Ejecutar suites completas sin omitidos, artefactos reales, WCAG/performance medidos y `git diff --check`. Registrar comandos, versiones, SHA, totales y reintentos.

## Documentación

Completar matriz de aceptación, ledger, closeout, runbooks, evidencia browser/artifact/runtime, riesgos, rollback y procedimiento de deploy/validación posterior. No afirmar producción validada si no se ejecutó.

## Criterios de cierre

- todos los casos P0 y P1 pasan;
- cero hallazgos críticos/altos;
- consistencia multicanal real;
- tenant isolation y RBAC verificados;
- migraciones/backup/restore QA pasan;
- cleanup completo;
- revisión independiente aprueba.

## Salida obligatoria

Estado `READY_FOR_REVIEW` o `NOT_READY`, SHA, comandos/resultados, casos por suite, E2E, PostgreSQL, artefactos, seguridad, accesibilidad, rendimiento, cleanup, hallazgos, bloqueos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR contra `main` solo si la evidencia está completa. No merge, no deploy y no iniciar Fase 6.
