# ARCHITECTURE_MAP — TCDX ISO SaaS V4

## AS-IS de alto nivel

```text
Frontend (`frontend/src/app`, `frontend/src/components`)
        + UI-02 Stage 3 Risk and Control workspace shell shared by `/riesgos`,
          `/matriz-riesgo`, `/controles`, `/activos` and `/riesgo-cuantitativo`
        + `/riesgos` is a frontend operational register projection over loaded
          ISO matrix, asset-risk and Phase 3 quantitative sources; no new Risk DB,
          backend contract or source of truth is introduced
        |
        v
Backend Node/Express
        +--> Auth/RBAC
        |      + canonical/compatibility role resolver (`roleCompatibility.service.js`)
        |      + release RBAC closeout: seven canonical roles including
        |        `viewer`; platform/dealer/admin/auditor/area_owner/executive/
        |        viewer detection resolves centrally through
        |        `roleCompatibility.service.js`
        |      + authorization target contract is user -> canonical role -> RBAC
        |        permission -> tenant scope -> commercial entitlement/capability
        |      + raw legacy effective role preserved for permission checks
        |      + API RBAC middleware remains backend authority; frontend gates
        |        mirror effective permissions/modules/capabilities and are not
        |        authorization authority
        |      + final pre-deploy residual role authority gate requires
        |        RESIDUAL_AUTHORIZATION_AUTHORITY=0 and classifies local role
        |        mentions as central consumer, presentation, business semantics
        |        or compatibility only
        |      + commercial gates evaluate entitlement + module active + permission
        |      + RBAC-02 strict base capability exception only for `core.dashboard`
        |        on active commercial tenants with `dashboards.read`; no generic
        |        missing-module fallback
        |      + RBAC-03 re-evaluation: no role/permission reconciliation required
        |        for the confirmed Dashboard incident
        |      + Admin SaaS contract saves synchronize `tenant_contracts` to
        |        `tenant_subscriptions`, keeping `v_commercial_tenant_*`
        |        aligned with the contract surface
        |      + `/api/me/entitlements` resolves the effective tenant through the
        |        central tenant resolver; tenant mismatch fails closed
        |      + standard commercial plan aliases are backend-owned:
        |        `iso -> pyme`, `iso_operational_risk -> empresa`,
        |        `grc -> enterprise`; frontend only displays backend-derived
        |        standard plans/modules
        |
        |
        +--> PostgreSQL / dominios operacionales
        |      + DB-N01 local: `tenant_controls.id` es la identidad operacional canonica de control para findings/evidences/action_plans/workflows; `controls_catalog.id` queda como identidad de catalogo y `controls.id` queda solo como compatibilidad legacy de lectura/transicion hasta migracion y retiro controlado
        |      + DB-N02 local: `control_health_scores` mantiene drill-down legacy, pero su `standard_code` se reconstruye por linaje canonico `tenant_controls.control_id -> controls_catalog_standards/controls_catalog.iso -> tenant_standards.active`; multiples normas activas quedan `AMBIGUOUS` y no se actualizan por seleccion ordenada
        |      + DB-N03 local: integridad multi-tenant critica se refuerza con FKs compuestas `(tenant_id, parent_id)` y constraints `(tenant_id, id)` sobre relaciones GRC/Health prioritarias; RLS queda preparado con `tcdx_security.*` y politicas staged, sin habilitar RLS hasta completar contexto tenant transaccional en runtime
        |      + DB-N04 local: backend Node queda cableado con contexto DB tenant transaction-local mediante `dbTenantContext.js`, AsyncLocalStorage, wrapper de `pg.Pool`, middleware `/api`, path platform explicito y schedulers/workers controller->tenant; RLS runtime queda parcial por `AI_READER_RLS_DEFERRED`
        |      + TCDX SaaSv2 runtime contract V2 local: fresh baseline y migracion forward-only agregan contrato activo de `tenant_standards`, `tenant_nonconformities`, `evidences`, Evidence AI runtime y lifecycle runtime; triggers en BD reconcilian `control_id` catalogo con `tenant_control_id` operacional y permiten inserts activos sin `title` sin fabricar datos tenant
        |      + TCDX SaaSv2 fresh runtime closeout local: la migracion forward-only `20260910_tcdx_saasv2_fresh_runtime_contract_closeout` agrega el contrato fisico activo de perfil, Admin SaaS, RBAC SQL, dealers, modulos, contratos, catalogo comercial administrable, prefacturacion, external lookup y auditoria; no reabre baseline, no replay historico, no `DROP VIEW ... CASCADE` y no seed de precios/cuota default
        |      + TCDX commercial runtime integral closeout local: la migracion forward-only `20260910_tcdx_commercial_runtime_integral_closeout` cubre `tenant_standard_audit`, perfil/aplicabilidad tenant, enlaces documento-objeto, `findings.due_date` y `tenant_subscription_addons.tenant_id`; audit/report normalizan estados inline sin depender de `normalize_status_for_audits(text)` y search history degrada seguro si su tabla opcional no existe
        |      + TCDX control lifecycle closeout local: `controls_catalog.tenant_id IS NULL` es catalogo global, same-tenant es catalogo tenant y `source_type` queda como provenance; `initialize-controls` y `public.tcdx_effective_control_catalog(uuid,text,text)` materializan `tenant_controls` + `tenant_applicable_controls` idempotentes para Dashboard, Diagnostico, `/controles`, Tenant Standards y consumidores downstream sin fabricar Health scores
        |      + TCDX post-lifecycle runtime consumers closeout local: consumidores posteriores al lifecycle leen clausula desde `controls_catalog.clause`, no desde `controls_catalog_standards`; Diagnostico usa pertenencia normativa efectiva y columnas opcionales nulas; Health ISO consume vistas tenant-scoped materializadas sobre `v_iso_control_effective_health`, aplicabilidad, evidencias, hallazgos, acciones y audit logs; `refresh_kpi_health_snapshots` queda fuera del runtime fresh; runner preflight pending no exige vistas que todavia no existen
        |
        +--> Commercial product authority
        |      + `commercial_plans`, `commercial_plan_versions`
        |      + `plan_version_modules`, `commercial_modules`
        |      + `commercial_technical_capabilities`
        |      + `v_commercial_plan_capabilities`
        |      + `tenant_subscriptions`, `v_commercial_tenant_*`
        |      + AI contractual authority is binary in `tenant_subscription_addons.addon_key='ai'`; legacy `tenants.ai_plan` is not an entitlement gate
        |      + manual module controls remain add-on/pilot/exception surface
        |
        +--> math-governance
        |      + source contracts/resolver
        |      + scale/count/temporal/status contract metadata
        |      + domain status normalization
        |      + governed legacy fallback policy and fallback provenance
        |      + deterministic/versioned data trust assessment
        |      + dataset validation and temporal/status classification
        |      + producer-known status drift guard for F5_5 source domains
        |      + residual producer/source contract drift closure for severity, maturity and health components
        |      + formula-to-source ownership enforcement for Severity Index source overrides
        |      + Severity Index readiness finding adapter aligned to physical snapshot schema
        |      + official indicator matrix v1 derived from formula registry/source contracts
        |      + formula registry/execution
        |      + official calculation orchestrator as single source of truth
        |      + GRC post-mutation orchestration adapter: route producers derive functional metric codes from existing indicator/formula catalog and delegate publication through indicator governance / officialCalculationOrchestrator; post-COMMIT publication failures are observable in `official_recalculation` without false mutation 500s; no formula execution, Health engine or mapping/assurance score authority is duplicated
        |      + DB-N02 Health authority: `F5_5_GRC_HEALTH` v2 es la unica autoridad ejecutiva Health por `official_formula_versions`, `calculation_runs`, `calculation_outputs`, `metric_snapshots` y `metric_source_bindings`; `canonicalHealthProjection.service.js` solo lee, normaliza, explica y presenta
        |      + DB-N03/DB-N04 tenant DB context: backend Node usa `set_config(..., true)` dentro de transacciones por `withTenantTransaction`, `tenantContextMiddleware` y pool wrapper; platform admin usa `withPlatformTransaction`/scope explicito, no `BYPASSRLS` en runtime tenant; AI Engine sigue pendiente de tenant context o vistas tenant-safe
        |      + governed Observation emission producer for material Data Trust signals
        |      + snapshots/lineage
        |      + decision interpretation
        |      + Package3 compatibility projection only; no parallel official truth
        |      + PUI phase runtime closure: PRE_UI_DATA_TRUTH_GATE=PASS
        |
        +--> GRC services/rules/workflows/approvals/observability
        |      + GRC Observation API facade over Semantic Layer
        |      + Governed Observation outbox (`grc_observation_emission_outbox`)
        |      + Observation emitter policy/consumer (`grcObservationEmitter.service.js`)
        |      + Outbox -> Semantic Layer timestamp boundary normalized to ISO-8601 UTC
        |      + Canonical deterministic Gap model (`grc_gaps`, `grc_gap_rules`, `grc_gap_status_history`, `grc_gap_hypotheses`)
        |      + GRC relationship inventory foundation for Impact Graph (`docs/architecture/grc_relationship_inventory.md`)
        |      + Impact Graph 2.0 projection/adapters (`impactGraph.service.js`) over existing relation truth
        |      + Priority Engine 2.0 projection (`priorityEngine.service.js`) over Gap + Impact Graph truth
        |      + Phase 2 connector scheduler runs as internal `platform_admin` worker, classifies each tenant connector result, preserves per-connector retry/health/error state, and observes `phase2_scheduler_connector` without turning feature-gated `CONNECTOR_NOT_AVAILABLE` into global scheduler spam
        |      + Escalation policy facade generates internal tenant-scoped policy codes and exposes user-facing `display_name`; UI manages functional names/application/hours under existing RBAC
        |      + tenant-scoped source validation, RBAC and audit log integration
        |
        +--> Semantic Layer
        |      + canonical GRC Observation SOR (`grc_observations`)
        |      + canonical observation relations (`grc_observation_relations`)
        |      + global manual observation contract (`grc.manual_observations@v1`)
        |      + source contracts, snapshots, lineage, append-only supersession
        |
        +--> Knowledge Base v2
        |      + canonical document model (`knowledge_documents`, `knowledge-document-model-v1`)
        |      + additive source link (`knowledge_sources.knowledge_document_id`)
        |      + GLOBAL/REGULATORY/TENANT scope, versioning, lifecycle and provenance
        |      + tenant ingestion pipeline (`knowledge-ingestion-pipeline-v1`)
        |      + ingestion runs/audit/chunk manifest (`knowledge_document_ingestions`, `knowledge_document_ingestion_audit`, `knowledge_document_chunks`)
        |      + pgvector embedding foundation (`knowledge_chunk_embeddings`, `knowledge-embedding-contract-v1`)
        |      + hybrid retrieval candidates (`hybrid-retrieval-contract-v1`)
        |      + grounded RAG runtime projection (`rag-grounded-answer-contract-v1`)
        |      + regulatory foundation (`regulatory_authoritative_sources`, `regulatory_ingestions`, `regulations`, `regulation_versions`, `legal_obligations`)
        |      + regulatory semantic diff (`regulatory-semantic-diff-contract-v1`) over canonical versions/chunks/obligations
        |      + regulatory packs (`regulatory-pack-model-v1`) with tenant activation/applicability as configuration/evaluation, not legal truth
        |      + structured search/matching/coverage/guardrails
        |
        +--> Intelligence services
               + rules/confidence/explainability/actions
               + prompt builder/orchestrator
               + canonical IntelligenceContext (`canonical-intelligence-context-v1`)
               + Pattern/Trend runtime projection (`pattern-trend-engine-v1`)
               + Anomaly runtime projection (`anomaly-engine-v1`)
               + Cross-GRC Intelligence Orchestrator (`cross-grc-intelligence-orchestrator-v1`)
               + adapters to Priority Engine 2, Impact Graph, grounded RAG and Regulatory Packs
               + Operational Learning (`recommendation-decision-ledger-v1`, `effectiveness-feedback-loop-v1`, `operational-memory-v1`)
               + AI Governance (`ai-governance-contract-v1`, `ai-capability-registry-v1`, `ai-policy-boundaries-v1`)
               + AI Evaluation Suite (`ai-evaluation-suite-v1`)
               + AI Compliance engine-health reports contractual states (`healthy`, `feature_disabled`, `engine_unavailable`, `db_unavailable`) without converting disabled features into 500; protected AI Compliance operations still require auth, tenant isolation, RBAC `ai.view` and `ai.compliance` capability
               + deterministic fallback/audit traces
               + non-blocking Intelligence Brief: deterministic base response first, tenant-scoped cache/dedupe, background AI narrative refresh, safe fallback observability
                    |
                    v
              AI Engine Python/FastAPI
                    + specialized routes/services
                    + OpenAI-compatible DGX/LiteLLM gateway support through existing
                      `llm_client.py`: JSON mode, content-only parsing,
                      default `reasoning_effort=low`, effective `max_tokens>=2000`,
                      Ollama-option filtering and no application use of
                      `reasoning_content`
                    + narrative grounding guard: sparse authorized contexts produce
                      explicit insufficient-evidence/human-review output; contexts
                      with operational evidence require generic claims with
                      authorized source_refs before being treated as grounded
                    + canonical context building over current `ai_core` views:
                      tenant/KPI health as published metric snapshots, controls by
                      tenant/control/catalog identity plus `implementation_status`,
                      app-derived implementation buckets, no legacy context columns
                      and no cross-tenant fallback
                    + trusted external lookup
```

