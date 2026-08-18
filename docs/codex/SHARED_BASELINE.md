# SHARED_BASELINE — TCDX ISO SaaS V4

Este archivo contiene hechos reutilizables. No redescubrir mientras no exista evidencia que los contradiga.

## CONFIRMED / PROTECTED

- PostgreSQL es la verdad operacional.
- Auth/RBAC existente: proteger; no reabrir sin evidencia.
- Multi-tenant scoping ya validado en fases previas: proteger y volver a probar sólo cuando el work package toque datos tenant-scoped.
- Math Governance existente: formula registry, source contracts/resolver, dataset validation, official calculation, snapshots/lineage y decision interpretation.
- PUI-01 source ownership confirmado para CONTROL-EFFECT, RISK-INHERENT y MATURITY en `docs/codex/CONTRACTS_REGISTRY.md`: no reabrir sin evidencia nueva.
- CONTROL-EFFECT: `score` agregado puede alimentar cálculos agregados/composite, pero no puede fabricarse como `design`, `implementation`, `operation` ni `evidence`.
- PUI-02 scale/unit confirmado para CONTROL-EFFECT, RISK-INHERENT, MATURITY y normalización explícita auditada en `docs/codex/CONTRACTS_REGISTRY.md`: la normalización depende de `scale_metadata`, no de magnitud.
- PUI-03 count semantics confirmado para Math Governance focal: `received` son filas fisicas, `eligible` es poblacion oficial elegible, `usable` son filas con inputs validos, `excluded` son filas unicas no usadas, `exclusionIssueCount` son categorias/codigos distintos y `population_size` es poblacion elegible.
- PUI-04 temporal semantics confirmado por validación manual externa sobre `7a9df18`: temporalidad oficial depende de `temporal_semantics`, no de `created_at`/`updated_at` universales.
- PUI-05 status semantics confirmado para Math Governance focal: `status_semantics` define dominio, mapping versionado, `unknown_policy=exclude_visible`, reason y elegibilidad; estados unknown/unmapped no se convierten silenciosamente a estados válidos.
- PUI-06 fallback governance confirmado para Math Governance focal: fallback legacy sólo se permite por `primary_absent` o `primary_no_rows` explícitamente autorizados; cierre manual/deploy confirmado en handoff PUI-06.
- PUI-07 Data Trust confirmado para Math Governance focal: `data-trust-model-v1` es determinístico, versionado, no usa IA ni valor de métrica y consume señales PUI-01..PUI-06.
- PUI-07-HF1 consolida el pipeline oficial: `officialCalculationOrchestrator` es la única fuente de verdad para fórmulas oficiales y Package3 queda como compatibilidad sin cálculo/persistencia paralela.
- PUI-07-HF3 cierra localmente drift residual focal: `grc_readiness_findings` usa el snapshot padre para temporalidad y `status=not_applicable`; `maturity_assessments` reconoce vocabulario productor de `survey_evaluations`/`metric_measurements`; `grc_health_components` usa `started_at/completed_at` cuando `period_start` es nulo.
- PUI-07-HF4 cierra localmente source ownership de `F5_5_SEVERITY_INDEX`: el source canónico sigue siendo `audit_findings_actions`; overrides no canónicos a `incident_operational_events`/`grc_incidents` no pueden desplazarlo y quedan visibles como warning/provenance.
- PUI-07-HF5 cierra localmente compatibilidad física de `F5_5_SEVERITY_INDEX`: `grc_readiness_snapshots` produce `generated_at`, `period_start` y `period_end`, no `source_as_of`; `audit_findings_actions` v9 y el adapter de Severity no requieren ni fabrican `source_as_of`.
- PUI-08 cierra localmente la matriz integral oficial: 53 fórmulas oficiales gobernadas se derivan de `FORMULAS`, `FORMULA_SOURCE_MAP`, source contracts, consumers, dependencias, snapshots/lineage y escenarios empty/partial/sufficient/two-tenant mediante `officialIndicatorMatrix.service.js`.
- PUI-09 cierra la fase PUI con evidencia runtime productiva post-PUI-08 sobre commit `2a526d6329f7abae0119a782f99cd64aeed01892`: matriz 53/53, 20 source contracts, 9 consumers, 16 calculated runs con 16 snapshots, 0 missing snapshots, 0 calculated con `source_unavailable`/`source_incompatible`, 0 null-to-zero en `not_calculable`, lineage presente para datasets poblados, Data Trust v1 presente y `F5_5_SEVERITY_INDEX` calculado desde `audit_findings_actions`/`grc_readiness_findings` con `TRUSTED`.
- 6.8-01-HF1 reconcilia Observation con el Semantic Layer preexistente: `grc_observations` es el system of record canónico, `grc_observation_relations` es el modelo canónico de relaciones, `backend/src/services/semantic/semanticLayer.service.js` es owner/runtime de persistencia, y `backend/src/services/grc/grcObservation.service.js` es sólo fachada GRC. `grc_metric_observations` permanece productor/modelo de dominio de métricas, no sistema transversal de Observation.
- 6.8-01-HF2 runtime closure confirmado por evidencia PostgreSQL post-deploy del usuario sobre production/main `5c40dcc0cad8ff98a207ee92b6465648b1a8a3f2`: forward migration `20260818_f6_8_01_hf2_manual_observation_contract_bootstrap` aplicada, `grc.manual_observations@v1` global/published existe, `current_version_id` apunta a v1, sin duplicados ni contratos tenant-specific, `trg_semantic_observation_history` activo. `F6_8_01_RUNTIME=PASS` y `6.8-02=READY`.
- 6.8-02 cierra localmente el Governed Observation Emitter / Outbox: `grc_observation_emission_outbox` es la cola tenant-scoped de emisión automática; el productor inicial es `officialCalculationOrchestrator`; el consumer delega persistencia exclusivamente a `semanticLayer.createManualObservation`; la regla inicial `official_calculation.data_trust_attention@1` sólo emite cálculos `calculated` con señal material Data Trust (`TRUSTED_WITH_WARNINGS`/`LOW_CONFIDENCE`) y `observed_at` explícito. Runtime/deploy sigue siendo validación manual posterior.
- 6.8-02-HF1 corrige localmente el defecto runtime de serialización temporal del emitter: filas `timestamptz` del outbox vuelven desde PostgreSQL como `Date` y deben normalizarse a ISO-8601 UTC antes de cruzar a `semanticLayer.createManualObservation`. No se fabrican fechas, no hay migración, no cambian fórmulas ni source contracts; `F6_8_02_RUNTIME` queda pendiente de deploy/validación del usuario.
- Fórmulas/pesos oficiales: no modificar durante PRE-UI salvo defecto matemático probado y decisión aprobada.
- Knowledge Base v2 existe: extender, no sustituir.
- Intelligence Engine backend existe: rules, confidence, explainability, guardrails, prompt builder, actions, orchestrator y deterministic fallback.
- AI Engine especializado existe: SoA, Beta-PERT, audit documents, Senior Auditor y otros flujos documentados.
- Trusted external/web lookup existe parcialmente; no equivale a Regulatory Intelligence versionada.
- Responsive/navigation/RBAC/commercial multi-tenant de Fase 6 previa: proteger.
- `dashboard-v2` fue retirado: no reintroducir.
- Security hardening previamente cerrado: reabrir sólo por nueva evidencia.

