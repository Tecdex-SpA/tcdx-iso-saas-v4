# QA Checklist - Intelligence Layer

| criterio | estado | evidencia | riesgo residual | accion pendiente |
|---|---|---|---|---|
| Conversor MD a JSONL | OK | `node backend/scripts/convert-knowledge-md-to-jsonl.js` genera 1000 registros sin warnings | bajo | ejecutar cuando cambie la fuente |
| JSONL valido >= 950 | OK | dry-run reporta `valid_records: 1000` | bajo | mantener test |
| Summary JSON | OK | `knowledge_base_seed_v2.summary.json` existe | bajo | mantener versionado |
| Loader idempotente | OK unitario | `knowledge.service.test.js` prueba full-volume con DB falsa | bajo | mantener prueba |
| Loader real DB | OK runtime | VM backend `192.168.2.41`: `knowledge_items=1000`, `knowledge_mappings=6000`; dry-run loader reporta `valid_records: 1000` | bajo | no reejecutar carga full sin ventana operativa |
| Sin duplicados item_key | OK unitario | loader usa upsert por `item_key` | bajo | verificar SQL post-load |
| license_class permitido | OK | conversor/loader validan `derived_summary` | bajo | mantener allowlist |
| HTML/script rechazado | OK unitario | guardrails parser | bajo | ampliar fuzz test |
| Datos tenant en KB | OK diseño | tablas KB no tienen `tenant_id` | bajo | revisar seeds nuevos |
| searchKnowledge | OK unitario | `knowledge.service tests OK` | bajo | smoke con DB |
| Matching tenant entity | OK unitario | control/riesgo simulado | bajo | smoke con tenant real |
| Tenant sin datos | OK unitario | `intelligence.service tests OK` | bajo | smoke con tenant real |
| Evidencia baja | OK unitario | readiness bajo/medio | bajo | smoke con tenant real |
| Accion vencida | OK unitario | finding + next action | bajo | smoke con tenant real |
| Hallazgo abierto | OK unitario | regla `open_finding_without_action_plan` | medio | agregar fixture DB real |
| NC antigua | OK codigo | regla `old_nonconformity` | medio | agregar fixture DB real |
| Riesgo critico sin plan | OK unitario | finding critico con KB | bajo | smoke con tenant real |
| Datos contradictorios | OK unitario | score alto + data quality bajo | bajo | ampliar casos |
| Estandar activo sin KB | OK codigo | regla `active_standard_without_kb` | medio | smoke con tenant real |
| KB no cargada | OK unitario | confidence baja/media | bajo | smoke con tablas vacias |
| IA desactivada | OK unitario | `intelligence.service.test.js` valida `AI_DISABLED` y fallback deterministico | bajo | smoke runtime cuando cambie proveedor IA |
| LLM timeout | OK unitario/runtime | test orquestador valida `AI_ENGINE_TIMEOUT`; runtime brief devolvio fallback por `AI_ENGINE_TIMEOUT` | medio | mejorar SLA AI Engine |
| JSON IA invalido | OK unitario | `intelligence.service.test.js` mockea salida IA invalida y valida `AI_INVALID_OUTPUT` sin romper brief | bajo | mantener fixture |
| IA sin knowledge_basis | OK unitario | test degrada confidence a `baja` con `degraded_reason=missing_knowledge_basis` | bajo | smoke con traces reales |
| Sin token | OK unitario | auth devuelve 401 | bajo | QA runtime |
| Otro tenant | OK unitario | tenant scope devuelve 403 | bajo | QA runtime |
| Viewer lectura | OK unitario | RBAC permite GET intelligence | bajo | QA runtime |
| Dealer denegado | OK unitario | RBAC deniega intelligence | bajo | QA runtime |
| Platform permitido | OK unitario | RBAC permite role plataforma | bajo | QA runtime |
| Cache brief | OK unitario | miss/hit/bypass | bajo | monitorear TTL |
| Observabilidad | OK unitario | metadata + log estructurado | bajo | integrar log central |
| Prompt guardrails | OK unitario/doc | tests verifican limite KB, redaccion de secretos y no inclusion de KB completa; `prompting-and-guardrails.md` documenta politica | bajo | ampliar fuzz test |
| UI muestra fundamento | OK runtime parcial | frontend usa `useIntelligenceBrief`; endpoint runtime entrega `knowledge_context`, `narratives` y acciones | bajo | QA visual por pantalla |
| Reportes Premium/PDF/ZIP | PARCIAL NO BLOQUEANTE | frontend envia `intelligence_brief` sanitizado y `knowledge_basis_annex`; backend reportes filtra/ignora campos y no rompe export | medio | incorporar render real del brief en preview/PDF/ZIP |
| Backend runtime | OK runtime | `tecdex-backend.service` activo en `192.168.2.41`; `/api/intelligence/brief` responde OK | bajo | monitorear logs |
| Frontend runtime | OK runtime | `nginx` activo en `192.168.2.43`; `curl -I` a localhost e IP devuelve HTTP 200 | bajo | `nginx -t` requiere sudo |
| Cache refresh runtime | OK runtime | `refresh=1` devuelve `cache_status=bypass`; llamada posterior `miss`; tercera llamada `hit` en 3 ms | bajo | ajustar TTL si escala |

## Evidencia runtime 2026-07-07

- Backend VM `192.168.2.41`: commit `dd1342b`, servicio `tecdex-backend.service` activo, puerto 3000.
- Knowledge Base en PostgreSQL real: `knowledge_items=1000`, `knowledge_mappings=6000`.
- Loader dry-run en VM: `valid_records=1000`, `mapping_rows_planned=6000`, `warning_count=0`.
- Intelligence Brief runtime: `ok=true`, `version=intelligence_brief_v1`, `knowledge_coverage=19`, `has_narratives=true`, `next_best_actions_count=10`.
- Cache runtime: `bypass` con `refresh=1`, luego `miss`, luego `hit` con `latency_ms=3`.
- Observabilidad runtime: `INTELLIGENCE_BRIEF_EVENT` registrado con `cache_status` `bypass`, `miss` y `hit`.
- Frontend VM `192.168.2.43`: commit `dd1342b`, `nginx.service` activo, HTTP 200 en `localhost` e IP.

## Deuda futura no bloqueante

1. Cache distribuido si se escalan multiples instancias backend.
2. Invalidacion automatica de cache por cambios tenant/KB.
3. Mejorar hardware/modelo/cola async para AI Engine; runtime actual degrada por `AI_ENGINE_TIMEOUT`.
4. Persistir metricas de observabilidad en storage central si se requiere auditoria operativa.
5. Completar render real de `intelligence_brief` en preview/PDF/ZIP; hoy el frontend lo prepara y el backend no rompe al ignorarlo.
