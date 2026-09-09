# DB-N05 Migration Chain

## Decision

DB-N05 uses a **Consolidated production baseline** for a new production database:

`database/baseline/production_schema_v1.sql`
-> `database/baseline/production_seed_v1.sql`
-> `scripts/normalization/load-production-reference-catalogs.js`
-> isolated DB-N05 validation harness.

Historical migrations remain preserved for existing database upgrades. They are not deleted and are not applied to `db-v4` by this package.

Final documented order:

`DB-N01 -> DB-N02 -> DB-N03 -> DB-N04 -> DB-N05`

For fresh production, DB-N01..DB-N04 contracts are absorbed into the consolidated baseline:
- DB-N01: `tenant_controls.id` is canonical operational identity; `controls` retained as compatibility.
- DB-N02: Health/KPI authority is formula/run/output/snapshot; `control_health_scores` remains drill-down.
- DB-N03: same-tenant composite FK protections and RLS policies are staged.
- DB-N04: transaction-local tenant context functions and readiness view are present; broad RLS remains disabled.
- DB-N05 grants: runtime role table/function privileges are explicit. No schema-wide `EXECUTE ON ALL FUNCTIONS` survives in the fresh baseline.

## Bootstrap Classification

| path | classification | decision |
| --- | --- | --- |
| `database/baseline/production_schema_v1.sql` | CANONICAL_BOOTSTRAP | New DB-N05 fresh production schema entrypoint. |
| `database/baseline/production_seed_v1.sql` | CANONICAL_BOOTSTRAP | New DB-N05 reference/system seed. No tenant/customer data. |
| `database/migrations/*.sql` | MIGRATION_ONLY | Upgrade history for existing databases; final canonical state absorbed in baseline. |
| `scripts/normalization/apply-*.js` | MIGRATION_ONLY | Package-specific runners for existing DBs; not fresh prod bootstrap. |
| `database/demo/*.sql` | DEMO_ONLY | Excluded from fresh production baseline. |
| `database/seeds/knowledge/*.jsonl` | REFERENCE_SEED_SOURCE | Reference knowledge source consumed by the existing production reference loader. |
| `scripts/phase*/prepare-*qa*.js`, `scripts/phase*/seed-*qa*.js` | QA_ONLY | Excluded from fresh production baseline. |
| `scripts/demo/*` | DEMO_ONLY | Excluded from fresh production baseline. |

## Chain Inventory

