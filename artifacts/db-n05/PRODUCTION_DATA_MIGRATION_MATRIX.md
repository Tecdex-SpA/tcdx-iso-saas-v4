# DB-N05 Production Data Migration Matrix

DB-N05 does not migrate data. This matrix defines what a future production creation runbook may migrate after explicit approval.

| data class | examples | classification | default decision | prerequisite |
| --- | --- | --- | --- | --- |
| Global standards | `standards` | GLOBAL_REFERENCE_DATA | Recreate from seed | Confirm standard catalog version. |
| Global control catalog | `controls_catalog`, `controls_catalog_standards` | GLOBAL_REFERENCE_DATA | Recreate from seed | Confirm no QA-only catalog rows. |
| RBAC catalog | `app_roles`, `permissions`, `role_permissions` | CONFIGURATION | Recreate from seed | Confirm role map with product owner. |
| Commercial catalog | plans, modules, capabilities | CONFIGURATION | Recreate from seed | Confirm current commercial authority. |
| Formula catalog | `official_formula_*` | CONFIGURATION | Recreate from seed | Confirm F5_5 published formula versions. |
| Workflow catalog | workflow definitions/versions | CONFIGURATION | Recreate from seed | Confirm default workflow versions. |
| Real tenants | customer tenant rows | REAL_CUSTOMER_DATA | Migrate only if approved | Read-only QA preflight and customer list. |
| Real users | customer users | REAL_CUSTOMER_DATA | Migrate only if approved | Identity mapping and password/SSO plan. |
| Tenant standards/controls | tenant activation and control operation rows | REAL_CUSTOMER_DATA | Migrate or recreate per customer | DB-N01 canonical identity map. |
| Tenant operational records | evidences, findings, actions, risks, audits, documents | REAL_CUSTOMER_DATA | Migrate only if approved | Tenant-scoped export/import with composite FK validation. |
| Metric outputs/snapshots | calculations and Health snapshots | CONFIGURATION / REAL_CUSTOMER_DATA | Prefer recompute; migrate only approved audit snapshots | Formula/source contract compatibility proof. |
| QA fixtures | QA audit records, test tenants, generated QA users | QA_TEST_DATA | DO_NOT_MIGRATE | None. |
| Demonstration fixtures | demonstration tenants, evidence, findings, metrics | DEMONSTRATION_DATA | DO_NOT_MIGRATE | None. |
| Backup/preview state | backup, cleanup, preview tables | HISTORICAL_BACKUP | DO_NOT_MIGRATE | Archive outside app DB only if legal retention requires it. |
