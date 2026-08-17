# DECISIONS — TCDX ISO SaaS V4

Las siguientes decisiones provienen del Plan Maestro y se consideran `VERIFIED`.

| ADR | Estado | Decisión |
|---|---|---|
| ADR-001 | VERIFIED | No LLM direct SQL. El LLM recibe contextos autorizados. |
| ADR-002 | VERIFIED | PostgreSQL outbox first. Kafka sólo con necesidad/benchmark demostrado. |
| ADR-003 | VERIFIED | PostgreSQL pgvector first. Vector DB separada sólo con escala demostrada. |
| ADR-004 | VERIFIED | PostgreSQL graph abstraction first. Neo4j no es requisito inicial. |
| ADR-005 | VERIFIED | Extend Knowledge Base v2. No crear una segunda KB. |
| ADR-006 | VERIFIED | Extend Intelligence Engine. No crear un segundo orchestrator transversal. |
| ADR-007 | VERIFIED | Deterministic truth, AI explanation. Scores/gaps oficiales no los inventa el LLM. |
| ADR-008 | VERIFIED | Tenant learning via memory/RAG. No fine-tuning cross-tenant automático. |
| ADR-009 | VERIFIED | Authoritative regulatory sources. Web general no es Source of Truth legal. |
| ADR-010 | VERIFIED | `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`; CI/merge/deploy son manuales. |
| ADR-011 | VERIFIED | Temporalidad oficial de Math Governance debe ser contract-driven: `temporal_semantics` define campo canónico, significado, período, `as_of`, timezone y política de ausencia; `created_at`/`updated_at` no son fallback universal. |
| ADR-012 | VERIFIED | Status oficial de Math Governance debe ser contract-driven y domain-aware: `status_semantics` define dominio, mapping versionado, política de unknown visible y elegibilidad; no existe diccionario universal ni fallback silencioso a estados válidos. |
| ADR-013 | REVIEW | Fallback legacy en Math Governance debe estar gobernado por el resolver: sólo `primary_absent` o `primary_no_rows` con contrato explícitamente autorizado pueden activar fallback; incompatibilidad, contrato inválido, filas excluidas, status/temporal/scale invalid no activan fallback. |

Una ADR `VERIFIED` sólo se revisa por evidencia objetiva, regresión, cambio aprobado de requisito, incompatibilidad demostrada o riesgo de seguridad.
