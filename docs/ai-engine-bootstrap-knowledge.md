# AI General Knowledge Bootstrap

## Objetivo

AI General Knowledge Bootstrap es una capa adicional e independiente para poblar conocimiento general inicial del sistema TCDX Compliance. Su objetivo es que el AI Engine tenga una base curada de criterios sobre ISO, auditoria, evidencias, riesgos, ciberseguridad, continuidad, KPIs y reportes antes de que exista consumo masivo de clientes.

Esta capa no reemplaza la knowledge base anterior del AI Engine.

No modifica ni reemplaza:

- `ai-engine/knowledge/tcdx_ai_knowledge_seed.json`
- `ai-engine/knowledge/senior_auditor_reasoning_rules.json`
- `ai-engine/knowledge/report_generation_rules.json`
- `ai-engine/knowledge/task_generation_rules.json`
- `ai-engine/knowledge/audit_intelligence_rules.json`
- `ai-engine/knowledge/evidence_quality_rules.json`
- `ai-engine/knowledge/risk_analysis_rules.json`
- `ai-engine/knowledge/kpi_interpretation_rules.json`
- `ai-engine/knowledge/ai_output_schemas.json`
- `ai-engine/knowledge/web_context_rules.json`
- `analyze_as_senior_auditor`
- endpoints actuales del AI Engine
- servicios actuales de Brave Search

## Estado Actual

Fase 1 implementa solo estructura, catalogo de temas, seeds internos y validacion.

No escribe en base de datos.
No consulta Brave Search.
No registra endpoints nuevos.
No cambia el auditor senior.

## Estructura

La nueva capa vive en:

```text
ai-engine/knowledge/bootstrap/
  topics/
  sources/
  generated/
  approved/
  pending_review/
  rejected/
  logs/
  seeds/
```

Archivos principales:

- `ai-engine/knowledge/bootstrap/topics/bootstrap_topics.json`
- `ai-engine/knowledge/bootstrap/seeds/bootstrap_evidence_best_practices.json`
- `ai-engine/knowledge/bootstrap/seeds/bootstrap_audit_findings.json`
- `ai-engine/knowledge/bootstrap/seeds/bootstrap_corrective_actions.json`
- `ai-engine/knowledge/bootstrap/seeds/bootstrap_risk_management.json`
- `ai-engine/knowledge/bootstrap/seeds/bootstrap_report_writing.json`
- `ai-engine/knowledge/bootstrap/seeds/bootstrap_kpi_interpretation.json`
- `ai-engine/knowledge/bootstrap/seeds/bootstrap_iso27001_guidance.json`
- `ai-engine/knowledge/bootstrap/seeds/bootstrap_iso9001_guidance.json`
- `ai-engine/knowledge/bootstrap/seeds/bootstrap_business_continuity.json`
- `ai-engine/knowledge/bootstrap/seeds/bootstrap_cybersecurity_guidance.json`

## Catalogo De Temas

`bootstrap_topics.json` define temas estrategicos para busqueda futura con Brave Search. Cada tema contiene:

- `code`
- `title`
- `query_templates`
- `domain`
- `module`
- `standard_code`
- `knowledge_types`
- `priority`
- `max_results`

Las consultas son genericas y no contienen datos de clientes ni tenants.

## Seeds Internos

Los seeds son conocimiento interpretativo propio de TCDX. No copian texto protegido de normas ISO ni paginas externas.

Cada item contiene:

- `title`
- `knowledge_type`
- `domain`
- `module`
- `standard_code`
- `summary`
- `content`
- `practical_use`
- `recommended_application`
- `limitations`
- `tags`
- `confidence_score`
- `origin = bootstrap_seed`
- `status = bootstrap_approved`
- `source_type = internal_seed`

## Seguridad Y Separacion

Esta capa es global, no tenant-specific.

No debe guardar:

