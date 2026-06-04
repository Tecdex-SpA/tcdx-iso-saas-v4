# Sprint 3 Risk and Rollback

Date: 2026-06-04

## Risks

### Migration dependency

The new endpoints require `tenant_process_entity_links`. If the migration is not applied, backend returns `SPRINT3_MIGRATION_REQUIRED`.

### Generic target FK risk

The bridge table intentionally does not FK `target_id` to target tables because it supports multiple target types. Backend validation is mandatory.

### Tenant isolation risk

RLS is not enabled. Tenant isolation depends on backend JWT tenant scope and tenant-scoped SQL filters.

### View-level filters deferred

Sprint 3 exposes links in `/configuracion`. Filters inside `/cumplimiento-auditoria`, `/evidencias`, `/riesgos`, and `/planes-accion` are deferred to avoid broad page refactors.

### Sprint 5 creep

No KPI/Health by process was implemented. Sprint 5 will consume these links later.

## Code rollback

```bash
cd ~/repos/tcdx-iso-saas
git checkout main
git log --oneline -5
git revert -m 1 <MERGE_COMMIT_HASH>
git push origin main
./scripts/deploy-vms.sh
```

If merged as a normal commit:

```bash
git revert <COMMIT_HASH>
git push origin main
./scripts/deploy-vms.sh
```

## DB rollback

Preferred rollback:

1. Revert code.
2. Leave `tenant_process_entity_links` unused.
3. Drop DB objects only later with backup and DBA/product approval.

Do not run destructive DB rollback automatically.

## Safe DB rollback note

If product/DBA approval is granted after backup, the objects introduced by Sprint 3 are:

- `tenant_process_entity_links`
- related indexes and checks

Dropping them would remove link history and must not be done casually.
