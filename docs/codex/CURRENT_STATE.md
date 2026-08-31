# CURRENT_STATE — TCDX ISO SaaS V4

Actualizado: 2026-08-31
Repositorio: `Tecdex-SpA/tcdx-iso-saas-v4`
Remote/base `main` verificado para F6.14-A: `e6b431df521300119efaf9194d3ff4d8e56d7004`
Fuente: repositorio `main` + handoffs runtime cerrados + evidencia runtime validada por el responsable del proyecto + cierre runtime F6.11-A + cierre runtime F6.11-B + cierre runtime F6.12-A + cierre runtime F6.13-A + cierre local UI-04 + cierre local UI-07.

## Estado del programa

- CONT-00: DONE (bootstrap documental materializado en `main` antes de PUI-01).
- PUI-01: DONE (source ownership cerrado localmente; validación manual/CI pendiente por diseño).
- PUI-02: DONE (escala/unidad y normalización canónica cerradas localmente para el alcance focal; validación manual/CI pendiente por diseño).
- PUI-03: DONE (semantica canonica de conteos y poblaciones cerrada localmente para Math Governance focal; validación manual/CI pendiente por diseño).
- PUI-04: DONE (validación manual externa confirmada sobre `main/deploy` commit `7a9df185f06be031757d0d79f25aa59b27a53bbf`; focal test y deploy OK reportados por responsable del proyecto).
- PUI-05: DONE (normalización canónica/versionada de estados por dominio en el alcance focal; validación manual/CI pendiente por diseño).
- PUI-06: DONE (fallback legacy gobernado implementado y cierre manual/deploy confirmado en `docs/codex/handoffs/PUI-06.md`).
- PUI-07: DONE (Data Trust determinístico/versionado cerrado localmente para Math Governance focal; validación manual/CI pendiente por diseño).
- PUI-07-HF1: DONE local (pipeline oficial consolidado sobre `officialCalculationOrchestrator -> sourceResolver -> PUI-01..PUI-07`; validación manual/CI/deploy pendiente por diseño).
- PUI-07-HF2: READY_FOR_RUNTIME_VALIDATION local (status/temporal producer-consumer reconciliation implementada para F5_5 runtime; requiere deploy, recalculo oficial y queries PostgreSQL antes de PASS).
- PUI-07-HF3: DONE_LOCAL (cierre contractual residual para `F5_5_MATURITY` y `grc_health_components` validado en runtime externo; `F5_5_SEVERITY_INDEX` requirió HF4 por source override no canónico).
- PUI-07-HF4: DONE_LOCAL (source ownership de `F5_5_SEVERITY_INDEX` cerrado localmente: overrides no canónicos a `incident_operational_events/grc_incidents` se ignoran con warning auditable y se resuelve `audit_findings_actions`; validación runtime/productiva pendiente por diseño).
- PUI-07-HF5: PASS runtime externo confirmado por el responsable del proyecto; `F5_5_SEVERITY_INDEX` calcula desde `audit_findings_actions` con physical source `grc_readiness_findings + grc_readiness_snapshots` y sin falso `SOURCE_SCHEMA_INCOMPATIBLE`.
- PUI-08: DONE (matriz integral oficial computable integrada en `main` y validada en producción sobre commit `2a526d6329f7abae0119a782f99cd64aeed01892`: 53 fórmulas, 20 source contracts, 9 consumers).
- PUI-09: DONE (cierre documental/runtime de fase PUI; evidencia productiva post-PUI-08 aceptada: snapshots, lineage, Data Trust, Severity Index y aislamiento multi-tenant sin regresión).
- PUI_PHASE: CLOSED.
- PRE_UI_DATA_TRUTH_GATE: PASS.
- PRE-UI: CLOSED.
- UI enterprise: UI-02 COMPLETE con Etapas oficiales 1-5 COMPLETE en branch `codex/ui02-stage1-foundation` sobre HEAD local `12a1342877d806267a82e3572bd7483dcfe01fdf`. Secuencia oficial: Etapa 4 = Estados universales/Data Trust y Etapa 5 = replicacion controlada por dominios; orden real ejecutado: Domain Replication fue cerrada primero como "Etapa 4" operativa y Universal States/Data Trust se cerro posteriormente para alinear la referencia original. Arquitectura aprobada: App Shell + `RiskControlWorkspaceShell` + `EnterpriseDomainWorkspaceShell` + enterprise primitives + Universal Data States + `DataTrustIndicator`. Rutas App Router 97->97; RBAC/`mvpPermissions.ts` preservado; backend/API/BD/contratos/Math Governance/Data Trust logico sin cambios por UI-02. Validacion consolidada local PASS: lint, typecheck, sidebar/RBAC, responsive, Stage 3 Risk-Control, Stage 4/5 Domain Workspaces, `UI02_UNIVERSAL_DATA_STATES_CONTRACT_PASS`, build y git diff --check. Evidencia reutilizada: `artifacts/ui02-stage3-risk-control-workspace/`, `artifacts/ui02-stage4-enterprise-domain-workspaces/`, `artifacts/ui02-universal-data-states/`. Deuda remanente clasificada como POLISH BACKLOG; siguiente gate = siguiente bloque de Plan Maestro, no mas propagacion UI-02.
- UI-04: REMEDIATED_AND_APPROVED_LOCAL en branch `codex/ui02-stage1-foundation` sobre HEAD `7d16d534d8f442041569783e247b6d8bd8f72456` sin commit por instruccion. Product Design review final completada: se detecto un `MAJOR` mobile/evidencia porque `Requiere atención` y las secciones Data Trust/Data Gap no quedaban visibles en las capturas objetivo; se remedio adelantando prioridades en mobile sin cambiar el orden desktop y ajustando el harness para capturar secciones `scroll_target`. Centro Ejecutivo aprobado sobre la ruta existente `/dashboard`: KPI strip, prioridades "Requiere atención", riesgo/cumplimiento, auditoría/acciones, tendencia oficial comparable y Data Trust ejecutivo reutilizando `UniversalStateBlock`, `UniversalStateBadge` y `DataTrustIndicator`. No crea `/centro-ejecutivo`, `/executive-center`, endpoint ejecutivo, scoring nuevo, source of truth nuevo, cambios backend/API/BD/IA ni cambios RBAC. Contrato focal PASS: `UI04_EXECUTIVE_COMMAND_CENTER_CONTRACT_PASS route=/dashboard routes=97->97 rbac=unchanged`. Evidencia visual PASS actualizada: `artifacts/ui04-executive-command-center/` con cinco PNG y `manifest.json`. Validacion local PASS: lint, typecheck, sidebar/RBAC, responsive, UI-04 contract, build y git diff --check. DATA_GAP documentado: si snapshots no publican histórico suficiente o Data Trust, la UI muestra `Datos insuficientes`, `No disponible`, `Sin datos` o `No calculable` sin convertir ausencia a cero.
- UI-05: MATERIALMENTE_SATISFECHO_ANTICIPADO por UI-02. Los workspaces GRC consolidados de Riesgo y Control, Cumplimiento, Auditoría, Datos, Inteligencia y Reportes quedaron implementados/aprobados en UI-02 mediante `RiskControlWorkspaceShell` y `EnterpriseDomainWorkspaceShell`. No se ejecutó reimplementación UI-05.
- UI-06: COMPLETE_WITH_POLISH_BACKLOG local en branch `codex/ui02-stage1-foundation` sobre HEAD `966525dbc09af01da1834389f068bfd775514e2d` sin commit por instruccion. Visualización de datos normalizada de forma focal: `ResponsiveChartFrame` acepta contexto accesible; `/dashboard` conserva UI-04 y normaliza tooltips, ejes, estados universales y resúmenes textuales en charts existentes; `/metricas/[id]` agrega tendencia oficial publicada sólo con snapshots calculados suficientes y sin convertir ausencia/no calculable en cero. No se agregan endpoints, mutaciones, fuentes de verdad, fórmulas, agregaciones backend, cambios RBAC ni rutas. Contrato focal PASS: `UI06_DATA_VISUALIZATION_CONTRACT_PASS routes=97->97 rbac=unchanged`. Evidencia visual PASS: `artifacts/ui06-data-visualization/` con `charts-dashboard-1440.png`, `charts-metrics-1440.png`, `charts-mobile-390.png` y `manifest.json`. Validación local PASS: lint, typecheck, sidebar/RBAC, responsive, UI-06 contract, UI-04 contract, UI-02 Universal States/Data Trust contract, build y git diff --check. DATA_GAP: un snapshot ausente/no calculable se omite de la línea y se mantiene como ausencia; histórico insuficiente muestra `Datos insuficientes`. POLISH BACKLOG: warnings locales de Recharts por dimensiones durante captura persisten como deuda no bloqueante ya observada en UI-04, sin overflow global ni chart blank en evidencia.
- UI-07: COMPLETE_WITH_POLISH_BACKLOG local en branch `codex/ui02-stage1-foundation` sobre HEAD `d54d66c890d6c87f9ecb2bf554b53a4a9d5ae34a` sin commit por instruccion. Tablas/filtros/densidad enterprise normalizados de forma focal en `/datos`, `/metricas`, `/riesgos`, `/evidencias?legacy_upload=1`, `/controles` y `/exportes`; rutas revisadas sin reimplementación: `/hallazgos`, `/no-conformidades`, `/planes-accion`, `/auditorias`, `/indicadores`. Se agregan primitivas UI `EnterpriseFilterBar` y `EnterpriseRowActions`, y `EnterpriseTableShell` soporta densidad compacta/footer. No se agregan endpoints, mutaciones, fuentes de verdad, backend/API/BD, fórmulas, cambios RBAC ni rutas. Contrato focal PASS: `UI07_ENTERPRISE_TABLES_CONTRACT_PASS routes=97->97 rbac=unchanged`. Evidencia visual PASS: `artifacts/ui07-enterprise-tables/` con seis PNG, `manifest.json` y validación 1440/1280/390. Validación local PASS: lint, typecheck, sidebar/RBAC, responsive, UI-07 contract, build y git diff --check. POLISH BACKLOG: workbenches especializados tipo cards siguen fuera de conversión a tabla general sin soporte de workflow/backend.
- Fase 6 ampliada 6.8-6.14: LOCAL_CLOSED_PENDING_RUNTIME_VALIDATION.
- 6.8-01-HF1: CLOSED (reconciliación Observation: `grc_observations` + `grc_observation_relations` son el modelo canónico del Semantic Layer; `grcObservation.service.js` queda como fachada GRC; tabla paralela de 6.8-01 migrada/removida si existía).
- 6.8-01-HF2: CLOSED / PASS_RUNTIME (deploy validado por el usuario en production/main `5c40dcc0cad8ff98a207ee92b6465648b1a8a3f2`; `schema_migrations` registra `20260818_f6_8_01_hf2_manual_observation_contract_bootstrap` aplicado, `grc.manual_observations@v1` existe published, `current_version_id` correcto, sin duplicados globales/versiones ni contratos tenant-specific).
- 6.8-01: CLOSED; `F6_8_01_RUNTIME=PASS`; 6.8-02 READY.
- 6.8-02: CLOSED / PASS_RUNTIME (Governed Observation Emitter / Outbox validado por cierre runtime `docs/codex/handoffs/6.8-02-HF1-RUNTIME-CLOSURE.md`; los eventos elegibles retry pasaron a `completed`, persistieron Observation canónica y no generaron duplicados).
- 6.8-02-HF1: CLOSED / PASS_RUNTIME (hotfix de serialización temporal validado post-deploy; `F6_8_02_RUNTIME=PASS`; 6.8-03 quedó READY).
- 6.8-03: CLOSED / PASS_RUNTIME (GRC Gap Model canónico validado post-deploy por `docs/codex/handoffs/6.8-03-RUNTIME-CLOSURE.md`; `F6_8_03_RUNTIME=PASS`, `F6_8_03=CLOSED`, Observation -> Gap runtime confirmado vía `grc_observation_relations`).
- 6.9-01: CLOSED / integrado en `main` mediante `f19709d8deb3dd808e362ebaf6dd7ef4adfe21a3`; inventario canónico de relaciones GRC en `docs/architecture/grc_relationship_inventory.md`: 38 familias, 32 persistidas, 6 derivadas, 8 canónicas, 25 domain-specific y 0 duplicate candidates.
- 6.9-02: CLOSED / PASS_RUNTIME. Impact Graph 2.0 foundation está mergeada en `main@ddd97e02fe7b0c536ab3c3345c2d8d4453febb55` como proyección/adapters en `backend/src/services/grc/impactGraph.service.js`; runtime confirmó modelo `impact-graph-2-foundation-v1`, provenance persisted+derived Observation -> Gap, determinismo, límites, aislamiento cross-tenant, 0 graph storage paralelo y 0 segundo source of truth. Cierre: `docs/codex/handoffs/6.9-02-RUNTIME-CLOSURE.md`.
- 6.9-03: CLOSED / PASS_RUNTIME. Priority Engine 2.0 está mergeado en `main@cb8b0d853521971b0d4d0f2768c9e3b8c967102a` como proyección determinística `priority-engine-2-v1` sobre `grc_gaps` + Impact Graph 2.0; runtime post-deploy confirmó pruebas focales GRC/RBAC, rutas `GET /api/grc/priorities` y `GET /api/grc/priorities/:entityType/:id`, 0 tablas priority/priority_engine, ausencia de `grc_observation_links` y conservación de `grc_gaps`, `grc_observation_relations` y `grc_observations`. `F6_9_03_RUNTIME=PASS`, `LLM_SCORE_AUTHORITY=0`, `NEW_PRIORITY_SOURCE_OF_TRUTH=0`. Cierre: `docs/codex/handoffs/6.9-03-RUNTIME-CLOSURE.md`.
- 6.10-01: CLOSED / PASS_RUNTIME. Runtime closure `docs/codex/handoffs/6.10-01-RUNTIME-CLOSURE.md` confirmó `knowledge-document-model-v1` en production/main `3a1fa02c952d177ac63b5cd21cb47fb480fcfaed`: `knowledge_documents`, `knowledge_sources.knowledge_document_id`, constraints de scope/version/lifecycle/checksum, KB v2 preservada, sin `knowledge_base_v3` y sin modelo vector prematuro. `F6_10_01_RUNTIME=PASS`, `IMPLEMENTATION_DEBT=NONE`, `RUNTIME_DEBT=NONE`.
- 6.10-02: CLOSED / PASS_RUNTIME. Runtime closure `docs/codex/handoffs/6.10-02-RUNTIME-CLOSURE.md` confirmó production/main `8031965baa8563bbff62049a35bf2c73873b27cd`: `knowledge_document_ingestions`, `knowledge_document_chunks`, `knowledge_document_ingestion_audit`, constraints/idempotencia, KB v2 preservada, sin `knowledge_base_v3`, sin pgvector/embeddings y `F6_10_02_RUNTIME=PASS`.
- 6.10-03: CLOSED / PASS_RUNTIME. Runtime closure `docs/codex/handoffs/6.10-03-RUNTIME-CLOSURE.md` confirmó production/main `a71cd9cbe11ab840d6f85e291a5f0224a8834b7a`: pgvector `0.6.0`, `knowledge_chunk_embeddings`, constraints/indexes, tenant-filter-first vector search foundation, canonical chunk model preserved, no `knowledge_base_v3`, no second chunk truth y `F6_10_03_RUNTIME=PASS`.
- 6.10-04: CLOSED / PASS_RUNTIME. Runtime closure `docs/codex/handoffs/6.10-04-RUNTIME-CLOSURE.md` confirmó production/main `98531cce7a1308fa0c3727c962f0fa6559b5d018`: `hybrid-retrieval-contract-v1` reutiliza `knowledge_document_chunks` + `knowledge_chunk_embeddings`, ranking determinístico versionado, tenant filter first, lifecycle filtering, provenance para RAG, sin KB v3, sin segundo retrieval engine y `F6_10_04_RUNTIME=PASS`.
- 6.10-05: CLOSED / PASS_RUNTIME. Runtime closure `docs/codex/handoffs/6.10-05-RUNTIME-CLOSURE.md` confirmó production/main `d098441ec4deff867820f989d8595cfb3206571b`: `rag-grounded-answer-contract-v1` sobre Hybrid Retrieval, citations verificables, abstención segura, tenant isolation, sin KB paralela ni autoridad operacional del LLM. `F6_10_05_RUNTIME=PASS`.
- F6.11-A: CLOSED / PASS_RUNTIME. Runtime closure `docs/codex/handoffs/6.11-A-RUNTIME-CLOSURE.md` confirmó production/main `d69f28a2f69b83c7aa12737dc82788d9def68141`, migración `20260819_f6_11_a_regulatory_foundation` aplicada, modelos regulatorios canónicos presentes, KB v2 preservada, sin storage regulatorio paralelo y `F6_11_B=READY`.
- F6.11-B: CLOSED / PASS_RUNTIME. Runtime closure `docs/codex/handoffs/6.11-B-RUNTIME-CLOSURE.md` confirmó production/main `99dd2772c599c5cbdd579594d7520aadc7b0cbb9`, implementation commit `719b7046870142f22b4ecda232c6cfbbf41e9016`, migración `20260824_f6_11_b_semantic_diff_regulatory_packs` aplicada con checksum `ec090bbd7a95be92d4cd6e01f66e3a09d75083828654695a4a0b7425979e9705`, tests focales PASS, tablas runtime de semantic diff/packs/applicability/audit presentes, sin KB/chunks/regulatory model paralelo y `F6_12_A=READY`.
- F6.12-A: CLOSED / PASS_RUNTIME. Runtime closure `docs/codex/handoffs/6.12-A-RUNTIME-CLOSURE.md` confirmó production/main `6aed2555524e1ab146ab9c25af4015401abfd7be`, implementation commit `28ad84d8ba4fd9c342dbb8c70e4366295bdd9462`, tests focales PASS, adapter Python compilado, no `CREATE TABLE` nuevo para intelligence/pattern/anomaly/context, sin storage paralelo y `F6_13_A=READY`.
- F6.13-A: CLOSED / PASS_RUNTIME. Runtime closure `docs/codex/handoffs/6.13-A-RUNTIME-CLOSURE.md` confirmó production/main `f2828bb45c290d88adbdbe89628e661ec4866a0b`, implementation commit `46b4525c02fc2e8f9ff5f7a5b42a6f2641f7b52f`, migración `20260824_f6_13_a_operational_learning` aplicada con checksum `da9844178ead79afe22cbecd1239a4d42f2f4ef6fd310d429fa571228ad27a79`, tests focales PASS, deploy oficial corregido con runner F6.13, sin storage paralelo y `F6_14_A=READY`.
- F6.14-A: DONE_LOCAL. Campaña consolidada 6.14-01/02/03 agrega `ai-governance-contract-v1`, `ai-capability-registry-v1`, `ai-policy-boundaries-v1`, `ai-retention-redaction-policy-v1`, `ai-evaluation-suite-v1`, `ai-eval-golden-cases-f6-14-v1` y `ai-eval-thresholds-f6-14-v1`. Extiende trazas AI existentes sin DDL, sin segundo AI orchestrator, sin KB/RAG/retrieval/priority/observation/gap/regulatory/memory truth paralelo. `F6_14_A_RUNTIME=PENDING_USER_DEPLOY_VALIDATION`; `PHASE6_EXPANDED_RUNTIME=PENDING_USER_DEPLOY_VALIDATION`.
- RBAC-01 + BRAND-01: aprobado y versionado en `main@31ce8ffa95eede2d9986692dcc1c7eed18acac88` (`feat(auth): normalize RBAC commercial gating and product branding`). DB audit real consumido desde `artifacts/rbac01-db-audit/*.csv`; RBAC-01 ya fue desplegado por el responsable del proyecto y la migración `20260827_rbac01_canonical_roles_brand01` ya fue aplicada en producción. Se implementó resolver backend/frontend de roles canónicos/compatibilidad preservando `effective_role` legacy; revisión final corrigió el match de role gates para que legacy/deprecated no satisfagan listas canonical-only por familia. `auditor` recupera dashboard; `admin != tenant_admin`, `superadmin != platform_admin` y `operativo` legacy quedan documentados/testeados. Comercial separa permiso, entitlement, módulo activo y scope; `MODULE_NOT_ACTIVE` deniega capabilities aunque estén entituladas. BRAND-01 normaliza superficies visibles actuales a `Tecdex GRC Compliance`; identificadores técnicos `tcdx/TECDX` preservados. Siguiente gate: RBAC-02 commercial gating runtime audit desde red con acceso a DB.
- RBAC-02 Commercial Gating: DONE_RUNTIME según baseline RBAC-03 del 2026-08-28; RBAC-02 fue desplegado y la migración productiva `20260827_rbac02_commercial_gating_normalization` fue aplicada por el responsable del proyecto. Root cause original: `/dashboard` requiere `core.dashboard`/`core`; la excepción queda como compatibilidad estricta sólo para `core.dashboard`, bajo `dashboards.read`, sin fallback genérico de módulos. Auditoría READ-ONLY real consumida: 14 tenants, 50 users, 12 roles, 6 active subscriptions, 188 tenant capabilities, 0 unknown roles, 0 module mismatches, 0 false DENY y 1 false ALLOW risk pre-fix corregido por `core.dashboard.required_permission=dashboards.read`. Handoff: `docs/codex/handoffs/RBAC-02-COMMERCIAL-GATING.md`.
- Fase 7: NOT_STARTED.