- nombres de clientes
- `tenant_id`
- correos
- RUT
- IPs privadas
- URLs internas
- nombres de archivos internos
- datos de evidencias privadas
- tokens
- credenciales
- secretos

## Copyright

Las reglas de bootstrap exigen:

- no copiar textos largos,
- no copiar normas ISO literalmente,
- no almacenar documentos completos,
- guardar resumen propio y metadata,
- dejar fuentes externas en revision cuando se implemente Brave Search.

## Scripts

Validar estructura, JSON y patrones sensibles:

```bash
cd /home/tecdex/ai-engine
chmod +x scripts/validate-bootstrap-knowledge.sh
./scripts/validate-bootstrap-knowledge.sh
```

Dry-run de fase 1:

```bash
cd /home/tecdex/ai-engine
chmod +x scripts/bootstrap-general-knowledge.sh
./scripts/bootstrap-general-knowledge.sh --dry-run
./scripts/bootstrap-general-knowledge.sh --seeds
```

Reindex placeholder de fase 1:

```bash
cd /home/tecdex/ai-engine
chmod +x scripts/reindex-bootstrap-knowledge.sh
./scripts/reindex-bootstrap-knowledge.sh
```

En fase 1, estos scripts no escriben en DB.

## Variables Futuras

Las siguientes variables se documentan para fases posteriores:

```ini
ENABLE_BOOTSTRAP_KNOWLEDGE=true
BOOTSTRAP_KNOWLEDGE_PROVIDER=brave
BOOTSTRAP_KNOWLEDGE_MAX_TOPICS_PER_RUN=10
BOOTSTRAP_KNOWLEDGE_MAX_RESULTS_PER_TOPIC=5
BOOTSTRAP_KNOWLEDGE_REQUIRE_REVIEW=true
BOOTSTRAP_KNOWLEDGE_AUTO_APPROVE_INTERNAL_SEEDS=true
BOOTSTRAP_KNOWLEDGE_AUTO_APPROVE_EXTERNAL=false
BOOTSTRAP_KNOWLEDGE_ALLOWED_DOMAINS=
BOOTSTRAP_KNOWLEDGE_BLOCKED_DOMAINS=
BOOTSTRAP_KNOWLEDGE_DRY_RUN=false
```

Se reutilizaran:

```ini
BRAVE_SEARCH_API_KEY=
BRAVE_SEARCH_ENDPOINT=https://api.search.brave.com/res/v1/web/search
ENABLE_WEB_CONTEXT=true
WEB_CONTEXT_PROVIDER=brave
WEB_CONTEXT_TIMEOUT_MS=8000
```

## Fases Siguientes

Fase 2:

- Crear migracion DB con tablas nuevas `ai_bootstrap_knowledge_*`.
- Cargar seeds internos a DB.
- Mantener estados `bootstrap_pending_review`, `bootstrap_approved`, `bootstrap_rejected`, `bootstrap_archived`.

Fase 3:

- Crear endpoints internos protegidos de status, run, pending, approve/reject y search.

Fase 4:

- Integrar Brave Search para bootstrap controlado.
- Sanitizar consultas.
- Aplicar scoring y deduplicacion.
- Dejar fuentes externas en `bootstrap_pending_review` por defecto.

Fase 5:

- Integrar `bootstrap_approved` como contexto opcional en auditor senior.
- Agregar `bootstrap_knowledge_context` en la respuesta.

## Validacion En VM IA

Ruta esperada:

```bash
cd /home/tecdex/ai-engine
./scripts/validate-bootstrap-knowledge.sh
./scripts/bootstrap-general-knowledge.sh --dry-run
```

El puerto real del AI Engine se mantiene en `8001` segun despliegues actuales, pero fase 1 no agrega endpoints nuevos.

## Desactivar

En fase 1 no hay runtime activo que desactivar. En fases posteriores se usara:

```ini
ENABLE_BOOTSTRAP_KNOWLEDGE=false
BOOTSTRAP_KNOWLEDGE_PROVIDER=disabled
```
