# CONTRACTS_REGISTRY — TCDX ISO SaaS V4

| Contrato | Estado | Owner | Nota |
|---|---|---|---|
| Source contracts | CURRENT/PUI-09 | CODEX A | PUI cerró ownership, escala/unidad, conteos, temporalidad, status, fallback, Data Trust y matriz oficial. |
| Metric/data semantics | CURRENT/PUI-09 | CODEX A | PRE-UI Data Truth Gate cerrado; 53 fórmulas oficiales cubiertas y validadas en runtime. |
| Count semantics | CURRENT/PUI-03 | CODEX A | PUI-03 cerró received/eligible/usable/excluded/exclusionIssueCount/population_size para source resolver y dataset validation focales. |
| Temporal semantics | CURRENT/PUI-04 | CODEX A | `temporal_semantics` contractual agregado a los 20 source contracts; validación focal/deploy confirmada externamente sobre `7a9df18`. |
| Status semantics | CURRENT/PUI-05 | CODEX A | `status_semantics` contractual agregado a los 20 source contracts; normalización versionada por dominio y unknown visible en Math Governance. |
| Legacy fallback policy | CURRENT/PUI-06 | CODEX A | Política central implementada en resolver; cierre focal/manual/deploy confirmado en handoff PUI-06. |
| Scale/unit semantics | CURRENT/PUI-02 | CODEX A | PUI-02 cerró escala/unidad para CONTROL-EFFECT, RISK-INHERENT, MATURITY y normalización explícita auditada; otros dominios quedan para su paquete específico sólo con evidencia. |
| Data Trust | CURRENT/PUI-07 | CODEX A | Modelo determinístico `data-trust-model-v1` expuesto por resolver, snapshots y cálculo oficial; PUI-08 cierra reproducibilidad integral. |
| Official calculation pipeline | CURRENT/PUI-07-HF1 | CODEX A | `officialCalculationOrchestrator` es la única fuente de verdad para fórmulas oficiales; Package3 queda como compatibilidad sin cálculo/persistencia paralela. |
| Measurement | CURRENT/PUI-09 | CODEX A | Runtime PUI-09 confirmó cálculos oficiales persistidos sin null-to-zero ni fuentes incompatibles calculadas. |
| Snapshot | CURRENT/PUI-09 | CODEX A | Runtime PUI-09 confirmó snapshots para 16/16 calculated runs. |
| Lineage | CURRENT/PUI-09 | CODEX A | Runtime PUI-09 confirmó lineage para cálculos con dataset poblado. |
| Observation contract | CURRENT/6.8-01-HF2-RUNTIME | CODEX A | Modelo canónico en `grc_observations` + `grc_observation_relations`; owner/runtime `semanticLayer.service.js`; fachada GRC sin persistencia paralela; contrato global `grc.manual_observations@v1` validado runtime post-deploy. |
| Observation emitter/outbox | CURRENT/6.8-02-HF1-RUNTIME | CODEX A | `grc_observation_emission_outbox` registra eventos de emisión tenant-scoped; reglas en `grcObservationEmitter.service.js`; consumer delega a Semantic Layer con timestamps normalizados a ISO-8601 UTC; productor inicial `officialCalculationOrchestrator`; runtime cerrado por `6.8-02-HF1-RUNTIME-CLOSURE`. |
| Gap contract | CURRENT/6.8-03-RUNTIME | CODEX A | `grc_gaps` + `grc_gap_rules` + `grc_gap_status_history` + `grc_gap_hypotheses`; deterministic Gap sobre Observations canónicas; AI hypotheses separadas; runtime cerrado. |
| Relationship inventory / graph input contract | CURRENT/6.9-01 | CODEX A | `docs/architecture/grc_relationship_inventory.md`; Impact Graph debe proyectar/adaptar truth existente, no duplicar relaciones. |
| Graph Projection / Edge contract | CURRENT/6.9-02 | CODEX A | `impact-graph-2-foundation-v1` en `backend/src/services/grc/impactGraph.service.js`; proyección/adapters sobre truth existente, sin persistencia graph ni segundo source of truth. |
| Priority contract | CURRENT/6.9-03 | CODEX C executing package | `priority-engine-2-v1`; proyección determinística sobre `grc_gaps` + Impact Graph 2.0, sin storage paralelo de prioridad. |
| IntelligenceContext | CURRENT/F6.12-A-RUNTIME | CODEX B | `canonical-intelligence-context-v1`; backend arma contexto tenant-scoped por categorias/provenance y AI Engine no consulta sin tenant autorizado. |
| Pattern/Trend Engine | CURRENT/F6.12-A-RUNTIME | CODEX B | `pattern-trend-engine-v1`; senales deterministicas sobre series historicas tenant-scoped con minimum-period guard y `insufficient_data`. |
| Anomaly Engine | CURRENT/F6.12-A-RUNTIME | CODEX B | `anomaly-engine-v1`; robust z-score/MAD versionado con baseline explicito, score/band y guard contra sparse false positives. |
| Cross-GRC Intelligence Orchestrator | CURRENT/F6.12-A-RUNTIME | CODEX B | `cross-grc-intelligence-orchestrator-v1`; orquesta context/patterns/trends/anomalies/Priority/Impact/RAG/regulatory sin store paralelo ni LLM truth. |
| Recommendation Decision Ledger | CURRENT/F6.13-A-RUNTIME | CODEX B | `recommendation-decision-ledger-v1`; decisiones humanas tenant-scoped append-only/idempotentes sobre recomendaciones/contexto/prioridad, sin decision authority de IA. Runtime closure PASS. |
| Effectiveness Feedback Loop | CURRENT/F6.13-A-RUNTIME | CODEX A | `effectiveness-feedback-loop-v1`; compara before/action/after/expected/observed con ventana, metodologia y Data Trust; closed no equivale a effective. Runtime closure PASS. |
| Operational Memory | CURRENT/F6.13-A-RUNTIME | CODEX B | `operational-memory-v1`; casos tenant-scoped con facts/decisions/outcomes/evaluations/confirmed lessons/AI hypotheses separados, sin segunda KB/retrieval. Runtime closure PASS. |
| AI Governance | CURRENT/F6.14-A-LOCAL | CODEX B | `ai-governance-contract-v1`; registry/policy/versioning para provider/model/prompt/context/schema/grounding/authority/tenant/privacy/failure por capacidad AI real, sin segundo AI orchestrator ni AI truth store. |
| AI Capability Registry | CURRENT/F6.14-A-LOCAL | CODEX B | `ai-capability-registry-v1`; inventario gobernado de `intelligence_narrative`, `knowledge_rag_answer`, `cross_grc_intelligence` y `operational_learning`. |
| AI Evaluation Suite | CURRENT/F6.14-A-LOCAL | CODEX B | `ai-evaluation-suite-v1`; fixtures sinteticos/no privados, expectations gobernadas y regression gate versionado para estructura, citas, factualidad, insuficiencia, prompt injection, tenant isolation y fallback. |
| Knowledge Document | CURRENT/6.10-01-RUNTIME | CODEX B | `knowledge-document-model-v1`; `knowledge_documents` extiende KB v2 con scope, tenant, versioning, lifecycle, checksums y provenance; runtime closure PASS. |
| Knowledge Ingestion | CURRENT/6.10-02-RUNTIME | CODEX B | `knowledge-ingestion-pipeline-v1`; pipeline tenant-scoped con secure upload, extracción, chunks, audit, idempotencia y KB v2 linkage; runtime closure PASS. |
| Knowledge Chunk | CURRENT/6.10-02-RUNTIME | CODEX B | `knowledge_document_chunks`; manifest determinístico y chunk content canónico para documentos tenant; 6.10-03 lo referencia sin copiar `chunk_text`. |
| Knowledge Embedding | CURRENT/6.10-03-RUNTIME | CODEX B | `knowledge-embedding-contract-v1`; `knowledge_chunk_embeddings` persiste embeddings pgvector versionados por provider/model/model_version/dimensions/input_checksum con `tenant_id` explícito y FK a `knowledge_document_chunks`; runtime closure PASS. |
| Hybrid Retrieval | CURRENT/6.10-04-RUNTIME | CODEX B | `hybrid-retrieval-contract-v1`; combina lexical sobre `knowledge_document_chunks` y vector sobre `knowledge_chunk_embeddings` con ranking determinístico versionado, tenant filter first y provenance para RAG; runtime closure PASS. |
| RAG Citation | CURRENT/6.10-05-RUNTIME | CODEX B | `rag-grounded-answer-contract-v1`; citations verificables sólo desde candidatos Hybrid Retrieval, validación determinística y abstención segura; runtime closure PASS. |
| Authoritative Source Registry | CURRENT/F6.11-A-RUNTIME | CODEX B | `authoritative-source-registry-v1`; `regulatory_authoritative_sources` gobierna fuentes oficiales por scope/jurisdicción/autoridad sin convertir web general o LLM en verdad legal. |
| Regulatory Ingestion | CURRENT/F6.11-A-RUNTIME | CODEX B | `regulatory-ingestion-contract-v1`; artefactos regulatorios inmutables/versionados enlazados a `knowledge_documents` y chunks canónicos. |
| Regulation | CURRENT/F6.11-A-RUNTIME | CODEX B | `regulation-model-v1`; identidad regulatoria/legal estable en `regulations`. |
| RegulationVersion | CURRENT/F6.11-A-RUNTIME | CODEX B | `regulation-version-model-v1`; publicación/version normativa inmutable en `regulation_versions`. |
| LegalObligation | CURRENT/F6.11-A-RUNTIME | CODEX B | `legal-obligation-model-v1`; obligaciones legales explícitas/gobernadas en `legal_obligations`, sin publicación autoritativa por LLM. |
| Regulatory Semantic Diff | CURRENT/F6.11-B-RUNTIME | CODEX B | `regulatory-semantic-diff-contract-v1`; diff determinístico/revisable entre versiones de la misma regulación, con cambios estructurados y provenance; runtime closure PASS. |
| Regulatory Pack | CURRENT/F6.11-B-RUNTIME | CODEX B | `regulatory-pack-model-v1`; composición versionada de fuentes, regulaciones, versiones, obligaciones y diffs canónicos, sin copiar texto normativo; runtime closure PASS. |
| Regulatory Pack Activation | CURRENT/F6.11-B-RUNTIME | CODEX B | `regulatory-pack-activation-contract-v1`; activación/configuración tenant-scoped que no muta la definición global del pack; runtime closure PASS. |
| Regulatory Applicability | CURRENT/F6.11-B-RUNTIME | CODEX B | `regulatory-pack-applicability-contract-v1`; evaluación/recomendación tenant-scoped con confirmación humana para aplicabilidad sensible; IA no es autoridad legal; runtime closure PASS. |
| Regulatory Mapping | PLANNED | CODEX B | Mapeos profundos a controles/evidencias/riesgos existentes requieren equivalencia real y revisión humana; F6.11-B sólo conserva `mapping_targets` gobernados en items de pack. |
| Capability/RBAC | CURRENT/HOTFIX-POSTDEPLOY-01-LOCAL | A+C | Backend autoriza; roles canónicos usan resolver de compatibilidad sin alias de privilegios; autorización efectiva separa usuario, rol efectivo, permiso, tenant, suscripción/plan, módulo, capability y scope. RBAC-02 mantiene excepción estricta sólo para `core.dashboard`. HOTFIX-POSTDEPLOY-01 reconcilia `ai.view` sólo para roles tenant `admin`, `tenant_admin` y `auditor`; roles no autorizados deben permanecer sin `ai.view`. |
| RBAC-01 canonical roles | CURRENT/RBAC-01 | A+C | Roles nuevos oficiales: `platform_admin`, `tenant_admin`, `auditor`, `area_owner`, `executive`, `dealer`; legacy preserva `effective_role` y no reescribe usuarios. |
| RBAC-02 route access matrix | CURRENT/RBAC-02-READY | A+C | Matriz App Router generada en `artifacts/rbac02-route-audit/route_access_matrix.csv`: `routes=97`, `mapped=97`, `missing=0`; contraste contra matriz runtime focal: `divergences=0`; backend guard = RBAC/commercial entitlement, frontend = espejo de navegación/disponibilidad. |
| Admin SaaS contract -> commercial subscription sync | CURRENT/RBAC-03-READY | A+C | Guardar contrato, suspender servicio o reactivar servicio desde Admin SaaS sincroniza `tenant_contracts` con `tenant_subscriptions` en la misma transacción para que `v_commercial_tenant_subscription`, módulos/capabilities y `/api/me/entitlements` reflejen el contrato vigente sin refresh manual adicional. |
| Standard commercial plan model | CURRENT/COMMERCIAL-PLAN-MATRIX-LOCAL | A+C | Planes estándar no destructivos: `iso -> pyme -> ISO`, `iso_operational_risk -> empresa -> ISO + Riesgo Operativo`, `grc -> enterprise -> GRC`; regla definitiva `ISO = ONLY_ISO`, `ISO_RISK = ISO + OPERATIONAL_RISK_ONLY`, `GRC = ALL_TENANT_COMMERCIAL_CAPABILITIES`; autoridad DB/backend en `commercialPlanMatrix.service.js`, `commercial_plans`, `commercial_plan_versions`, `plan_version_modules`, `commercial_modules`, `commercial_technical_capabilities` y `v_commercial_plan_capabilities`; matriz documental en `docs/codex/commercial/COMMERCIAL_PLAN_CAPABILITY_MATRIX.md`; migración comercial `20260828_commercial_standard_plan_matrix.sql` requerida, no ejecutada por Codex. |
| AI binary commercial authority | CURRENT/AI-ADDON-02-LOCAL | A+C | La autoridad contractual de IA es solo `tenant_subscription_addons.addon_key='ai'` sobre suscripción efectiva activa. `tenants.ai_plan` queda como compatibilidad histórica sin autoridad, no visible/seleccionable en Admin SaaS y no usado por `/api/me/entitlements`, `isTenantAiFeatureEnabled`, Sidebar/AppLayout ni acceso directo. Flags runtime/cuotas siguen subordinados a add-on activo, capability, RBAC y scope. |
| NORMALIZATION-01 DB/backend authority | CURRENT/NORMALIZATION-01-LOCAL | A+C | Permisos canónicos: `ai.compliance -> ai.view`, `iso.actions -> actions.view`; mutaciones de acciones usan `actions.manage/actions.approve/actions.delete`. IA efectiva requiere add-on `tenant_subscription_addons.addon_key='ai'`; ninguna versión publicada de plan debe exponer IA plan-level. `GET /api/grc/overview` consume últimos cálculos/snapshots persistidos y no dispara recálculo persistente. |
| NORMALIZATION-02 Health/KPI authority | CURRENT/NORMALIZATION-02-LOCAL | A+C | Autoridad Health/KPI única: `official_formula_versions + calculation_runs/results + metric_snapshots + metric_source_bindings`; `F5_5_GRC_HEALTH` v2 gobierna cobertura/confianza/faltantes y publicacion ejecutiva solo con cobertura suficiente; `/dashboard`, `/api/health/*`, `/api/grc/overview`, `/health` e `/iso-health` consumen proyeccion canónica. |
| HOTFIX-POSTDEPLOY-01 ISO Health / IA / GRC | CURRENT/HOTFIX-POSTDEPLOY-01-LOCAL | A+C | `canonicalHealthProjection.service.js` no consulta columnas inexistentes `calculation_runs.source_as_of` ni `calculation_runs.created_at`; usa `period_end/completed_at/started_at/period_start`. IA Compliance mantiene autoridad `tenant_subscription_addons.ai` + `ai.compliance` + `ai.view` + runtime `suggestions`; la migración `20260901_hotfix_postdeploy01_ai_view_rbac` concede `ai.view` sólo a `admin`, `tenant_admin` y `auditor` y valida que roles no autorizados no lo tengan. |
| Audit operational generated report | CURRENT/UI-FUNC-05-LOCAL | CODEX C | `GET /api/audits/generated-report/:id` genera PDF read-only al vuelo desde `audits`, `tenants`, `audit_control_reviews`, `findings` y `action_plans` tenant-scoped, bajo `canReadAudits` y `ensureTenantAccess`. No reemplaza `/api/audits/report/:id`, no persiste truth de reporte, no expone UUID internos como contenido comercial y no modifica cierre/estado de auditoría. |
| RELEASE-CLOSEOUT NORMALIZATION gate | CURRENT/NO_GO_PREDEPLOY | A+C | Gates locales A/B/C PASS para NORMALIZATION-01/02 integradas, pero commit/deploy/postdeploy permanecen bloqueados hasta preflight PostgreSQL PASS de ambas migraciones en contexto autorizado. Handoff: `docs/codex/handoffs/RELEASE-CLOSEOUT-NORMALIZATION.md`. |

