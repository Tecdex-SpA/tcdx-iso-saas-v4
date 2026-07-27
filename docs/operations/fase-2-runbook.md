# Fase 2 — Runbook operativo

## Gates locales

1. Ejecutar tests backend, lint y build frontend.
2. Ejecutar `scripts/phase2/check-phase2-migration.sh`.
3. Ejecutar `scripts/phase2/check-phase2-postgres.sh`.
4. Ejecutar audits de backend, frontend runtime y sync agent.
5. Confirmar discovery dirigido de 16 pruebas y full de 46.
6. Confirmar `git diff --check` y ausencia de secretos.

## Deploy

El despliegue parte exclusivamente del Mac, en `main`, con worktree limpio y
SHA publicado. El único comando permitido es:

```bash
./scripts/deploy-vms.sh
```

Después se verifica SHA, servicio y health de backend, frontend y AI Engine; la
migración se comprueba en PostgreSQL antes de habilitar el módulo de QA.

## Runtime QA

Se crea un manifest por pasada con `phase2-qa-manifest.js`, se habilita
`grc_phase2_integrated` de forma controlada y se ejecutan targeted y full sin
retries. La pasada full incluye las 30 pruebas de Fase 1 y las 16 de Fase 2.

## Cleanup

`cleanup-phase2-qa.js` exige:

- `PHASE2_QA_ENV=qa`;
- manifest del tenant;
- `PHASE2_QA_CONFIRM=CLEAN_PHASE2_QA:<run-id>`.

El borrado usa advisory lock, transacción, IDs exactos, ownership tenant y
prefijo QA. Elimina relaciones/eventos/alertas/métricas/auditoría derivados,
raíces y archivos exactos del portal. Debe ejecutarse dos veces: la primera
devuelve `CLEANED` y la segunda `ALREADY_CLEAN`. Los triggers deben permanecer
enabled.

## Fallos

Ante fallo de E2E se conserva reporte/traza, se ejecuta el mismo cleanup
manifest-scoped y no se despliega un nuevo SHA hasta corregir y repetir todos
los gates. Un fallo live de tercero queda como ejecución fallida/dead-letter,
sin ocultar el error ni exponer secretos.
