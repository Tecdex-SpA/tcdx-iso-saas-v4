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
| Runtime/post-deploy | Manual por el usuario | entorno autorizado | MANUAL |
| F6.11-A regulatory foundation focal | `node backend/src/services/knowledge-base/regulatoryFoundation.service.test.js` | repo root | VERIFIED/F6.11-B |
| F6.11-B semantic diff/regulatory packs focal | `node backend/src/services/knowledge-base/regulatoryDiffPacks.service.test.js` | repo root | VERIFIED/F6.11-B |
| F6.12-A cross-GRC intelligence focal | `node backend/src/services/intelligence/crossGrcIntelligence.service.test.js` | repo root | VERIFIED/F6.12-A |
| F6.13-A operational learning focal | `node backend/src/services/intelligence/operationalLearning.service.test.js` | repo root | VERIFIED/F6.13-A |
| F6.11 migration checksum | `node scripts/f6-11/apply-f6-11-migration.js --checksum` | repo root | VERIFIED/F6.11-B |
| F6.11 post-deploy preflight/apply | `MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/f6-11/apply-f6-11-migration.js --preflight` then `--apply` then `--preflight` | deployed backend host | MANUAL |
| F6.13 migration checksum | `node scripts/f6-13/apply-f6-13-migration.js --checksum` | repo root | VERIFIED/F6.13-A |
| F6.13 post-deploy preflight/apply | `MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/f6-13/apply-f6-13-migration.js --preflight` then `--apply` then reapply `--apply` then `--preflight` | deployed backend host | MANUAL |

Regla de ahorro:
- máximo 1 test focal rápido por prompt cuando aporte valor;
- no full CI/full regression/repeated test cycles;
- usuario hace push, PR, CI, merge, deploy y runtime.
