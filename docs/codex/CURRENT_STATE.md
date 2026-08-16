# CURRENT_STATE — TCDX ISO SaaS V4

Actualizado: 2026-08-16
Repositorio: `Tecdex-SpA/tcdx-iso-saas-v4`
Remote `main` verificado: `3341f69c328fd1f9999fbbf2d57e2b3c5b783361`
Fuente: GitHub branch `main` consultada durante CONT-00.

## Estado del programa

- CONT-00: DONE (bootstrap documental preparado; materialización local/commit a cargo del usuario).
- PRE-UI: IN_PROGRESS.
- UI enterprise: INITIAL / trabajo temprano.
- Fase 6 ampliada 6.8–6.14: BLOCKED por `PRE_UI_DATA_TRUTH_GATE` donde corresponda.
- Fase 7: NOT_STARTED.

## Baseline reciente confirmado

- PR #90: mergeado en `main`; commit `3341f69c328fd1f9999fbbf2d57e2b3c5b783361`.
- PR #91 `fix(metrics): reconcile control risk and maturity sources`: OPEN, no mergeado.
- PR #91 head: `e913d67deb9499e4a6a371d99278f1832763138d`.
- PR #91 aborda CONTROL-EFFECT, RISK-INHERENT y MATURITY.
- No se declara CI completo PASS para PR #91 desde este bootstrap.

## Ownership fijo

- CODEX A / `codex`: Data / Backend / GRC core.
- CODEX B / `tecdex2-codex`: AI / Knowledge / RAG / Regulatory.
- CODEX C / `tecdex3-codex`: Frontend / UX / Product E2E.

## Política de validación

`CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`

Codex NO ejecuta automáticamente full CI, full regression, repeated test cycles, push, merge ni deploy.
El usuario realiza CI/merge/deploy y decide si un fallo requiere un work package correctivo.

## Próxima acción

1. Materializar estos artefactos en el repositorio local.
2. Commit documental manual.
3. Reconciliar estado local de PR #91/branch antes de PUI-01.
4. Ejecutar el siguiente work package READY de `WORK_QUEUE.md` sin repo-wide scan.

## Handoff relevante

- `docs/codex/handoffs/CONT-00.md`
