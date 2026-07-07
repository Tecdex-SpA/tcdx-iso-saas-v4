# Intelligence Layer - Arquitectura

## Objetivo

La Intelligence Layer interpreta datos operacionales del tenant con Knowledge Base v2, reglas deterministicas, scoring explicable y recomendaciones trazables. No reemplaza los modulos existentes ni duplica datos tenant.

## Flujo

```text
JWT + RBAC + tenant scope
-> datos existentes del tenant
-> normalizeTenantDataset()
-> enrichDatasetWithKnowledge()
-> evidence strength
-> rules engine
-> scoring
-> metric explanations
-> next best actions
-> intelligence brief
```

## Fuentes operacionales

El dataset se arma desde `aiContextBuilder.service.js` y degrada seguro si una fuente no existe:

- tenant profile
- tenant standards
- controles y Health ISO
- SOA / aplicabilidad
- evidencias y evidence library
- riesgos y activos
- auditorias
- hallazgos y no conformidades
- planes de accion
- KPIs
- procesos y operaciones
- traces o feedback IA cuando esten disponibles

## Seguridad

El endpoint `GET /api/intelligence/brief/:tenantId` queda bajo:

- `auth`
- `enforceApiAccess`
- `enforceTenantRequestScope`

El endpoint no acepta datos tenant por body. El tenant se resuelve por path y se compara contra JWT salvo roles plataforma.

## Degradacion

Si faltan datos o Knowledge Base:

- `ok: true`
- `confidence.level = baja|media`
- `data_quality.warnings`
- `knowledge_context.missing_coverage`
- no se inventan valores operacionales

## Performance

El brief incluye cache liviano en memoria:

- key: `tenantId + locale`
- TTL default: 5 minutos
- bypass: `?refresh=1` o `?bypass_cache=1`
- metadata: `cache_status = miss|hit|bypass`

## Observabilidad

Se registra evento estructurado `INTELLIGENCE_BRIEF_EVENT` sin payload completo:

- request_id
- tenant_id
- user_id
- intelligence_version
- knowledge_seed_version
- rules_version
- ai_used
- fallback_used
- latency_ms
- cache_status
- confidence
- knowledge_coverage_score
- error_code
