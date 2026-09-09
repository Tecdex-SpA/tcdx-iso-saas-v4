# DB-N05 DB-N01..DB-N04 Baseline Parity

Gate date: 2026-09-07

| package | required parity | baseline evidence | result | decision |
| --- | --- | --- | --- | --- |
| DB-N01 control identity | `tenant_controls.id` is canonical operational identity; `controls` compatibility retained; findings/evidences/action plans use same-tenant `tenant_control_id`. | `tenant_controls`, `controls`, composite FKs on `findings`, `evidences`, `action_plans`; harness creates modern rows and cross-tenant insert fails. | PASS | Preserve. |
| DB-N02 Health state/lineage | Health authority uses official formula/source/run/output/snapshot chain; unknown/missing/not-configured/stale numeric states are not promoted to available. | DB-N05 baseline now matches DB-N02 function semantics; harness P01/P02 tests unknown/missing/not-configured/stale numeric cases; P03 tests binding lineage. | PASS | Preserve corrected baseline. |
| DB-N03 composite FK/RLS prerequisites | Critical tenant-scoped relations carry composite same-tenant constraints; staged policies exist without broad enable. | Baseline contains same-tenant FKs and staged policies for pilot tables; harness rejects cross-tenant relation. | PASS | Preserve. |
| DB-N04 tenant context/runtime readiness | Transaction-local tenant/platform context helpers exist; broad RLS deferred for AI reader. | `tcdx_security.current_tenant_id`, `platform_scope_enabled`, `tenant_visible`, `tenant_write_allowed`, readiness view and harness pool leakage checks. | PASS | Preserve. |
| DB-N04 AI reader defer | No unsafe AI reader direct read while tenant-safe path is not proven. | DB-N05 removed `GRANT SELECT ON ALL TABLES IN SCHEMA ai_core TO ai_reader`; harness verifies grant count `0`. | PASS | Keep deferred until AI Engine GUC/views are proven. |

## Gate

```text
DB-N01 parity = PASS
DB-N02 parity = PASS
DB-N03 parity = PASS
DB-N04 parity = PASS
PARITY_REQUIRED mismatches = 0
```

Parity passes for the DB-N01..DB-N04 contracts that DB-N05 includes. Overall DB-N05 still remains partial because runtime/schema and reference catalog coverage fail outside those parity contracts.
