# Release Checklist - Intelligence Layer

| criterio | estado | evidencia | riesgo residual | accion pendiente |
|---|---|---|---|---|
| Fuentes oficiales en repo | OK | archivos en `docs/intelligence-layer` y `database/seeds/knowledge` | bajo | mantener checksum |
| Migracion KB aplicada | EXTERNO | usuario reporto tablas existentes | medio | verificar en entorno QA |
| Conversor KB | OK | dry-run/conversor local | bajo | automatizar CI |
| Loader KB | BLOQUEADO LOCAL DB | `DB_CONFIG_MISSING` sin DB_NAME/DB_USER | medio | ejecutar con env DB QA |
| Endpoint brief | OK unitario | `intelligence.service tests OK` | medio | smoke runtime con JWT |
| RBAC endpoint | OK unitario | viewer/platform allowed, dealer denied | bajo | QA runtime |
| Tenant scope | OK unitario | mismatch 403 | bajo | QA runtime cross-tenant |
| Degradacion sin KB | OK unitario | confidence baja/media | bajo | smoke tablas vacias |
| Reglas deterministicas | OK unitario | findings Fase 2 | bajo | ampliar fixtures |
| Scoring explicable | OK unitario | metric_explanations | bajo | calibrar pesos |
| Next best actions | OK unitario | action_basis requerido | bajo | validar copy UX |
| Cache | OK unitario | miss/hit/bypass | bajo | monitorear memoria |
| Observabilidad | OK unitario | metadata + log estructurado | medio | conectar a logging central |
| Prompt guardrails | OK doc | documento creado | medio | validar orquestador IA |
| UI/reportes | PARCIAL | API entrega fundamento | medio | conectar consumidores visuales |
| Validaciones backend | OK | `npm run check && npm test` | bajo | mantener CI |
| Validaciones frontend | OK | `npm run lint`, `npm run check` | bajo | mantener CI |

## Decision

No liberar a produccion hasta ejecutar loader y smoke tests con variables DB de QA configuradas. El codigo backend y los tests unitarios estan listos para QA runtime.