## Ownership

- CODEX A / `codex`: Data, Backend, GRC core.
- CODEX B / `tecdex2-codex`: AI, Knowledge, RAG, Regulatory.
- CODEX C / `tecdex3-codex`: Frontend, UX, Product E2E.

## Protected extension points

- `backend/src/services/math-governance/*`: extender sin crear resolver paralelo.
- `backend/src/services/knowledge-base/*`: extender a RAG; no nueva KB.
- `backend/src/services/intelligence/*`: extender; no segundo orchestrator.
- `backend/src/services/grc/*`: reutilizar rules/workflows/approvals.
- `backend/src/routes/grc.routes.js` / `backend/src/services/grc/grc.service.js`: las proyecciones `workflow-entity-options` y `workflow-instances` son UX/read-models tenant-scoped sobre `grc_workflow_*` y `grcRuntimeAdapters`; no son nuevo source of truth.
- `ai-engine/app/*`: preservar flujos especializados que funcionan.
- `frontend/src/*`: remodelación visual sin romper contratos/RBAC.

## TO-BE de referencia

```text
operational data
→ source contract/normalization
→ eligibility/sufficiency/Data Trust
→ official calculation
→ governed Observation outbox / idempotent consumer
→ measurement/snapshot/lineage
→ Observation
→ Gap
→ Impact Graph
→ Priority
→ GRC Intelligence
→ Human decision
→ Action
→ Retest/Effectiveness
→ Operational Memory
```