## Baseline reciente confirmado

- PR #90: mergeado en `main`; commit `3341f69c328fd1f9999fbbf2d57e2b3c5b783361`.
- PR #91 `fix(metrics): reconcile control risk and maturity sources`: OPEN, no mergeado.
- PR #91 head: `e913d67deb9499e4a6a371d99278f1832763138d`.
- PR #91 aborda CONTROL-EFFECT, RISK-INHERENT y MATURITY.
- No se declara CI completo PASS para PR #91 desde este bootstrap.
- PUI-01 se ejecutó sobre branch `fix/pui-01-source-contract-ownership` desde base local `033236f11a140530316c02ad81676a226efc15cb`.
- PUI-01 confirmó que `sourceResolver.test.js` pasa localmente en el checkout actual y cerró la ambigüedad documental de CONTROL-EFFECT: el `score` agregado no se expande a dimensiones D/I/O/E.
- PUI-01 confirmó source ownership para `control_assurance_evidence`, `risk_register_controls` y `maturity_assessments` en `docs/codex/CONTRACTS_REGISTRY.md`.
- PUI-02 se ejecutó sobre branch `fix/pui-02-scale-unit-contract` desde base local `57e8264cfbc94a7895cf21252b85665deea731d0`.
- PUI-02 verificó PUI-01 integrado con SHA distinto al reportado: `810b6c42e8d06572283a243da102b38adca1a5b1` no es ancestro, pero existen `control_assurance_evidence` v3, anti-fabricación D/I/O/E y `docs/codex/handoffs/PUI-01.md`.
- PUI-02 eliminó normalización por magnitud para los paths focales y agregó `scale_metadata` gobernado a contratos/resolver/snapshot.
- PUI-03 se ejecutó sobre branch `fix/pui-03-count-population-semantics` desde base local `d9800d9d38926bf92b0fd08b0f1e528616e2e5bf`.
- PUI-03 verificó PUI-02 integrado con SHA distinto al reportado: `2ec20c5a28c09f833bd0d017cd8bc4054200f367` no es ancestro, pero existe `docs/codex/handoffs/PUI-02.md`, los contratos contienen `scale_metadata`, `maturity_assessments` está en v3 y las heurísticas eliminadas por PUI-02 no reaparecen en los paths focales.
- PUI-03 agregó contrato de conteos canonico: `received`, `eligible`, `usable`, `excluded`, `ineligible`, `eligible_unusable`, `exclusionIssueCount`, `exclusionIssueInstanceCount` y `population_size`.
- PUI-03-HF2 corrigió versionado de fórmula gobernada: `F5_5_CONTROL_EFFECTIVENESS` cambia `1 -> 2` porque PUI-01 modificó metodología serializable; protección de checksum publicada permanece intacta.
- PUI-04 se ejecutó sobre branch `fix/pui-04-temporal-semantics` desde base local `2f6eeb488b869ee5e12e34cbbf6841a5b4f12b0d`.
- PUI-04 agregó `temporal_semantics` gobernado a los 20 source contracts, eliminó el default contractual `created_at` como período genérico y preservó conteos PUI-03 mediante exclusiones temporales auditables.
- PUI-04 cambió versiones de source contracts para no reutilizar payload gobernado publicado; no cambió fórmulas, pesos ni checksums históricos.
- PUI-04 quedó validado externamente en `main/deploy` commit `7a9df185f06be031757d0d79f25aa59b27a53bbf`: `cd backend && node src/services/math-governance/sourceResolver.test.js` reportó `PHASE5_5_SOURCE_RESOLVER_TESTS_OK` y `./scripts/deploy-vms.sh` reportó `DEPLOY V4 FINALIZADO OK`.
- PUI-05 se ejecutó sobre branch `fix/pui-05-status-normalization` desde base local `7a9df185f06be031757d0d79f25aa59b27a53bbf`.
- PUI-05 agregó `status_semantics` gobernado a los 20 source contracts, registry versionado por dominio en Math Governance, exclusiones auditables para `status_unmapped`/`status_not_eligible` y persistencia en `official_formula_source_contracts.metadata`.
- PUI-05 cambió versiones de source contracts para no reutilizar payload gobernado publicado; no cambió fórmulas, pesos, unidades ni precisión.
- PUI-06 se ejecutó sobre branch `fix/pui-06-governed-legacy-fallback` desde base local `90d75b60603fccfc3b4ab0b7f75a9a3e3ef4c1cc`.
- PUI-06 formalizó una política central en `sourceResolver.service.js`: fallback legacy sólo se permite para `primary_absent` o `primary_no_rows` cuando el source code está explícitamente autorizado en `LEGACY_FALLBACK_POLICY_BY_SOURCE`.
- PUI-06 agrega provenance/observabilidad en filas, resultado y snapshot: `fallback_used`, `fallback_reason`, `primary_state`, `primary_source`, `fallback_source`, `fallback_summary` y warning estructurado.
- PUI-06 no modificó source contract payload, fórmulas, pesos, unidades, precisión ni checksums históricos; `CONTRACTS_VERSIONED=[]`.
- PUI-06 cierre manual confirmado: `sourceResolver.test.js` PASS, `./scripts/deploy-vms.sh` PASS y post-deploy backend/AI/frontend PASS según handoff.
- PUI-07 se ejecutó sobre branch `fix/pui-07-data-trust` desde base local `955a5877bd1f199def844a94d3c173be6b94dc04`.
- PUI-07 agregó `dataTrust.service.js` con `data-trust-model-v1`, estados discretos, dimensiones y reasons machine-readable; consume señales PUI-01..PUI-06 sin recalcularlas.
- PUI-07 expone `data_trust` en resolver, `source_snapshot`, metadata de snapshot persistido, result oficial y detalles; no cambió source contracts ni fórmulas.
- PUI-07-HF1 se ejecutó sobre branch `hotfix/pui-07-hf1-official-pipeline-consolidation` desde base local/desplegada `17975ded33956a103e31c26b036b2b4ccae876ea`.
- PUI-07-HF1 elimina Package3 como motor paralelo de verdad: `phase5Package3.service.js` queda como compatibilidad sin cálculo y `phase5.service.js` redirige recalculo/overview al `officialCalculationOrchestrator`.
- PUI-07-HF1 persiste `not_calculable` con `calculation_run`, explanation, machine reason, Data Trust y snapshot/provenance mínimo cuando corresponde; `trust_score`/`trust_status` quedan como proyección legacy derivada de `data_trust` canónico.
- PUI-07-HF1 elimina `America/Santiago` como timezone universal en recalculo oficial/frontend y en defaults focales tocados.
- PUI-07-HF2 se ejecutó sobre branch `fix/pui-07-hf2-runtime-source-semantics` desde base local `606d98eebf20cb5308776740672a2d2837e5fc76`.
- PUI-07-HF2 reconcilia vocabulario legítimo productor-consumidor para dominios F5_5: risk (`suggested`, `needs_review`), control (`unknown`, `incomplete`, `degraded`), audit/action (`abierto`, `en progreso`, `bloqueado`, `completado`, `cancelado`), incident, loss, supplier, assurance (`pass_with_observations`) y data_trust.
- PUI-07-HF2 agrega drift guard `PRODUCER_STATUS_CONTRACTS` en `statusSemantics.service.js` y test focal para que estados legítimos productores no terminen como `status_unmapped`.
- PUI-07-HF2 corrige semántica temporal de `validity_interval`: `valid_to` futuro no se clasifica como evento futuro inválido; `event_stream` y `valid_from` futuro siguen excluidos por `date_in_future`/`temporal_after_as_of` según contrato.
- PUI-07-HF2 versiona sólo los source contracts cuyo `status_semantics.mapping_version` cambió a v2: `risk_register_controls` v7, `control_assurance_evidence` v7, `audit_findings_actions` v7, `incident_operational_events` v5, `loss_events_operational` v6, `supplier_tprm_assessments` v5, `assurance_test_results` v5 e `indicator_data_trust_assessments` v5. No cambió fórmulas.
- PUI-07-HF3 se ejecutó sobre branch `fix/pui-07-hf3-final-contract-closure` desde base local `2dc4820cd8c7967eb051e2c1b4dcbbe5f19e13b6`.
- PUI-07-HF3 cerró drift residual focal: `audit_findings_actions` v8 usa snapshot padre de `grc_readiness_findings` para temporalidad y `status=not_applicable`; `maturity_assessments` v7 reconoce estados producer-known de `survey_evaluations`/`metric_measurements`; `grc_health_components` v6 proyecta `started_at/completed_at` porque `calculation_runs.period_start` es nullable y el contrato ya permite esos fallbacks.
- PUI-07-HF3 no cambió fórmulas, pesos, unidades, precisión, Data Trust v1, fallback governance, snapshots ni Package3.
- Validación runtime externa posterior a PUI-07-HF3 confirmó `F5_5_MATURITY` y `F5_5_GRC_HEALTH` sin defecto residual: no reabrir esos flujos sin evidencia nueva.
- PUI-07-HF4 se ejecutó sobre branch `fix/pui-07-hf4-severity-index-source-closure` desde base local `0c844dddccde4a4c92a8e6bc27841d23c1405c93`.
- PUI-07-HF4 confirmó que el ownership publicado ya era `F5_5_SEVERITY_INDEX -> audit_findings_actions`, con severidad derivada de `grc_readiness_findings`/`grc_readiness_snapshots` cuando existen.
- PUI-07-HF4 corrigió el defecto de override: `officialCalculationOrchestrator` y `sourceResolver` ya no permiten que `source_overrides/body.source_code=incident_operational_events` desplace el contrato canónico de Severity Index; el override se conserva como `requested_source_code` y warning `source_override_ignored_non_canonical`.
- PUI-07-HF4 no modificó source contract payload, fórmulas, pesos, unidades, precisión ni checksums históricos; `SOURCE_CONTRACTS_VERSIONED=[]`, `FORMULAS_VERSIONED=[]`.
- PUI-07-HF5 se ejecutó sobre branch `fix/pui-07-hf5-severity-index-schema-compatibility` desde base local `44821f736f73efaf417683991faef63b7a8a43fd`.
- PUI-07-HF5 corrigió la incompatibilidad física remanente de `F5_5_SEVERITY_INDEX`: el adapter canónico `audit_findings_actions` ya no consulta `grc_readiness_snapshots.source_as_of`, columna inexistente en el schema productor; usa sólo `period_start`, `period_end` y `generated_at`.
- PUI-07-HF5 versionó `audit_findings_actions` v8→v9 porque el payload gobernado eliminó `source_as_of` de `columns`, `source_time_fields` y `valid_from_fields`; no modificó fórmulas, pesos, unidades, precisión, Maturity, GRC Health, Data Trust ni Package3.
- UI-09 se ejecutó sobre branch `codex/ui02-stage1-foundation` desde base local `f401f7ba3d1dbdb0a76b3f446d73b288aeaaba4e`.
- UI-09 cerró responsive/accesibilidad focal final: focus visible global, contraste de disabled, affordance de tabs horizontales, regiones de tabla scrolleables con `role=region`/`tabIndex=0`, conteo de filtros con `aria-live`, header con Escape/focus-return/roles, y ajuste focal de `/matriz-riesgo` para tabla local mobile.
- UI-09 preservó rutas `97 -> 97`, `frontend/src/utils/mvpPermissions.ts` sin diff, Universal States, Data Trust, RBAC, tenants dinámicos, sin endpoints/mutaciones/backend nuevos y sin `null -> 0`.
- Evidencia UI-09 generada en `artifacts/ui09-responsive-accessibility/` con 6 PNG y `manifest.json`; contrato `frontend/scripts/check-ui09-responsive-accessibility-contract.mjs` reporta `UI09_RESPONSIVE_ACCESSIBILITY_CONTRACT_PASS`.

