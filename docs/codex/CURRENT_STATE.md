# CURRENT_STATE — TCDX ISO SaaS V4

Actualizado: 2026-09-02
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

1. AI-ADDON-02 queda listo para revision humana local: IA comercial es binaria por `tenant_subscription_addons.addon_key='ai'`; `ai_plan` queda como compatibilidad sin autoridad, no visible/seleccionable en Admin SaaS y no participa en `/api/me/entitlements` ni en gates runtime. Push/PR/CI/merge/deploy/runtime validation son responsabilidad del usuario.
2. AI-ADDON-01 + COMMERCIAL-UI-01 queda listo para revision humana local: push/PR/CI/merge/deploy/migracion/runtime validation son responsabilidad del usuario.
3. Usuario mantiene push/PR/CI/merge/deploy/manual runtime validation si corresponde.
4. No continuar al siguiente bloque desde este cierre.
5. Mantener cerrados PUI-01..PUI-09, F6.8-01/F6.8-02/F6.8-03, 6.9-01..6.9-03, 6.10-01..6.10-05, F6.11-A/B, F6.12-A, F6.13-A, F6.14-A, UI-02, UI-04, UI-05 material, UI-06, UI-07 y UI-09 salvo evidencia objetiva nueva.
6. RBAC-01 + BRAND-01 está en `main@31ce8ffa95eede2d9986692dcc1c7eed18acac88`; RBAC-01 ya fue desplegado y su migración productiva ya fue aplicada por el responsable del proyecto.
7. RBAC-02 ya fue desplegado y la migración productiva `20260827_rbac02_commercial_gating_normalization` fue aplicada por el responsable del proyecto según baseline RBAC-03 del 2026-08-28.
8. RBAC-03 fue reevaluado con nuevo hecho confirmado: Admin Credex recuperó Dashboard tras refrescar contrato desde superadmin. `RBAC03_NOT_REQUIRED` para reconciliación de roles/permisos; el fix local queda acotado a sincronización automática contrato comercial legacy -> `tenant_subscriptions` y cache/context invalidation. Producción no fue modificada por Codex.
9. AI-ADDON-01 + COMMERCIAL-UI-01 quedó `READY_FOR_HUMAN_REVIEW` local sobre `main@6dc752b` con working tree dirty esperado y sin commit/push/deploy/migracion productiva por Codex. La migración histórica `20260828_commercial_standard_plan_matrix.sql` quedó sin diff y su checksum histórico PASS; la evolución forward-only vive en `20260831_ai_addon_commercial_visibility.sql` con runner `scripts/ai-addon/apply-ai-addon-migration.js`. IA pasa a add-on transversal: ISO, ISO+Riesgo y GRC pueden existir con o sin IA; GRC base ya no concede IA efectiva sin add-on activo. Validación local PASS: backend focal completo, frontend lint/typecheck/contratos comerciales, route matrix 97/97/0, build y `bash -n scripts/deploy-vms.sh`. Producción no fue modificada.
10. POSTDEPLOY-02-LEGACY-CANONICAL-DATA-AUDIT quedó `POSTDEPLOY_LEGACY_CANONICAL_DB_AUDIT_COMPLETE` sobre `main@84fc1799e497e0af2abe6089eb6e3c2b800905e9`: auditoría productiva read-only cerrada con `DB_AUDIT_CONNECTION=OK`, `DB_AUDIT_READ_ONLY=YES`, `DB_NAME=tecdex_saas`, `DB_USER=postgres`, PostgreSQL `16.15` y `production_writes=NO`. Evidencia DB confirmó views comerciales addon-aware, migraciones focales aplicadas con checksum local coincidente, Credex activo con subscription `enterprise` y add-on `ai` efectivo, pero `ai.compliance` falla por `required_permission=ai_compliance.read` ausente en `permissions`; `iso.actions` falla igual por `required_permission=actions.read` ausente. También confirmó Health/KPI divergence: official `GRC-HEALTH`/`DATA-TRUST` unmeasured vs legacy `KPI-HLT-*` numérico, `EVIDENCE-COVERAGE` ausente y `F5_C3_DATA_TRUST` bloqueado por `accuracy/Exactitud`. Handoff: `docs/codex/handoffs/POSTDEPLOY-02-LEGACY-CANONICAL-DATA-AUDIT.md`; artefactos: `artifacts/postdeploy-legacy-audit/*.csv`; next gate: `HUMAN_REVIEW_BEFORE_NORMALIZATION_OR_FIX`.
11. NORMALIZATION-01 quedó `READY_FOR_HUMAN_REVIEW` local sobre `main@84fc1799e497e0af2abe6089eb6e3c2b800905e9` sin commit/push/deploy ni `--apply` productivo. Autoridades: IA comercial binaria por `tenant_subscription_addons.addon_key='ai'`; `ai.compliance.required_permission=ai.view`; `iso.actions.required_permission=actions.view`; planes base sin IA efectiva; add-ons duplicados IA se cierran por migración forward-only sin DELETE; `/api/grc/overview` queda read-only sobre últimos cálculos oficiales persistidos. Migración `20260901_normalization01_db_backend_authority.sql`, runner `scripts/normalization/apply-normalization-01-migration.js`, checksum `9dd53235b8f2b54afd9f09e047b5a3be44293b23b0969e66f442ed01a3761a78`. Validación local focal PASS; productive preflight no ejecutado porque `MIGRATION_DATABASE_URL` no estaba definido.

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