Knowledge/RAG y Regulatory Intelligence alimentan Intelligence/Impact sin convertirse en sistema de registro.

## Phase Transition

- PUI phase: CLOSED by PUI-09.
- PRE_UI_DATA_TRUTH_GATE: PASS.
- Next phase: FASE_6_AMPLIADA.
- 6.8-01-HF1: CLOSED; canonical Observation reconciliation valid.
- 6.8-01-HF2: CLOSED / PASS_RUNTIME; forward bootstrap for `grc.manual_observations@v1` validated after user deploy.
- 6.8-02: CLOSED / PASS_RUNTIME; governed Observation emitter/outbox validated after HF1 runtime replay.
- 6.8-02-HF1: CLOSED / PASS_RUNTIME; timestamp serialization hotfix validated after user deploy/retry.
- 6.8-03: CLOSED / PASS_RUNTIME; canonical deterministic Gap model validated after user deploy with Observation -> Gap relation in `grc_observation_relations`.
- 6.9-01: DONE_LOCAL; relationship inventory created at `docs/architecture/grc_relationship_inventory.md`, no graph storage/traversal implemented, duplicate relation model remains 0.
- 6.9-02: CLOSED / PASS_RUNTIME; Impact Graph 2.0 foundation implemented as tenant-scoped projection/adapters over 6.9-01 inventory, with no graph storage/migration.
- 6.9-03: CLOSED / PASS_RUNTIME; Priority Engine 2.0 implemented as `priority-engine-2-v1` projection over `grc_gaps` + Impact Graph with no priority storage/migration.
- 6.10-01: CLOSED / PASS_RUNTIME; Knowledge Document model implemented as `knowledge-document-model-v1` over KB v2 with forward migration, no second KB and no pgvector/embeddings/retrieval/RAG implementation.
- 6.10-02: CLOSED / PASS_RUNTIME; Tenant document ingestion implemented as `knowledge-ingestion-pipeline-v1` with secure upload, extraction, sensitive classification, deterministic chunk manifest, KB v2 linkage and audit; no pgvector/embeddings/retrieval/RAG implementation.
- 6.10-03: CLOSED / PASS_RUNTIME; pgvector embedding foundation implemented as `knowledge-embedding-contract-v1` with embedding-side table `knowledge_chunk_embeddings` referencing canonical `knowledge_document_chunks`, provider/model/version/dimensions metadata, failure/stale states and tenant-filter-first vector search primitive; no Hybrid Retrieval/RAG answer/citations/reranker.
- 6.10-04: CLOSED / PASS_RUNTIME; Hybrid Retrieval implemented as `hybrid-retrieval-contract-v1` over lexical `knowledge_document_chunks` and vector `knowledge_chunk_embeddings`, with deterministic rank normalization, tenant filter first, lifecycle filtering and provenance for future citations; no RAG answer/citations/reranker.
- 6.10-05: CLOSED / PASS_RUNTIME; grounded RAG answer `rag-grounded-answer-contract-v1` validated in runtime over Hybrid Retrieval candidates only, with evidence-only context builder, deterministic citation validation, safe abstention, tenant isolation and no RAG persistence/source of truth. Closure: `docs/codex/handoffs/6.10-05-RUNTIME-CLOSURE.md`.
- F6.10: CLOSED through 6.10-05.
- F6.11-A: CLOSED / PASS_RUNTIME; regulatory foundation adds `regulatory_authoritative_sources`, `regulatory_ingestions`, `regulations`, `regulation_versions` and `legal_obligations`, reusing `knowledge_documents` and `knowledge_document_chunks(scope='REGULATORY')` instead of creating a second KB/chunk/embedding/retrieval model.
- F6.11-B: CLOSED / PASS_RUNTIME; Semantic Diff and Regulatory Packs add governed tables for deterministic diffs, obligation lineage, pack version composition, tenant activation and applicability evaluation. Runtime closure confirmed production/main `99dd2772c599c5cbdd579594d7520aadc7b0cbb9`, applied migration `20260824_f6_11_b_semantic_diff_regulatory_packs`, focal tests PASS and no KB/chunk/embedding/retrieval/RAG duplication.
- F6.12-A: CLOSED / PASS_RUNTIME; Context Builders, Pattern/Trend, Anomaly and Cross-GRC Intelligence validated in runtime on production/main `6aed2555524e1ab146ab9c25af4015401abfd7be` as runtime projections under existing Intelligence services with no migration, no new route/RBAC, no parallel Observation/Gap/Graph/Priority/KB/RAG truth and no LLM operational truth.
- F6.13-A: CLOSED / PASS_RUNTIME; Operational Learning adds a governed tenant-scoped ledger/effectiveness/memory layer in `backend/src/services/intelligence/operationalLearning.service.js` with forward migration `20260824_f6_13_a_operational_learning`. Runtime closure confirmed migration, tests, deploy runner and no parallel Priority/Observation/Gap/KB/Retrieval/AI truth.
- F6.14-A: DONE_LOCAL; AI Governance and AI Evaluation Suite formalize governed capability registry, provider/model/prompt/context/schema/policy/authority/failure semantics and synthetic regression evaluation in `backend/src/services/intelligence/aiGovernance.service.js` and `backend/src/services/intelligence/aiEvaluationSuite.service.js`. No DDL, no second AI orchestrator, no AI truth store and no frontend/UI work. Runtime validation pending user deploy.
- RBAC-03 commercial correction: DONE_LOCAL; commercial plan authority is capability-based in `backend/src/services/commercial/commercialPlanMatrix.service.js` and materialized by `database/migrations/20260828_commercial_standard_plan_matrix.sql`. `ISO = ONLY_ISO`, `ISO_RISK = ISO + OPERATIONAL_RISK_ONLY`, `GRC = ALL_TENANT_COMMERCIAL_CAPABILITIES`; authorization still requires active tenant, active subscription, entitled capability, active module, RBAC permission and scope. No RBAC/schema privilege model changes.
- DB-N05: PARTIAL local; fresh production database architecture has a consolidated baseline path: `database/baseline/production_schema_v1.sql` + `database/baseline/production_seed_v1.sql`, but it is not yet complete enough for production creation. Historical migrations remain upgrade history. Fresh bootstrap excludes QA/demo/backup/preview residue, retains compatibility-only `controls` and Health/KPI surfaces required by runtime, carries DB-N01..DB-N04 contracts, and leaves broad RLS deferred until AI reader tenant-safe access is proven. Critical review 2026-09-07 corrected Health unknown numeric parity, source binding lineage, `ai_reader` safe defer and runtime function grants: no `EXECUTE ON ALL FUNCTIONS`; backend/platform use explicit app-function allowlists. `RUNTIME_TO_BASELINE_COVERAGE` reports `ACTIVE_MISSING=0`; product reference catalogs remain incomplete.
- TCDX SaaSv2 GRC runtime V3: local closeout aligns fresh baseline and forward migration for active GRC backend contracts. Module enablement authority is `tenant_module_settings.is_enabled`; legacy `enabled` is synchronized compatibility. GRC Phase 1/2/3 runtime objects, connector scheduler columns, explicit `tcdx_backend_runtime` grants and critical tenant-aware connector FKs are now represented in baseline plus `20260910_tcdx_saasv2_grc_runtime_contract_closeout_v3.sql`. This is clone-validation ready only, not production-ready.
- TCDX SaaSv2 fresh deploy architecture: `scripts/deploy-vms.sh` now treats application deploy as a strategy-gated runtime operation, not bootstrap. `fresh-baseline` is valid only for `tcdx_saasv2`, skips historical runners and skips `production_schema_v1.sql` / `production_seed_v1.sql` / `load-production-reference-catalogs.js` during recurrent deploy; `historical-upgrade` preserves the old migration chain only for non-fresh databases. Deploy remains multi-VM backend -> AI Engine -> frontend, with pre-service guards for migration DB identity and backend runtime `.env` identity. Fresh recurrent deploy may run only explicitly registered forward-only runners; currently this includes the fresh runtime contract closeout runner.
- TCDX SaaSv2 fresh runtime contract closeout: local continuation audited the forward-only SQL and removed unsafe cascade view drops plus invented price/default quota seeds. Commercial/prebilling views are recreated in dependency order after explicit non-cascade drops, so unlisted dependencies fail closed. The physical contract is ready for human review/authorized clone preflight only, not production readiness.
- TCDX control lifecycle systemic closeout: fresh recurrent deploy now appends `scripts/normalization/apply-tcdx-control-lifecycle-systemic-closeout.js` after fresh runtime, Release RBAC, commercial runtime and fresh dependency closeout. Runtime catalog authority is ownership scope, not provenance: generic/global rows are `tenant_id IS NULL`, personalized rows are same-tenant and mixed unions both with declared `base_control_id` dedupe only. No production apply was executed by Codex.

