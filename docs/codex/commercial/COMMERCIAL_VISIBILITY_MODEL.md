# Commercial Visibility Model

Status: `READY_FOR_HUMAN_REVIEW_LOCAL`

Production modified: `NO`

## Effective Visibility

Frontend visibility is a projection of backend effective entitlement.

```text
tenant active
AND subscription active
AND plan entitled
AND capability active
AND addon entitled when required
AND RBAC allowed
AND scope allowed
```

For AI:

```text
active AI add-on
AND AI runtime enabled
AND specific AI feature enabled
AND RBAC allowed
AND scope allowed
```

## Frontend Rules

- Sidebar visibility uses `canShowCapability()`.
- Direct access protection in AppLayout uses `canShowCapability()`.
- Dashboard advanced blocks fetch/render only when the effective commercial capability is visible.
- Admin SaaS separates AI contract state from AI runtime settings.
- General tenant fields remain editable independently from AI add-on state when the user has Admin SaaS management permission.

## Non-Goals

- Do not remove routes to implement commercial visibility.
- Do not create a frontend-owned plan matrix.
- Do not let `hasCapability()`, local feature flags or tenant runtime AI settings bypass backend entitlement.

## Route Matrix

Latest local validation:

```text
routes=97
mapped=97
missing=0
```
