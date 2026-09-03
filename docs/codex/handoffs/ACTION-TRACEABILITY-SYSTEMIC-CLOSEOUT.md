# ACTION TRACEABILITY SYSTEMIC CLOSEOUT

## 1. BASE

- Fecha local: 2026-09-03.
- Repositorio: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`.
- Rama: `main`.
- Base commit: `dabb140076f341b76058f75e3bf6c0112ac0470f`.
- Estado inicial: `git status --short` limpio.
- Cambios preexistentes: ninguno detectado en el preflight de esta tarea.
- Restricciones cumplidas: sin commit, sin push, sin merge, sin deploy, sin reset, sin stash, sin checkout destructivo y sin escrituras manuales en produccion.

## 2. ROOT CAUSES

| Sintoma | Causa | Correccion |
|---|---|---|
| `/plan-accion` y Dashboard podian quedar expuestos a errores opacos de planes | El reader enriquecido de planes dependia de una proyeccion amplia de evidencia/documentos y los errores SQL se propagaban como detalle tecnico | Se conserva la proyeccion real de `evidences` + `tenant_document_object_links` y se agrega contrato focal que verifica filtros tenant/active/relation/status/dedupe; los errores focales ya no devuelven SQL crudo |
| Creacion manual/control podia disparar `uq_action_plans_one_active_control_remediation` | `POST /api/action-plans` hacia remediacion de control insertaba sin dedupe contra la regla unica activa | `backend/src/routes/action-plans.routes.js` reutiliza remediacion activa compatible antes del insert y tambien despues de un conflicto concurrente |
| Recomendaciones/sugerencias podian duplicar planes o mostrar SQL | Conversiones ISO y aprobacion operacional insertaban planes sin reutilizar conversion/target existente ni remediacion activa compatible | `isoRecommendedActions.service.js` reutiliza `iso_recommended_action_conversions`; `isoOperationalExecution.service.js` reutiliza target aplicado y planes compatibles |
| Retry de recomendacion ya convertida no era idempotente | La ruta bloqueaba por status aplicado antes de devolver el target existente | Retry devuelve el target existente cuando `created_record_type` coincide con el destino operacional solicitado |
| NC -> accion podia quedar trazada solo por texto/campos parciales | El plan generado desde borrador IA de NC no persistia `source_id` de la NC como relacion operacional completa | `backend/src/routes/ai-compliance.routes.js` persiste `source_type='nonconformity'`, `source_id`, `nonconformity_id` y datos IA existentes |
| Sugerencia IA directa usaba valores fuera del contrato de `action_plans` | Se intentaba crear plan con `source_type='ai_suggestion'` y status tipo draft, fuera de los CHECK publicados | La creacion usa `source_type='ia'`, `status='abierto'` y `source_id=suggestion.id` |
| Hallazgo -> Plan tenia riesgo de dedupe cross-tenant y error tecnico | Lookup de plan por hallazgo no filtraba explicitamente por tenant en todas las ramas | `backend/src/routes/findings.routes.js` filtra por `tenant_id` y deja mensaje funcional sin `err.message` |
| Feedback IA en Hallazgos podia construir `/api/api/ai-feedback` | El helper frontend no normalizaba `NEXT_PUBLIC_API_URL` cuando ya terminaba en `/api` | `frontend/src/app/hallazgos/page.tsx` remueve sufijo `/api` antes de llamar `POST /api/ai-feedback` |
| PATCH de `progress_percent` era semanticamente incorrecto | La condicion `progress_percent !== undefined || progress_percent !== null` era siempre verdadera | `backend/src/routes/action-plans.routes.js` usa `&&`, de modo que ausencia de progreso no crea actualizacion ni altera progreso |
| Flujos focales seguian con `alert()` nativo | Planes, NC, Hallazgos y sugerencias IA usaban alert para errores/success | Se usan estados de error/mensaje existentes; no quedan `alert()` en los archivos focales |

## 3. CONSTRAINT

Definicion documentada en `docs/database-live-map/indexes.md`:

```sql
CREATE UNIQUE INDEX uq_action_plans_one_active_control_remediation
ON public.action_plans USING btree (tenant_id, tenant_control_id, iso_code)
WHERE (
  (source_type = 'control'::text)
  AND (tenant_control_id IS NOT NULL)
  AND (status = ANY (ARRAY['abierto'::text, 'en progreso'::text, 'bloqueado'::text]))
)
```

Intencion preservada: para un mismo tenant, control operativo e ISO, puede existir solo una remediacion activa de control. Estados activos protegidos: `abierto`, `en progreso`, `bloqueado`. Estados fuera de la regla unica: `completado`, `cancelado`. No se modifico schema, migracion historica, indice, predicado ni lista de estados.

## 4. WRITER MATRIX

| Origen | Endpoint | Writer | Dedupe | Idempotencia | Trazabilidad | Resultado |
|---|---|---|---|---|---|---|
| Manual | `POST /api/action-plans` | `action-plans.routes.js` | Sin dedupe global; si el payload es remediacion `source_type='control'`, aplica dedupe de remediacion activa | Crea plan manual o reutiliza plan de remediacion activa compatible | `tenant_id`, `source_type`, `source_id`, `tenant_control_id`, `iso_code` cuando existe | Plan creado o respuesta funcional |
| Control/remediacion | `POST /api/action-plans`, writers operacionales de control | `action-plans.routes.js`, `isoOperationalExecution.service.js` | `tenant_id + tenant_control_id + iso_code + source_type='control' + status activo` | Retry devuelve/reutiliza plan activo compatible | `tenant_control_id`, `iso_code`, `source_type='control'` | Sin duplicate-key por insert ciego |
| Hallazgo | `POST /api/findings/:id/create-action` | `findings.routes.js` | Tenant scoped por `finding_id` o `source_type='finding' AND source_id=finding.id` | Reusa plan existente para el mismo hallazgo/tenant | `finding_id`, `source_type='finding'`, `source_id`, `tenant_id` | Plan creado o existente, sin cross-tenant |
| No conformidad | `POST /api/ai-compliance/apply/nonconformity-draft-to-action-plan` | `ai-compliance.routes.js` | Helper existente de plan reutilizable para NC | Retry reusa el plan NC compatible | `nonconformity_id`, `source_type='nonconformity'`, `source_id=nonconformity_id`, AI trace | Plan trazable a NC |
| Borrador IA NC | `POST /api/ai-compliance/apply/nonconformity-draft-to-action-plan` | `ai-compliance.routes.js` | Igual que NC | Igual que NC | NC + AI trace + payload de orquestacion existente | No crea plan huerfano solo por titulo/texto |
| Recomendacion | `POST /api/iso-recommended-actions/:id/dry-run-convert`, `POST /api/iso-recommended-actions/:id/convert` | `isoRecommendedActions.service.js` | `iso_recommended_action_conversions` converted + target existente | Retry devuelve target convertido cuando coincide el destino | `recommendation_id`, `target_type`, `target_table`, `target_id`, `result_payload` | Dry-run/convert/retry sin insert ciego |
| Sugerencia | `POST /api/iso-operational-execution/:id/approve`, `POST /api/ai-compliance/suggestions/:id/apply` | `isoOperationalExecution.service.js`, `ai-compliance.routes.js` | Reusa `created_record_id` aplicado y/o plan compatible por source/control | Retry aplicado devuelve target existente | `iso_operational_suggestions.created_record_*`, `action_plans.source_*`, updates | No duplica remediacion activa |
| Otras conversiones operacionales | Approval ISO a finding/NC/action plan | `isoOperationalExecution.service.js` | Tenant scoped por suggestion y destino | Dry-run no escribe; approve transaccional actualiza suggestion y target | `created_record_type`, `created_record_id`, `conversion_context` | Target unico o conflicto funcional |

## 5. TRACEABILITY GRAPH

- Control <-> Hallazgo: `findings.tenant_control_id` cuando existe; compatibilidad legacy por `controls.catalog_control_id` hacia `tenant_controls.id`.
- Control <-> NC: `tenant_nonconformities.control_id` como control de catalogo bajo tenant; los writers resuelven contexto tenant/control.
- Control <-> Plan: `action_plans.tenant_control_id`, `iso_code`, `source_type='control'` y `source_id` cuando aplica.
- Control <-> Evidencia: `evidences.tenant_control_id` y documentos asociados en `tenant_document_object_links target_type='control'`.
- Hallazgo <-> NC: `findings.nonconformity_id` donde el modelo lo publica.
- Hallazgo <-> Plan: `action_plans.finding_id` y/o `source_type='finding'`, `source_id=finding.id`.
- NC <-> Plan: `action_plans.nonconformity_id` y `source_type='nonconformity'`, `source_id=nonconformity.id`.
- Recomendacion/Sugerencia <-> Plan: `iso_recommended_action_conversions.recommendation_id -> target_type/target_id` y `iso_operational_suggestions.created_record_type/created_record_id`.
- Plan <-> Evidencia/Documento: `evidences.metadata->>'action_plan_id'` y `tenant_document_object_links target_type='action'`, `target_id=action_plans.id`.

## 6. EVIDENCE SEMANTICS

- Evidencia formal: registros de `evidences`.
- Documento asociado desde Biblioteca: `tenant_document_object_links` activo/asociado al target.
- Asociacion documental valida no equivale a aprobacion automatica.
- Conteos preservados: asociada, pendiente, aprobada/validada, rechazada y ultima evidencia se derivan de estado real.
- Dedupe preservado por identidad de origen; un mismo objeto no debe contarse dos veces si aparece por fuente formal y documental.
- Links excluidos: `reference`, `is_active=false`, `status` no activo, `relation_type` no asociado, tenant distinto.
- Health no cambia: evidencia existente no implica control saludable.

## 7. TENANT SAFETY

- `action_plans`: dedupe y reutilizacion siempre incluyen `tenant_id`.
- `tenant_controls`: resolucion por `tenant_id` y `tenant_control_id`.
- `evidences`: proyeccion bajo `tenant_id`.
- `tenant_document_object_links`: proyeccion bajo `tenant_id`, `target_type` y `target_id`.
- `iso_recommended_action_conversions`: join con `iso_operational_suggestions` por `tenant_id` y `recommendation_id`.
- Hallazgos: dedupe de plan filtra por `tenant_id`.
- NC: writers usan tenant resuelto por usuario y validaciones existentes.
- No se agrego compatibilidad que permita reutilizacion cross-tenant ni bypass por `tenant_id IS NULL`.

## 8. PROTECTED AREAS

- DB schema modificado: NO.
- Migraciones historicas modificadas: NO.
- Migracion nueva: NO.
- RBAC modificado: NO.
- Autoridad comercial modificada: NO.
- Formulas Health modificadas: NO.
- Autoridad AI add-on/runtime modificada: NO.
- Logica tenant-specific/hardcode: NO.
- Constraint debilitado/eliminado: NO.

## 9. TESTS

| Comando | Resultado |
|---|---|
| `node backend/src/services/actionTraceabilitySystemic.contract.test.js` | PASS: `ACTION_TRACEABILITY_SYSTEMIC_CONTRACT_PASS` |
| `node -c backend/src/routes/action-plans.routes.js` | PASS |
| `node -c backend/src/routes/findings.routes.js` | PASS |
| `node -c backend/src/routes/ai-compliance.routes.js` | PASS |
| `node -c backend/src/routes/iso-operational-execution.routes.js` | PASS |
| `node -c backend/src/routes/iso-recommended-actions.routes.js` | PASS |
| `node -c backend/src/services/isoOperationalExecution.service.js` | PASS |
| `node -c backend/src/services/isoRecommendedActions.service.js` | PASS |
| `npm --prefix backend run check` | PASS |
| `npm --prefix frontend run typecheck` | PASS fuera del sandbox; el primer intento fallo solo por `EPERM` escribiendo `frontend/tsconfig.tsbuildinfo` |
| `npm --prefix frontend run lint` | PASS |
| `npm --prefix frontend run test:phase6-sidebar-rbac` | PASS |
| `npm --prefix frontend run test:phase6-commercial-multitenant` | PASS |
| `git diff --check` | PASS |

## 10. BUILD

- `npm --prefix frontend run build`: PASS fuera del sandbox.
- El primer intento dentro del sandbox fallo por `EPERM` al escribir `frontend/.next/trace-build`.
- Next modifico automaticamente `frontend/tsconfig.json`; se restauro solo ese ruido generado segun la regla del paquete.

## 11. DEFERRED RUNTIME

- Runtime productivo/autenticado: no ejecutado por Codex.
- Valor de cierre: `DEFERRED_POSTDEPLOY`.
- Gate siguiente: human review, commit, push, deploy oficial y validacion postdeploy focal con tenants reales.

## 12. VERDICT

`ACTION_TRACEABILITY_READY_FOR_HUMAN_REVIEW`

## 13. FINAL INTEGRITY VERIFICATION

Fecha local: 2026-09-03.
Base commit verificado: `dabb140076f341b76058f75e3bf6c0112ac0470f`.
Estado inicial de esta verificacion: dirty esperado por el paquete sistemico anterior.

### A. Bidirectional Reuse Traceability

| Origen | Autoridad persistente | Reuse preserva vinculo | Plan puede reconstruir origen | Test |
|---|---|---|---|---|
| NC | `grc_phase2_relations source_type='nonconformity', source_id=tenant_nonconformities.id, target_type='action', target_id=action_plans.id, relation_type='originates_action'`; compatibilidad directa por `action_plans.nonconformity_id/source_type/source_id` | PASS. El writer NC upsertea la relacion en create y reuse dentro de la transaccion. | YES. `GET action_plans`/detalle enriquecido proyecta `origin_relations_json`; tambien puede reconstruirse consultando `grc_phase2_relations` por `target_type='action'` y `target_id`. | `node backend/src/services/actionTraceabilitySystemic.contract.test.js` |
| Hallazgo | `grc_phase2_relations source_type='finding', source_id=findings.id, target_type='action', target_id=action_plans.id, relation_type='originates_action'`; compatibilidad directa por `action_plans.finding_id/source_type/source_id` | PASS. El writer Hallazgo upsertea la relacion en create y reuse dentro de la transaccion. | YES. Misma proyeccion `origin_relations_json` y consulta inversa por plan. | `node backend/src/services/actionTraceabilitySystemic.contract.test.js` |
| Recomendacion | `iso_recommended_action_conversions recommendation_id -> target_type/target_table/target_id`, con join tenant-scoped a `iso_operational_suggestions` | PASS. La conversion crea/reutiliza el target real y registra `target_id`; retry lee esa autoridad y devuelve el mismo target. | YES. Se reconstruye desde plan por `iso_recommended_action_conversions.target_type='action_plan' AND target_id=action_plans.id`. | `node backend/src/services/actionTraceabilitySystemic.contract.test.js` |
| Sugerencia | `iso_operational_suggestions.created_record_type/created_record_id` | PASS. `approveSuggestion` actualiza la sugerencia con el plan creado o reutilizado; retry aplicado devuelve esa fila. | YES. Se reconstruye desde plan por `iso_operational_suggestions.created_record_type='action_plan' AND created_record_id=action_plans.id`. | `node backend/src/services/actionTraceabilitySystemic.contract.test.js` |

No se creo tabla nueva. Para NC/Hallazgo se reutiliza `grc_phase2_relations`, modelo existente tenant-scoped y N:N documentado en `docs/architecture/grc_relationship_inventory.md`.

### B. Active Remediation Equivalence

SQL real documentado:

```sql
CREATE UNIQUE INDEX uq_action_plans_one_active_control_remediation
ON public.action_plans USING btree (tenant_id, tenant_control_id, iso_code)
WHERE (
  (source_type = 'control'::text)
  AND (tenant_control_id IS NOT NULL)
  AND (status = ANY (ARRAY['abierto'::text, 'en progreso'::text, 'bloqueado'::text]))
)
```

Semantica: en `public.action_plans`, una remediacion activa de control se define por `tenant_id + tenant_control_id + iso_code`, con `source_type='control'`, `tenant_control_id IS NOT NULL` y `status IN ('abierto','en progreso','bloqueado')`.

Codigo: `backend/src/services/actionPlanTraceability.service.js` exporta `ACTIVE_CONTROL_REMEDIATION_STATUSES = ['abierto','en progreso','bloqueado']`; `action-plans.routes.js` e `isoOperationalExecution.service.js` consumen esa constante.

| Estado | Codigo lo considera activo | SQL lo considera activo | Equivalente |
|---|---:|---:|---:|
| `abierto` | YES | YES | YES |
| `en progreso` | YES | YES | YES |
| `bloqueado` | YES | YES | YES |
| `completado` | NO | NO | YES |
| `cancelado` | NO | NO | YES |

Resultado: `ACTIVE_CONTROL_REMEDIATION_STATUSES` es semanticamente equivalente al predicado SQL para todos los estados validos de `action_plans.status`. `STATUS_MISMATCHES=NONE`.

### C. Reuse Update Semantics

Contrato real de `action_plan_updates`:

- `progress_percent` es `integer NOT NULL DEFAULT 0` con check `0..100`.
- `NULL` no representa "sin cambio"; el schema no lo permite.
- `0` es un progreso operacional real valido.
- El reader/timeline toma el ultimo `action_plan_updates.progress_percent` como progreso vigente.

Politica cerrada:

- Reuse puro de sugerencia/recomendacion: `NO_ROW` en `action_plan_updates`; la trazabilidad vive en `iso_operational_suggestions.created_record_*` y, para recomendaciones, `iso_recommended_action_conversions`.
- Reuse NC con actualizacion real del plan: si se registra update, usa `CURRENT_PROGRESS` obtenido desde el ultimo update, no placeholder `0`.
- Creacion nueva de plan: `progress_percent=0` se conserva como valor inicial real.

Resultado:

```text
BIDIRECTIONAL_REUSE_TRACEABILITY=PASS
ACTIVE_REMEDIATION_SQL_EQUIVALENCE=PASS
REUSE_PROGRESS_HISTORY_SEMANTICS=PASS
PROGRESS_ZERO_FALSE_EVENT=NO
REAL_ZERO_PROGRESS_PRESERVED=YES
```

### Validacion Final

| Comando | Resultado |
|---|---|
| `node backend/src/services/actionTraceabilitySystemic.contract.test.js` | PASS: `ACTION_TRACEABILITY_SYSTEMIC_CONTRACT_PASS` |
| `node -c backend/src/services/actionPlanTraceability.service.js` | PASS |
| `node -c backend/src/routes/action-plans.routes.js` | PASS |
| `node -c backend/src/routes/findings.routes.js` | PASS |
| `node -c backend/src/routes/ai-compliance.routes.js` | PASS |
| `node -c backend/src/services/isoOperationalExecution.service.js` | PASS |
| `node -c backend/src/services/actionTraceabilitySystemic.contract.test.js` | PASS |
| `npm --prefix backend run check` | PASS |
| `git diff --check` | PASS |

No se ejecuto frontend lint/typecheck/build porque no se modifico frontend en esta verificacion. Build final no requerido: cambios acotados a backend/doc y cubiertos por contrato focal + `node -c` + backend check.

### Protecciones

- `DB_SCHEMA_MODIFIED=NO`
- `HISTORICAL_MIGRATIONS_MODIFIED=NO`
- `HEALTH_FORMULAS_MODIFIED=NO`
- `RBAC_MODIFIED=NO`
- `COMMERCIAL_AUTHORITY_MODIFIED=NO`
- `AI_AUTHORITY_MODIFIED=NO`
- `COMMIT=NO`
- `PUSH=NO`
- `DEPLOY=NO`

### Verdict Final

`ACTION_TRACEABILITY_FINAL_INTEGRITY_READY`
