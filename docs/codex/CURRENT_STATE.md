# CURRENT_STATE — TCDX ISO SaaS V4

Actualizado: 2026-08-17
Repositorio: `Tecdex-SpA/tcdx-iso-saas-v4`
Remote `main` verificado: `3341f69c328fd1f9999fbbf2d57e2b3c5b783361`
Fuente: GitHub branch `main` consultada durante CONT-00.

## Estado del programa

- CONT-00: DONE (bootstrap documental materializado en `main` antes de PUI-01).
- PUI-01: DONE (source ownership cerrado localmente; validación manual/CI pendiente por diseño).
- PUI-02: DONE (escala/unidad y normalización canónica cerradas localmente para el alcance focal; validación manual/CI pendiente por diseño).
- PUI-03: DONE (semantica canonica de conteos y poblaciones cerrada localmente para Math Governance focal; validación manual/CI pendiente por diseño).
- PUI-04: DONE (validación manual externa confirmada sobre `main/deploy` commit `7a9df185f06be031757d0d79f25aa59b27a53bbf`; focal test y deploy OK reportados por responsable del proyecto).
- PUI-05: DONE (normalización canónica/versionada de estados por dominio cerrada localmente para Math Governance focal; validación manual/CI pendiente por diseño).
- PUI-06: REVIEW (fallback legacy gobernado implementado localmente; el único test focal permitido falló por aserción PUI-06 corregida después, rerun manual pendiente).
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
- PUI-01 se ejecutó sobre branch `fix/pui-01-source-contract-ownership` desde base local `033236f11a140530316c02ad81676a226efc15cb`.
- PUI-01 confirmó que `sourceResolver.test.js` pasa localmente en el checkout actual y cerró la ambigüedad documental de CONTROL-EFFECT: el `score` agregado no se expande a dimensiones D/I/O/E.
- PUI-01 confirmó source ownership para `control_assurance_evidence`, `risk_register_controls` y `maturity_assessments` en `docs/codex/CONTRACTS_REGISTRY.md`.
- PUI-02 se ejecutó sobre branch `fix/pui-02-scale-unit-contract` desde base local `57e8264cfbc94a7895cf21252b85665deea731d0`.
- PUI-02 verificó PUI-01 integrado con SHA distinto al reportado: `810b6c42e8d06572283a243da102b38adca1a5b1` no es ancestro, pero existen `control_assurance_evidence` v3, anti-fabricación D/I/O/E y `docs/codex/handoffs/PUI-01.md`.
- PUI-02 eliminó normalización por magnitud para los paths focales y agregó `scale_metadata` gobernado a contratos/resolver/snapshot.
- PUI-03 se ejecutó sobre branch `fix/pui-03-count-population-semantics` desde base local `d9800d9d38926bf92b0fd08b0f1e528616e2e5bf`.
- PUI-03 verificó PUI-02 integrado con SHA distinto al reportado: `2ec20c5a28c09f833bd0d017cd8bc4054200f367` no es ancestro, pero existe `docs/codex/handoffs/PUI-02.md`, los contratos contienen `scale_metadata`, `maturity_assessments` está en v3 y las heurísticas eliminadas por PUI-02 no reaparecen en los paths focales.
- PUI-03 agregó contrato de conteos canonico: `received`, `eligible`, `usable`, `excluded`, `ineligible`, `eligible_unusable`, `exclusionIssueCount`, `exclusionIssueInstanceCount` y `population_size`.
- PUI-03-HF2 corrigió versionado de fórmula gobernada: `F5_5_CONTROL_EFFECTIVENESS` cambia `1 -> 2` porque PUI-01 modificó metodología serializable; protección de checksum publicada permanece intacta.
- PUI-04 se ejecutó sobre branch `fix/pui-04-temporal-semantics` desde base local `2f6eeb488b869ee5e12e34cbbf6841a5b4f12b0d`.
- PUI-04 agregó `temporal_semantics` gobernado a los 20 source contracts, eliminó el default contractual `created_at` como período genérico y preservó conteos PUI-03 mediante exclusiones temporales auditables.
- PUI-04 cambió versiones de source contracts para no reutilizar payload gobernado publicado; no cambió fórmulas, pesos ni checksums históricos.
- PUI-04 quedó validado externamente en `main/deploy` commit `7a9df185f06be031757d0d79f25aa59b27a53bbf`: `cd backend && node src/services/math-governance/sourceResolver.test.js` reportó `PHASE5_5_SOURCE_RESOLVER_TESTS_OK` y `./scripts/deploy-vms.sh` reportó `DEPLOY V4 FINALIZADO OK`.
- PUI-05 se ejecutó sobre branch `fix/pui-05-status-normalization` desde base local `7a9df185f06be031757d0d79f25aa59b27a53bbf`.
- PUI-05 agregó `status_semantics` gobernado a los 20 source contracts, registry versionado por dominio en Math Governance, exclusiones auditables para `status_unmapped`/`status_not_eligible` y persistencia en `official_formula_source_contracts.metadata`.
- PUI-05 cambió versiones de source contracts para no reutilizar payload gobernado publicado; no cambió fórmulas, pesos, unidades ni precisión.
- PUI-06 se ejecutó sobre branch `fix/pui-06-governed-legacy-fallback` desde base local `90d75b60603fccfc3b4ab0b7f75a9a3e3ef4c1cc`.
- PUI-06 formalizó una política central en `sourceResolver.service.js`: fallback legacy sólo se permite para `primary_absent` o `primary_no_rows` cuando el source code está explícitamente autorizado en `LEGACY_FALLBACK_POLICY_BY_SOURCE`.
- PUI-06 agrega provenance/observabilidad en filas, resultado y snapshot: `fallback_used`, `fallback_reason`, `primary_state`, `primary_source`, `fallback_source`, `fallback_summary` y warning estructurado.
- PUI-06 no modificó source contract payload, fórmulas, pesos, unidades, precisión ni checksums históricos; `CONTRACTS_VERSIONED=[]`.

## Ownership fijo

- CODEX A / `codex`: Data / Backend / GRC core.
- CODEX B / `tecdex2-codex`: AI / Knowledge / RAG / Regulatory.
- CODEX C / `tecdex3-codex`: Frontend / UX / Product E2E.

## Política de validación

`CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`

Codex NO ejecuta automáticamente full CI, full regression, repeated test cycles, push, merge ni deploy.
El usuario realiza CI/merge/deploy y decide si un fallo requiere un work package correctivo.

## Próxima acción

1. Usuario revisa PUI-06 y rerun manualmente `cd backend && node src/services/math-governance/sourceResolver.test.js`.
2. Si el rerun focal/manual pasa, promover PUI-06 a DONE y habilitar PUI-07 desde una nueva sesión/base actualizada; no iniciar PUI-07 desde Codex en esta sesión.

## Handoff relevante

- `docs/codex/handoffs/CONT-00.md`
- `docs/codex/handoffs/PUI-01.md`
- `docs/codex/handoffs/PUI-02.md`
- `docs/codex/handoffs/PUI-03.md`
- `docs/codex/handoffs/PUI-03-HF2.md`
- `docs/codex/handoffs/PUI-04.md`
- `docs/codex/handoffs/PUI-05.md`
- `docs/codex/handoffs/PUI-06.md`