## DB-N05 final local continuation — 2026-09-07

Status: `DB_N05_PARTIAL`; remaining blocker `MISSING_PRODUCTION_REFERENCE_SOURCE`.
Branch `codex/db-n01-control-identity-normalization`; HEAD `11003dd92385dcca1caf5365fa437be3aee1f648`; dirty DB-N01..DB-N04 work preserved; no staging/commit/push/merge/deploy or external DB writes.

Current evidence supersedes previous missing-pgvector/static-only reports:

- PostgreSQL 16.15 with local pgvector/pgvector:pg16 image ID sha256:ccc6e83d6e35e931dc7c5def2022729d5a6c370318d099181995567ff1fb4d6b. Disposable container, localhost-only random published port, tmpfs data, container/volumes removed. Helper supports auto/local/docker and retains mandatory vector.
- ACTIVE_MISSING=0, 60 focused checks; regulatory table/constraint/index parity PASS for all 15 scoped F6.11-A/B tables. SQL baseline executed twice successfully. Bounded coverage is not a whole-product runtime certification.
- Effective privileges PASS using real SET ROLE: migration admin bootstrap/rerun, backend DML, backend admin-only DML denied, support SELECT/write denial, platform catalog update/tenant DML denial, ai_reader no direct SELECT, no super/BYPASSRLS/CREATE privileges for runtime roles, and `R00 FUNCTION_EXECUTE_ALLOWLIST PASS`. Broad `EXECUTE ON ALL FUNCTIONS` was removed; explicit job/output grants follow existing asyncJob and official calculation consumers; app_roles and plan_version_capabilities are canonical.
- Real catalog load twice PASS; stable identities/content/counts checked. KB derived children are rebuilt by the existing loader: logical content is compared excluding generated child IDs/timestamps; the import audit records both completed runs. Counts: 4 standards, 30 ISO codes/mappings (26 leaf controls + 4 families), 62 permissions, 45 commercial capabilities, 135 plan/capability rows, 18 modules, 53 official formulas/versions, 20 official/semantic source contracts, 22 indicators/versions/bindings, 5 KB sources, 1000 items, 1000 each evidence expectations/questions/gaps/actions/rules/hints, 6000 mappings.
- Fresh gates PASS: BOOTSTRAP_RERUN, CATALOG_LOAD_1, CATALOG_LOAD_2, IDEMPOTENT, CATALOG_LOADER_RERUN, PGVECTOR_VALIDATION, FUNCTIONAL_VALIDATION, MULTITENANT_VALIDATION, LEGACY_ABSENCE, INTEGRITY_VALIDATION, BACKEND_STARTUP, FRESH_DB_FROM_ZERO. OBJECT_COUNTS=117|193|253. Backend startup uses a login member of tcdx_backend_runtime, not postgres.
- Catalog completeness FAIL: the canonical SoA registry declares ISO27001/ISO27701/ISO27017/ISO27018, while the inspected versioned KB/source inventory has no complete production source for ISO27701/ISO27017/ISO27018. ISO27001's 30 derived codes are not a complete reviewed control manifest; ISO9001 has KB reference coverage but no loaded complete clause/control catalog. No legal/control content invented and no product promises silently disabled.
- Ten requested DB-N01..DB-N04 regression commands PASS. Full backend suite/CI not run. No backend runtime edits in this continuation.

