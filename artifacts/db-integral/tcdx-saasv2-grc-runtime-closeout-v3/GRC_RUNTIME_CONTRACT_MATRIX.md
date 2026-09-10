# TCDX SaaSv2 GRC Runtime Contract Matrix V3

Local-only matrix for `20260910_tcdx_saasv2_grc_runtime_contract_closeout_v3.sql`.

No SQL was executed against `tcdx_saasv2`. Validation used isolated PostgreSQL only.

| Consumer | Object | Column/Contract | Baseline | V3 Upgrade | Runtime privilege | Test gate | Status |
|---|---|---|---|---|---|---|---|
| `admin-saas.routes.js` | `saas_modules` | `module_key`, `display_name`, `description`, `default_enabled`, `is_system`, `is_active`, `sort_order`, `status`, `updated_at` | Present after V3 mirror | Added/normalized | `SELECT` | `SAAS_MODULES_RUNTIME_COLUMNS` | PASS |
| `admin-saas.routes.js`, GRC services | `tenant_module_settings` | `is_enabled` canonical plus legacy `enabled`; `enabled_at`, `disabled_at`, actors, notes, metadata, `updated_at` | Present after V3 mirror | Added/normalized | `SELECT, INSERT, UPDATE` | `TENANT_MODULE_SETTINGS_RUNTIME_COLUMNS`, `TENANT_MODULE_SETTINGS_COMPATIBILITY` | PASS |
| `grcSchedulerRunner.js` | `tenant_module_settings`, `saas_modules` | Exact discovery query: Phase 1 enabled tenants by `module_key`, `is_enabled`, `sm.is_active` | Executable | Executable | `SELECT` | `GRC_PHASE1_SCHEDULER_DISCOVERY` | PASS |
| `phase2SchedulerRunner.js` | `grc_connector_instances`, `tenant_module_settings` | Exact discovery query: `schedule`, `next_sync_at`, `status`, `is_enabled` | Executable | Executable | `SELECT, UPDATE` | `GRC_PHASE2_SCHEDULER_DISCOVERY` | PASS |
| `grc.service.js` | Phase 1 workflow runtime | Definitions, versions, states, transitions, roles, instances, history, approvals, comments, attachments, automation, scheduler runs | 49 objects present | 49 objects present | `SELECT, INSERT, UPDATE, DELETE` where runtime writes | `GRC_PHASE1_REQUIRED_OBJECTS` | PASS |
| `grc.service.js`, `grcBootstrap.service.js` | Phase 1 readiness/framework/audit/evidence runtime | Evidence requests/schedules/requirements/submissions/versions/reviews/links/quality, readiness rules/snapshots/results/findings, frameworks/mappings/reviews, audit universe/plans/programs/team/conflicts/samples/workpapers/interviews/reviews/reports/followups | Present | Present | `SELECT, INSERT, UPDATE, DELETE` | `GRC_PHASE1_REQUIRED_OBJECTS` | PASS |
| `phase2.service.js` | Phase 2 relations/events/rules/alerts/metrics/obligations/assurance/effectiveness | Core integrated GRC tables and columns consumed by query/insert/update paths | Present | Present | `SELECT, INSERT, UPDATE, DELETE` | `GRC_PHASE2_REQUIRED_OBJECTS` | PASS |
| `phase2.service.js` | Supplier and questionnaire runtime | Suppliers, history, services, contracts, questionnaire templates/versions/sections/questions, assessments, answers, assessment history, portal invitations/sessions/evidence, exit checks | Present | Present | `SELECT, INSERT, UPDATE, DELETE` | `GRC_PHASE2_REQUIRED_OBJECTS` | PASS |
| `phase2.service.js` | Privacy and incident runtime | Processing activities/versions/processors, DPIA/risks, data subject requests, consents, breaches, incidents, incident history/timeline/impacts/notifications/root causes/postmortems | Present | Present | `SELECT, INSERT, UPDATE, DELETE` | `GRC_PHASE2_REQUIRED_OBJECTS` | PASS |
| `phase2.service.js`, `phase2SchedulerRunner.js` | Connector runtime | Definitions, instances, runs, external records, mappings, dead letters; instance columns include `connector_version`, `scopes`, `metadata_json`, `credential_envelope`, `schedule`, `next_sync_at`, health fields | Present | Present | Definitions `SELECT`; tenant runtime tables DML | `GRC_CONNECTOR_RUNTIME_COLUMNS`, `GRC_RUNTIME_GRANTS` | PASS |
| `phase3.service.js` | Phase 3 operations runtime | Organizational units, tenant process extensions, operational services/dependencies, BIA/impacts, continuity plans/tests, crisis activations/log | Present | Present | `SELECT, INSERT, UPDATE, DELETE` | `GRC_PHASE3_REQUIRED_OBJECTS` | PASS |
| `phase3.service.js` | Phase 3 metrics/risk/import runtime | Metric definitions/measurements, quantitative risk assessments, state history, readiness impacts, import batches/rows | Present | Present | `SELECT, INSERT, UPDATE, DELETE` | `GRC_PHASE3_REQUIRED_OBJECTS` | PASS |
| `grc.service.js`, `phase2.service.js`, `phase3.service.js` | Tenant isolation | Critical connector child rows enforce `(tenant_id, integration_id)` to parent `(tenant_id, id)` | Present | Present | N/A | `GRC_CRITICAL_TENANT_AWARE_FKS`, `GRC_CROSS_TENANT_RELATION_BLOCK` | PASS |
| Runtime role | `tcdx_backend_runtime` | Explicit grants only; no `GRANT ON ALL TABLES`, no `GRANT EXECUTE ON ALL FUNCTIONS`; `saas_modules` read-only | Present | Present | Minimal tested privileges | `GRC_RUNTIME_GRANTS`, `GRC_RUNTIME_NO_EXCESSIVE_PRIVILEGES` | PASS |
| Seed contract | Global GRC modules | Global module catalog only, deny-by-default; no tenants or `tenant_module_settings` seeded | Present | Present | N/A | `GRC_ZERO_FIXED_TENANT_SEED`, `GRC_ZERO_DEMO_DATA` | PASS |

Counts incorporated by V3 validation:

- Phase 1: 49 runtime objects.
- Phase 2: 44 runtime objects.
- Phase 3: 16 runtime objects.