## PARTIAL

- Source contracts/resolver: PUI-01..PUI-09 cerraron ownership, escala/unidad, count semantics, temporal semantics, status semantics, fallback governance, Data Trust, pipeline oficial único, drift residual/source override focal, compatibilidad física de Severity snapshot, matriz integral oficial y cierre runtime/documental de PUI.
- Data Trust/provenance/snapshots: PUI-09 confirmó runtime post-deploy integral para la fase PUI; futuras fases deben extender sin reabrir este baseline.
- Decision Interpretation / Next Best Actions: foundation determinística; falta causalidad transversal completa.
- Tenant document handling: hay capacidades especializadas, no RAG privado universal confirmado.
- External lookup: foundation web/trusted sources; falta registry regulatorio autoritativo, versionado y semantic diff.
- AI Governance: guardrails/traces/fallback existen; falta lifecycle humano/evals completos.
- Operational Memory: datos históricos existen, no ciclo formal recommendation→decision→action→effectiveness→memory confirmado.

## CONFIRMED PROBLEM

- PRE-UI / PUI phase está cerrado: `PUI_PHASE=CLOSED` y `PRE_UI_DATA_TRUTH_GATE=PASS`.
- PR #91 está abierto y no debe tratarse como mergeado.
- CONTROL-EFFECT, RISK-INHERENT y MATURITY formaban parte del bloque de reconciliación PRE-UI; PUI-01 cerró ownership de fuente, PUI-02 cerró escala/unidad, PUI-03 cerró counts, PUI-04 cerró temporalidad y PUI-05 cerró status semantics focales.
- Data Truth Gate PRE-UI declarado PASS por PUI-09; no reabrir sin evidencia objetiva nueva.

## NOT CONFIRMED / MISSING AS COMPLETE CAPABILITY

