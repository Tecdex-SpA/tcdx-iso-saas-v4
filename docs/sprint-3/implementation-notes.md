# Sprint 3 Implementation Notes

Date: 2026-06-04

## Governing scope

Sprint 3 implements the foundation to link processes/operations with controls, evidence, risks, and actions.

This sprint does not implement KPIs, Health by process, dashboard semaphores, premium reports, full AI Auditor, NLP, or semantic evidence matching.

## Targeted repository findings

- Sprint 2 artifacts are present in `main`.
- `tenant_processes` and `tenant_operations.process_id` exist through the Sprint 2 migration proposal.
- Controls use `tenant_controls` as tenant-scoped control instances.
- Evidence uses `evidences`.
- Actions use `action_plans`.
- ISO risks use `iso_risk_matrix_items`; legacy asset risks may use `asset_risks` joined to `assets`.
- These target tables have mixed legacy shapes, so FK constraints to every target table would be brittle.

## Data model decision

Implemented a generic bridge table:

```text
tenant_process_entity_links
```

Allowed `target_type` values:

- `control`
- `evidence`
- `risk`
- `action`

Columns:

- `id`
- `tenant_id`
- `process_id`
- `operation_id`
- `target_type`
- `target_id`
- `relation_type`
- `source`
- `notes`
- `is_active`
- `created_by_user_id`
- `created_at`
- `updated_at`

## FK decision

The migration adds FKs for stable Sprint 2 entities:

- `tenant_id -> tenants(id)`
- `process_id -> tenant_processes(id)`
- `operation_id -> tenant_operations(id)`
- `created_by_user_id -> users(id)`

It does not add FKs from `target_id` to controls/evidence/risks/actions because `target_type` is generic and risk targets may resolve to `iso_risk_matrix_items` or `asset_risks`.

Target ownership is validated in backend before link creation.

## Backend behavior

The backend derives tenant scope from authenticated JWT/context. It does not trust `tenant_id` from request body.

Before creating a link, the service validates:

- process belongs to authenticated tenant;
- optional operation belongs to authenticated tenant;
- optional operation belongs to selected process when `process_id` is present on the operation;
- target entity belongs to authenticated tenant;
- target type is allowed.

No hard delete exists. Links are deactivated/reactivated through status endpoints.

## Frontend behavior

The Sprint 3 UI lives inside:

```text
/configuracion -> Procesos y operaciones -> Elementos asociados
```

No new main sidebar view was introduced.

The UI searches readable candidates by type and does not expose `tenant_id` or raw `user_id`.

## AI context preparation

`aiContextBuilder.service.js` now prepares `operational_context` with:

- `process_id`
- `process_name`
- `operation_id`
- `operation_name`
- `linked_controls`
- `linked_evidence`
- `linked_risks`
- `linked_actions`

This is structured context only. It does not perform NLP, semantic matching, AI approval, certification, or automated decision-making.

## Deferred

- Process filters in `/cumplimiento-auditoria`, `/evidencias`, `/riesgos`, and `/planes-accion` are deferred to avoid risky view-level refactors.
- KPI/Health by process is Sprint 5.
- Diagnosis by process and active standard is Sprint 4.
