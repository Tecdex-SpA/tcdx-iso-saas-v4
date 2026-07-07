# Knowledge Base v2 - Intelligence Layer

## Proposito

Knowledge Base v2 es el catalogo tecnico global que fundamenta reglas, scoring, explicaciones, acciones recomendadas y narrativa ejecutiva. No reemplaza datos operacionales del tenant: los enriquece al momento de construir contexto inteligente.

Pipeline base:

```text
dato existente del tenant
-> normalizacion
-> matching Knowledge Base
-> knowledge_basis
-> reglas
-> scoring
-> explicacion
-> accion recomendada
-> narrativa
-> UI / reportes / IA Compliance
```

## Artefactos oficiales

- `docs/intelligence-layer/plan_maestro_intelligence_layer_tcdx_iso_saas_v4_kb1000.md`
- `database/seeds/knowledge/base_conocimiento_iso_grc_ia_tcdx_1000_registros.md`
- `database/seeds/knowledge/knowledge_base_seed_v2.jsonl`
- `database/seeds/knowledge/knowledge_base_seed_v2.summary.json`

## Modelo tecnico

La migracion `database/migrations/20260707_knowledge_base_v2_intelligence_layer.sql` crea tablas globales:

- `knowledge_sources`
- `knowledge_items`
- `knowledge_evidence_expectations`
- `knowledge_audit_questions`
- `knowledge_common_gaps`
- `knowledge_recommended_actions`
- `knowledge_rules`
- `knowledge_rule_hints`
- `knowledge_mappings`
- `knowledge_narrative_templates`
- `knowledge_import_runs`

Estas tablas no contienen `tenant_id`. El tenant scope vive en las fuentes operacionales existentes; el acoplamiento ocurre en servicios.

## Servicios

- `backend/src/services/knowledge-base/knowledge.service.js`
- `backend/src/services/knowledge-base/knowledge.repository.js`
- `backend/src/services/knowledge-base/knowledge.search.js`
- `backend/src/services/knowledge-base/knowledge.coverage.js`
- `backend/src/services/knowledge-base/knowledge.guardrails.js`
- `backend/src/services/intelligence/intelligence.service.js`

Funciones principales:

- `searchKnowledge()`
- `getKnowledgeForControl()`
- `getEvidenceExpectations()`
- `getAuditQuestions()`
- `getRecommendedActions()`
- `getRuleHints()`
- `matchKnowledgeToTenantEntity()`
- `buildKnowledgeContextForTenantDataset()`
- `buildTenantIntelligenceBrief()`

## Endpoints

- `GET /api/knowledge-base/search`
- `GET /api/knowledge-base/standards`
- `GET /api/knowledge-base/rules`
- `GET /api/intelligence/brief/:tenantId`

Todos pasan por `auth`, `enforceApiAccess` y `enforceTenantRequestScope`.

## Acoplamiento inicial

El matching soporta:

- `control`: por `standard_family`, `standard_code`, `clause_or_control`, `domain`.
- `soa_item`: por `ISO_27001`, control y dominio.
- `evidence`: por control asociado, dominio y guidance de evidencia.
- `risk`: por tema/dominio y guidance de riesgo.
- `audit_finding`: por norma, dominio, severidad y texto de brecha.
- `action_plan`: por hallazgo/riesgo/control asociado y accion recomendada.

La salida incluye `knowledge_basis`, `coverage_score`, `missing_coverage` y `license_warnings`.
