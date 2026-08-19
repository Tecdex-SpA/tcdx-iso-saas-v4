# CURRENT_STATE — TCDX ISO SaaS V4

Actualizado: 2026-08-19
Repositorio: `Tecdex-SpA/tcdx-iso-saas-v4`
Remote/base `main` verificado para cierre runtime 6.9-02: `ddd97e02fe7b0c536ab3c3345c2d8d4453febb55`
Fuente: repositorio `main` + handoffs runtime cerrados + evidencia runtime validada por el responsable del proyecto.

## Estado del programa

- CONT-00: DONE (bootstrap documental materializado en `main` antes de PUI-01).
- PUI-01: DONE (source ownership cerrado localmente; validación manual/CI pendiente por diseño).
- PUI-02: DONE (escala/unidad y normalización canónica cerradas localmente para el alcance focal; validación manual/CI pendiente por diseño).
- PUI-03: DONE (semantica canonica de conteos y poblaciones cerrada localmente para Math Governance focal; validación manual/CI pendiente por diseño).
- PUI-04: DONE (validación manual externa confirmada sobre `main/deploy` commit `7a9df185f06be031757d0d79f25aa59b27a53bbf`; focal test y deploy OK reportados por responsable del proyecto).
- PUI-05: DONE (normalización canónica/versionada de estados por dominio cerrada localmente para Math Governance focal; validación manual/CI pendiente por diseño).
- PUI-06: DONE (fallback legacy gobernado implementado y cierre manual/deploy confirmado en `docs/codex/handoffs/PUI-06.md`).
- PUI-07: DONE (Data Trust determinístico/versionado cerrado localmente para Math Governance focal; validación manual/CI pendiente por diseño).
- PUI-07-HF1: DONE local (pipeline oficial consolidado sobre `officialCalculationOrchestrator -> sourceResolver -> PUI-01..PUI-07`; validación manual/CI/deploy pendiente por diseño).
- PUI-07-HF2: READY_FOR_RUNTIME_VALIDATION local (status/temporal producer-consumer reconciliation implementada para F5_5 runtime; requiere deploy, recalculo oficial y queries PostgreSQL antes de PASS).
- PUI-07-HF3: DONE_LOCAL (cierre contractual residual para `F5_5_MATURITY` y `grc_health_components` validado en runtime externo; `F5_5_SEVERITY_INDEX` requirió HF4 por source override no canónico).
- PUI-07-HF4: DONE_LOCAL (source ownership de `F5_5_SEVERITY_INDEX` cerrado localmente: overrides no canónicos a `incident_operational_events/grc_incidents` se ignoran con warning auditable y se resuelve `audit_findings_actions`; validación runtime/productiva pendiente por diseño).
- PUI-07-HF5: PASS runtime externo confirmado por el responsable del proyecto; `F5_5_SEVERITY_INDEX` calcula desde `audit_findings_actions` con physical source `grc_readiness_findings + grc_readiness_snapshots` y sin falso `SOURCE_SCHEMA_INCOMPATIBLE`.
- PUI-08: DONE (matriz integral oficial computable integrada en `main` y validada en producción sobre commit `2a526d6329f7abae0119a782f99cd64aeed01892`: 53 fórmulas, 20 source contracts, 9 consumers).
- PUI-09: DONE (cierre documental/runtime de fase PUI; evidencia productiva post-PUI-08 aceptada: snapshots, lineage, Data Trust, Severity Index y aislamiento multi-tenant sin regresión).
- PUI_PHASE: CLOSED.
- PRE_UI_DATA_TRUTH_GATE: PASS.
- PRE-UI: CLOSED.
- UI enterprise: INITIAL / trabajo temprano.
- Fase 6 ampliada 6.8–6.14: IN_PROGRESS desde `F6.8`.
- 6.8-01-HF1: CLOSED (reconciliación Observation: `grc_observations` + `grc_observation_relations` son el modelo canónico del Semantic Layer; `grcObservation.service.js` queda como fachada GRC; tabla paralela de 6.8-01 migrada/removida si existía).
- 6.8-01-HF2: CLOSED / PASS_RUNTIME (deploy validado por el usuario en production/main `5c40dcc0cad8ff98a207ee92b6465648b1a8a3f2`; `schema_migrations` registra `20260818_f6_8_01_hf2_manual_observation_contract_bootstrap` aplicado, `grc.manual_observations@v1` existe published, `current_version_id` correcto, sin duplicados globales/versiones ni contratos tenant-specific).
- 6.8-01: CLOSED; `F6_8_01_RUNTIME=PASS`; 6.8-02 READY.
- 6.8-02: CLOSED / PASS_RUNTIME (Governed Observation Emitter / Outbox validado por cierre runtime `docs/codex/handoffs/6.8-02-HF1-RUNTIME-CLOSURE.md`; los eventos elegibles retry pasaron a `completed`, persistieron Observation canónica y no generaron duplicados).
- 6.8-02-HF1: CLOSED / PASS_RUNTIME (hotfix de serialización temporal validado post-deploy; `F6_8_02_RUNTIME=PASS`; 6.8-03 quedó READY).
- 6.8-03: CLOSED / PASS_RUNTIME (GRC Gap Model canónico validado post-deploy por `docs/codex/handoffs/6.8-03-RUNTIME-CLOSURE.md`; `F6_8_03_RUNTIME=PASS`, `F6_8_03=CLOSED`, Observation -> Gap runtime confirmado vía `grc_observation_relations`).
- 6.9-01: CLOSED / integrado en `main` mediante `f19709d8deb3dd808e362ebaf6dd7ef4adfe21a3`; inventario canónico de relaciones GRC en `docs/architecture/grc_relationship_inventory.md`: 38 familias, 32 persistidas, 6 derivadas, 8 canónicas, 25 domain-specific y 0 duplicate candidates.
- 6.9-02: CLOSED / PASS_RUNTIME. Impact Graph 2.0 foundation está mergeada en `main@ddd97e02fe7b0c536ab3c3345c2d8d4453febb55` como proyección/adapters en `backend/src/services/grc/impactGraph.service.js`; runtime confirmó modelo `impact-graph-2-foundation-v1`, provenance persisted+derived Observation -> Gap, determinismo, límites, aislamiento cross-tenant, 0 graph storage paralelo y 0 segundo source of truth. Cierre: `docs/codex/handoffs/6.9-02-RUNTIME-CLOSURE.md`.
- 6.9-03: READY. Siguiente objetivo: Priority Engine 2.0 determinístico, versionado y explicable; debe consumir la foundation 6.9-02 sin duplicar graph truth y mantener next-best-actions existente como compatibility/fallback adapter.
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
- PUI-06 cierre manual confirmado: `sourceResolver.test.js` PASS, `./scripts/deploy-vms.sh` PASS y post-deploy backend/AI/frontend PASS según handoff.
- PUI-07 se ejecutó sobre branch `fix/pui-07-data-trust` desde base local `955a5877bd1f199def844a94d3c173be6b94dc04`.
- PUI-07 agregó `dataTrust.service.js` con `data-trust-model-v1`, estados discretos, dimensiones y reasons machine-readable; consume señales PUI-01..PUI-06 sin recalcularlas.
- PUI-07 expone `data_trust` en resolver, `source_snapshot`, metadata de snapshot persistido, result oficial y detalles; no cambió source contracts ni fórmulas.
- PUI-07-HF1 se ejecutó sobre branch `hotfix/pui-07-hf1-official-pipeline-consolidation` desde base local/desplegada `17975ded33956a103e31c26b036b2b4ccae876ea`.
- PUI-07-HF1 elimina Package3 como motor paralelo de verdad: `phase5Package3.service.js` queda como compatibilidad sin cálculo y `phase5.service.js` redirige recalculo/overview al `officialCalculationOrchestrator`.
- PUI-07-HF1 persiste `not_calculable` con `calculation_run`, explanation, machine reason, Data Trust y snapshot/provenance mínimo cuando corresponde; `trust_score`/`trust_status` quedan como proyección legacy derivada de `data_trust` canónico.
- PUI-07-HF1 elimina `America/Santiago` como timezone universal en recalculo oficial/frontend y en defaults focales tocados.
- PUI-07-HF2 se ejecutó sobre branch `fix/pui-07-hf2-runtime-source-semantics` desde base local `606d98eebf20cb5308776740672a2d2837e5fc76`.
- PUI-07-HF2 reconcilia vocabulario legítimo productor-consumidor para dominios F5_5: risk (`suggested`, `needs_review`), control (`unknown`, `incomplete`, `degraded`), audit/action (`abierto`, `en progreso`, `bloqueado`, `completado`, `cancelado`), incident, loss, supplier, assurance (`pass_with_observations`) y data_trust.
- PUI-07-HF2 agrega drift guard `PRODUCER_STATUS_CONTRACTS` en `statusSemantics.service.js` y test focal para que estados legítimos productores no terminen como `status_unmapped`.
- PUI-07-HF2 corrige semántica temporal de `validity_interval`: `valid_to` futuro no se clasifica como evento futuro inválido; `event_stream` y `valid_from` futuro siguen excluidos por `date_in_future`/`temporal_after_as_of` según contrato.
- PUI-07-HF2 versiona sólo los source contracts cuyo `status_semantics.mapping_version` cambió a v2: `risk_register_controls` v7, `control_assurance_evidence` v7, `audit_findings_actions` v7, `incident_operational_events` v5, `loss_events_operational` v6, `supplier_tprm_assessments` v5, `assurance_test_results` v5 e `indicator_data_trust_assessments` v5. No cambió fórmulas.
- PUI-07-HF3 se ejecutó sobre branch `fix/pui-07-hf3-final-contract-closure` desde base local `2dc4820cd8c7967eb051e2c1b4dcbbe5f19e13b6`.
- PUI-07-HF3 cerró drift residual focal: `audit_findings_actions` v8 usa snapshot padre de `grc_readiness_findings` para temporalidad y `status=not_applicable`; `maturity_assessments` v7 reconoce estados producer-known de `survey_evaluations`/`metric_measurements`; `grc_health_components` v6 proyecta `started_at/completed_at` porque `calculation_runs.period_start` es nullable y el contrato ya permite esos fallbacks.
- PUI-07-HF3 no cambió fórmulas, pesos, unidades, precisión, Data Trust v1, fallback governance, snapshots ni Package3.
- Validación runtime externa posterior a PUI-07-HF3 confirmó `F5_5_MATURITY` y `F5_5_GRC_HEALTH` sin defecto residual: no reabrir esos flujos sin evidencia nueva.
- PUI-07-HF4 se ejecutó sobre branch `fix/pui-07-hf4-severity-index-source-closure` desde base local `0c844dddccde4a4c92a8e6bc27841d23c1405c93`.
- PUI-07-HF4 confirmó que el ownership publicado ya era `F5_5_SEVERITY_INDEX -> audit_findings_actions`, con severidad derivada de `grc_readiness_findings`/`grc_readiness_snapshots` cuando existen.
- PUI-07-HF4 corrigió el defecto de override: `officialCalculationOrchestrator` y `sourceResolver` ya no permiten que `source_overrides/body.source_code=incident_operational_events` desplace el contrato canónico de Severity Index; el override se conserva como `requested_source_code` y warning `source_override_ignored_non_canonical`.
- PUI-07-HF4 no modificó source contract payload, fórmulas, pesos, unidades, precisión ni checksums históricos; `SOURCE_CONTRACTS_VERSIONED=[]`, `FORMULAS_VERSIONED=[]`.
- PUI-07-HF5 se ejecutó sobre branch `fix/pui-07-hf5-severity-index-schema-compatibility` desde base local `44821f736f73efaf417683991faef63b7a8a43fd`.
- PUI-07-HF5 corrigió la incompatibilidad física remanente de `F5_5_SEVERITY_INDEX`: el adapter canónico `audit_findings_actions` ya no consulta `grc_readiness_snapshots.source_as_of`, columna inexistente en el schema productor; usa sólo `period_start`, `period_end` y `generated_at`.
- PUI-07-HF5 versionó `audit_findings_actions` v8→v9 porque el payload gobernado eliminó `source_as_of` de `columns`, `source_time_fields` y `valid_from_fields`; no modificó fórmulas, pesos, unidades, precisión, Maturity, GRC Health, Data Trust ni Package3.