- Hybrid RAG con pgvector/embeddings/reranking/citations.
- Impact Graph canónico transversal.
- Regulatory Intelligence genérica con RegulationVersion/LegalObligation/Applicability.
- Regulatory Packs completos Ley 21.719 / Ley 21.663.
- Operational Memory transversal.
- AI Evaluation Suite transversal.

## TO-BE

- Observation → Gap → Impact Graph → Priority → Intelligence → Human decision → Action → Effectiveness → Memory.
- Knowledge Platform: global + regulatory + tenant private + operational memory.
- Regulatory ingestion: authoritative source registry → immutable/versioned ingestion → semantic diff → human publish.
- Market ready sólo con `SELLABLE_MULTI_TENANT = PASS`, `ZERO_HARDCODE = PASS`, `ZERO_REGRESSION = PASS` y deuda comercial bloqueante 0.

## Do not rediscover

- No LLM directo a PostgreSQL.
- PostgreSQL outbox antes de Kafka.
- pgvector antes de Vector DB separada.
- graph abstraction en PostgreSQL antes de Neo4j.
- Extender KB v2.
- Extender Intelligence Engine existente.
- Deterministic truth, AI explanation.
- Tenant learning vía memory/RAG; no fine-tuning cross-tenant automático.
- Web general no es verdad legal autoritativa.
- No redescubrir en PUI-02 el ownership de fuente de CONTROL-EFFECT, RISK-INHERENT ni MATURITY cerrado por PUI-01; PUI-02 debe enfocarse en escala/unidad.
- No redescubrir en PUI-03 la escala/unidad de CONTROL-EFFECT, RISK-INHERENT, MATURITY ni supplier risk health cerrada por PUI-02; PUI-03 debe enfocarse en counts.
- No redescubrir en PUI-04 la semantica de conteos PUI-03; PUI-04 debe enfocarse en temporalidad.
- No redescubrir en PUI-05 la temporalidad PUI-04; PUI-05 cerró status dictionaries, mapping versions y unknown policy por dominio.
- No redescubrir en PUI-06 PUI-01 ownership, PUI-02 scale/unit, PUI-03 counts, PUI-04 temporal semantics ni PUI-05 status semantics; PUI-06 debe enfocarse en fallback legacy gobernado.
- PUI-06 implementó política central en `sourceResolver.service.js`: fallback legacy sólo se permite por `primary_absent` o `primary_no_rows` cuando el source code está autorizado.
- No redescubrir en PUI-08 el modelo Data Trust PUI-07 ni la consolidación PUI-07-HF1: `dataTrust.service.js`, `data-trust-model-v1`, `officialCalculationOrchestrator` como pipeline canónico y Package3 como compatibilidad están cerrados; PUI-08 debe enfocarse en reproducibilidad integral de snapshots/lineage.
- No redescubrir en PUI-08 los cierres HF3: `status_unmapped` no equivale a `status_not_eligible`; no inventar timestamps; `audit_findings_actions` v8, `maturity_assessments` v7 y `grc_health_components` v6 son los contratos focales actualizados por drift residual.
- No redescubrir en PUI-08 el cierre HF4/HF5: `F5_5_SEVERITY_INDEX` no usa `incident_operational_events`/`grc_incidents` como fuente canónica; source overrides no canónicos se ignoran con warning; el adapter canónico usa `grc_readiness_findings` + `grc_readiness_snapshots` y no debe consultar `grc_readiness_snapshots.source_as_of`.
- No redescubrir en PUI-09 el inventario PUI-08: `OFFICIAL_FORMULA_COUNT=53`, la matriz machine-readable vive en `backend/src/services/math-governance/officialIndicatorMatrix.service.js`, y consumers no pueden crear verdad paralela.
- No redescubrir en F6.8 el cierre PUI-09: PRE-UI Data Truth Gate está PASS; siguiente fase parte desde Observation/GRC model sobre la verdad oficial cerrada.
- No redescubrir en 6.8-02 el modelo base de Observation tras HF1: `findings` sigue siendo dominio especifico/legacy valido, no el modelo transversal; `grc_observations` y `grc_observation_relations` son canónicos vía Semantic Layer; cualquier emision automatica futura debe validar tenant/source, snapshots/provenance y supersession controlado.
- No redescubrir en 6.8-02 el bootstrap de observaciones manuales tras HF2 runtime closure: `grc.manual_observations` existe como contrato global `tenant_id=NULL`, v1 `published`, con `current_version_id` apuntando a v1; esto habilita productores/outbox.
- No redescubrir en 6.8-03 el mecanismo inicial de emisión Observation: el outbox F6.8 usa PostgreSQL, no Kafka; la emisión automática no escribe directo a `grc_observations`; los eventos no elegibles quedan `ignored` y no producen observaciones negativas desde no-data/insufficient/source-incompatible/dependency-pending.
