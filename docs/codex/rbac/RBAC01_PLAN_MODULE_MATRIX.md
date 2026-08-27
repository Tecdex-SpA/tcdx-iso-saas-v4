# RBAC-01 Plan Module Matrix

Status: `COMPLETE_LOCAL`

Target commercial concepts:

| Commercial plan | Included by concept | Excluded by default |
|---|---|---|
| `ISO` | ISO dashboard, ISO compliance, diagnosis, ISO health, SoA, lifecycle, ISO evidences, ISO audits, findings, nonconformities, action plans, ISO risks, ISO risk matrix, ISO controls, ISO metrics, ISO reports, IA Compliance if contracted/active. | Advanced operational risk, operational matrix, BIA, advanced continuity, privacy, data governance and non-contracted GRC capabilities. |
| `ISO + Riesgo Operativo` | ISO plus contracted operational risk capabilities: operational risk, operational matrix, assets, operational controls, quantitative risk if contracted, loss events, risk metrics/reports. | Non-contracted privacy, data governance and broader GRC capabilities. |
| `GRC` | Full contracted GRC suite according to active modules. | Anything not entitled or inactive. |

Current repository commercial structures:

| Structure | Detected source |
|---|---|
| Commercial plans | `commercial_plans`, `commercial_plan_versions`, `tenant_subscriptions`, `v_commercial_tenant_subscription`. |
| Commercial modules/features/capabilities | `commercial_modules`, `commercial_features`, `commercial_technical_capabilities`, `plan_version_modules`, `module_features`, `feature_capabilities`. |
| Tenant module state | `saas_modules`, `tenant_module_settings`, `v_tenant_modules`, `v_commercial_tenant_modules`. |
| Entitlements/overrides/trials | `tenant_entitlements`, `tenant_feature_overrides`, `trials`, `v_commercial_tenant_capabilities`. |

Current seeded commercial plan names in repo are implementation-era keys such as `legacy`, `demo`, `pyme`, `empresa`, `enterprise`. They are not the final commercial plan taxonomy requested by RBAC-01.

Final mapping from current persisted plans to `ISO`, `ISO + Riesgo Operativo` and `GRC` is blocked until real tenant subscription data is reviewed.
