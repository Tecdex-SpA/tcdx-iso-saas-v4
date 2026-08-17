# WORK_QUEUE — TCDX ISO SaaS V4

Fuente: Plan Maestro canónico. No tomar un work package `IN_PROGRESS` por otra cuenta sin reasignación explícita.

| ID | Owner | Account | Status | Depends on | Branch | Base SHA | Head/Commit | Handoff | Exit Gate | Next exact action |
|---|---|---|---|---|---|---|---|---|---|---|
| CONT-00 | CODEX A | codex | DONE | - | manual-local | main@3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | THIS_BOOTSTRAP | docs/codex/handoffs/CONT-00.md | CODEX_CONTINUITY_BOOTSTRAP=PASS | Materializar y commit manual |
| PUI-01 | CODEX A | codex | DONE | CONT-00 | fix/pui-01-source-contract-ownership | 033236f11a140530316c02ad81676a226efc15cb | FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE | docs/codex/handoffs/PUI-01.md | PUI_01_SOURCE_OWNERSHIP=PASS; manual validation pending | Usuario ejecuta push/PR/CI/full regression/manual validation |
| PUI-02 | CODEX A | codex | DONE | PUI-01 | fix/pui-02-scale-unit-contract | 57e8264cfbc94a7895cf21252b85665deea731d0 | FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE | docs/codex/handoffs/PUI-02.md | PUI_02_SCALE_UNIT_CONTRACT=PASS; manual validation pending | Usuario ejecuta push/PR/CI/full regression/manual validation |
| PUI-03 | CODEX A | codex | DONE | PUI-02 | fix/pui-03-count-population-semantics | d9800d9d38926bf92b0fd08b0f1e528616e2e5bf | FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE | docs/codex/handoffs/PUI-03.md | PUI_03_COUNT_SEMANTICS=PASS; manual validation pending | Usuario ejecuta push/PR/CI/full regression/manual validation |
| PUI-04 | CODEX A | codex | DONE | PUI-03 | fix/pui-04-temporal-semantics | 2f6eeb488b869ee5e12e34cbbf6841a5b4f12b0d | 7a9df185f06be031757d0d79f25aa59b27a53bbf | docs/codex/handoffs/PUI-04.md | PUI_04_TEMPORAL_SEMANTICS=PASS; manual focal/deploy validation confirmed externally | PUI-05 habilitado sobre main/deploy `7a9df18` |
| PUI-05 | CODEX A | codex | DONE | PUI-04 | fix/pui-05-status-normalization | 7a9df185f06be031757d0d79f25aa59b27a53bbf | FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE | docs/codex/handoffs/PUI-05.md | STATUS_NORMALIZATION=PASS; manual validation pending | Usuario ejecuta push/PR/CI/full regression/manual validation |
| PUI-06 | CODEX A | codex | REVIEW | PUI-05 | fix/pui-06-governed-legacy-fallback | 90d75b60603fccfc3b4ab0b7f75a9a3e3ef4c1cc | FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE | docs/codex/handoffs/PUI-06.md | LEGACY_FALLBACK_POLICY=PASS; FOCAL_TEST=FAIL | Usuario rerun focal/manual validation; no iniciar PUI-07 hasta cerrar REVIEW |
| PUI-07 | CODEX A | codex | BLOCKED | PUI-06 | - | FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE | - | docs/codex/handoffs/PUI-07.md | See Plan Maestro | Provenance, snapshots y Data Trust completos; bloqueado hasta validar PUI-06 |
| PUI-08 | CODEX A | codex | BLOCKED | PUI-07 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/PUI-08.md | See Plan Maestro | Matriz de 22+ indicadores oficiales |
| PUI-09 | CODEX A | codex | BLOCKED | PUI-08 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/PUI-09.md | See Plan Maestro | Validacion runtime post-deploy PRE-UI |
| UI-01 | CODEX C | tecdex3-codex | READY | CONT-00 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/UI-01.md | See Plan Maestro | Inventario visual y funcional de todas las rutas |
| UI-02 | CODEX C | tecdex3-codex | BLOCKED | UI-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/UI-02.md | See Plan Maestro | Foundation visual TECDEX |
| UI-03 | CODEX C | tecdex3-codex | BLOCKED | UI-02 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/UI-03.md | See Plan Maestro | App Shell y navegacion enterprise |
| UI-04 | CODEX C | tecdex3-codex | BLOCKED | PRE_UI_DATA_TRUTH_GATE | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/UI-04.md | See Plan Maestro | Centro Ejecutivo |
| UI-05 | CODEX C | tecdex3-codex | BLOCKED | UI-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/UI-05.md | See Plan Maestro | Workspaces GRC consolidados |
| UI-06 | CODEX C | tecdex3-codex | BLOCKED | PRE_UI_DATA_TRUTH_GATE | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/UI-06.md | See Plan Maestro | Visualizacion de datos y charts |
| UI-07 | CODEX C | tecdex3-codex | BLOCKED | UI-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/UI-07.md | See Plan Maestro | Tablas, filtros y densidad enterprise |
| UI-08 | CODEX C | tecdex3-codex | BLOCKED | UI-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/UI-08.md | See Plan Maestro | Estados UX universales |
| UI-09 | CODEX C | tecdex3-codex | BLOCKED | UI-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/UI-09.md | See Plan Maestro | Responsive y accesibilidad final |
| UI-10 | CODEX C | tecdex3-codex | BLOCKED | UI-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/UI-10.md | See Plan Maestro | QA visual automatizable |
| 6.8-01 | CODEX A | codex | BLOCKED | PRE_UI_DATA_TRUTH_GATE | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.8-01.md | See Plan Maestro | GRC Observation Model |
| 6.8-02 | CODEX A | codex | BLOCKED | 6.8-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.8-02.md | See Plan Maestro | Transactional Outbox para intelligence events |
| 6.8-03 | CODEX A | codex | BLOCKED | 6.8-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.8-03.md | See Plan Maestro | GRC Gap Model |
| 6.9-01 | CODEX A | codex | BLOCKED | PRE_UI_DATA_TRUTH_GATE | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.9-01.md | See Plan Maestro | Inventario de relaciones GRC existentes |
| 6.9-02 | CODEX A | codex | BLOCKED | 6.9-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.9-02.md | See Plan Maestro | Impact Graph 2.0 |
| 6.9-03 | CODEX B | tecdex2-codex | BLOCKED | 6.9-02 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.9-03.md | See Plan Maestro | Priority Engine 2.0 |
| 6.10-01 | CODEX B | tecdex2-codex | BLOCKED | PRE_UI_DATA_TRUTH_GATE | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.10-01.md | See Plan Maestro | Modelo de documentos de conocimiento |
| 6.10-02 | CODEX B | tecdex2-codex | BLOCKED | 6.10-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.10-02.md | See Plan Maestro | Pipeline de ingestion tenant |
| 6.10-03 | CODEX B | tecdex2-codex | BLOCKED | 6.10-02 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.10-03.md | See Plan Maestro | pgvector y embeddings |
| 6.10-04 | CODEX B | tecdex2-codex | BLOCKED | 6.10-03 + 6.9-02 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.10-04.md | See Plan Maestro | Hybrid Retrieval |
| 6.10-05 | CODEX B | tecdex2-codex | BLOCKED | 6.10-04 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.10-05.md | See Plan Maestro | RAG citations y grounded answer contract |
| 6.11-01 | CODEX B | tecdex2-codex | BLOCKED | 6.10-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.11-01.md | See Plan Maestro | Authoritative Source Registry |
| 6.11-02 | CODEX B | tecdex2-codex | BLOCKED | 6.11-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.11-02.md | See Plan Maestro | Regulatory ingestion versionada |
| 6.11-03 | CODEX B | tecdex2-codex | BLOCKED | 6.11-02 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.11-03.md | See Plan Maestro | Regulation / Legal Obligation data model |
| 6.11-04 | CODEX B | tecdex2-codex | BLOCKED | 6.11-03 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.11-04.md | See Plan Maestro | Semantic diff regulatorio |
| 6.11-05 | CODEX B | tecdex2-codex | BLOCKED | 6.11-04 + 6.10-05 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.11-05.md | See Plan Maestro | Regulatory Pack CL-LAW-21719 |
| 6.11-06 | CODEX B | tecdex2-codex | BLOCKED | 6.11-05 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.11-06.md | See Plan Maestro | Regulatory Pack CL-LAW-21663 |
| 6.12-01 | CODEX B | tecdex2-codex | BLOCKED | PRE_UI_DATA_TRUTH_GATE | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.12-01.md | See Plan Maestro | Unificar Context Builders |
| 6.12-02 | CODEX B | tecdex2-codex | BLOCKED | 6.8-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.12-02.md | See Plan Maestro | Pattern and Trend Engine |
| 6.12-03 | CODEX B | tecdex2-codex | BLOCKED | 6.12-02 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.12-03.md | See Plan Maestro | Anomaly Engine |
| 6.12-04 | CODEX B | tecdex2-codex | BLOCKED | 6.9-03 + 6.10-05 + 6.12-03 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.12-04.md | See Plan Maestro | Cross-GRC Intelligence Orchestrator |
| 6.13-01 | CODEX B | tecdex2-codex | BLOCKED | 6.12-04 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.13-01.md | See Plan Maestro | Recommendation Decision Ledger |
| 6.13-02 | CODEX A | codex | BLOCKED | 6.13-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.13-02.md | See Plan Maestro | Effectiveness Feedback Loop |
| 6.13-03 | CODEX B | tecdex2-codex | BLOCKED | 6.13-02 + 6.10-03 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.13-03.md | See Plan Maestro | Operational Memory |
| 6.14-01 | CODEX B | tecdex2-codex | BLOCKED | 6.12-04 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.14-01.md | See Plan Maestro | AI Governance formal |
| 6.14-02 | CODEX B | tecdex2-codex | BLOCKED | 6.14-01 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.14-02.md | See Plan Maestro | AI Evaluation Suite |
| 6.14-03 | CODEX B | tecdex2-codex | BLOCKED | ALL 6.8-6.14 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/6.14-03.md | See Plan Maestro | Cierre integral Fase 6 ampliada |
| 7.1 | CODEX C | tecdex3-codex | BLOCKED | 6.14-03 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/7.1.md | See Plan Maestro | Re-baseline funcional de Fase 7 |
| 7.2 | CODEX C | tecdex3-codex | BLOCKED | 7.1 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/7.2.md | See Plan Maestro | Experiencia por planes comerciales |
| 7.3 | CODEX A | codex | BLOCKED | 7.1 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/7.3.md | See Plan Maestro | MSP partner model |
| 7.4 | CODEX A+C | codex + tecdex3-codex | BLOCKED | 7.2 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/7.4.md | See Plan Maestro | Onboarding de cliente nuevo |
| 7.5 | CODEX A+C | codex + tecdex3-codex | BLOCKED | PRE_UI + 6.11 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/7.5.md | See Plan Maestro | Reporting y exportes finales |
| 7.6 | CODEX C | tecdex3-codex | BLOCKED | 7.5 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/7.6.md | See Plan Maestro | Demo comercial definitiva basada en datos reales |
| 7.7 | CODEX A+B | codex + tecdex2-codex | BLOCKED | 6.10-6.14 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/7.7.md | See Plan Maestro | Hardening seguridad final |
| 7.8 | CODEX A+B | codex + tecdex2-codex | BLOCKED | 7.7 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/7.8.md | See Plan Maestro | Observabilidad y soporte productivo |
| 7.9 | CODEX B | tecdex2-codex | BLOCKED | 7.8 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/7.9.md | See Plan Maestro | Performance y costo |
| 7.10 | CODEX A+B+C | all | BLOCKED | 7.1-7.9 | - | 3341f69c328fd1f9999fbbf2d57e2b3c5b783361 | - | docs/codex/handoffs/7.10.md | See Plan Maestro | Acceptance comercial final |