## Ownership fijo

- CODEX A / `codex`: Data / Backend / GRC core.
- CODEX B / `tecdex2-codex`: AI / Knowledge / RAG / Regulatory.
- CODEX C / `tecdex3-codex`: Frontend / UX / Product E2E.

Reasignación operativa vigente: por disponibilidad de cuenta, `6.10-01`, `6.10-02`, `6.10-03`, `6.10-04`, `6.10-05` y `F6.11-A` se ejecutan desde `tecdex3-codex` bajo alcance CODEX B. Esta reasignación no transfiere ownership funcional del dominio ni habilita repo-wide scan.

## Política de validación

`CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`

Codex NO ejecuta automáticamente full CI, full regression, repeated test cycles, push, merge ni deploy.
El usuario realiza CI/merge/deploy y decide si un fallo requiere un work package correctivo.

## Próxima acción

1. AI-ADDON-01 + COMMERCIAL-UI-01 queda listo para revision humana local: push/PR/CI/merge/deploy/migracion/runtime validation son responsabilidad del usuario.
2. Usuario mantiene push/PR/CI/merge/deploy/manual runtime validation si corresponde.
3. No continuar al siguiente bloque desde este cierre.
4. Mantener cerrados PUI-01..PUI-09, F6.8-01/F6.8-02/F6.8-03, 6.9-01..6.9-03, 6.10-01..6.10-05, F6.11-A/B, F6.12-A, F6.13-A, F6.14-A, UI-02, UI-04, UI-05 material, UI-06, UI-07 y UI-09 salvo evidencia objetiva nueva.
5. RBAC-01 + BRAND-01 está en `main@31ce8ffa95eede2d9986692dcc1c7eed18acac88`; RBAC-01 ya fue desplegado y su migración productiva ya fue aplicada por el responsable del proyecto.
6. RBAC-02 ya fue desplegado y la migración productiva `20260827_rbac02_commercial_gating_normalization` fue aplicada por el responsable del proyecto según baseline RBAC-03 del 2026-08-28.
7. RBAC-03 fue reevaluado con nuevo hecho confirmado: Admin Credex recuperó Dashboard tras refrescar contrato desde superadmin. `RBAC03_NOT_REQUIRED` para reconciliación de roles/permisos; el fix local queda acotado a sincronización automática contrato comercial legacy -> `tenant_subscriptions` y cache/context invalidation. Producción no fue modificada por Codex.
8. AI-ADDON-01 + COMMERCIAL-UI-01 quedó `READY_FOR_HUMAN_REVIEW` local sobre `main@6dc752b` con working tree dirty esperado y sin commit/push/deploy/migracion productiva por Codex. La migración histórica `20260828_commercial_standard_plan_matrix.sql` quedó sin diff y su checksum histórico PASS; la evolución forward-only vive en `20260831_ai_addon_commercial_visibility.sql` con runner `scripts/ai-addon/apply-ai-addon-migration.js`. IA pasa a add-on transversal: ISO, ISO+Riesgo y GRC pueden existir con o sin IA; GRC base ya no concede IA efectiva sin add-on activo. Validación local PASS: backend focal completo, frontend lint/typecheck/contratos comerciales, route matrix 97/97/0, build y `bash -n scripts/deploy-vms.sh`. Producción no fue modificada.

