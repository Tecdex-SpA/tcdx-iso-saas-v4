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
        |      + tenant-scoped source validation, RBAC and audit log integration
        |
        +--> Semantic Layer
        |      + canonical GRC Observation SOR (`grc_observations`)
        |      + canonical observation relations (`grc_observation_relations`)
        |      + global manual observation contract (`grc.manual_observations@v1`)
        |      + source contracts, snapshots, lineage, append-only supersession
        |
        +--> Knowledge Base v2
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
- Next work package candidate: 6.9-02 Impact Graph 2.0 using adapters/projection over the 6.9-01 inventory.