Regla: si un work package cambia un contrato, actualizar este archivo en el mismo commit.

## 6.8-01-HF1 Canonical GRC Observation Model

Status: DONE_LOCAL on branch `fix/f6-8-01-hf1-observation-architecture-reconciliation`.

HF2 correction: HF1 architectural reconciliation remains valid, but the runtime bootstrap for `grc.manual_observations` was incomplete because it lived in the historical 6.8-01 migration. F6.8-01-HF2 adds the required forward migration and runner registration.

| Contract Area | Canonical Decision |
|---|---|
| Entity | `grc_observations` is the transversal GRC Observation system of record; existing `findings`, readiness findings, action plans, risks, controls, evidences, incidents and `grc_metric_observations` remain domain-specific sources/consumers/producers. |
| Canonical owner/runtime | `backend/src/services/semantic/semanticLayer.service.js`. |
| GRC API role | `backend/src/services/grc/grcObservation.service.js` is a facade that validates API/RBAC/source tenant scope and delegates canonical persistence. |
| Tenant scope | Every observation and relation carries `tenant_id`; sources and relation targets are validated by tenant before write. |
| Identity/idempotency | Canonical identity is `source_identity_hash` under `(tenant_id, contract_version_id)` with `is_current`; no GRC runtime dependency on parallel key/hash/code columns. |
| Type/domain | Governed standard sets with `custom` type support for extension; no client-specific enum or tenant-specific branch. |
| Status lifecycle | API `PUT` and transitions create controlled supersession: previous row becomes `is_current=false` with `superseded_by_id`, new row carries `supersedes_observation_id`. |
| Severity/status | Use canonical `status_value` and `severity_value`; no duplicate `status`/`severity` columns in the canonical table. |
| Provenance | Preserve `contract_id`, `contract_version_id`, `source_table`, `source_record_id`, `source_identity_hash`, `source_snapshot_id`, `correlation_id`, `metadata` and `data_lineage_edges`. Manual API observations use the global semantic contract `grc.manual_observations` and `data_snapshots` provenance. |
| Relations | `grc_observation_relations` is the only canonical relation table. HTTP `/links` may keep its API name but persists to canonical relations. |
| RBAC | Permissions `observation.read`, `observation.manage`, `observation.transition`, `observation.link` integrated into the existing GRC permission group. |
| Auditability | Creation, updates, transitions and links emit existing `audit_event_log` entries; no second audit log. |
| Source/formula governance | No Math Governance source contract payload changed; no formula payload changed; `SOURCE_CONTRACTS_VERSIONED=[]`, `FORMULAS_VERSIONED=[]`. |

## 6.8-01-HF2 Manual Observation Semantic Contract

Status: PASS_RUNTIME on production/main `5c40dcc0cad8ff98a207ee92b6465648b1a8a3f2`; documented by `docs/codex/handoffs/6.8-01-HF2-RUNTIME-CLOSURE.md`.

| Field | Canonical Definition |
|---|---|
| `source_code` | `grc.manual_observations` |
| `display_name` | `GRC manual observations API` |
| `entity_type` | `grc_manual_observation` |
| `adapter_key` | `grc_manual_observation_api` |
| Scope | Global only: `tenant_id=NULL`; tenant-specific rows with the same source code are incompatible. |
| Owner/purpose | `owner=semantic_layer`, purpose `canonical provenance for manual GRC observation facade`. |
| Version | `version_number=1`, `status=published`, `current_version_id` points to v1. |
| Physical source | `data_snapshots` with role `manual_observation_payload`. |
| Required fields | `observation_type`, `entity_type`, `observed_at`, `status_value`, `severity_value`. |
| Optional fields | `period_start`, `period_end`, `numeric_value`, `text_value`, `boolean_value`, `unit`, `owner_user_id`, `evidence_id`, `metadata`. |
| Versioning | `SEMANTIC_CONTRACTS_VERSIONED=["grc.manual_observations@v1"]`; Math Governance source contracts and formulas unchanged. |

## 6.8-02 Governed Observation Emitter / Outbox

Status: CLOSED / PASS_RUNTIME by `docs/codex/handoffs/6.8-02-HF1-RUNTIME-CLOSURE.md`.

HF1 correction: DONE_LOCAL on branch `fix/f6-8-02-hf1-observation-timestamp-serialization`. Runtime showed eligible outbox events failed because `timestamptz` rows returned as JavaScript `Date` crossed into Semantic Layer and were serialized as `Date.toString()`. The emitter boundary now normalizes `observed_at`, `period_start` and `period_end` to ISO-8601 UTC before `semanticLayer.createManualObservation`, preserving null optional periods and never fabricating missing `observed_at`.

| Contract Area | Canonical Definition |
|---|---|
| Outbox table | `grc_observation_emission_outbox` |
| Scope | Tenant-scoped; `tenant_id` is mandatory on every event. |
| Owner | CODEX A / GRC service layer for event policy and worker; Semantic Layer remains owner of canonical Observation persistence. |
| Consumer | `backend/src/services/grc/grcObservationEmitter.service.js` calls `semanticLayer.createManualObservation`; no direct producer insert into `grc_observations`. |
| Producer v1 | `backend/src/services/math-governance/officialCalculationOrchestrator.service.js` after official calculation run + source snapshot persistence. |
| Rule registry v1 | `official_calculation.data_trust_attention@1`. |
| Eligibility | `status=calculated`, explicit `observed_at`, same-tenant calculation run/snapshot, Data Trust state in `TRUSTED_WITH_WARNINGS` or `LOW_CONFIDENCE`. |
| Non-eligibility | `source_unavailable`, `source_incompatible`, `SOURCE_SCHEMA_INCOMPATIBLE`, `SOURCE_DATA_INSUFFICIENT`, `FORMULA_DEPENDENCY_PENDING`, `FORMULA_VARIABLE_REQUIRED`, `FORMULA_ZERO_WEIGHTS`, `not_calculable`, `unmeasured`, `failed`, trusted/no material signal. |
| Idempotency | Outbox idempotency key includes producer run/snapshot; canonical Observation identity excludes run/snapshot and is based on tenant + producer type + rule + formula + period + source contract, enabling supersession across later runs for the same governed signal. |
| Provenance | Event payload preserves calculation run, source snapshot, source contract/code, formula version, Data Trust, source status, machine reason, correlation id, physical sources, counts and warnings. |
| Timestamp boundary | Outbox `timestamptz` may be returned by the Node PostgreSQL driver as `Date`; the service boundary to Semantic Layer uses ISO-8601 UTC strings. |
| Versioning | `SEMANTIC_CONTRACTS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `FORMULAS_VERSIONED=[]`. |

## 6.8-03 GRC Gap Model

Status: CLOSED / PASS_RUNTIME by `docs/codex/handoffs/6.8-03-RUNTIME-CLOSURE.md`.

| Contract Area | Canonical Definition |
|---|---|
| Gap table | `grc_gaps` |
| Rule registry | `grc_gap_rules`; published deterministic rule definition/checksum fields are immutable and require a new `rule_version` for semantic changes. |
| Lifecycle history | `grc_gap_status_history` records evaluation-created, evaluation-confirmed, reopened and manual transition events. |
| AI boundary | `grc_gap_hypotheses` stores non-deterministic/AI hypotheses separately and never creates deterministic Gap truth. |
| Initial rule | `observation.data_trust_attention_gap@1`, global, published, deterministic over `official_calculation.data_trust_attention` Observations. |
| Eligibility | Current canonical Observation, matching rule input type, valid quality, material Data Trust state (`TRUSTED_WITH_WARNINGS`/`LOW_CONFIDENCE`) and material severity (`low`/`medium`/`high`/`critical`). |
| Non-eligibility | Bad data/source/dependency states remain ignored for material business Gap generation: `INSUFFICIENT_DATA`, `UNTRUSTED`, `SOURCE_SCHEMA_INCOMPATIBLE`, `SOURCE_DATA_INSUFFICIENT`, `FORMULA_DEPENDENCY_PENDING`, `FORMULA_VARIABLE_REQUIRED`, `FORMULA_ZERO_WEIGHTS`, `source_unavailable`, `source_incompatible`, `not_calculable`, `unmeasured`, trusted/no material signal. |
| Identity/idempotency | `gap_key` is deterministic SHA-256 over tenant, rule code/version, gap type, source observation identity hash and affected entity; unique by `(tenant_id,gap_key)`. |
| Relation | Observation -> Gap uses canonical `grc_observation_relations` with `related_entity_type='grc_gap'` and `relation_type='supports'`; no `grc_observation_links`. |
| RBAC | `gap.read`, `gap.manage`, `gap.transition`, `gap.evaluate` integrated into the existing permission system and GRC route authorization. |
| Versioning | `FORMULAS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `SEMANTIC_CONTRACTS_VERSIONED=[]`. |