## NORMALIZATION-02 — KPI / Health / UI

Status: `READY_FOR_HUMAN_REVIEW` local sobre `main@4642ff103735c79581441e61b65591112283d1b8`.

Autoridad canónica:

- `GLOBAL_HEALTH_AUTHORITY=official_formula_versions+calculation_runs+calculation_outputs+metric_snapshots+metric_source_bindings`.
- `GLOBAL_SCORE_FORMULA=F5_5_GRC_HEALTH`.
- `GLOBAL_SCORE_VERSION=2`.
- `GLOBAL_SCORE_COVERAGE_POLICY=available_weight/applicable_weight; publish only when coverage >= minimum_coverage`.
- `DATA_TRUST_ACCURACY_POLICY=accuracy remains NOT_CONFIGURED until a real measurable source or canonical binding exists`.
- `EVIDENCE_COVERAGE_MAPPING=EVIDENCE-FRESH=freshness; COVERAGE=compliance_coverage; EVIDENCE-COVERAGE=compatibility_alias_only`.
- `LEGACY_KPI_HLT_ROLE=COMPATIBILITY_SOURCE_COMPONENT`.

Cambios locales:

- `F5_5_GRC_HEALTH` v2 soporta disponibilidad parcial sin convertir faltantes a `NOT_APPLICABLE`, reporta cobertura/confianza/faltantes y sólo publica score ejecutivo con cobertura suficiente.
- `canonicalHealthProjection.service.js` es la proyección única para `/dashboard`, `/health`, `/iso-health` y `/api/grc/overview`.
- `/api/health/summary`, `/api/health/dashboard`, `/api/health/kpis` y `/api/grc/overview` leen Health canónico; norma/proceso/KPI-HLT quedan como detalle de compatibilidad.
- `/encuestas` conserva un solo `AppLayout` desde su layout de ruta.
- `EVIDENCE-COVERAGE` no se crea como métrica oficial; la expectativa queda cerrada por mapping de compatibilidad.
- Migración forward-only `database/migrations/20260901_normalization02_kpi_health_ui.sql` y runner `scripts/normalization/apply-normalization-02-migration.js` agregados. Checksum: `b1daafdac3eda56dafd3cc47b655512bb34a88435a3954a5fd8de94c89f87da6`.

Validación local focal: `git diff --check`, checks sintácticos de servicios/runner, tests `NORMALIZATION02_GLOBAL_SCORE_SEMANTICS_PASS`, `NORMALIZATION02_CANONICAL_HEALTH_PROJECTION_PASS`, `NESTED_ENCUESTAS_LAYOUT=0`, `NORMALIZATION02_RUNNER_CONTRACT_PASS`, checksum runner y `bash -n scripts/deploy-vms.sh`. No se ejecutó build, lint/typecheck global, Playwright/E2E, regresión integral, deploy ni validación runtime.