Next: supply or identify governed complete reference sources/manifests for the declared product families, wire them through the same loader and close the failing catalog gate. Review application role mappings for any newly registered commercial permission identities; the loader does not silently grant those permissions. No real production creation and no DB-N06. See artifacts/db-n05/VALIDATION_RESULTS.md and REFERENCE_CATALOG_COVERAGE.md.

## DB-N05 versioned ISO reference path — 2026-09-08

The sole orchestrator remains `scripts/normalization/load-production-reference-catalogs.js`. Manifest v2 stores raw standard_code/version_code, explicit product compatibility code, publication/certification status, loader_status, controls/evidence/metadata paths, exact counts and SHA-256 for each file. Three entries are approved_for_loader; FDIS is transition_only. Every file and same-version evidence mapping is validated before any reference write, and before the main orchestrator connects. Pending/unapproved states, checksum or count mismatches, missing titles, duplicate controls/evidence and cross-version references fail closed.

Fresh baseline adds `iso_standards`, `iso_standard_versions`, `iso_controls`, `iso_evidence_expectations`, with natural-key uniqueness and composite same-version FKs. New surrogate IDs come from PostgreSQL, not QA. Runtime backend/platform/support have SELECT only on these four tables; ai_reader has no access; migration admin loads references. No schema-wide grants or new functions were added.