## Ownership fijo

- CODEX A / `codex`: Data / Backend / GRC core.
- CODEX B / `tecdex2-codex`: AI / Knowledge / RAG / Regulatory.
- CODEX C / `tecdex3-codex`: Frontend / UX / Product E2E.

## Política de validación

`CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`

Codex NO ejecuta automáticamente full CI, full regression, repeated test cycles, push, merge ni deploy.
El usuario realiza CI/merge/deploy y decide si un fallo requiere un work package correctivo.

## Próxima acción

1. Mergear este cierre documental de `6.9-02` en `main`.
2. Iniciar `6.9-03 — Priority Engine 2.0` desde `main` actualizado, aplicando continuidad obligatoria y `FOCUSED_MINIMAL`.
3. Mantener cerrados PUI-01..PUI-09, F6.8-01/F6.8-02/F6.8-03, 6.9-01 y 6.9-02 salvo evidencia objetiva nueva.

## Handoff relevante

- `docs/codex/handoffs/CONT-00.md`
- `docs/codex/handoffs/PUI-01.md`
- `docs/codex/handoffs/PUI-02.md`
- `docs/codex/handoffs/PUI-03.md`
- `docs/codex/handoffs/PUI-03-HF2.md`
- `docs/codex/handoffs/PUI-04.md`
- `docs/codex/handoffs/PUI-05.md`
- `docs/codex/handoffs/PUI-06.md`
- `docs/codex/handoffs/PUI-07.md`
- `docs/codex/handoffs/PUI-07-HF1.md`
- `docs/codex/handoffs/PUI-07-HF2.md`
- `docs/codex/handoffs/PUI-07-HF3.md`
- `docs/codex/handoffs/PUI-07-HF4.md`
- `docs/codex/handoffs/PUI-07-HF5.md`
- `docs/codex/handoffs/PUI-08.md`
- `docs/codex/handoffs/PUI-09.md`
- `docs/codex/handoffs/6.8-01.md`
- `docs/codex/handoffs/6.8-01-HF1.md`
- `docs/codex/handoffs/6.8-01-HF2.md`
- `docs/codex/handoffs/6.8-02.md`
- `docs/codex/handoffs/6.8-02-HF1.md`
- `docs/codex/handoffs/6.8-02-HF1-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.8-03.md`
- `docs/codex/handoffs/6.8-03-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.9-01.md`
- `docs/codex/handoffs/6.9-02.md`
- `docs/codex/handoffs/6.9-02-RUNTIME-CLOSURE.md`
- `docs/architecture/grc_relationship_inventory.md`