## 6.9-01 GRC Relationship Inventory / Impact Graph Foundation

Status: DONE_LOCAL on branch `feat/f6-9-01-grc-relationship-inventory`.

| Contract Area | Canonical Definition |
|---|---|
| Primary artifact | `docs/architecture/grc_relationship_inventory.md` |
| Inventory scope | 38 relationship families: 32 persisted, 6 derived, 8 canonical, 25 domain-specific, 3 compatibility/adapter families, 0 duplicate candidates. |
| Graph foundation | 6.9-02 must prefer projection/adapters over existing source-of-truth tables before adding graph persistence. |
| Canonical Observation relation input | `grc_observation_relations`; `grc_observation_links` remains deprecated/must not return. |
| Canonical Gap input | `grc_gaps`, `grc_gap_rules`, `grc_gap_status_history`, `grc_gap_hypotheses` with deterministic truth and AI hypothesis separation. |
| Domain-specific relations | Evidence, audit, supplier, privacy, incident, process/dependency, metric and risk-matrix relations remain authoritative in their domain tables. |
| Graph edge persistence | Not created in 6.9-01. Any 6.9-02 edge abstraction must document source, owner, tenant scope and whether it is derived. |
| Formula/source contract changes | None. `FORMULAS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `SEMANTIC_CONTRACTS_VERSIONED=[]`. |

## 6.9-02 Impact Graph 2.0 Foundation

Status: DONE_LOCAL on branch `feat/f6-9-02-impact-graph-foundation`.

| Contract Area | Canonical Definition |
|---|---|
| Model version | `impact-graph-2-foundation-v1` |
| Owner/runtime | `backend/src/services/grc/impactGraph.service.js` through existing GRC facade. |
| Storage decision | No graph storage was created; no migration was added; domain tables remain source of truth. |
| Node identity | Deterministic SHA-256 over model version, `tenant_id`, normalized `entity_type` and `entity_id`. |
| Edge identity | Deterministic SHA-256 over model version, tenant, normalized endpoints, relationship type, source model/record, derivation rule and persisted/derived flag. |
| Projection | `GraphProjection` returns seed, nodes, edges, limits, depth and technical `projected_at`; `projected_at` is not part of identity. |
| Provenance | Each edge preserves source domain/model, source record, source tenant, relationship type, owner, persisted/derived and derivation inputs when applicable. |
| Adapters v1 | `grc_requirement_control_mappings`, `grc_evidence_links`, `grc_phase2_relations`, `grc_operational_dependencies`, `tenant_process_entity_links`, `grc_observation_relations`, `grc_gaps` derivation metadata. |
| Observation/Gap | Observation -> Gap persisted edge consumes `grc_observation_relations`; `grc_gaps` exposes derived provenance only. |
| Runtime surface | GET `/api/grc/impact-graph/nodes/:entityType/:id/relationships`; GET `/api/grc/impact-graph/neighborhood/:entityType/:id`. |
| RBAC | Existing GRC route protection plus service permission `workflow.read`; no new permission/migration. |
| Limits | `depth<=3`, `max_nodes<=100`, `max_edges<=200`. |
| Versioning | `FORMULAS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `SEMANTIC_CONTRACTS_VERSIONED=[]`; `MIGRATIONS_CHANGED=NO`. |

## 6.9-03 Priority Engine 2.0

Status: DONE_LOCAL on branch `feat/f6-9-03-priority-engine-2`.

| Contract Area | Canonical Definition |
|---|---|
| Model version | `priority-engine-2-v1` |
| Owner/runtime | `backend/src/services/grc/priorityEngine.service.js` through existing GRC facade. |
| Storage decision | No priority table/storage was created; no migration was added. Results are reproducible projections over existing truth. |
| Subject v1 | `grc_gap` only; non-Gap entity priority remains future expansion through Intelligence/Cross-GRC orchestration. |
| Inputs | `grc_gaps` for deterministic Gap truth and `impactGraph.service.js` (`impact-graph-2-foundation-v1`) for bounded relationship/provenance context. |
| Factors | `gap_severity` max 35, `gap_lifecycle_status` max 20, `data_trust_state` max 15, `impact_graph_breadth` max 20, `canonical_gap_provenance` max 10. |
| Score | Sum of factor contributions clamped to 0..100; bands: `urgent >=75`, `high >=50`, `medium >=25`, else `low`. |
| Tie-breaking | `priority_score desc`, severity weight desc, status weight desc, subject type asc, subject id asc. |
| Explainability | Every result returns `factors[]` with value, contribution, rule and source, plus provenance and graph limits. |
| API | GET `/api/grc/priorities`; GET `/api/grc/priorities/:entityType/:id`. |
| RBAC | Existing `workflow.read`; no new permission/migration. |
| AI boundary | AI never creates score/order; `ai_priority_truth=false`. |
| Versioning | `FORMULAS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `SEMANTIC_CONTRACTS_VERSIONED=[]`; `MIGRATIONS_CHANGED=NO`. |

## 6.10-01 Knowledge Document Model

Status: CLOSED / PASS_RUNTIME by `docs/codex/handoffs/6.10-01-RUNTIME-CLOSURE.md`.

| Contract Area | Canonical Definition |
|---|---|
| Model version | `knowledge-document-model-v1` |
| Owner/runtime | CODEX B / Knowledge Base v2, service boundary `backend/src/services/knowledge-base/knowledgeDocument.service.js`. |
| Storage decision | Additive parent/source model `knowledge_documents`; no `knowledge_base_v3`, no replacement of `knowledge_items`, no duplicate KB. |
| KB v2 compatibility | `knowledge_items`, `knowledge_rules`, `knowledge_evidence_expectations`, `knowledge_audit_questions`, `knowledge_recommended_actions`, `knowledge_common_gaps`, `knowledge_rule_hints`, `knowledge.service.js`, `knowledge.repository.js` and `knowledge.search.js` remain compatible. |
| Source link | `knowledge_sources.knowledge_document_id` optionally links existing KB v2 sources to a canonical document; existing source rows remain valid with NULL document link. |
| Scope | `GLOBAL`, `REGULATORY`, `TENANT`. `TENANT` requires `tenant_id`; `GLOBAL` and `REGULATORY` require `tenant_id=NULL`; `REGULATORY` requires `source_authority=authoritative`. |
| Tenant visibility | Service queries return global/regulatory plus same-tenant private documents only; empty tenant/private scope returns valid empty collection. |
| Versioning | Unique `(scope, COALESCE(tenant_id, zero uuid), document_key, version)`; `supersedes_document_id` preserves audit trail; new versions do not overwrite published/previous rows. |
| Lifecycle | DB/service status set: `draft`, `indexing`, `active`, `deprecated`, `rejected`, `error`; service transitions v1: draft -> indexing/active/rejected/error, indexing -> active/rejected/error, active -> deprecated/error, error -> draft. |
| Temporal validity | `effective_from`/`effective_to` are explicit; `updated_at` is not document versioning. |
| Checksums | `original_file_checksum`, `extracted_text_checksum` and `content_checksum` are SHA-256 hex; content checksum is required and may be deterministically computed by service when omitted. |
| Original content | `original_file_reference` points to existing storage/file owner; this table does not store binary content. |
| Extracted text | `extracted_text_reference` and `extracted_text_checksum` prepare 6.10-02/6.10-03 without implementing chunking/embeddings. |
| Source authority | `tcdx_internal`, `authoritative`, `tenant_private`, `imported`, `derived`; web/general content is not legal authority by default. |
| Operational attachment boundary | `OPERATIONAL_ATTACHMENT_AUTO_PROMOTION=0`; uploads/evidence/audit/incident/vendor attachments require future explicit ingestion/promotion workflow before becoming published knowledge. |
| AI boundary | LLM does not determine authoritative `scope`, `tenant_id`, `version`, `status` or checksum truth. |
| Future readiness | Supports 6.10-02 tenant ingestion, 6.10-03 pgvector/embeddings, 6.10-04 hybrid retrieval and 6.10-05 citations without implementing them in 6.10-01. |
| Formula/source contracts | `FORMULAS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `SEMANTIC_CONTRACTS_VERSIONED=[]`; `MIGRATIONS_CHANGED=YES_FORWARD_ONLY`. |

## 6.10-02 Tenant Document Ingestion

Status: CLOSED / PASS_RUNTIME by `docs/codex/handoffs/6.10-02-RUNTIME-CLOSURE.md`.

| Contract Area | Canonical Definition |
|---|---|
| Contract version | `knowledge-ingestion-pipeline-v1` |
| Owner/runtime | CODEX B / Knowledge Base v2, service boundary `backend/src/services/knowledge-base/knowledgeIngestion.service.js`. |
| API | `GET /api/knowledge-base/ingestions`, `GET /api/knowledge-base/ingestions/:id`, `POST /api/knowledge-base/ingestions`. |
| RBAC | Existing `/api/knowledge-base` RBAC prefix; read roles can view ingestion metadata, write restricted to existing tenant admin roles. |
| Secure upload | Reuses `backend/src/utils/secureUpload.js` memory upload; one file, bounded fields, bounded size, MIME+extension validation and service-level signature validation. |
| Supported types | PDF, TXT/Markdown and DOCX. OCR is not executed. Legacy `.doc` is not supported for tenant ingestion v1. |
| Extraction | Reuses `documentContentExtraction.service.js` local storage extraction; no content fabrication when text is absent. |
| Malware scan | No universal scanner exists; persisted as `malware_scan_status=not_available`. |
| Sensitive handling | Rule-based minimum classification: `none`, `sensitive`, `secret_detected`; secrets reject activation and are not chunked. |
| Storage/provenance | Original and extracted text use local references/checksums; binary content is not stored in DB. |
| Document lifecycle | Inserts `knowledge_documents` as TENANT documents; successful flow records draft/indexing/active path and final `active`; no-text becomes `error`; secret content becomes `rejected`. |
| Idempotency | Unique `(tenant_id,idempotency_key)` in `knowledge_document_ingestions`; default key derives from tenant, document key, version and original checksum. |
| Chunks | `knowledge_document_chunks` stores deterministic heading/paragraph chunks with tenant, document, version, ordinal, offsets, page/section/heading when available and text checksum. No vector columns. |
| KB v2 linkage | Active ingestions create/update `knowledge_sources` row with `knowledge_document_id`; `knowledge_items` remain untouched. |
| Audit | `knowledge_document_ingestion_audit` records tenant, actor, document, checksums, method, status, request/correlation id, error code and metadata without full text/secrets. |
| Vector/RAG boundary | `PGVECTOR_IMPLEMENTED=0`, `EMBEDDINGS_IMPLEMENTED=0`, `HYBRID_RETRIEVAL_IMPLEMENTED=0`, `RAG_ANSWER_CONTRACT_IMPLEMENTED=0`. |
| Formula/source contracts | `FORMULAS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `SEMANTIC_CONTRACTS_VERSIONED=[]`; `MIGRATIONS_CHANGED=YES_FORWARD_ONLY`. |

## 6.10-03 pgvector Embedding Foundation

Status: CLOSED / PASS_RUNTIME by `docs/codex/handoffs/6.10-03-RUNTIME-CLOSURE.md`.

| Contract Area | Canonical Definition |
|---|---|
| Contract version | `knowledge-embedding-contract-v1` |
| Owner/runtime | CODEX B / Knowledge Base v2, service boundary `backend/src/services/knowledge-base/knowledgeEmbedding.service.js`. |
| Storage decision | `knowledge_chunk_embeddings` is embedding-side storage keyed to `knowledge_document_chunks.id`; it does not store/copy `chunk_text` and does not replace canonical chunk ownership. |
| pgvector | Forward migration `20260819_f6_10_03_pgvector_embeddings` governs `CREATE EXTENSION IF NOT EXISTS vector` and embedding storage postconditions. |
| Provider strategy | Provider/model/model_version/dimensions are explicit configuration or service input; no model/dimension is product-hardcoded. OpenAI adapter is available only when configured; tests inject a provider fixture. |
| Versioning/reindex | Reindex required when chunk `text_checksum`, provider, model, model_version, dimensions or contract version changes; superseded rows are marked `stale`. |
| Status | `pending`, `ready`, `failed`, `stale`, `skipped`; failed provider attempts persist failure state without fabricating vectors. |
| Tenant isolation | Every embedding row has `tenant_id`; composite FK `(tenant_id, chunk_id)` binds embeddings to same-tenant canonical chunks; search SQL filters tenant before vector ranking. |
| Search primitive | `searchTenantVectorCandidates` returns tenant-scoped chunk IDs/scores/metadata only; no hybrid lexical/graph/authority/reranking/RAG answer. |
| Compatibility | `knowledge_documents`, `knowledge_document_ingestions`, `knowledge_document_chunks`, `knowledge_document_ingestion_audit`, `knowledge_sources` and KB v2 child tables remain compatible. |
| Formula/source contracts | `FORMULAS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `SEMANTIC_CONTRACTS_VERSIONED=[]`; `MIGRATIONS_CHANGED=YES_FORWARD_ONLY`. |