| order | migration id/file | purpose | dependency | required for fresh DB? | legacy-only? | demo-only? | QA-only? | safe on fresh DB? | safe re-run? | decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `database/baseline/production_schema_v1.sql` | Current production schema, roles, extensions, constraints, RLS prerequisites | Empty PostgreSQL | Yes | No | No | No | Yes | Yes | BASELINE_REQUIRED |
| 2 | `database/baseline/production_seed_v1.sql` | Global roles/permissions/plans/standards/formulas/workflow defaults | Baseline schema | Yes | No | No | No | Yes | Yes | BASELINE_REQUIRED |
| H01 | `20260502_ai_bootstrap_knowledge.sql` | AI knowledge bootstrap structures | Historical chain | Absorbed when needed | No | No | No | Unknown as standalone | Partial | HISTORY_REQUIRED_FOR_COMPATIBILITY |
| H02 | `20260506_iso_control_mapping_apply_log.sql` | ISO mapping apply log | Historical chain | Absorbed | No | No | No | Unknown as standalone | Partial | HISTORY_REQUIRED_FOR_COMPATIBILITY |
| H03 | `20260506_iso_document_generator.sql` | ISO generated documents | Historical chain | Absorbed | No | No | No | Yes | Yes | HISTORY_REQUIRED_FOR_COMPATIBILITY |
| H04 | `20260506_iso_express_diagnostic.sql` | Express diagnostic structures | Historical chain | Absorbed | No | No | No | Yes | Yes | HISTORY_REQUIRED_FOR_COMPATIBILITY |
| H05 | `20260506_iso_operational_execution.sql` | Operational execution structures | Historical chain | Absorbed | No | No | No | Yes | Yes | HISTORY_REQUIRED_FOR_COMPATIBILITY |
| H06 | `20260506_iso_risk_matrix.sql` | ISO risk matrix | Historical chain | Absorbed | No | No | No | Yes | Yes | HISTORY_REQUIRED_FOR_COMPATIBILITY |
| H07 | `20260507_dashboard_v2_user_preferences.sql` | User dashboard preferences | Historical chain | Absorbed | No | No | No | Yes | Yes | HISTORY_REQUIRED_FOR_COMPATIBILITY |
| H08 | `20260507_iso_recommended_action_conversions.sql` | Recommended action conversion model | Historical chain | Absorbed | No | No | No | Yes | Yes | HISTORY_REQUIRED_FOR_COMPATIBILITY |
| H09 | `20260507_iso_recommended_action_workflow.sql` | Recommended action workflow events | Historical chain | Absorbed | No | No | No | Yes | Yes | HISTORY_REQUIRED_FOR_COMPATIBILITY |
| H10-H18 | `20260512`..`20260526` migrations | Evidence center, audit prep, jobs, AI entitlements, tenant applicability/connectors | Historical chain | Final non-backup objects absorbed | Some cleanup tables | No | No | Mixed | Mixed | HISTORY_REQUIRED_FOR_COMPATIBILITY |
| H19-H30 | `20260604`..`20260723` migrations | Evidence library, process links, operational risk, SoA, knowledge v2, GRC phase 1 | Historical chain | Final objects absorbed | No | No | No | Mixed | Mixed | HISTORY_REQUIRED_FOR_COMPATIBILITY |
| H31-H40 | `20260727`..`20260730` migrations | Integrated GRC, commercial product, data metrics, official math governance | Historical chain | Final objects absorbed | KPI compatibility retained | No | No | Mixed | Mixed | HISTORY_REQUIRED_FOR_COMPATIBILITY |
| H41 | `20260730_universal_excel_import.sql` | Universal import support | Historical chain | Deferred from minimal DB-N05 baseline | No | No | No | Unknown | Unknown | DEFERRED_REMOVAL_REVIEW |
| H42 | `20260803_demo_tenant_iso_grc.sql` | Tenant/customer demonstration data | Historical chain | No | No | Yes | No | Not for prod | Yes | DEMO_ONLY |
| H43 | `20260803_demo_tenant_visual_completion.sql` | Visual demonstration completion data | Historical chain | No | No | Yes | No | Not for prod | Yes | DEMO_ONLY |
| H44-H56 | `20260803_phase5_c2`..`20260824_f6_13_a` | Semantic layer, indicators, observations, knowledge documents, regulatory packs, operational learning | Historical chain | Final non-demo objects partially absorbed/deferred by allowlist | No | No | No | Mixed | Mixed | HISTORY_REQUIRED_FOR_COMPATIBILITY |
| H57-H65 | `20260827_rbac01`..`20260901_reconcile_ai_addon_after_historical_reapply` | RBAC, commercial gating, AI add-on, authority normalization, repair after historical reapply | Historical chain | Final decisions absorbed | Yes for repair steps | No | No | Mixed | Mixed | DATA_REPAIR_ONLY for repair rows, HISTORY_REQUIRED_FOR_COMPATIBILITY for contracts |
| H66 | `20260904_dbn01_control_identity_normalization.sql` | Control identity normalization for existing data | DB-N01 | Absorbed | Existing-data migration | No | No | Not needed on fresh | Yes | OBSOLETE_FOR_FRESH_BOOTSTRAP |
| H67 | `20260904_dbn02_health_metrics_lineage_normalization.sql` | Health lineage normalization for existing data | DB-N02 | Absorbed | Existing-data migration | No | No | Not needed on fresh | Yes | OBSOLETE_FOR_FRESH_BOOTSTRAP |
| H68 | `20260907_dbn03_multitenant_integrity_rls.sql` | Same-tenant FKs/RLS prerequisites for existing data | DB-N03 | Absorbed | Existing-data migration | No | No | Not needed on fresh | Yes | OBSOLETE_FOR_FRESH_BOOTSTRAP |
| H69 | `20260907_dbn04_runtime_tenant_and_legacy_cleanup.sql` | Runtime RLS readiness and legacy annotations | DB-N04 | Absorbed | Existing-data annotation | No | No | Not needed on fresh | Yes | OBSOLETE_FOR_FRESH_BOOTSTRAP |

## Counts

- Historical migration files inspected: 70.
- Fresh bootstrap: two SQL files plus the existing production reference loader.
- Historical files not executed for fresh baseline: 70.
- Explicitly excluded demonstration migrations: 2.
- Existing-database repair/normalization packages absorbed for fresh baseline: DB-N01, DB-N02, DB-N03, DB-N04 plus 20260901 normalization/reconcile hotfixes.
- Latest local fresh/rerun PASS on PostgreSQL 16.15 with pgvector. Regulatory parity PASS for F6.11-A/B. Function execute allowlist PASS for backend/platform/support/ai_reader. Required existing reference-loader step executed twice with stable catalog content; complete product reference sources remain missing. Historical upgrade migration inventory is preserved, not replayed against QA.

## Isolated validation backend

The existing fresh and privilege harnesses share db-n05-isolated-postgres.js. Auto uses local pgvector/pgvector:pg16 when Docker is available; DBN05_PG_MODE=local retains initdb mode, DBN05_PG_MODE=docker selects Docker explicitly. DBN05_PG_IMAGE can identify an already present image; the helper resolves/logs its immutable image ID before starting. Port binds 127.0.0.1 only, data is tmpfs, and cleanup removes the named container and anonymous volumes. No target URL to db-v4 is accepted by this helper.
