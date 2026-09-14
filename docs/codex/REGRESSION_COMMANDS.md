# REGRESSION_COMMANDS — TCDX ISO SaaS V4

`CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`

Este archivo registra comandos reutilizables. Codex NO ejecuta automáticamente suites completas; el usuario las ejecuta manualmente.

| Propósito | Comando | Directorio | Estado |
|---|---|---|---|
| Backend focal | Usar el test exacto indicado por el work package | `backend/` | VERIFIED BY WORK PACKAGE ONLY |
| Backend completo | Consultar `backend/package.json` antes de usar | `backend/` | NOT CONFIRMED IN CONT-00 |
| Phase 5 | Usar scripts/documentación ya existente del repo | repo/backend | NOT CONFIRMED IN CONT-00 |
| Phase 5.5 | Usar scripts/documentación ya existente del repo | repo/backend | NOT CONFIRMED IN CONT-00 |
| Frontend lint | Consultar `frontend/package.json` | `frontend/` | NOT CONFIRMED IN CONT-00 |
| Frontend typecheck | Consultar `frontend/package.json` | `frontend/` | NOT CONFIRMED IN CONT-00 |
| Frontend build | Consultar `frontend/package.json` | `frontend/` | NOT CONFIRMED IN CONT-00 |
| E2E | Consultar scripts existentes | repo/frontend | NOT CONFIRMED IN CONT-00 |
| Multi-tenant | Usar suite/fixture definida por work package | según dominio | NOT CONFIRMED IN CONT-00 |
| AI tests/evals | Consultar `ai-engine` scripts cuando corresponda | `ai-engine/` | NOT CONFIRMED IN CONT-00 |
| AI Engine DGX/LiteLLM hardening focal | `PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_dgx_litellm_hardening.py` | repo root | VERIFIED_LOCAL/DGX-INTEGRATION-HARDENING |
| AI Engine context canonical schema focal | `PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_dgx_litellm_hardening.py` | repo root | VERIFIED_LOCAL/AI-CONTEXT-CANONICAL-SCHEMA |
| AI Guided canonical knowledge focal | `PYTHONPYCACHEPREFIX=/private/tmp/tcdx-ai-pycache PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_ai_guided_canonical_knowledge.py` | repo root | VERIFIED_LOCAL/AI-GUIDED-CANONICAL-KNOWLEDGE |
| AI Guided canonical knowledge isolated PostgreSQL | `node scripts/normalization/ai-guided-canonical-knowledge.postgres.test.js` | repo root | VERIFIED_LOCAL/AI-GUIDED-CANONICAL-KNOWLEDGE |
| AI Guided canonical knowledge runtime grants checksum | `node scripts/normalization/apply-ai-guided-canonical-knowledge-runtime-grants.js --checksum` | repo root | VERIFIED_LOCAL/AI-GUIDED-CANONICAL-KNOWLEDGE-RUNTIME-GRANTS |
| AI Guided canonical knowledge runtime grants isolated PostgreSQL | `node scripts/normalization/apply-ai-guided-canonical-knowledge-runtime-grants.test.js` | repo root | VERIFIED_LOCAL/AI-GUIDED-CANONICAL-KNOWLEDGE-RUNTIME-GRANTS |
| AI Guided canonical knowledge runtime grants postdeploy preflight/apply | `MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/normalization/apply-ai-guided-canonical-knowledge-runtime-grants.js --preflight` then human-approved `--apply` then `--preflight` | authorized clone/staging/production DB only | MANUAL_AFTER_HUMAN_REVIEW |
| AI Core runtime context grants isolated PostgreSQL | `node scripts/normalization/apply-ai-core-runtime-context-grants.test.js` | repo root | VERIFIED_LOCAL/AI-CORE-RUNTIME-GRANTS-ALLOWLIST |
| AI Core runtime context grants checksum | `node scripts/normalization/apply-ai-core-runtime-context-grants.js --checksum` | repo root | VERIFIED_LOCAL/AI-CORE-RUNTIME-GRANTS-ALLOWLIST |
| AI Core runtime context grants postdeploy preflight/apply | `MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/normalization/apply-ai-core-runtime-context-grants.js --preflight` then human-approved `--apply` then `--preflight` | authorized clone/staging/production DB only | MANUAL_AFTER_HUMAN_REVIEW |
| Runtime/post-deploy | Manual por el usuario | entorno autorizado | MANUAL |
| F6.11-A regulatory foundation focal | `node backend/src/services/knowledge-base/regulatoryFoundation.service.test.js` | repo root | VERIFIED/F6.11-B |
| F6.11-B semantic diff/regulatory packs focal | `node backend/src/services/knowledge-base/regulatoryDiffPacks.service.test.js` | repo root | VERIFIED/F6.11-B |
| F6.12-A cross-GRC intelligence focal | `node backend/src/services/intelligence/crossGrcIntelligence.service.test.js` | repo root | VERIFIED/F6.12-A |
| TCDX SaaSv2 GRC runtime contract V3 | `node scripts/normalization/apply-tcdx-saasv2-grc-runtime-contract-closeout-v3.test.js` | repo root | READY_FOR_CLONE_VALIDATION/TCDX-SAASV2-GRC-RUNTIME-CONTRACT-CLOSEOUT-V3 |
| TCDX SaaSv2 fresh deploy strategy | `node scripts/deploy-vms-strategy.test.js` | repo root | VERIFIED/TCDX-SAASV2-FRESH-DEPLOY-ARCHITECTURE |
| Phase 5-C3 source contract checksum focal | `node backend/src/services/math-governance/sourceContractChecksum.test.js` | repo root | VERIFIED/TCDX-SAASV2-PHASE5-C3-CHECKSUM-CLOSEOUT |
| Phase 5-C3 isolated PostgreSQL replay | `bash scripts/phase5-c3/check-phase5-c3-postgres.sh` | repo root | VERIFIED/TCDX-SAASV2-PHASE5-C3-CHECKSUM-CLOSEOUT |
| F6.13-A operational learning focal | `node backend/src/services/intelligence/operationalLearning.service.test.js` | repo root | VERIFIED/F6.13-A |
| F6.14-A AI governance/evaluation focal | `node backend/src/services/intelligence/aiGovernanceEvaluation.service.test.js` | repo root | VERIFIED/F6.14-A |
| F6.11 migration checksum | `node scripts/f6-11/apply-f6-11-migration.js --checksum` | repo root | VERIFIED/F6.11-B |
| F6.11 post-deploy preflight/apply | `MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/f6-11/apply-f6-11-migration.js --preflight` then `--apply` then `--preflight` | deployed backend host | MANUAL |
| F6.13 migration checksum | `node scripts/f6-13/apply-f6-13-migration.js --checksum` | repo root | VERIFIED/F6.13-A |
| F6.13 post-deploy preflight/apply | `MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/f6-13/apply-f6-13-migration.js --preflight` then `--apply` then reapply `--apply` then `--preflight` | deployed backend host | MANUAL |
| Release RBAC static contract | `node scripts/release-rbac/check-release-rbac-contract.js` | repo root | VERIFIED_LOCAL/TCDX-RELEASE-RBAC-CAPABILITY-SYSTEMIC-CLOSEOUT |
| Release RBAC residual role authority | `node scripts/release-rbac/check-residual-role-authority.js` | repo root | VERIFIED_LOCAL/TCDX-RELEASE-RBAC-CAPABILITY-FINAL-PREDEPLOY |
| Release RBAC role alias equivalence | `node scripts/release-rbac/check-role-alias-equivalence.js` | repo root | VERIFIED_LOCAL/TCDX-RELEASE-RBAC-CAPABILITY-FINAL-PREDEPLOY |
| Release RBAC frontend/backend consistency | `node scripts/release-rbac/check-frontend-backend-authorization-consistency.js` | repo root | VERIFIED_LOCAL/TCDX-RELEASE-RBAC-CAPABILITY-SYSTEMIC-CLOSEOUT |
| Release RBAC isolated PostgreSQL | `node scripts/release-rbac/release-rbac-isolated-postgres.test.js` | repo root | VERIFIED_LOCAL/TCDX-RELEASE-RBAC-CAPABILITY-SYSTEMIC-CLOSEOUT |
| Release RBAC migration checksum | `node scripts/release-rbac/apply-release-rbac-capability-closeout.js --checksum` | repo root | VERIFIED_LOCAL/TCDX-RELEASE-RBAC-CAPABILITY-SYSTEMIC-CLOSEOUT |
| Commercial runtime integral isolated PostgreSQL | `node scripts/normalization/apply-tcdx-commercial-runtime-integral-closeout.test.js` | repo root | VERIFIED_LOCAL/TCDX-COMMERCIAL-RUNTIME-INTEGRAL-CLOSEOUT |
| Commercial runtime integral migration checksum | `node scripts/normalization/apply-tcdx-commercial-runtime-integral-closeout.js --checksum` | repo root | VERIFIED_LOCAL/TCDX-COMMERCIAL-RUNTIME-INTEGRAL-CLOSEOUT |
| Fresh baseline runtime dependency isolated PostgreSQL | `node scripts/normalization/apply-tcdx-fresh-baseline-runtime-dependency-systemic-closeout.test.js` | repo root | VERIFIED_LOCAL/TCDX-FRESH-BASELINE-RUNTIME-DEPENDENCY-SYSTEMIC-CLOSEOUT |
| Fresh baseline runtime dependency migration checksum | `node scripts/normalization/apply-tcdx-fresh-baseline-runtime-dependency-systemic-closeout.js --checksum` | repo root | VERIFIED_LOCAL/TCDX-FRESH-BASELINE-RUNTIME-DEPENDENCY-SYSTEMIC-CLOSEOUT |
| Fresh baseline runtime dependency checker scan | `node scripts/normalization/check-fresh-baseline-runtime-dependencies.js --scan-only` | repo root | VERIFIED_LOCAL/TCDX-FRESH-BASELINE-RUNTIME-DEPENDENCY-SYSTEMIC-CLOSEOUT |
| Fresh baseline runtime dependency checker with DB probes | `MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/normalization/check-fresh-baseline-runtime-dependencies.js --mutation-probes` | authorized clone/staging DB only | MANUAL_AFTER_HUMAN_REVIEW |
| Control lifecycle systemic closeout isolated PostgreSQL | `node scripts/normalization/apply-tcdx-control-lifecycle-systemic-closeout.test.js` | repo root | VERIFIED_LOCAL/TCDX-CONTROL-LIFECYCLE-SYSTEMIC-CLOSEOUT |
| Control lifecycle systemic closeout migration checksum | `node scripts/normalization/apply-tcdx-control-lifecycle-systemic-closeout.js --checksum` | repo root | VERIFIED_LOCAL/TCDX-CONTROL-LIFECYCLE-SYSTEMIC-CLOSEOUT |
| Post-lifecycle runtime consumers isolated PostgreSQL | `node scripts/normalization/apply-tcdx-post-lifecycle-runtime-consumers-systemic-closeout.test.js` | repo root | VERIFIED_LOCAL/TCDX-POST-LIFECYCLE-RUNTIME-CONSUMERS-SYSTEMIC-CLOSEOUT |
| Post-lifecycle runtime consumers migration checksum | `node scripts/normalization/apply-tcdx-post-lifecycle-runtime-consumers-systemic-closeout.js --checksum` | repo root | VERIFIED_LOCAL/TCDX-POST-LIFECYCLE-RUNTIME-CONSUMERS-SYSTEMIC-CLOSEOUT |
| Post-lifecycle AI Compliance RBAC focal | `node backend/src/routes/ai-compliance.rbac.test.js` | repo root | VERIFIED_LOCAL/TCDX-POST-LIFECYCLE-RUNTIME-CONSUMERS-SYSTEMIC-CLOSEOUT |
| Post-lifecycle tenant processes degradation focal | `node backend/src/services/tenantProcesses.service.test.js` | repo root | VERIFIED_LOCAL/TCDX-POST-LIFECYCLE-RUNTIME-CONSUMERS-SYSTEMIC-CLOSEOUT |
| Post-lifecycle runtime consumers preflight/apply | `MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/normalization/apply-tcdx-post-lifecycle-runtime-consumers-systemic-closeout.js --preflight` then human-approved `--apply` | authorized clone/staging DB only | MANUAL_AFTER_HUMAN_REVIEW |

Regla de ahorro:
- máximo 1 test focal rápido por prompt cuando aporte valor;
- no full CI/full regression/repeated test cycles;
- usuario hace push, PR, CI, merge, deploy y runtime.