## 6.10-04 Hybrid Retrieval

Status: CLOSED / PASS_RUNTIME by `docs/codex/handoffs/6.10-04-RUNTIME-CLOSURE.md`.

| Contract Area | Canonical Definition |
|---|---|
| Contract version | `hybrid-retrieval-contract-v1` |
| Ranking version | `hybrid-rank-weighted-rank-normalization-v1` |
| Owner/runtime | CODEX B / Knowledge Base v2, service boundary `backend/src/services/knowledge-base/knowledgeHybridRetrieval.service.js`. |
| Lexical retrieval | Tenant-scoped SQL over `knowledge_document_chunks.chunk_text`; no copied lexical index/table and no external search engine. |
| Vector retrieval | Reuses `knowledge_chunk_embeddings` and F6.10-03 embedding config/vector validation; only `ready` embeddings with matching provider/model/model_version/dimensions/contract participate. |
| Ranking | Explicit weighted combination of normalized method ranks; default weights vector `0.55`, lexical `0.45`, normalized if overridden. |
| Tenant isolation | Tenant filters are applied in SQL for lexical and vector channels before candidate ranking. |
| Lifecycle | Default official retrieval returns `knowledge_documents.status='active'`; rejected/error/deprecated are excluded. |
| API | `POST /api/knowledge-base/retrieval/search`; RBAC uses existing tenant read roles through explicit `knowledge.retrieval.read` rule. |
| Boundary | Returns candidates/provenance only; no LLM answer, citation contract, reranker, external vector DB or new storage. |
| Formula/source contracts | `FORMULAS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `SEMANTIC_CONTRACTS_VERSIONED=[]`; `MIGRATIONS_CHANGED=NO`. |

## F6.13-A Recommendation Decision Ledger, Effectiveness Feedback And Operational Memory

Status: CLOSED / PASS_RUNTIME by `docs/codex/handoffs/6.13-A-RUNTIME-CLOSURE.md`.

| Contract Area | Canonical Definition |
|---|---|
| Decision Ledger | `recommendation-decision-ledger-v1` in `recommendation_decision_ledger`; append-only/idempotent tenant-scoped decisions over recommendations, Cross-GRC context and Priority context. |
| Decision identity | Stable `decision_key` excludes technical timestamps and is based on tenant, canonical recommendation identity, recommendation version, subject, intelligence context key/version and priority context key/version. |
| Human decision boundary | Decisions require actor, reason, decision time and correlation/idempotency; AI cannot write final decisions or create official actions. |
| Effectiveness | `effectiveness-feedback-loop-v1` in `recommendation_effectiveness_evaluations`; before/after comparison with expected/observed outcome, methodology, window, Data Trust and provenance. |
| Effectiveness semantics | `closed_equals_effective_assumption=false`; no evidence or missing metrics produce `insufficient_data`/`inconclusive`, not `ineffective`. |
| Operational Memory | `operational-memory-v1` in `operational_memory_cases` + `operational_memory_case_links`; tenant-scoped cases reference canonical objects and separate facts, decisions, outcomes, evaluations, confirmed lessons and AI hypotheses. |
| Memory governance | `confirmed` memory requires human actor, `confirmed_at` and `confirmation_reason`; `ai_hypothesis` cannot be confirmed directly. |
| Retrieval boundary | Structured tenant-scoped query only; future semantic retrieval must use KB/Hybrid/RAG adapter, not a second KB or retrieval engine. |
| Audit | Service writes state changes to existing `audit_event_log` with tenant, actor, object, contract version and correlation id. |
| API/RBAC | No new HTTP route in F6.13-A; future routes must distinguish read, decide, evaluate and confirm/publish memory. |
| Formula/source contracts | `FORMULAS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `SEMANTIC_CONTRACTS_VERSIONED=[]`; `MIGRATIONS_CHANGED=YES_FORWARD_ONLY`. |

## F6.14-A AI Governance, AI Evaluation Suite And Phase 6 Closeout

Status: DONE_LOCAL on branch `feat/f6-14-a-ai-governance-final-closeout`; runtime validation pending user deploy.

| Contract Area | Canonical Definition |
|---|---|
| AI Governance | `ai-governance-contract-v1` in `backend/src/services/intelligence/aiGovernance.service.js`; formalizes capability identity, provider/model strategy, prompt/context/schema/policy versions, grounding, tenant/privacy, failure semantics and authority boundary. |
| Capability registry | `ai-capability-registry-v1`; covers real AI surfaces `intelligence_narrative`, `knowledge_rag_answer`, `cross_grc_intelligence` and `operational_learning` without duplicating the AI orchestrator. |
| Policy boundaries | `ai-policy-boundaries-v1`; LLM direct SQL, operational truth, compliance final authority, risk acceptance, Gap closure, legal publication, decision authority and memory publication are all forbidden. |
| Retention/redaction | `ai-retention-redaction-policy-v1`; traces retain metadata, checksums and references, not full prompts, full context, complete documents or secrets. |
| Trace/audit | Existing `ai_prompt_logs` receives governed metadata through `intelligence.audit-log.js`; no new table or AI governance store. |
| Grounding/citations | Knowledge/RAG capability references `rag-grounded-answer-contract-v1`; retrieved content is evidence only and cannot become instruction or authority. |
| Failure statuses | `success`, `fallback`, `insufficient_evidence`, `provider_unavailable`, `timeout`, `invalid_output`, `policy_blocked`, `grounding_failed`, `dependency_unavailable`. |
| AI Evaluation Suite | `ai-evaluation-suite-v1` in `backend/src/services/intelligence/aiEvaluationSuite.service.js`; evaluates synthetic/non-private golden cases by facts/structure, not exact narrative wording. |
| Eval dataset/thresholds | `ai-eval-golden-cases-f6-14-v1` and `ai-eval-thresholds-f6-14-v1`; no private tenant data and no magic unversioned thresholds. |
| Regression comparison | Baseline vs candidate compares aggregate gate pass/fail and failures by case; longer or more persuasive prose is not treated as improvement. |
| API/RBAC | No new HTTP route or permission in F6.14-A; future surfaces must separate read/evaluate/policy-manage and preserve backend RBAC. |
| Persistence | No DDL. No second AI orchestrator, KB, retrieval engine, RAG engine, priority store, observation/gap/regulatory/memory truth or AI governance truth store. |
| Formula/source contracts | `FORMULAS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `SEMANTIC_CONTRACTS_VERSIONED=[]`; `MIGRATIONS_CHANGED=NO`. |

## 6.10-05 RAG Grounded Answer + Citations

Status: PASS_RUNTIME on production/main `d098441ec4deff867820f989d8595cfb3206571b`; documented by `docs/codex/handoffs/6.10-05-RUNTIME-CLOSURE.md`.

| Contract Area | Canonical Definition |
|---|---|
| Contract version | `rag-grounded-answer-contract-v1` |
| Owner/runtime | CODEX B / Knowledge Base v2, service boundary `backend/src/services/knowledge-base/knowledgeRag.service.js`. |
| Candidate source | Reuses `knowledgeHybridRetrieval.service.js` / `hybrid-retrieval-contract-v1` as the only retrieval candidate source. |
| Context builder | Materializes `knowledge_document_chunks.chunk_text` only for Hybrid Retrieval candidate IDs in a tenant-scoped batch, then builds bounded evidence-only context. |
| LLM provider | Reuses backend `AiEngineClient` and AI Engine `call_llm_json` through `/api/ai/knowledge/rag-answer`; provider/model/version remain runtime configuration/provenance, not product-hardcoded truth. |
| Citations | Citation IDs are generated before LLM call and can only reference retrieved candidate chunks/documents with tenant, version, checksum, source authority and retrieval provenance. |
| Grounding validation | Backend deterministically rejects fabricated citation IDs, grounded answers without citations and invalid structured output; empty/insufficient evidence abstains. |
| Tenant isolation | Tenant comes from authenticated context; filters cannot override tenant; foreign candidate/evidence rows are discarded before context and citation assembly. |
| API | `POST /api/knowledge-base/rag/answer`; RBAC uses existing tenant read roles through explicit `knowledge.rag.answer` rule. |
| Persistence | Runtime projection only; no response table, cache truth, second KB, second retrieval engine or chunk copy. |
| Formula/source contracts | `FORMULAS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `SEMANTIC_CONTRACTS_VERSIONED=[]`; `MIGRATIONS_CHANGED=NO`. |

## F6.11-A Regulatory Foundation

Status: CLOSED / PASS_RUNTIME by `docs/codex/handoffs/6.11-A-RUNTIME-CLOSURE.md`.

| Contract Area | Canonical Definition |
|---|---|
| Consolidated packages | 6.11-01 Authoritative Source Registry, 6.11-02 Versioned Regulatory Ingestion, 6.11-03 Regulation / Legal Obligation model. |
| Source registry | `authoritative-source-registry-v1` in `regulatory_authoritative_sources`; scopes `GLOBAL`, `JURISDICTIONAL`, `TENANT_PRIVATE`; tenant-private requires `tenant_id`; global/jurisdictional require `tenant_id=NULL`. |
| Authority governance | `authority_classification` distinguishes `AUTHORITATIVE`, `APPROVED_REFERENCE`, `INFORMATIONAL`; only `AUTHORITATIVE` + `active` can produce canonical regulatory truth. General web and LLM output are not legal source of truth. |
| Regulatory ingestion | `regulatory-ingestion-contract-v1` in `regulatory_ingestions`; every run links source, `knowledge_document_id`, version identifier, checksums, acquisition metadata, parser/extraction method and provenance. |
| Knowledge reuse | Regulatory documents are `knowledge_documents(scope='REGULATORY', tenant_id=NULL, source_authority='authoritative')`; no `regulatory_documents_v2`, no KB v3. |
| Chunk reuse | `knowledge_document_chunks` remains canonical chunk text truth and is extended with `scope`; regulatory chunks use `scope='REGULATORY'` and `tenant_id=NULL`; no `regulatory_chunks`. |
| Regulation | `regulation-model-v1` in `regulations`; stable legal/regulatory identity by scope/tenant-normalized `regulation_key`, jurisdiction, source and official identifier/title/type. |
| RegulationVersion | `regulation-version-model-v1` in `regulation_versions`; immutable publication/version row with content checksum, document/ingestion linkage and supersession lineage. |
| LegalObligation | `legal-obligation-model-v1` in `legal_obligations`; explicit governed obligations tied to regulation/version and optional source chunk/checksum. LLM suggestions cannot publish legal truth. |
| Tenant isolation | Public regulatory sources/regulations are global/jurisdictional; `TENANT_PRIVATE` source/regulation rows are tenant-scoped. Tenant identity is service context, not body authority. |
| Future boundary | Semantic diff and packs extend these tables and F6.10 retrieval/RAG, not create parallel document/chunk/embedding/retrieval models. |
| Formula/source contracts | `FORMULAS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `SEMANTIC_CONTRACTS_VERSIONED=[]`. |

## F6.11-B Semantic Diff And Regulatory Packs

Status: CLOSED / PASS_RUNTIME by `docs/codex/handoffs/6.11-B-RUNTIME-CLOSURE.md`.

| Contract Area | Canonical Definition |
|---|---|
| Consolidated packages | 6.11-04 Semantic Diff, 6.11-05 Regulatory Pack CL-LAW-21719 model support, 6.11-06 Regulatory Pack CL-LAW-21663 model support. |
| Service owner | `backend/src/services/knowledge-base/regulatoryDiffPacks.service.js` under CODEX B / Knowledge-Regulatory boundary. |
| Semantic Diff | `regulatory-semantic-diff-contract-v1` in `regulatory_semantic_diffs`; compares two different `regulation_versions` from the same `regulation_id`, using canonical document/chunk/obligation references. |
| Diff method | `section-anchor-token-jaccard-v1`; deterministic section anchor/checksum matching plus bounded token similarity; technical timestamps are excluded from semantic identity. |
| Diff changes | `regulatory_semantic_diff_changes` stores `added`, `removed`, `modified`, `moved`, `unchanged` and `unaffected` changes for `text_section`, `legal_obligation`, `version_temporality` and `reference_scope` where supported by data. |
| Obligation lineage | `regulatory_obligation_change_lineage` relates previous/new `legal_obligations` as `added`, `modified`, `removed`, `deprecated`, `unchanged` or `unaffected`; historical obligations are not overwritten or deleted. |
| AI boundary | `ai_interpretation_status` can only be non-authoritative draft/review metadata; `AI_SEMANTIC_DIFF_TRUTH_AUTHORITY=0`, `AI_LEGAL_OBLIGATION_PUBLISH_AUTHORITY=0`, `LLM_DIRECT_SQL=0`. |
| Pack identity | `regulatory-pack-model-v1` in `regulatory_packs`; stable by `(scope, tenant-normalized id, pack_key)`, with `GLOBAL`, `JURISDICTIONAL` and `TENANT_PRIVATE` scope. |
| Pack versioning | `regulatory_pack_versions` stores `version_identifier`, lifecycle, effective dates, supersession and `composition_checksum`; checksums reference canonical object ids and metadata, not copied legal text. |
| Pack composition | `regulatory_pack_items` references canonical `regulatory_authoritative_sources`, `regulations`, `regulation_versions`, `legal_obligations` or `regulatory_semantic_diffs`; `mapping_targets` are governed hints requiring real equivalence/review. |
| Tenant activation | `regulatory-pack-activation-contract-v1` in `regulatory_pack_tenant_activations`; tenant id comes from authenticated context and activation/configuration does not mutate global pack definition. |
| Applicability | `regulatory-pack-applicability-contract-v1` in `regulatory_pack_applicability_evaluations` and `regulatory_pack_applicability_results`; produces draft recommendation/confidence/provenance and requires human confirmation for sensitive applicability. |
| Audit | `regulatory_governance_audit` captures actor, tenant when applicable, object, contract version, source/regulation/version ids, correlation id and metadata without full document text or secrets. |
| Ley 21.719 / Ley 21.663 boundary | `CL-LAW-21719` and `CL-LAW-21663` are supported as data-driven pack keys over canonical records. F6.11-B does not fabricate law text or obligations; runtime must use authoritative ingested `regulations`/`regulation_versions`/`legal_obligations`. |
| API/RBAC | No new HTTP route in F6.11-B; service methods are internal. Existing RBAC remains protected and unchanged. Future routes must add explicit read/manage/review/activate permissions. |
| Knowledge/RAG reuse | Uses `knowledge_documents`, `knowledge_document_chunks`, `knowledge_chunk_embeddings`, Hybrid Retrieval and grounded RAG as existing owners; no KB v3, no `regulatory_chunks`, no regulatory embeddings/retrieval engine. |
| Formula/source contracts | `FORMULAS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `SEMANTIC_CONTRACTS_VERSIONED=[]`; `MIGRATIONS_CHANGED=YES_FORWARD_ONLY`. |

