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
        |      + raw legacy effective role preserved for permission checks
        |      + API RBAC middleware remains backend authority
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
               + deterministic fallback/audit traces
               + non-blocking Intelligence Brief: deterministic base response first, tenant-scoped cache/dedupe, background AI narrative refresh, safe fallback observability
                    |
                    v
              AI Engine Python/FastAPI
                    + specialized routes/services
                    + context building
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