All four sources load into versioned tables. Only the three approved published versions project to existing product standards/controls/mappings. Existing 30 KB-derived ISO27001 codes and their compatibility behavior remain; metadata marks them compatibility_only. They are not counted as approved versioned controls and no semantic equivalence to QA ISMS codes is invented. Fresh controls_catalog/mappings=83: 53 approved projected controls + 30 preserved KB codes. QA controls_catalog's 118 exported rows and 118 mappings are not imported.

Natural identity: raw standard/version/control; operational identity remains tenant_controls.id. No QA UUID is imported. FDIS is retained only in the version-aware reference layer, not the legacy product selection projection.

## DB integral human review — 2026-09-09

Fresh production bootstrap now has a zero-legacy authority path for DB-N01..DB-N05. Operational control identity is `tenant_controls.id`; catalog identity is `controls_catalog.id`; SoA uses `control_soa`, `control_soa_assessments` and `control_soa_change_log`; risk formulas use `risks` plus `risk_control_relations`.

Health has two separate projections. Tenant/global Health is `F5_5_GRC_HEALTH` through the official formula/orchestrator lineage. Per-control Health is `public.v_iso_control_effective_health` and reads only official measured `F5_5_CONTROL_EFFECTIVENESS` snapshots with explicit `tenant_control_id`. It does not infer control scores from global GRC Health, and no UI/API path should coerce missing scores to zero.