## F6.12-A Context Builders, Pattern/Trend, Anomaly And Cross-GRC Intelligence

Status: CLOSED / PASS_RUNTIME on production/main `6aed2555524e1ab146ab9c25af4015401abfd7be`; documented by `docs/codex/handoffs/6.12-A-RUNTIME-CLOSURE.md`.

| Contract Area | Canonical Definition |
|---|---|
| Context contract | `canonical-intelligence-context-v1` in `backend/src/services/intelligence/crossGrcIntelligence.service.js`. |
| Categories | Separates `facts`, `derived_signals`, `retrieved_knowledge`, `regulatory_context`, `historical_context`, `missing_context` and `insufficient_context` with provenance. |
| Tenant scope | Tenant is mandatory for backend context building; rows carrying another tenant are discarded and empty tenant returns insufficient context without fallback. |
| AI Engine adapter | `ai-engine/app/services/context_builder.py` now returns `tenant_scope_required` without querying context when tenant is absent; standard fallback is explicit opt-in via `allow_standard_fallback`. |
| Prompt builder | `intelligence.prompt-builder.js` accepts compact canonical context and still applies guardrails: no full KB, no long licensed text, no secrets. |
| Pattern/Trend | `pattern-trend-engine-v1` uses `linear-delta-v1` and `threshold-crossing-v1` over bounded historical series; min periods are required before declaring a trend/pattern. |
| Anomaly | `anomaly-engine-v1` uses `robust-z-score-mad-v1` over explicit baseline window; sparse/zero-variance baselines return `insufficient_data`, not fake anomalies. |
| Orchestrator | `cross-grc-intelligence-orchestrator-v1` builds context once, runs applicable deterministic engines and invokes adapters for Priority Engine 2, Impact Graph, grounded RAG and regulatory context when provided. |
| Priority boundary | Priority context is delegated to `priorityEngine.service.js` / `priority-engine-2-v1`; no local priority scoring or priority storage. |
| Impact Graph boundary | Relationship context is delegated to `impactGraph.service.js` / `impact-graph-2-foundation-v1`; no graph storage or traversal engine copy. |
| Knowledge/RAG boundary | Grounded explanations are delegated to `knowledgeRag.service.js` / `rag-grounded-answer-contract-v1`; no second retrieval engine or RAG truth table. |
| Regulatory boundary | Regulatory items are references/context from F6.11-A/B owners or injected provider; no legal text copy or regulatory model fork. |
| Data Trust | Missing/no-data remains `insufficient_data`; trust is derived from source states and never from metric value or LLM explanation. |
| Temporal semantics | Separates event/observation/period/regulatory effective/analysis/technical evaluation time; `now()` only sets technical evaluation time. |
| Persistence | Runtime projection only; no migration, no table, no ledger and no cache truth added. |
| API/RBAC | No new HTTP route; existing `/api/intelligence` RBAC remains read-only. |
| AI boundary | `AI_PATTERN_TRUTH_AUTHORITY=0`, `LLM_ANOMALY_TRUTH_AUTHORITY=0`, `AI_CROSS_GRC_TRUTH_AUTHORITY=0`, `LLM_DIRECT_SQL=0`. |
| Formula/source contracts | `FORMULAS_VERSIONED=[]`; `MATH_GOVERNANCE_SOURCE_CONTRACTS_VERSIONED=[]`; `SEMANTIC_CONTRACTS_VERSIONED=[]`; `MIGRATIONS_CHANGED=NO`. |

## PUI-01 Source Ownership Inventory

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-01-source-contract-ownership`.

| Metric/Family | Contract | Canonical Source | Producer | Fields | Tenant Scope | Resolver/Adapter | Fallback | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| CONTROL-EFFECT / `F5_5_CONTROL_EFFECTIVENESS` dimensions | `control_assurance_evidence` v3 | Explicit control dimension fields only | `grc_control_assurance` and governed control assurance rows | `design_score`/`design_effectiveness`, `implementation_score`/`implementation_effectiveness`, `operation_score`/`operation_effectiveness`/`operating_effectiveness`, `evidence_score`/`evidence_effectiveness` | `tenant_id` required; adapter filters `a.tenant_id=$1::uuid` | `queryControls` + `mapFormulaInput('F5_5_CONTROL_EFFECTIVENESS')` | Legacy tables may provide rows, but aggregate `score` is not valid for D/I/O/E dimensions | CANONICAL | `backend/src/services/math-governance/sourceContracts.service.js`; `sourceResolver.service.js`; `sourceResolver.test.js` |
| Control aggregate effectiveness / composite assurance score | `control_assurance_evidence` v3 | Aggregate assurance score as aggregate only | `grc_control_assurance` or explicit legacy adapter row with `score` | `score` mapped to `effectivenesses`/aggregate use; not to D/I/O/E | `tenant_id` required through resolver and adapter | `queryControls`; `mapFormulaInput('F5_5_COMBINED_EFFECTIVENESS')`; residual risk control effectiveness mapping where present | Explicit first-populated legacy fallback with warning; no semantic expansion | CANONICAL | `sourceContracts.service.js`; `sourceResolver.service.js` |
| RISK-INHERENT / `F5_5_INHERENT_RISK` | `risk_register_controls` v3 | Latest completed/reviewed ISO risk matrix items, else operational risk rows | `iso_risk_matrix_runs` + `iso_risk_matrix_items`; fallback operational risk tables | `probability`/`likelihood`, `impact`, computed `inherent_risk_score=probability*impact` | `tenant_id` required; primary query filters run and item tenant; fallback uses tenant filter | `queryRisk`; `riskInherentPortfolio`; `mapFormulaInput('F5_5_INHERENT_RISK')` | `grc_quantitative_risk_assessments`, `asset_risks`, `privacy_dpia_risks` are explicit legacy fallbacks | CANONICAL | `sourceContracts.service.js`; `sourceResolver.service.js`; `sourceResolver.test.js` |
| MATURITY / `F5_5_MATURITY` | `maturity_assessments` v7 | Published/effective maturity evaluations; metric measurements only when bound to maturity | `survey_evaluations`; scoped metric measurement definitions/bindings | `level`/`maturity_level`/`score`/`total_score`; `weight`; `evaluation_status`/`quality_status`/`official_state`; metric fallback restricted by `MATURITY` or `F5_5_MATURITY` binding | `tenant_id` required; every candidate query filters tenant | `queryMaturity`; `maturityPortfolio`; `mapFormulaInput('F5_5_MATURITY')` | `metric_measurements` and `grc_metric_measurements` only with explicit maturity predicate; invalid/non-0..5 levels excluded; producer-known non-final statuses are `status_not_eligible` | CANONICAL | `sourceContracts.service.js`; `statusSemantics.service.js`; `sourceResolver.service.js`; `sourceResolver.test.js` |

PUI-01 decision: an aggregate/composite score can be a valid source only for aggregate/composite calculations. It is never a valid substitute for missing formula dimensions. Missing source, missing dimension, no-data, insufficient-data and excluded rows remain distinct from numeric zero.

PUI-02+ boundary: scale/unit metadata, temporal classification, count semantics and broader 22+ indicator matrix remain for their own work packages; PUI-01 closes source ownership for the rows above only.

## PUI-02 Scale And Unit Contract Inventory

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-02-scale-unit-contract`.

| Variable/Metric | Contract | Source Field | Source Scale | Source Unit | Canonical Scale | Canonical Unit | Strategy | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| CONTROL-EFFECT D/I/O/E | `control_assurance_evidence` v3 | `design_score`, `implementation_score`, `operation_score`, `evidence_score` and explicit effectiveness aliases | `PERCENT_0_100` | `percent` | `RATIO_0_1` | `ratio` | `percent_to_ratio`; no `0.8 == 80%` inference | CANONICAL | `sourceContracts.service.js`; `sourceResolver.service.js`; `sourceResolver.test.js` |
| Control aggregate effectiveness | `control_assurance_evidence` v3 | `score` | `PERCENT_0_100` | `percent` | `RATIO_0_1` | `ratio` | `percent_to_ratio`; aggregate remains aggregate only | CANONICAL | same files |
| RISK-INHERENT axes | `risk_register_controls` v3 | `probability`/`likelihood`, `impact` | `SCORE_1_5` | `score` | `SCORE_1_5` | `score` | `identity_integer`; 0 and non-integers invalid | CANONICAL | same files |
| Residual risk control effectiveness input | `risk_register_controls` v3 | `assurance_score`, `control_effectiveness*`, `control_score`, `effectiveness_score` | `PERCENT_0_100` | `percent` | `RATIO_0_1` | `ratio` | `percent_to_ratio`; missing remains null | CANONICAL | same files |
| MATURITY level | `maturity_assessments` v7 | `level`, `maturity_level`, `numeric_value`, `value_numeric` | `SCORE_0_5` | `level` | `SCORE_0_5` | `level` | `identity`; values outside 0..5 invalid | CANONICAL | same files |
| MATURITY score fallback | `maturity_assessments` v7 | `score`, `total_score` or row `__scale_level_source=PERCENT_0_100` | `PERCENT_0_100` | `percent` | `SCORE_0_5` | `level` | `percent_to_score_0_5`; only when scale is declared | CANONICAL | same files |
| Supplier risk health support | `supplier_tprm_assessments` | supplier risk dimension scores | `SCORE_0_5` | `score` | `PERCENT_0_100` | `percent` | `score_0_5_to_percent`; removed `<=5 ? *20 : value` inference | CANONICAL | same files |

PUI-02 decision: numeric normalization is driven by `scale_metadata` in the source contract. `source_scale`, `source_unit`, source range, canonical range, canonical unit and `normalization_strategy` are explicit for the PUI-02 variables above. Out-of-range values return invalid/excluded/null according to the existing resolver path; they are not clamped and are not converted to zero.