## RELEASE-CLOSEOUT — NORMALIZATION-01 + NORMALIZATION-02

Status: `RELEASE_CLOSEOUT_NO_GO` local sobre `main@4642ff103735c79581441e61b65591112283d1b8`.

Resultado: Gates locales A/B/C PASS, pero release GO bloqueado porque `MIGRATION_DATABASE_URL` no esta definido en el entorno local y no pudo ejecutarse preflight PostgreSQL read-only de NORMALIZATION-01/02. Por regla de cierre no hubo commit, deploy oficial ni postdeploy.

Evidencia local PASS:

- Historico protegido: `database/migrations/20260828_commercial_standard_plan_matrix.sql` y `database/migrations/20260831_ai_addon_commercial_visibility.sql` sin diff.
- Gate A: contratos NORMALIZATION-01/02, AI add-on, matriz comercial, RBAC-02, visibilidad comercial, subscription sync, commercial multi-tenant y RBAC middleware PASS.
- Gate B: frontend lint/typecheck/build PASS, backend `npm run check` PASS, checksums de migraciones y `bash -n scripts/deploy-vms.sh` PASS.
- Gate C: `WEB_BASE_URL=http://localhost:3001 npx playwright test --config=playwright.release-closeout.config.ts` PASS con 11/11 sobre rutas criticas `/dashboard`, `/dashboard?view=kpi`, `/ia-compliance`, `/ia-auditor`, `/acciones-recomendadas`, `/planes-accion`, `/encuestas`, `/grc`, `/health`, `/iso-health`.

Pendiente bloqueante exacto: ejecutar preflight oficial de migraciones en contexto autorizado, luego commit/deploy/postdeploy si preflight PASS. Handoff: `docs/codex/handoffs/RELEASE-CLOSEOUT-NORMALIZATION.md`.

## AI-ADDON MIGRATION ORDER RECONCILIATION

Status: `READY_FOR_HUMAN_REVIEW` local sobre `main@279ec9a68a87bb1da8751d2df426b498a4c1286e`.

Root cause confirmado: `20260828_commercial_standard_plan_matrix` pudo reejecutarse porque el lookup exacto de `schema_migrations` no encontraba una fila aplicada para `migration_id=20260828_commercial_standard_plan_matrix` en el momento del deploy; no fue causado por checksum/status/details drift ni por la evolucion aceptada de permisos/clasificacion. Esa reejecucion historica revirtio invariantes efectivas de `20260831_ai_addon_commercial_visibility` aunque su ledger seguia `applied`.

Cambios locales: el runner comercial clasifica ledger antes de catalog drift y bloquea reapply con `applied+checksum`; el runner AI Add-on reconoce solo el estado revertido conocido como `already_applied_with_reconciliation_required`; se agrega migracion forward-only `20260901_reconcile_ai_addon_after_historical_reapply` y runner `scripts/normalization/apply-ai-addon-reconciliation-migration.js`; `scripts/deploy-vms.sh` queda ordenado Commercial Plan Matrix -> AI Add-on -> AI Add-on Reconciliation -> NORMALIZATION-01 -> NORMALIZATION-02.

Validacion focal y preflight productivo read-only PASS; no hubo `--apply`, commit, push ni deploy. Handoff: `docs/codex/handoffs/AI-ADDON-MIGRATION-ORDER-RECONCILIATION.md`.

## HOTFIX-POSTDEPLOY-01 — ISO Health / IA Compliance / GRC

Status: `READY_FOR_HUMAN_REVIEW` local sobre `main@ab63c0c4d7f37a88275b030d7ce5920c75504365` sin commit/push/deploy ni migración aplicada por Codex.

Root causes cerrados localmente:

