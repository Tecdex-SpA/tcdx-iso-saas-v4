# Release Checklist - Intelligence Layer

| criterio | estado | evidencia | riesgo residual | accion pendiente |
|---|---|---|---|---|
| Fuentes oficiales en repo | OK | archivos en `docs/intelligence-layer` y `database/seeds/knowledge` | bajo | mantener checksum |
| Migracion KB aplicada | OK runtime | VM backend PostgreSQL tiene tablas KB y conteos reales | bajo | mantener migraciones versionadas |
| Conversor KB | OK | dry-run/conversor local | bajo | automatizar CI |
| Loader local sin DB | BLOQUEADO LOCAL ESPERADO | sin `DB_NAME`/`DB_USER`, loader falla explicitamente con `DB_CONFIG_MISSING` | bajo | configurar `.env` local solo si se requiere carga local |
| Loader runtime QA/VM | OK runtime | `knowledge_items=1000`, `knowledge_mappings=6000`; dry-run VM `valid_records=1000` | bajo | no reejecutar full load sin ventana operativa |
| Endpoint brief | OK unitario/runtime | `intelligence.service tests OK`; smoke JWT runtime responde `ok=true` | bajo | monitorear latencia IA |
| RBAC endpoint | OK unitario | viewer/platform allowed, dealer denied | bajo | QA runtime |
| Tenant scope | OK unitario | mismatch 403 | bajo | QA runtime cross-tenant |
| Degradacion sin KB | OK unitario | confidence baja/media | bajo | smoke tablas vacias |
| Reglas deterministicas | OK unitario | findings Fase 2 | bajo | ampliar fixtures |
| Scoring explicable | OK unitario | metric_explanations | bajo | calibrar pesos |
| Next best actions | OK unitario | action_basis requerido | bajo | validar copy UX |
| Cache | OK unitario/runtime | runtime verifico `bypass`, `miss` y `hit` en 3 ms | bajo | monitorear memoria |
| Observabilidad | OK unitario/runtime | `INTELLIGENCE_BRIEF_EVENT` registrado en journal con cache/confidence/coverage | medio | conectar a logging central |
| Prompt guardrails | OK unitario/doc | tests cubren limite KB, secretos, salida IA invalida y knowledge_basis ausente | bajo | ampliar fuzz test |
| UI Intelligence | OK runtime | frontend consume `useIntelligenceBrief`; VM frontend HTTP 200 | bajo | QA visual por pantalla |
| Reportes PDF/ZIP | PARCIAL NO BLOQUEANTE | frontend envia `intelligence_brief` sanitizado; backend lo ignora/filtra sin romper preview/narrative/export | medio | renderizar anexo Intelligence en PDF/ZIP |
| AI Engine HW/SLA | DEUDA OPERATIVA | runtime devolvio fallback por `AI_ENGINE_TIMEOUT` y brief no rompio | medio | mejorar timeout/modelo/cola async |
| Validaciones backend | OK | `npm run check && npm test` | bajo | mantener CI |
| Validaciones frontend | OK | `npm run lint`, `npm run check` | bajo | mantener CI |
| Nginx config test | OK historico / permiso limitado | `nginx.service` activo y ExecStartPre previo salio OK; `sudo -n nginx -t` no ejecuta por password requerido | bajo | ejecutar `sudo nginx -t` en ventana operativa |

## Decision

Decision: APTO PARA RELEASE CONTROLADO.

La Intelligence Layer queda cerrada funcionalmente para liberacion controlada: codigo, tests unitarios, build frontend, Knowledge Base cargada en PostgreSQL runtime, endpoint `brief`, cache, observabilidad, guardrails y fallback IA fueron validados. Quedan mejoras futuras no bloqueantes: cache distribuido, invalidacion automatica, hardware/modelo IA, metricas persistidas y render real de `intelligence_brief` en PDF/ZIP.

## Evidencia runtime 2026-07-07

- Backend VM `192.168.2.41`: `/home/tecdex/tcdx-iso-saas-v4`, commit `dd1342b`, `tecdex-backend.service` activo, puerto 3000.
- PostgreSQL runtime: `knowledge_items=1000`, `knowledge_mappings=6000`.
- Loader dry-run runtime: `valid_records=1000`, `mapping_rows_planned=6000`, `warning_count=0`.
- Intelligence Brief runtime con `refresh=1`: `ok=true`, `version=intelligence_brief_v1`, `cache_status=bypass`, `fallback_reason=AI_ENGINE_TIMEOUT`, `knowledge_coverage=19`, `has_narratives=true`, `next_best_actions_count=10`.
- Cache runtime: llamada posterior sin refresh `cache_status=miss`; tercera llamada `cache_status=hit`, `latency_ms=3`.
- Journal backend: eventos `INTELLIGENCE_BRIEF_EVENT` para `bypass`, `miss` y `hit`.
- Frontend VM `192.168.2.43`: commit `dd1342b`, `nginx.service` activo, `curl -I` a `localhost` e IP devuelve HTTP 200.

## Deuda futura no bloqueante

1. Cache distribuido si se escalan multiples instancias backend.
2. Invalidacion automatica de cache por cambios tenant/KB.
3. Mejorar hardware/modelo/cola async para AI Engine; runtime actual degrada por `AI_ENGINE_TIMEOUT`.
4. Persistir metricas de observabilidad en storage central si se requiere auditoria operativa.
5. Completar render real de `intelligence_brief` en preview/PDF/ZIP; hoy el frontend lo prepara y el backend no rompe al ignorarlo.