Formula execution has two productive phases: `officialCalculationOrchestrator.service.js -> recalculateOfficialAnalytics` resolves source contracts, validates bindings and formula versions, and persists runs/outputs/source snapshots; `indicatorGovernance.service.js` publishes governed metric snapshots. Fresh baseline objects `calculation_validations`, `calculation_snapshots`, indicator governance tables and metric snapshot publication columns are included because runtime services consume them.

## Fresh runtime dependency closeout — 2026-09-11

Fresh production uses strategy `fresh-baseline` and must run only forward fresh runners, in this order:

1. `scripts/normalization/apply-tcdx-saasv2-fresh-runtime-contract-closeout.js`
2. `scripts/release-rbac/apply-release-rbac-capability-closeout.js`
3. `scripts/normalization/apply-tcdx-commercial-runtime-integral-closeout.js`
4. `scripts/normalization/apply-tcdx-fresh-baseline-runtime-dependency-systemic-closeout.js`

The fourth runner reconciles bounded active runtime dependencies that remain after the first three fresh closeouts. It creates/extends only physical contracts used by executable backend SQL: notifications, document index/exclusions, report catalog/access/exports, ISO Express diagnostic tables, ISO Operational Suggestions audit/conversions and supporting views/grants.

Controls initialization uses `tenant_standards.id -> tenant_controls.tenant_standard_id` as the canonical standard association. `tenant_controls.operation_id` remains nullable; when a standard has multiple active operations and no single default, initialization does not pick a row by arbitrary ordering. The unique tenant/control contract remains the idempotency boundary.