- `/iso-health` y `/grc` fallaban porque `canonicalHealthProjection.service.js` consultaba `calculation_runs cr.source_as_of` y `cr.created_at`, columnas inexistentes en producción. La proyección ahora usa sólo `period_end`, `completed_at`, `started_at` y `period_start`.
- Request_id productivo `web-1788294251198-ff1293a847d9b` encontrado en logs backend con `SQLSTATE=42703`, mismo error `column cr.source_as_of does not exist`; `/api/grc/overview` conserva GET read-only.
- `/ia-compliance` fallaba en el primer gate RBAC efectivo: add-on IA, capability `ai.compliance`, runtime `suggestions` y Auditor IA estaban OK, pero roles tenant esperados tenían `ai.view=false`; `audit.review=true` explicaba el control positivo Auditor Senior IA. Se agrega migración forward-only `20260901_hotfix_postdeploy01_ai_view_rbac` y runner `scripts/normalization/apply-hotfix-postdeploy-01-migration.js` para conceder `ai.view` sólo a `admin`, `tenant_admin` y `auditor`, con postcondition que bloquea roles no autorizados.
- Sidebar i18n: `navigation.destinations.aiAuditor` agregado a `es.json` y `en.json`.

Evidencia productiva read-only: `transaction_read_only=on`; `calculation_runs` no tiene `source_as_of` ni `created_at`; `HOTFIX_RBAC_STATE ai_permission_active=true ai_compliance_canonical=true tenant_expected_role_count=3 tenant_expected_ai_view_count=0 unauthorized_ai_view_role_count=0`; producción no fue modificada.

Validación focal PASS: `git diff --check`, checks sintácticos de JS tocados, `bash -n scripts/deploy-vms.sh`, checksum/contrato del runner hotfix, `canonicalHealthProjection.service.test.js`, `grcHealthCalculation.service.test.js`, `aiAddonCommercial.contract.test.js`, `normalization01Authority.contract.test.js`, `npm --prefix frontend run test:phase6-sidebar-rbac`, `npm --prefix frontend run test:phase6-commercial-multitenant`.

Next gate: `HUMAN_REVIEW -> COMMIT -> PUSH -> OFFICIAL_DEPLOY -> POSTDEPLOY_RUNTIME_VALIDATION`.

## UI-OPT-01 — PRODUCTIVITY CLEANUP

Status: `READY_FOR_HUMAN_REVIEW` local sobre `main@e7dc1b01c03a20c6852db2db3e52a2ca10d4d24a` sin commit/push/deploy.

Cambios locales: se elimina duplicacion de `AuditReadinessCard` en `/auditorias` y `/cumplimiento-auditoria`; `/grc-global` queda oculto de navegacion visible con ruta/RBAC/backend preservados; Data Governance conserva `/datos` e `/importaciones` como accesos primarios y relega `/datos/calidad`, `/datos/catalogo`, `/datos/lineage` y `/datos/semantica`; KPI/Health y reportes localizan codigos/enums visibles sin cambiar lookups internos; report designer queda especializado para `kind='report'`; reportes premium muestran preview/narrativa/fuentes solo con contenido real; evidencias muestra Google Drive y carga manual como fuentes productivas visibles, con Zoho/Sync Agent/carpeta montada fuera de UI productiva y biblioteca documental scrolleable.

Validacion local PASS: `git diff --check`, `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run test:phase6-sidebar-rbac`, `npm --prefix frontend run test:phase6-commercial-multitenant` y `npm --prefix frontend run build`. `frontend/tsconfig.json` fue restaurado tras el ajuste automatico de Next.

Autoridades preservadas: backend/API/BD/migraciones/RBAC/modelo comercial/Health authority/formulas oficiales sin cambios. Handoff: `docs/codex/handoffs/UI-OPT-01-PRODUCTIVITY-CLEANUP.md`.

## UI-OPT-02 — PRODUCTIVE CLOSURE

Status: `READY_FOR_HUMAN_REVIEW` local sobre `main@d0326953744354e0e8a6c5be55a0b87f1426fd44` sin commit/push/deploy.

