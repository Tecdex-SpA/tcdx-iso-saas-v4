# ARCHITECTURE_MAP — TCDX ISO SaaS V4

## AS-IS de alto nivel

```text
Frontend (`frontend/src/app`, `frontend/src/components`)
        |
        v
Backend Node/Express
        |
        +--> PostgreSQL / dominios operacionales
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
        |      + structured search/matching/coverage/guardrails
        |
        +--> Intelligence services
               + rules/confidence/explainability/actions
               + prompt builder/orchestrator
               + deterministic fallback/audit traces
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
- F6.11-A: DONE_LOCAL; regulatory foundation adds `regulatory_authoritative_sources`, `regulatory_ingestions`, `regulations`, `regulation_versions` and `legal_obligations`, reusing `knowledge_documents` and `knowledge_document_chunks(scope='REGULATORY')` instead of creating a second KB/chunk/embedding/retrieval model.
- 6.11-04: BLOCKED_UNTIL_F6_11_A_RUNTIME_PASS.