Per-control Health remains a projection over `metric_snapshots` with `metric_code='F5_5_CONTROL_EFFECTIVENESS'`. `controls_catalog.category` is the source of category in the view. `control_health_scores`, KPI-HLT and global `F5_5_GRC_HEALTH` are not per-control Health authorities in this fresh path.

Optional dependencies are explicit: `search_history` remains optional empty/no-op from commercial closeout; `tenant_controls.notes` is not a fresh contract; `document_index` same-tenant FKs to source/integration are added only when those parent contracts exist. RLS remains staged according to DB-N03/DB-N04; this closeout does not enable universal RLS.

## GRC runtime functional repair — 2026-09-11

The repaired runtime path remains:

`GRC mutation -> committed fact -> grcCalculationOrchestration.service.js adapter -> indicatorGovernance -> officialCalculationOrchestrator/source contracts -> calculation_runs/calculation_outputs/calculation_snapshots -> metric_snapshots -> canonical projections -> consumers`.

The adapter maps fact types to official metrics only: diagnostic/SoA/compliance affect COMPLIANCE/DATA-TRUST/GRC-HEALTH, evidence affects EVIDENCE-FRESH/DATA-TRUST/GRC-HEALTH, finding affects remediation/severity-derived metrics, action affects REMEDIATION/DATA-TRUST/GRC-HEALTH, and risk affects inherent/residual risk metrics. Nonconformity currently publishes no direct metric unless a governed formula covers it; it still returns a post-mutation orchestration result.

Action plan persistence is schema-aware. `action_plans.description`, `priority` and `owner` are not assumed physical runtime columns; projections use real columns through `to_jsonb(row)` or `metadata`, and writers never recreate legacy schema. Control workbench Health reads canonical effective Health state and keeps `sin_datos`/N/A when no per-control Health measurement exists. IA-assisted NC drafting reuses existing AI Compliance endpoint and does not update compliance status, evidence or official scores.

## GRC runtime final directed correction — 2026-09-11

The GRC repair now fails closed for schema drift in action plan persistence: only declared optional fallback fields may move to `metadata`; unknown fields and missing structural columns are contract errors. This prevents misspelled relationship fields from becoming silent metadata.

ISO Express standard eligibility is data-driven. Tenant standard codes are normalized syntactically and matched against `iso_standard_versions` identity candidates; no code path owns a whitelist of individual ISO numbers. Compact labels such as `ISO27001` are presentation-only formatting.

Control workbench Health consumes `public.v_iso_control_effective_health` as a single canonical pair. A null score cannot coexist with `saludable`, `atencion`, `deteriorado` or `critico`; it normalizes to `sin_datos` with null score. Summary counts, average, badges and frontend filters use that same normalized state.