## RBAC-03 Effective Authorization

Status: `RBAC03_NOT_REQUIRED` para roles/permisos; commercial sync fix y modelo comercial estándar READY_FOR_HUMAN_REVIEW local sobre `main@29fe3fb7a57854e637205e84aa15281181e1267f`.

Root cause reevaluado:

- El refresh superadmin de contrato corrigió el acceso, por lo que la causa primaria no es RBAC role/permission.
- Hay dos superficies comerciales: `tenant_contracts`/`v_tenant_modules` y `tenant_subscriptions`/`v_commercial_tenant_*`; Phase 4 sembraba `tenant_subscriptions` desde contratos, pero el guardado posterior de contrato no sincronizaba automáticamente esa superficie.
- Admins del tenant activo `Servicios de Información Credex SPA` aparecen como `NO_FAILURE`, igual que admins Tecdex; `admin@credex.cl`/`admind2@credex.cl` de `Credex test` siguen siendo deny correcto por `SUBSCRIPTION_INACTIVE`.

Cambios RBAC-03:

- `backend/src/services/commercial/contractSubscriptionSync.service.js` sincroniza contrato Admin SaaS a `tenant_subscriptions`.
- `backend/src/routes/admin-saas.routes.js` ejecuta esa sincronización en la misma transacción de guardar contrato, suspender servicio y reactivar servicio.
- `backend/src/routes/me.routes.js` resuelve `/api/me/entitlements` con `resolveEffectiveTenant`; mismatch de tenant seleccionado ahora falla explícitamente.
- `frontend/src/hooks/useTenantEntitlements.ts`, `frontend/src/utils/auth.ts`, `frontend/src/utils/apiClient.ts` y `frontend/src/utils/accessBootstrap.ts` invalidan cache por cambio de usuario/token/tenant.
- No hay migración RBAC, no hay grants nuevos de roles/permisos y no hay excepción por tenant/usuario.
- `backend/src/services/commercial/commercialPlanModel.service.js` define alias estándar `iso -> pyme -> ISO`, `iso_operational_risk -> empresa -> ISO + Riesgo Operativo` y `grc -> enterprise -> GRC`; `demo` y `legacy` siguen sólo como compatibilidad histórica.
- Admin SaaS muestra únicamente planes estándar para nuevos contratos y muestra módulos derivados desde backend/BD como información read-only.
- `backend/src/services/commercial/commercialPlanMatrix.service.js` define la matriz definitiva capability-by-capability: `ISO = ONLY_ISO`, `ISO_RISK = ISO + OPERATIONAL_RISK_ONLY`, `GRC = ALL_TENANT_COMMERCIAL_CAPABILITIES`.
- `database/migrations/20260828_commercial_standard_plan_matrix.sql` normaliza la matriz publicada por capabilities, materializa `iso.compliance`, `iso.risk`, `iso.actions`, `evidence.library` e `iso.health` si faltan, y deriva módulos desde las capabilities esperadas; no usa `grc_core` como proxy de ISO.
- `scripts/commercial-plan/apply-commercial-plan-matrix-migration.js` es el runner oficial local de la migración comercial: usa `MIGRATION_DATABASE_URL`, checksum SHA-256, `schema_migrations`, advisory lock, `--preflight`, `--apply`, detección `already_applied`, fallo por checksum mismatch y postconditions ISO/ISO+Riesgo/GRC.
- `scripts/deploy-vms.sh` registra `Commercial Plan Matrix|scripts/commercial-plan/apply-commercial-plan-matrix-migration.js` después de RBAC-02 y antes de desplegar backend/AI/frontend; fail-fast queda preservado.
- La migración comercial no fue ejecutada por Codex y debe pasar review humano; valida sobre/subexposición antes de aplicar y conserva datos históricos usando `included=false`.
- `docs/codex/commercial/COMMERCIAL_PLAN_CAPABILITY_MATRIX.md` documenta 45 capabilities comerciales tenant: 7 `ISO_ONLY`, 5 `OPERATIONAL_RISK_EXTENSION`, 33 `GRC_ADVANCED`, con `OVEREXPOSED=0`, `UNDEREXPOSED=0`, `MISCLASSIFIED=0` local.
- `artifacts/rbac02-route-audit/route_access_matrix.csv` fue regenerado con `routes=97`, `mapped=97`, `missing=0`.
- Estado operacional: `COMMERCIAL_PLAN_MATRIX_APPROVED`, `COMMERCIAL_PLAN_MIGRATION_RUNNER_READY`, `PRODUCTION_MIGRATION_NOT_EXECUTED`.