## PUI-03 Count And Population Semantics

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-03-count-population-semantics`.

Canonical count terms:

| Term | Canonical Semantics |
|---|---|
| `received` | Physical rows after tenant/source scoping and row normalization, before contract/dataset eligibility. |
| `eligible` | Rows that pass contract/dataset eligibility validation and belong to the official population before formula-specific input validation. |
| `usable` | Eligible rows with sufficient valid formula inputs. |
| `excluded` | Unique physical rows received but not used by the formula. It is a row count, not an issue count. |
| `ineligible` | Received rows excluded by contract/dataset validation. |
| `eligible_unusable` | Eligible rows excluded by formula-specific input validation. |
| `exclusionIssueCount` | Distinct exclusion issue categories/codes. |
| `exclusionIssueInstanceCount` | Total exclusion issue instances, preserving multiple issues per row for audit. |
| `population_size` | Official eligible population size: the population the formula operates over before formula-specific usability exclusions. |

PUI-03 inventory:

| Metric/Family | Contract | Physical Received | Eligibility Rule | Usable Rule | Excluded Semantics | Issue Count | population_size | Status | Evidence |
|---|---:|---|---|---|---|---|---|---|---|
| Dataset validation / all source contracts | contract-specific source | `rows.length` after tenant/source scope | rows passing tenant, required field, range, scale, state, reference and current period validation | same as eligible at dataset-validation stage | unique invalid rows; `excluded = received - usable` | distinct issue codes; instances also tracked | eligible rows | CANONICAL | `datasetValidation.service.js`; `sourceResolver.test.js` |
| RISK-INHERENT | `risk_register_controls` v3 | normalized resolver rows | `validation.usable_rows.length` | rows with valid probability/likelihood and impact under PUI-02 scale rules | received rows not in formula rows | `risk_axis_invalid` category count; instances retained | eligible rows | CANONICAL | `sourceResolver.service.js`; `sourceResolver.test.js` |
| MATURITY | `maturity_assessments` v7 | normalized resolver rows | `validation.usable_rows.length` | rows with a declared valid maturity level/score after PUI-02 normalization and eligible maturity status | received rows not in formula rows | `status_not_eligible`, `status_unmapped`, `maturity_level_scale_invalid` category count; instances retained | eligible rows | CANONICAL | `sourceResolver.service.js`; `sourceResolver.test.js` |
| Severity index / audit findings | `audit_findings_actions` v9 | normalized resolver rows | `validation.usable_rows.length` | rows with severity low/medium/high/critical | received rows not in formula rows; severity `info` is known but not weighted | `severity_not_eligible` / `severity_missing_or_invalid` category count; instances retained | eligible rows | CANONICAL | `sourceResolver.service.js`; `sourceResolver.test.js` |
| Generic source resolver mappings | formula source contract | normalized resolver rows | `validation.usable_rows.length` | same as eligible unless a formula-specific mapper applies | received rows not used by formula | distinct issue codes; instances retained | eligible rows | CANONICAL | `sourceResolver.service.js` |

PUI-03 decision: `source_snapshot.counts` and resolver `counts` carry the canonical population contract. `source_snapshot.exclusions` carries auditable issue detail; row counts live in `excluded_rows`, `ineligible_rows`, `eligible_unusable_rows` and `counts`. A source with `received > 0` and `usable = 0` is no longer represented as `empty_dataset`; it remains distinguishable as validated-with-warnings/insufficient-data for downstream state handling.

## PUI-04 Temporal Semantics

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-04-temporal-semantics`. Manual focal/deploy validation later confirmed externally on `main/deploy` commit `7a9df185f06be031757d0d79f25aa59b27a53bbf`.

Canonical temporal terms:

| Term | Canonical Semantics |
|---|---|
| `canonical_time_field` | Contract-declared field used by dataset validation; resolver-normalized rows use `__event_time` when available. |
| `source_time_fields` | Explicit ordered physical/normalized fields allowed to produce canonical time in adapters. No implicit repo-wide `created_at` fallback. |
| `time_meaning` | Domain meaning of the timestamp, e.g. occurrence time, assessment time, state effective time or calculation period end. |
| `period_policy` | Requested period is interpreted as `start_inclusive_end_exclusive`. |
| `as_of_policy` | Records after explicit `as_of` are excluded with `temporal_after_as_of`; no future data is consumed silently. |
| `missing_time_policy` | Missing required temporal data is excluded with `temporal_missing_required_time`; it is not imputed to current time, epoch or `created_at`. |
| `validity_interval` | Contracts with interval semantics use declared `valid_from_fields`/`valid_to_fields` and period overlap, so records created before a period can remain eligible when still valid. |

PUI-04 source contract inventory:

| Source Contract | Version | Class | Canonical temporal field | Time meaning | Existing filter after PUI-04 | Decision | Status |
|---|---:|---|---|---|---|---|---|
| `compliance_requirements_assessments` | v4 | latest_effective_state | `__event_time` / `assessed_at` | compliance mapping assessment state time | tenant scope only before validation | explicit state time; no generic `created_at` period default | CANONICAL |
| `grc_readiness_operational_snapshot` | v4 | state_snapshot | `__event_time` | readiness snapshot as-of time | tenant scope only before validation | snapshot as-of governs period classification | CANONICAL |
| `risk_register_controls` | v5 | latest_effective_state | `__event_time` | risk assessment effective time | latest completed/reviewed run constrained by `as_of`/period end; fallback tenant scope only | latest-effective risk state is explicit | CANONICAL |
| `control_assurance_evidence` | v5 | state_snapshot | `__event_time` | control assurance calculation time | tenant scope only before validation | calculated assurance time is canonical | CANONICAL |
| `audit_findings_actions` | v9 | validity_interval | `__event_time`; interval `opened_at`/`created_at` or snapshot `period_start`/`generated_at` to `closed_at`/`completed_at`/`period_end` | action lifecycle or readiness snapshot finding time | tenant scope; latest update limited by `as_of` when provided; readiness findings join snapshot parent | period eligibility uses lifecycle/snapshot overlap without synthetic timestamps; `grc_readiness_snapshots.source_as_of` is not a physical field | CANONICAL |
| `incident_operational_events` | v3 | event_stream | `__event_time` | incident report/detection time | tenant scope only before validation | event time governs inclusion | CANONICAL |
| `evidence_freshness_records` | v3 | validity_interval | `__event_time`; interval review/submission to `expires_at` | evidence review/submission time | tenant scope only before validation | freshness validity is explicit | CANONICAL |
| `loss_events_operational` | v4 | event_stream | `__event_time` | loss occurrence time | tenant scope/status only before validation | `occurred_at`/`event_date` only; no fallback to `created_at` for future/missing occurrence | CANONICAL |
| `continuity_resilience_tests` | v3 | event_stream | `__event_time` | resilience test completion time | tenant scope/status/completed only before validation | completed test time governs inclusion | CANONICAL |
| `asset_inventory_security` | v3 | latest_effective_state | `__event_time` | asset inventory state time | tenant scope only before validation | inventory state time explicit | CANONICAL |
| `supplier_tprm_assessments` | v3 | state_snapshot | `__event_time` | supplier assessment decision time | tenant scope/status only before validation | approved/submitted assessment time explicit | CANONICAL |
| `survey_response_scoring` | v3 | event_stream | `__event_time` | survey response submission time | tenant scope only before validation | submitted response time explicit | CANONICAL |
| `assurance_test_results` | v3 | event_stream | `__event_time` | assurance test execution time | tenant scope only before validation | executed/tested time explicit | CANONICAL |
| `data_quality_observations` | v3 | event_stream | `__event_time` | data quality assessment time | tenant scope only before validation | assessed time explicit | CANONICAL |
| `data_lineage_observations` | v3 | event_stream | `__event_time` | lineage relation observation time | tenant scope only before validation | `created_at` is allowed only as declared relation observation time | CANONICAL |
| `statistical_metric_measurements` | v3 | event_stream | `__event_time` | metric measurement time | tenant scope only before validation | measured/calculated/period_end fields explicit | CANONICAL |
| `indicator_data_trust_assessments` | v3 | event_stream | `__event_time` | data trust assessment time | tenant scope only before validation | assessed time explicit | CANONICAL |
| `grc_health_components` | v6 | validity_interval | `__event_time`; interval `period_start`/`started_at` to `period_end`/`completed_at` | official calculation period end/completion time | tenant + formula + interval overlap | health components use official calculation interval; `period_start` is nullable and `started_at` is contractual fallback | CANONICAL |
| `maturity_assessments` | v7 | event_stream | `__event_time` | maturity evaluation/measurement time | tenant + maturity binding only before validation | survey evaluations use `confirmed_at`/`created_at`; metric measurements use declared measurement/calculation period fields | CANONICAL |
| `external_fx_rates` | v3 | latest_effective_state | `__event_time` | FX rate effective time | source unavailable | contract metadata explicit; source remains unavailable | CANONICAL |

PUI-04 decision: `official_formula_source_contracts.metadata` persists `temporal_semantics` alongside `scale_metadata` and `count_semantics`. Published source contract immutability is preserved by incrementing all 20 source contract versions because their governed payload now includes temporal metadata and no longer inherits a generic `created_at` period policy. Formula payloads, weights, expressions, units and precision were not changed.