Cambios locales: `/datos` deja de ser wrapper generico y pasa a `DataTraceabilityCenter`, usando endpoints reales existentes (`/api/grc/overview`, `/api/data/domains`, `/api/data/elements`, `/api/data/quality`, `/api/evidence-library/sources`, `/api/grc/official/analytics/catalog`) para mostrar datos disponibles, origen, uso, calidad/confianza, dependencias, faltantes y proxima accion. Report Studio separa `Revisar configuracion` local de `Vista previa` real: no existe preview backend propio de definicion studio, generacion/historial/descarga quedan mapeados a `/api/reports/:id/generate`, `/api/report-generations` y `/api/report-generations/:id/download`. `/exportes` corrige contraste y compacta la lectura ejecutiva/contexto; Dashboard KPI localiza labels visibles sin cambiar identificadores internos ni formulas.

Validacion local PASS: `git diff --check`, `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run test:phase6-sidebar-rbac`, `npm --prefix frontend run test:phase6-commercial-multitenant` y `npm --prefix frontend run build`. Test focal de reportes Phase 5.5 disponible quedo `BLOCKED_BY_ENV` por `WEB_BASE_URL` ausente. `frontend/tsconfig.json` fue restaurado tras el ajuste automatico de Next.

Autoridades preservadas: backend/API/BD/migraciones/RBAC/modelo comercial/Health authority/formulas oficiales sin cambios. Handoff: `docs/codex/handoffs/UI-OPT-02-PRODUCTIVE-CLOSURE.md`.

## UI-OPT-03 — REPORTING, CONTRASTE Y LOCALIZACION

Status: `READY_FOR_HUMAN_REVIEW` local sobre `main@5236f4904463d5b422a6167564ba35a2aab7483c` sin commit/push/deploy.

Cambios locales: `/reportes/studio` queda como flujo guiado para seleccionar contenido real desde catalogo oficial, configurar nombre/tipo/formato/periodo, revisar configuracion, generar informe, consultar historial y descargar salida. La exigencia de formula publicada queda fuera del flujo principal de usuario; codigos internos permanecen solo en payloads/detalle tecnico colapsado. `/exportes` conserva preview real premium y refuerza contraste de `Lectura ejecutiva del sistema`; IA Auditor Senior refuerza contraste en superficies oscuras; categorias/enums visibles usan `presentationLabels` sin modificar codigos enviados a backend.

Validacion local PASS: `git diff --check`, `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run test:phase6-sidebar-rbac`, `npm --prefix frontend run test:phase6-commercial-multitenant` y `npm --prefix frontend run build`. No existe script focal de reportes en `frontend/package.json`. `frontend/tsconfig.json` fue restaurado tras el ajuste automatico de Next.

Autoridades preservadas: backend/API/BD/migraciones/RBAC/modelo comercial/Health authority/formulas oficiales/AI runtime sin cambios. Handoff: `docs/codex/handoffs/UI-OPT-03-REPORTING-CONTRAST-LOCALIZATION-CLOSEOUT.md`.

## UI-FUNC-04 — REPORTS + AUDIT UX CLOSEOUT

Status: `READY_FOR_HUMAN_REVIEW` local sobre `main@adc92877a5ecc5b5a84f29396ec60a218c6f4541` sin commit/push/deploy.

Cambios locales: Report Studio alinea `report_type` con el CHECK real que fallaba en producción (`POST /api/reports/`, `SQLSTATE=23514`, `report_definitions_report_type_check`), `/reportes/generaciones` queda como `Informes generados` sobre `/api/report-generations` y `/api/reports`, `/auditorias/ejecucion` y `GrcPhase1Panel` usan selector real de auditorías por tenant sin input libre de ID, y se cierran contraste/localización focal y descargas sin IDs técnicos visibles para cliente.