## Handoff relevante

- `docs/codex/handoffs/CONT-00.md`
- `docs/codex/handoffs/PUI-01.md`
- `docs/codex/handoffs/PUI-02.md`
- `docs/codex/handoffs/PUI-03.md`
- `docs/codex/handoffs/PUI-03-HF2.md`
- `docs/codex/handoffs/PUI-04.md`
- `docs/codex/handoffs/PUI-05.md`
- `docs/codex/handoffs/PUI-06.md`
- `docs/codex/handoffs/PUI-07.md`
- `docs/codex/handoffs/PUI-07-HF1.md`
- `docs/codex/handoffs/PUI-07-HF2.md`
- `docs/codex/handoffs/PUI-07-HF3.md`
- `docs/codex/handoffs/PUI-07-HF4.md`
- `docs/codex/handoffs/PUI-07-HF5.md`
- `docs/codex/handoffs/PUI-08.md`
- `docs/codex/handoffs/PUI-09.md`
- `docs/codex/handoffs/6.8-01.md`
- `docs/codex/handoffs/6.8-01-HF1.md`
- `docs/codex/handoffs/6.8-01-HF2.md`
- `docs/codex/handoffs/6.8-02.md`
- `docs/codex/handoffs/6.8-02-HF1.md`
- `docs/codex/handoffs/6.8-02-HF1-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.8-03.md`
- `docs/codex/handoffs/6.8-03-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.9-01.md`
- `docs/codex/handoffs/6.9-02.md`
- `docs/codex/handoffs/6.9-02-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.9-03.md`
- `docs/codex/handoffs/6.9-03-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.10-01.md`
- `docs/codex/handoffs/6.10-01-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.10-02.md`
- `docs/codex/handoffs/6.10-02-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.10-03.md`
- `docs/codex/handoffs/6.10-03-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.10-04.md`
- `docs/codex/handoffs/6.10-04-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.10-05.md`
- `docs/codex/handoffs/6.10-05-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.11-A.md`
- `docs/codex/handoffs/6.11-A-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.11-B.md`
- `docs/codex/handoffs/6.11-B-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.12-A.md`
- `docs/codex/handoffs/6.12-A-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.13-A.md`
- `docs/codex/handoffs/6.13-A-RUNTIME-CLOSURE.md`
- `docs/codex/handoffs/6.14-A.md`
- `docs/codex/handoffs/UI-04.md`
- `docs/codex/handoffs/UI-06.md`
- `docs/codex/handoffs/UI-07.md`
- `docs/codex/handoffs/UI-09.md`
- `docs/codex/handoffs/RBAC-01-BRAND-01.md`
- `docs/codex/handoffs/RBAC-02-COMMERCIAL-GATING.md`
- `docs/codex/handoffs/AI-ADDON-01-COMMERCIAL-UI-01.md`
- `docs/codex/PHASE6_EXPANDED_CLOSURE.md`
- `docs/architecture/grc_relationship_inventory.md`