## PUI-05 Status Semantics

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-05-status-normalization`.

Canonical status terms:

| Term | Canonical Semantics |
|---|---|
| `domain` | Explicit GRC domain used to interpret a source status; no universal status dictionary is used across domains. |
| `source_status` | Original source status value after row normalization. It remains visible in `__status_normalization`. |
| `canonical_status` | Domain-specific normalized status used by validation/formula inputs. Unknown values become `unknown`, not `pending`, `compliant`, `active` or `open`. |
| `mapping_version` | Versioned dictionary identifier, e.g. `supplier-status-map-v1`, persisted in `status_semantics` and status summary. |
| `reason` | Auditable reason for mapped, ineligible or unmapped status decisions. |
| `unknown_policy` | `exclude_visible`: unknown/unmapped statuses are preserved, reported as `status_unmapped` and excluded by dataset validation when status semantics applies. |

PUI-05 inventory:

| Domain | Source contract(s) | Source statuses observed/accepted | Current mapping location before PUI-05 | Canonical target | Ambiguity | Decision |
|---|---|---|---|---|---|---|
| compliance | `compliance_requirements_assessments` v5 | conform/compliant/effective/implemented/approved, partial/in_progress, non_conform/non_compliant/ineffective/rejected, not_applicable/na, pending/not_evaluated/draft/deleted/retired | SQL CASE in `queryCompliance`; formulas counted raw status strings | conform, partial, non_conform, not_applicable, pending, retired, unknown | `ELSE pending` hid unmapped states | `compliance-status-map-v1`; SQL unknown stays visible; draft/deleted/retired/rejected ineligible when applicable |
| readiness | `grc_readiness_operational_snapshot` v5 | ready/calculated/partial/draft when status exists | resolver rows had no domain status registry | ready, partial, draft, unknown | status optional but unversioned | `readiness-status-map-v1`; optional missing status is visible but not exclusionary |
| risk | `risk_register_controls` v6 | active/open/assessed/reviewed/completed/accepted/rejected/archived/retired | `queryRisk` filtered rejected/archived rows before validation | active, assessed, reviewed, completed, accepted, rejected, archived, unknown | status ineligibility could disappear from counts | `risk-status-map-v1`; item status exclusion moves to validation; run status selection remains source query semantics |
| control | `control_assurance_evidence` v6 | effective/partially_effective/ineffective/pass/fail/pending/draft/retired | raw assurance status and formula status sets | effective, partially_effective, ineffective, pending, draft, retired, unknown | status interpretation was not versioned | `control-status-map-v1`; optional status mapped when present |
| audit/action | `audit_findings_actions` v9 | open/pending/in_progress/active/closed/completed/resolved/overdue/cancelled/rejected/archived/not_applicable | `queryAuditActions` and `mapFormulaInput`; readiness findings have no operational status | open, in_progress, closed, completed, resolved, overdue, cancelled, rejected, archived, not_applicable, unknown | missing status previously could become open/unknown silently | `audit-status-map-v3`; readiness snapshot findings use `not_applicable`; missing/unknown remains visible elsewhere |
| incident | `incident_operational_events` v4 | open/active/investigating/contained/resolved/closed/cancelled/rejected | raw incident status | open, investigating, contained, resolved, closed, cancelled, rejected, unknown | `closed` could be confused with action closure semantics | `incident-status-map-v1`; same string may map to same canonical label but carries incident-specific reason/version |
| evidence | `evidence_freshness_records` v4 | approved/aprobada/accepted/valid/submitted/pending/pendiente/reviewed/reopened/rejected/expired | adapter defaults and freshness formula status list | approved, submitted, pending, reviewed, reopened, rejected, expired, unknown | Spanish/English approval aliases were formula-local | `evidence-status-map-v1`; approval aliases centralized |
| loss | `loss_events_operational` v5 | confirmed/approved/booked/draft/cancelled/rejected | `queryLossEvents` filtered cancelled/rejected before validation | confirmed, draft, cancelled, rejected, unknown | ineligible loss events were not reconciled as received | `loss-status-map-v1`; status filter removed from adapter; validation records ineligible rows |
| continuity | `continuity_resilience_tests` v4 | pass/passed/passed_with_observations/completed/successful/within_sla/failed/failure/planned/draft/scheduled/cancelled | SQL CASE and status filter | within_sla, failed, planned, draft, scheduled, cancelled, unknown | status filter hid ineligible test rows | `continuity-status-map-v1`; status filter removed while completed-time temporal rule remains PUI-04 |
| asset | `asset_inventory_security` v4 | active/current/retired/archived when status exists | raw row status | active, retired, archived, unknown | optional status unversioned | `asset-status-map-v1` |
| supplier | `supplier_tprm_assessments` v4 | approved/submitted/completed/active/current/qualified/draft/invited/in_progress/rejected/expired | `querySupplier` filtered ineligible statuses before validation | approved, submitted, completed, active, qualified, draft, invited, in_progress, rejected, expired, unknown | ineligible supplier assessments were not counted/explained | `supplier-status-map-v1`; filter removed and validation excludes with reason |
| survey | `survey_response_scoring` v4 | completed/submitted/approved/not_applicable/na/in_progress/draft/rejected | formulas used local completed/not-applicable sets | completed, submitted, approved, not_applicable, in_progress, draft, rejected, unknown | status sets were formula-local | `survey-status-map-v1` |
| assurance | `assurance_test_results` v4 | pass/passed/fail/failed/inconclusive/not_applicable/pending/draft | SQL CASE on result/status/outcome | pass, fail, inconclusive, not_applicable, pending, draft, unknown | result semantics were not persisted as status metadata | `assurance-status-map-v1`; source field `result` remains canonical field |
| data_quality | `data_quality_observations` v4 | valid/assessed/failed when status exists | no central status mapping | valid, assessed, failed, unknown | optional status unversioned | `data_quality-status-map-v1` |
| data_lineage | `data_lineage_observations` v4 | active/current/retired when status exists | no central status mapping | active, retired, unknown | optional status unversioned | `data_lineage-status-map-v1` |
| statistics | `statistical_metric_measurements` v4 | calculated/published/approved/draft/rejected when status exists | metric rows carried local states | calculated, published, approved, draft, rejected, unknown | optional status unversioned | `statistics-status-map-v1` |
| data_trust | `indicator_data_trust_assessments` v4 | assessed/calculated/approved/draft when `trust_status` exists | raw trust status | assessed, calculated, approved, draft, unknown | trust status had no mapping version | `data_trust-status-map-v1`; source field `trust_status` |
| health | `grc_health_components` v6 | calculated/completed/failed/cancelled in `run_status` | source query filtered calculated official runs | calculated, failed, cancelled, unknown | adapter did not project `started_at`/`completed_at` for temporal validation when `period_start` was null | `health-status-map-v1`; source field `run_status`; official run selection remains source query semantics |
| maturity | `maturity_assessments` v7 | evaluated/calculated/published/approved/confirmed/applied/valid/estimated/draft/previewed/rejected/incomplete/inconsistent/unknown and official unmeasured/error states | adapter defaults and producer statuses from `survey_evaluations`/`metric_measurements` | evaluated, calculated, published, draft, incomplete, inconsistent, unmeasured, source_unavailable, unknown | producer-known statuses could become `status_unmapped` | `maturity-status-map-v2`; confirmed/applied/valid/estimated eligible; draft/previewed/incomplete/inconsistent/unmeasured/error states visible but ineligible |
| currency_conversion | `external_fx_rates` v4 | published/active/draft when available | source unavailable | published, draft, unknown | unavailable contract still lacked governed status metadata | `currency_conversion-status-map-v1`; source remains unavailable |

PUI-05 decision: `backend/src/services/math-governance/statusSemantics.service.js` owns versioned domain dictionaries. `sourceContracts.service.js` attaches `status_semantics` to every source contract, `sourceResolver.service.js` normalizes rows before dataset validation, `datasetValidation.service.js` emits `status_summary` and `status_unmapped`/`status_not_eligible` exclusions, and `formulaBootstrap.service.js` persists `status_semantics` in `official_formula_source_contracts.metadata`. Published source contract immutability is preserved by incrementing exactly one version on each contract whose governed payload now includes `status_semantics`; formula payloads, expressions, weights, units and precision were not changed.

## PUI-06 Governed Legacy Fallback

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-06-governed-legacy-fallback`. Manual closure recorded in handoff PUI-06: focal rerun PASS and deploy/post-deploy PASS.

Canonical fallback terms:

| Term | Canonical Semantics |
|---|---|
| `primary_state` | Machine-readable state of the primary source path: `primary_available`, `primary_absent`, `primary_no_rows`, `primary_source_incompatible`, `primary_rows_excluded`, `primary_validation_failed`, `primary_unmeasured`. |
| `fallback_used` | Boolean indicating that a legacy source produced the rows consumed by the resolver. |
| `fallback_reason` | Machine-readable reason for activation; PUI-06 permits only `primary_source_absent` and `primary_no_rows`. |
| `primary_source` | Physical source considered primary for the source contract path. |
| `fallback_source` | Physical legacy source used when fallback is allowed and produces rows. |
| `fallback_summary` | Snapshot/result metadata carrying fallback state, reason, primary/fallback source and warning for observability. |

PUI-06 fallback inventory:

| Source Contract | Primary Source | Legacy/Fallback Source | Current Trigger | Allowed? | Problem | Required Policy |
|---|---|---|---|---|---|---|
| `compliance_requirements_assessments` | `grc_requirement_control_mappings` | `control_soa_assessments`, `tenant_controls` | first populated candidate | YES for primary absent/no rows | previous warning lacked machine-readable state/reason | `ALLOWED_PRIMARY_ABSENT` / `ALLOWED_PRIMARY_NO_ROWS`; no fallback after validation defects |
| `risk_register_controls` | `iso_risk_matrix_items` via latest completed/reviewed run | `grc_quantitative_risk_assessments`, `asset_risks`, `privacy_dpia_risks` | primary ISO source absent/no rows | YES for primary absent/no rows | primary ISO state was lost when entering operational legacy list | preserve `primary_source=iso_risk_matrix_items`, `primary_state`, `fallback_reason` |
| `control_assurance_evidence` | `grc_control_assurance` | `control_soa_assessments`, `control_health_scores`, `tenant_controls` | primary absent/no rows | YES for primary absent/no rows | primary direct-source empty state was not observable | preserve `primary_state` and fallback provenance |
| `audit_findings_actions` | formula-dependent first candidate (`action_plans` or `grc_readiness_findings`) | `findings`, alternate action/readiness tables | first populated candidate | YES for primary absent/no rows | warning-only fallback | machine-readable fallback metadata |
| `evidence_freshness_records` | `evidences` | `grc_evidence_versions` with submission/review joins | primary absent/no rows | YES for primary absent/no rows | fallback source needed structured observability | `fallback_summary` plus existing physical source |
| `maturity_assessments` | `survey_evaluations` | `metric_measurements`, `grc_metric_measurements` with maturity predicates | primary absent/no rows | YES for primary absent/no rows | fallback must not hide invalid maturity rows | only source absence/no rows can trigger fallback; scale invalid remains exclusion |
| Other source contracts | first contract table or direct adapter source | none explicitly authorized | primary absent/no rows | NO | generic table lists are not treated as implicit fallback permission | `NOT_APPLICABLE`; no legacy query if policy not explicit |

PUI-06 decision: fallback policy is centralized in `sourceResolver.service.js` through `LEGACY_FALLBACK_POLICY_BY_SOURCE` and `canUseLegacyFallback`. It is resolver execution policy, not source contract payload, so no source contract version bump is required. Fallback is never activated after `contract_invalid`, `source_incompatible`, `primary_rows_excluded`, `status_unmapped`, temporal exclusions, scale/unit invalidity or formula input exclusions. `source_snapshot` and resolver result expose `fallback_summary`, `fallback_used`, `fallback_reason` and `primary_state`. Formula payloads, weights, expressions, units and precision were not changed.

CONTRACTS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-07-HF4 Severity Index Source Ownership Closure

Status: DONE_LOCAL on branch `fix/pui-07-hf4-severity-index-source-closure`; runtime validation pending by design.

Canonical source decision:

| Formula | Canonical source code | Canonical physical source | Allowed fallbacks | Legacy/non-canonical paths |
|---|---|---|---|---|
| `F5_5_SEVERITY_INDEX` | `audit_findings_actions` | `grc_readiness_findings` joined to parent `grc_readiness_snapshots` when present; otherwise governed audit/action physical sources under the same source contract | `NONE` for formula-to-source override; only existing `audit_findings_actions` contract fallback policy may apply for primary absent/no rows | `incident_operational_events` / `grc_incidents` are canonical for incident indicators, not for `F5_5_SEVERITY_INDEX`; request overrides to that source are ignored with warning and cannot displace the Severity Index contract |

Decision:

- `FORMULA_SOURCE_MAP` and formula registry already published `F5_5_SEVERITY_INDEX -> audit_findings_actions`; HF4 did not change source contract payload.
- The runtime inconsistency came from execution-time `source_overrides` / `body.source_code` being accepted before canonical formula-to-source ownership was enforced.
- For `F5_5_SEVERITY_INDEX`, `officialCalculationOrchestrator` and `sourceResolver` now constrain requested non-canonical source codes to the formula's canonical source code and expose `requested_source_code`, `canonical_source_code`, `source_override_ignored` and warning `source_override_ignored_non_canonical:<requested>-><canonical>` in result/snapshot provenance.
- `SOURCE_SCHEMA_INCOMPATIBLE` remains valid for genuinely incompatible canonical physical schema, but `incident_operational_events/grc_incidents` can no longer create a false positive for `F5_5_SEVERITY_INDEX`.

SOURCE_CONTRACTS_VERSIONED: `[]`

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## NORMALIZATION-02 KPI / Health Canonical Authority

Status: `VERIFIED_LOCAL`

| Contract | Authority | Version | Scope | Notes |
|---|---|---:|---|---|
| `canonical-health-projection-v1` | `official_formula_versions+calculation_runs+calculation_outputs+metric_snapshots+metric_source_bindings` | 1 | Health/KPI/GRC overview read model | Single read projection for `/api/health/*`, `/api/grc/overview`, `/dashboard`, `/health`, `/iso-health`. |
| `F5_5_GRC_HEALTH` | official formula registry and DB `official_formula_versions` | 2 | Global Health Score | Dynamic denominator only over `AVAILABLE`; only `NOT_APPLICABLE` leaves denominator; `MISSING/NOT_CONFIGURED/STALE/INVALID/UNKNOWN` reduce coverage/confidence. |
| `GRC-HEALTH` | `metric_definition_versions` + `metric_source_bindings` + `metric_calculation_policies` | 2 | Executive KPI | `minimum_coverage=0.80`; score can be internally computed below threshold but is not published as executive score. |
| `EVIDENCE-FRESH` / `COVERAGE` | existing official metric keys | 1 | Evidence freshness and coverage | `EVIDENCE-COVERAGE` is not an official duplicate; compatibility expectation maps to these existing keys. |
| `KPI-HLT-*` | legacy operational health snapshots/views | legacy | Compatibility/source components | Historical and operational detail only; cannot be displayed as a second Global Score authority. |

Registered policies:

```text
GLOBAL_HEALTH_AUTHORITY=official_formula_versions+calculation_runs+calculation_outputs+metric_snapshots+metric_source_bindings
GLOBAL_SCORE_FORMULA=F5_5_GRC_HEALTH
GLOBAL_SCORE_VERSION=2
GLOBAL_SCORE_COVERAGE_POLICY=available_weight/applicable_weight; publish only when coverage >= minimum_coverage
DATA_TRUST_ACCURACY_POLICY=accuracy remains NOT_CONFIGURED until a real measurable source or canonical binding exists
EVIDENCE_COVERAGE_MAPPING=EVIDENCE-FRESH=freshness; COVERAGE=compliance_coverage; EVIDENCE-COVERAGE=compatibility_alias_only
LEGACY_KPI_HLT_ROLE=COMPATIBILITY_SOURCE_COMPONENT
```

## PUI-08 Official Indicator Matrix