Validación local PASS: `git diff --check`, `node --check backend/src/services/phase5/phase5.service.js`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run lint`, `npm --prefix frontend run test:phase6-sidebar-rbac`, `npm --prefix frontend run test:phase6-commercial-multitenant` y `npm --prefix frontend run build`. `FOCAL_RUNTIME_E2E=DEFERRED_TO_HUMAN_POSTDEPLOY`.

Autoridades preservadas: BD/migraciones/RBAC/modelo comercial/Health formulas/AI runtime sin cambios. Handoff: `docs/codex/handoffs/UI-FUNC-04-REPORTS-AUDIT-UX-CLOSEOUT.md`.

## UI-FUNC-05 — REPORTS + AUDIT PRODUCT CLOSEOUT

Status: `READY_FOR_HUMAN_REVIEW` local sobre `main@274278f62b78c64c1f8ea3ce00983bb3c4bbd61b` sin commit/push/deploy.

Cambios locales: `/reportes/studio` queda sin tabla primaria de definiciones técnicas y separa configuración guardada de generación real; la descarga/ver informe generado sólo aparece con `generation.status=generated`. `/reportes/generaciones` elimina el `AppLayout` interior bajo el layout de reportes y mantiene biblioteca de generaciones reales con descarga. `/auditorias/ejecucion` conserva selector real y agrega flujo operacional de 8 pasos con estados derivados del audit/checklist. Se agrega `GET /api/audits/generated-report/:id` para PDF operacional read-only generado al vuelo con empresa, norma, periodo, equipo, checklist, hallazgos y acciones reales disponibles. IA Auditor Senior corrige contraste desde la causa efectiva de cascade `.tcdx-premium-view`.

Validación local PASS: `git diff --check`, `node --check backend/src/services/phase5/phase5.service.js`, `node --check backend/src/routes/audits.routes.js`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run lint`, `npm --prefix frontend run test:phase6-sidebar-rbac`, `npm --prefix frontend run test:phase6-commercial-multitenant` y `npm --prefix frontend run build`. `frontend/tsconfig.json` fue restaurado tras el ajuste automático de Next. `FOCAL_RUNTIME_E2E=DEFERRED_TO_HUMAN_POSTDEPLOY`.

Autoridades preservadas: BD/migraciones/RBAC/modelo comercial/Health formulas/AI runtime sin cambios; sin lógica tenant-specific. Handoff: `docs/codex/handoffs/UI-FUNC-05-REPORTS-AUDIT-PRODUCT-CLOSEOUT.md`.

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
- `docs/codex/handoffs/UI-OPT-01-PRODUCTIVITY-CLEANUP.md`
- `docs/codex/handoffs/UI-OPT-02-PRODUCTIVE-CLOSURE.md`
- `docs/codex/handoffs/UI-OPT-03-REPORTING-CONTRAST-LOCALIZATION-CLOSEOUT.md`
- `docs/codex/handoffs/UI-FUNC-04-REPORTS-AUDIT-UX-CLOSEOUT.md`
- `docs/codex/handoffs/UI-FUNC-05-REPORTS-AUDIT-PRODUCT-CLOSEOUT.md`
- `docs/codex/handoffs/RBAC-01-BRAND-01.md`
- `docs/codex/handoffs/RBAC-02-COMMERCIAL-GATING.md`
- `docs/codex/handoffs/AI-ADDON-01-COMMERCIAL-UI-01.md`
- `docs/codex/handoffs/AI-ADDON-02-BINARY-COMMERCIAL-MODEL.md`
- `docs/codex/handoffs/POSTDEPLOY-02-LEGACY-CANONICAL-DATA-AUDIT.md`
- `docs/codex/handoffs/NORMALIZATION-01-DB-BACKEND-AUTHORITY.md`
- `docs/codex/handoffs/NORMALIZATION-02-KPI-HEALTH-UI.md`
- `docs/codex/handoffs/RELEASE-CLOSEOUT-NORMALIZATION.md`
- `docs/codex/handoffs/AI-ADDON-MIGRATION-ORDER-RECONCILIATION.md`
- `docs/codex/handoffs/HOTFIX-POSTDEPLOY-01-ISOHEALTH-AI-GRC.md`
- `docs/codex/PHASE6_EXPANDED_CLOSURE.md`
- `docs/architecture/grc_relationship_inventory.md`
