# SHARED_BASELINE — TCDX ISO SaaS V4

Este archivo contiene hechos reutilizables. No redescubrir mientras no exista evidencia que los contradiga.

## CONFIRMED / PROTECTED

- PostgreSQL es la verdad operacional.
- Auth/RBAC existente: proteger; no reabrir sin evidencia.
- Multi-tenant scoping ya validado en fases previas: proteger y volver a probar sólo cuando el work package toque datos tenant-scoped.
- Math Governance existente: formula registry, source contracts/resolver, dataset validation, official calculation, snapshots/lineage y decision interpretation.
- PUI-01 source ownership confirmado para CONTROL-EFFECT, RISK-INHERENT y MATURITY en `docs/codex/CONTRACTS_REGISTRY.md`: no reabrir sin evidencia nueva.
- CONTROL-EFFECT: `score` agregado puede alimentar cálculos agregados/composite, pero no puede fabricarse como `design`, `implementation`, `operation` ni `evidence`.
- Fórmulas/pesos oficiales: no modificar durante PRE-UI salvo defecto matemático probado y decisión aprobada.
- Knowledge Base v2 existe: extender, no sustituir.
- Intelligence Engine backend existe: rules, confidence, explainability, guardrails, prompt builder, actions, orchestrator y deterministic fallback.
- AI Engine especializado existe: SoA, Beta-PERT, audit documents, Senior Auditor y otros flujos documentados.
- Trusted external/web lookup existe parcialmente; no equivale a Regulatory Intelligence versionada.
- Responsive/navigation/RBAC/commercial multi-tenant de Fase 6 previa: proteger.
- `dashboard-v2` fue retirado: no reintroducir.
- Security hardening previamente cerrado: reabrir sólo por nueva evidencia.

## PARTIAL

- Source contracts/resolver: PRE-UI continúa corrigiendo normalización/semántica.
- Data Trust/provenance/snapshots: foundation existe; requiere cierre integral PRE-UI.
- Decision Interpretation / Next Best Actions: foundation determinística; falta causalidad transversal completa.
- Tenant document handling: hay capacidades especializadas, no RAG privado universal confirmado.
- External lookup: foundation web/trusted sources; falta registry regulatorio autoritativo, versionado y semantic diff.
- AI Governance: guardrails/traces/fallback existen; falta lifecycle humano/evals completos.
- Operational Memory: datos históricos existen, no ciclo formal recommendation→decision→action→effectiveness→memory confirmado.

## CONFIRMED PROBLEM

- PRE-UI sigue abierto.
- PR #91 está abierto y no debe tratarse como mergeado.
- CONTROL-EFFECT, RISK-INHERENT y MATURITY formaban parte del bloque de reconciliación PRE-UI; PUI-01 cerró ownership de fuente localmente, con validación manual/CI pendiente.
- No declarar Data Truth Gate mientras no se complete PUI-01..PUI-09 y validación manual correspondiente.

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
