# DB-N04 Legacy Object Matrix

Date: 2026-09-07
Repository: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`

Evidence used:

- Focused code search in `backend`, `frontend`, `ai-engine`, `scripts`, `database`.
- Local structural inventory in `docs/database-live-map/*`.
- DB-N01/DB-N02/DB-N03 handoffs and contracts.
- No read-only preflight was executed against `db-v4` by Codex.

Rows/sizes:

- `size/rows` below is `READONLY_PREFLIGHT_REQUIRED` unless the object is a pure code/doc concept. DB-N04 provides `scripts/normalization/db-n04-readonly-preflight.sql` to collect authorized live row/size evidence later.

| schema | object | type | size/rows | runtime readers | writers | replacement | drop candidate | prerequisite | decision |
|---|---|---|---|---|---|---|---|---|---|
| `public` | `controls` | table | `READONLY_PREFLIGHT_REQUIRED` | Backend/frontend/AI compatibility consumers found; 81 files reference controls/catalog identity patterns | legacy/migration paths | `tenant_controls.id` operational identity plus `controls_catalog` catalog identity | NO | DB-N01 apply, SoA/report/UI compatibility retirement, zero runtime consumers | `COMPATIBILITY_REQUIRED` |
| `public` | `control_health_scores` | table | `READONLY_PREFLIGHT_REQUIRED` | Health drill-down, SoA intelligence, report/health consumers | Health refresh path | DB-N02 canonical executive Health projection | NO | Keep as operational detail/compatibility | `KEEP_ACTIVE` + `COMPATIBILITY_REQUIRED` |
| `public` | `control_health_scores_backup_history` | table | `READONLY_PREFLIGHT_REQUIRED` | No current runtime reader proven in focused search | Historical backup only | `control_health_scores` plus migration history | YES, deferred | Authorized preflight: 0 readers, 0 writers, 0 dependencies, retention approval | `BACKUP_ONLY`; `DROP_CANDIDATE_DEFERRED` |
| `public` | `control_health_scores_v2_preview` | table | `READONLY_PREFLIGHT_REQUIRED` | No current runtime reader proven in focused search; docs/indexes mention it | Preview lineage/history | DB-N02 `v_control_health_scores_dbn02_lineage` and `refresh_control_health_scores_v2_1(uuid)` | YES, deferred | Authorized dependency and retention proof | `DEAD_LEGACY` candidate; `DROP_CANDIDATE_DEFERRED` |
| `qa_audit` | `*` | schema/tables | `READONLY_PREFLIGHT_REQUIRED` | QA/audit only by naming and package context; no product drop evidence | QA audit jobs/manual analysis | None in product runtime | NO in product migration | QA owner review and explicit QA cleanup package | `QA_ONLY` |
| `public` | `users_backup_before_role_governance_20260417` | table | `READONLY_PREFLIGHT_REQUIRED` | No runtime reader proven | Historical migration backup | current `users` + RBAC history | YES, deferred | Retention/legal/audit approval | `BACKUP_ONLY` |
| `public` | `users_backup_before_role_normalization_20260430` | table | `READONLY_PREFLIGHT_REQUIRED` | No runtime reader proven | Historical migration backup | current `users` + RBAC history | YES, deferred | Retention/legal/audit approval | `BACKUP_ONLY` |
| `public` | `report_access_rules_backup_20260430` | table | `READONLY_PREFLIGHT_REQUIRED` | No runtime reader proven | Historical migration backup | current report access rules | YES, deferred | Report access owner review and preflight dependency proof | `BACKUP_ONLY` |
| `public` | `tenant_applicable_controls_cleanup_backup_20260525` | table | `READONLY_PREFLIGHT_REQUIRED` | No runtime reader proven | Historical migration backup | current applicability tables/views | YES, deferred | Applicability owner review and dependency proof | `MIGRATION_HISTORY_ONLY` |
| `public` | `tenant_applicable_kpis_cleanup_backup_20260525` | table | `READONLY_PREFLIGHT_REQUIRED` | No runtime reader proven | Historical migration backup | current applicability tables/views | YES, deferred | Applicability owner review and dependency proof | `MIGRATION_HISTORY_ONLY` |
| `public` | `tenant_applicable_evidence_requirements_cleanup_backup_20260525` | table | `READONLY_PREFLIGHT_REQUIRED` | No runtime reader proven | Historical migration backup | current applicability tables/views | YES, deferred | Applicability owner review and dependency proof | `MIGRATION_HISTORY_ONLY` |
| `public` | `tenant_applicability_exclusions_cleanup_backup_20260525` | table | `READONLY_PREFLIGHT_REQUIRED` | No runtime reader proven | Historical migration backup | current applicability exclusions | YES, deferred | Applicability owner review and dependency proof | `MIGRATION_HISTORY_ONLY` |
| `public` | `evidences_backup_history` | table | `READONLY_PREFLIGHT_REQUIRED` | No runtime reader proven | Historical backup only | current `evidences` plus audit history | YES, deferred | Evidence owner retention/dependency proof | `BACKUP_ONLY` |
| `public` | `action_plans_backup_history` | table | `READONLY_PREFLIGHT_REQUIRED` | No runtime reader proven | Historical backup only | current `action_plans` plus audit/history | YES, deferred | Action owner retention/dependency proof | `BACKUP_ONLY` |
| `ai_core` | `view_definition_backups` | table | `READONLY_PREFLIGHT_REQUIRED` | AI-core migration/history only suspected; no safe RLS posture proven | AI-core backup process/migrations | current `ai_core` views | YES, deferred | AI owner review plus `AI_READER_RLS_READY` | `MIGRATION_HISTORY_ONLY`; `DROP_CANDIDATE_DEFERRED` |
| `public` | `v_latest_health_kpi_snapshots` | view | n/a | Health/report/UI compatibility | view refresh/source | DB-N02 canonical Health projection | NO | KPI-HLT retirement package after consumers removed | `COMPATIBILITY_REQUIRED` |
| `public` | `v_latest_health_kpi_snapshots_applicable` | view | n/a | Health/report/UI compatibility | view refresh/source | DB-N02 canonical Health projection | NO | KPI-HLT retirement package after consumers removed | `COMPATIBILITY_REQUIRED` |
| formula/catalog | `KPI-HLT-*` | governed metric codes | n/a | frontend labels, Health drill-down/report compatibility | formula/catalog history | `F5_5_GRC_HEALTH` v2 executive authority | NO | Consumer retirement and compatibility window decision | `COMPATIBILITY_REQUIRED` |

## Control Health

- `control_health_scores`: `KEEP_ACTIVE` / `COMPATIBILITY_REQUIRED`. It is not a backup and must not be dropped.
- `control_health_scores_backup_history`: `BACKUP_ONLY`; candidate only after live preflight proves zero consumers/dependencies and retention approval.
- `control_health_scores_v2_preview`: `DEAD_LEGACY` candidate by current code search, but deferred until dependency proof.

## Duplicate Indexes

- `docs/database-live-map/indexes.md` shows same-key overlap on `control_health_scores(tenant_control_id)` between a unique/constraint-backed index and a nonunique index.
- This is not an exact duplicate safe drop by DB-N04 because uniqueness/constraint ownership differs.
- `scripts/normalization/db-n04-readonly-preflight.sql` reports only exact normalized `pg_get_indexdef` duplicates and constraint ownership for future review.

## Functions And Views

| object/pattern | classification | decision |
|---|---|---|
| `refresh_control_health_scores_v2_1(uuid)` | `ACTIVE` | DB-N02 canonical lineage refresh; keep. |
| `refresh_*control_health*` older variants | `REPLACED` candidate | Defer until live dependencies and report/UI callers are proven absent. |
| `legacy_*` functions/views | `COMPATIBILITY` or `DEAD` by object | No blanket drop; require per-object preflight. |
| `*_v2_preview` | `REPLACED` candidate | Defer unless zero runtime readers/writers/dependencies are proven. |
| `v_latest_health_kpi_snapshots*` | `COMPATIBILITY` | Keep for KPI-HLT compatibility. |

## Safe Drops

No safe destructive drop was proven inside DB-N04.

All cleanup candidates are documented as `DROP_CANDIDATE_DEFERRED`, not dropped.