Status: DONE_LOCAL under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-08-official-indicator-matrix-closure`.

Machine-readable artifact:

- `backend/src/services/math-governance/officialIndicatorMatrix.service.js`
- Validation: `backend/src/services/math-governance/officialIndicatorMatrix.test.js`
- Matrix version: `pui-08-official-indicator-matrix-v1`

Canonical decision:

| Area | Contract |
|---|---|
| Formula coverage | `OFFICIAL_FORMULA_COUNT=53`; every row derives from `FORMULAS` and retains formula version/unit. |
| Source ownership | Every formula row uses `FORMULA_SOURCE_MAP` and a published source contract with version/checksum. |
| Physical source coverage | Every row exposes physical sources from the source contract; `F5_5_SEVERITY_INDEX` is explicitly `grc_readiness_findings + grc_readiness_snapshots`. |
| Temporal/status/count semantics | Every row carries the source contract `temporal_semantics`, `status_semantics` and `count_semantics`; no PUI-01..PUI-07 contract is reopened. |
| Empty behavior | Empty/no applicable source remains `not_calculable` with `value=null`; no null/no-data/insufficient-data is converted to zero. |
| Partial behavior | Exclusions and count reconciliation are required; silent fallback is forbidden. |
| Sufficient behavior | Formula output must be deterministic, calculated through formula registry/orchestrator, with snapshot, lineage and Data Trust. |
| Tenant behavior | Two-tenant scenario requires isolated datasets and forbids cross-tenant lineage leaks. |
| Consumers | Consumers are official projections only: orchestrator/source resolver/persistence, analytics catalog, functional indicator catalog, Formula Catalog, dashboard official metrics and reports/exports via persisted official calculations. |
| Dependency graph | Dependencies are explicit for readiness, residual risk and GRC health; cycles are forbidden. |

PUI-08 does not change source contract payload, formula payload, formula expression, weights, units or precision.

SOURCE_CONTRACTS_VERSIONED: `[]`

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-09 Runtime Phase Closure

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `docs/pui-09-runtime-phase-closure`.

Runtime evidence accepted:

| Evidence | Result |
|---|---|
| Production commit | `2a526d6329f7abae0119a782f99cd64aeed01892` |
| Official formula matrix | `PUI_08_OFFICIAL_INDICATOR_MATRIX_OK`; 53 formulas, 20 source contracts, 9 consumers |
| Formula/source/orchestrator regressions | `PHASE5_5_FORMULA_TESTS_OK`, `PHASE5_5_SOURCE_RESOLVER_TESTS_OK`, `OFFICIAL_CALCULATION_ORCHESTRATOR_TESTS_OK`, `PHASE5_5_PACKAGE5_TESTS_OK`, `indicatorCore tests passed` |
| Source compatibility | 0 calculated runs with `source_unavailable` or `source_incompatible` |
| Snapshot coverage | 16 calculated runs, 16 snapshots, 0 missing snapshots |
| Lineage coverage | 0 empty lineage for populated calculation snapshots |
| Null/zero contract | 0 `not_calculable` outputs persisted as zero; 0 `not_calculable` outputs persisted as `completed` |
| Data Trust | `data-trust-model-v1` present in runtime snapshots/results |
| Severity Index | `F5_5_SEVERITY_INDEX` calculated with `source_code=audit_findings_actions`, physical source `grc_readiness_findings`, `trust_status=trusted`, value `42.5` |
| Multi-tenant | Runtime evidence shows different historical `F5_5_INHERENT_RISK` values across tenants, preserving tenant isolation |

PUI-09 does not change source contract payload, formula payload, formula expression, weights, units or precision.

PUI_PHASE: `CLOSED`

PRE_UI_DATA_TRUTH_GATE: `PASS`

SOURCE_CONTRACTS_VERSIONED: `[]`

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-07-HF5 Severity Index Snapshot Schema Compatibility

Status: DONE_LOCAL on branch `fix/pui-07-hf5-severity-index-schema-compatibility`; runtime validation pending by design.

Schema evidence:

```text
grc_readiness_snapshots:
  generated_at: YES
  period_start: YES
  period_end: YES
  source_as_of: NO
```

Canonical decision:

| Formula | Source contract | Version | Canonical physical source | Temporal fields | Non-canonical path |
|---|---|---:|---|---|---|
| `F5_5_SEVERITY_INDEX` | `audit_findings_actions` | v9 | `grc_readiness_findings` joined to parent `grc_readiness_snapshots` | `period_start`, `period_end`, `generated_at`; no `source_as_of` dependency | `incident_operational_events` / `grc_incidents` remain non-canonical and cannot displace ownership |

Notes:

- The Severity adapter no longer references `s.source_as_of`; this removes the false `SOURCE_SCHEMA_INCOMPATIBLE` caused by a non-existent physical column.
- `audit_findings_actions` v8->v9 removes `source_as_of` from governed `columns`, `temporal_semantics.source_time_fields` and `temporal_semantics.valid_from_fields`.
- Empty canonical readiness findings return empty/not-calculable source evidence, not a fabricated zero severity portfolio.
- Formula expression, weights, units and precision are unchanged.

Source contract versions changed: `audit_findings_actions` v8->v9.

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-07 Data Trust

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-07-data-trust`.

Existing foundation distinguished:

- `indicator_data_trust_assessments` and `F5_C3_DATA_TRUST` remain an operational dataset/formula for persisted trust assessments.
- PUI-07 adds deterministic trust assessment for each Math Governance source resolution; it does not replace or recursively consume the operational `indicator_data_trust_assessments` source contract.

Canonical Data Trust model:

| Contract Element | Decision |
|---|---|
| model version | `data-trust-model-v1` |
| owner | `backend/src/services/math-governance/dataTrust.service.js` |
| states | `TRUSTED`, `TRUSTED_WITH_WARNINGS`, `LOW_CONFIDENCE`, `INSUFFICIENT_DATA`, `UNTRUSTED`, `UNMEASURED` |
| dimensions | `source_validity`, `completeness`, `population_sufficiency`, `field_validity`, `temporal_validity`, `status_validity`, `scale_unit_validity`, `consistency`, `fallback_dependency`, `provenance_completeness` |
| reasons | `source_unavailable`, `source_incompatible`, `source_contract_invalid`, `no_received_rows`, `insufficient_population`, `high_exclusion_ratio`, `validation_warnings`, `fallback_used`, `status_unmapped`, `status_not_eligible`, `temporal_invalid`, `scale_unit_invalid`, `missing_required_fields`, `provenance_incomplete`, `consistency_issues` |
| source of truth | Existing resolver/validation signals from PUI-01..PUI-06; no metric-value based trust and no AI scoring. |

PUI-07 decision: Data Trust is deterministic, versioned and attached to `source_snapshot.data_trust`, resolver `data_trust`, official calculation result context and persisted snapshot metadata. It distinguishes insufficient population from low confidence: insufficient usable population yields `INSUFFICIENT_DATA`; sufficient population with high exclusion ratio yields `LOW_CONFIDENCE`. Fallback legacy yields an explicit warning/reason and can produce `TRUSTED_WITH_WARNINGS`, not automatic `UNTRUSTED`.

Source contracts changed: `NONE`

SOURCE_CONTRACTS_VERSIONED: `[]`

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-07-HF1 Official Calculation Pipeline Consolidation

Status: DONE_LOCAL under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `hotfix/pui-07-hf1-official-pipeline-consolidation`.

Canonical pipeline:

```text
consumer
-> officialCalculationOrchestrator
-> sourceResolver
-> source contracts / validation / Data Trust
-> official result
-> calculation_run + output + explanation + source snapshot
```

Decisions:

- `phase5Package3.service.js` no longer calculates from overview blocks and throws `PACKAGE3_CANONICAL_ORCHESTRATOR_REQUIRED` for direct calculation attempts.
- `phase5.service.js` redirects Package3-compatible overview and single-metric recalculation consumers to `officialCalculationOrchestrator.recalculateOfficialAnalytics`.
- `not_calculable` results are persisted with machine-readable reason, `data_trust`, source context and source snapshot/provenance when the persistence layer is available.
- Legacy `trust_score` and `trust_status` remain only as compatibility projections derived from canonical `data_trust` when present.
- Formula expressions, weights, units, precision, source contract payloads and formula payloads were not changed.

SOURCE_CONTRACTS_VERSIONED: `[]`

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-07-HF2 Runtime Source Semantics Reconciliation

Status: READY_FOR_RUNTIME_VALIDATION local on branch `fix/pui-07-hf2-runtime-source-semantics`.

Canonical producer-consumer status reconciliation:

| Domain | Source contract | Producer-known statuses reconciled | Canonical/eligibility decision |
|---|---|---|---|
| risk | `risk_register_controls` v7 | `suggested`, `accepted`, `rejected`, `needs_review`, `archived` | `accepted` remains eligible; `suggested` and `needs_review` are legitimate workflow states but not official accepted/reviewed risk population; rejected/archived remain ineligible. |
| control | `control_assurance_evidence` v7 | `unknown`, `incomplete`, `degraded`, `effective`, `ineffective` | `degraded` maps to `partially_effective` and remains eligible with its score; `incomplete` remains visible/eligible; `unknown` is visible but ineligible. |
| audit/action | `audit_findings_actions` v7 | `abierto`, `en progreso`, `bloqueado`, `completado`, `cancelado` plus English/underscore aliases | open/in-progress/blocked/completed rows remain eligible; `cancelado` is ineligible with `status_not_eligible`; no global status dictionary. |
| incident | `incident_operational_events` v5 | `reported`, `triaged`, `classified`, `active`, `contained`, `recovering`, `resolved`, `post_incident_review`, `closed` | Workflow statuses are mapped in the incident domain and remain eligible for incident severity population when required fields are valid. |
| loss | `loss_events_operational` v6 | `draft`, `under_review`, `confirmed`, `recovered_partial`, `closed`, `cancelled` | confirmed/recovered/closed rows are eligible; draft/under_review/cancelled are visible and ineligible. |
| supplier | `supplier_tprm_assessments` v5 | `draft`, `invited`, `in_progress`, `submitted`, `under_review`, `remediation_required`, `approved`, `rejected`, `expired` | Existing approved/submitted semantics are preserved; under_review/remediation_required remain visible and ineligible. |
| assurance | `assurance_test_results` v5 | `pass`, `pass_with_observations`, `fail`, `not_applicable`, `inconclusive` | `pass_with_observations` is eligible and distinct from `pass`; formula weighting remains unchanged. |
| data_trust | `indicator_data_trust_assessments` v5 | `trusted`, `acceptable`, `attention`, `untrusted`, `unknown` | Operational trust assessment statuses map without `status_unmapped`; formula still requires its eight persisted dimensions. |

Temporal reconciliation:

| Source/Classification | Decision |
|---|---|
| `event_stream` | Canonical event/execution/occurrence timestamps in the future remain invalid for operational calculation (`date_in_future` / `temporal_after_as_of` as applicable). |
| `validity_interval` | `valid_from` in the future remains invalid for current/period overlap; `valid_to` in the future is allowed because it represents lifecycle end/expiry, not a future event occurrence. |
| `audit_findings_actions` | Actions opened before a period and not closed before `period_start` remain eligible for period overlap; actions closing after the period are still valid during the period. |

Drift guard: `backend/src/services/math-governance/statusSemantics.service.js` exports `PRODUCER_STATUS_CONTRACTS`; `sourceResolver.test.js` asserts every producer-known status maps domain-wise and that unknown statuses still produce `status_unmapped`.

Source contract versions changed: `risk_register_controls` v6→v7, `control_assurance_evidence` v6→v7, `audit_findings_actions` v6→v7, `incident_operational_events` v4→v5, `loss_events_operational` v5→v6, `supplier_tprm_assessments` v4→v5, `assurance_test_results` v4→v5, `indicator_data_trust_assessments` v4→v5.

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-07-HF3 Final Data Trust Contract Closure

Status: DONE_LOCAL on branch `fix/pui-07-hf3-final-contract-closure`; runtime validation pending by design.

Residual contract decisions:

| Source / KPI | Root cause | Canonical decision | Version |
|---|---|---|---|
| `audit_findings_actions` / `F5_5_SEVERITY_INDEX` | `grc_readiness_findings` has severity but no operational status or row-local timestamps; temporal context lives in `grc_readiness_snapshots`. | Resolver joins snapshot parent; readiness findings use `status=not_applicable`; HF5 supersedes the earlier `source_as_of` assumption because snapshots physically expose `period_start`/`period_end`/`generated_at` only; severity `info` is known but not weighted. | v9 |
| `maturity_assessments` / `F5_5_MATURITY` | Producer vocabularies from `survey_evaluations` and `metric_measurements` exceeded `maturity-status-map-v1`; survey temporal fields are `confirmed_at`/`created_at`, not generic `evaluated_at`. | `maturity-status-map-v2` maps confirmed/applied/valid/estimated as eligible and known non-final/error states as `status_not_eligible`; survey adapter exposes producer temporal fields. | v7 |
| `grc_health_components` / `F5_5_GRC_HEALTH` | `calculation_runs.period_start` is nullable by schema; adapter queried by `started_at`/`completed_at` but did not project those fields for validation. | Contract columns and adapter projection include `started_at`/`completed_at`; `period_start` absence does not exclude rows when official run timestamps prove the interval. | v6 |

Source contract versions changed: `audit_findings_actions` v7→v8, `maturity_assessments` v6→v7, `grc_health_components` v5→v6.

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`
