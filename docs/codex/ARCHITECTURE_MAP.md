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
        |      + snapshots/lineage
        |      + decision interpretation
        |      + Package3 compatibility projection only; no parallel official truth
        |      + PUI phase runtime closure: PRE_UI_DATA_TRUTH_GATE=PASS
        |
        +--> GRC services/rules/workflows/approvals/observability
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
- Next work package: F6.8 / 6.8-01.
