# Prompt 7.4 — Servicios gestionados e integraciones MSP

## Rol

Actúa como principal managed-services architect, integration operations engineer y especialista en SLA GRC.

## Contexto y objetivo

Permite que un MSP opere servicios e integraciones expresamente contratados y autorizados por cada cliente. La delegación debe ser granular, temporal cuando corresponda y completamente auditable.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase7/7-4-managed-services-integrations
```

Exige SHA actual, origin oficial y worktree limpio.

## Restricciones

- No operar un conector sin grant, entitlement y consentimiento del tenant.
- No reutilizar credenciales entre clientes.
- No reportes multiempresa con detalle reidentificable.
- No ejecutar cambios externos destructivos.
- No merge, deploy ni producción.

## Alcance

Catálogo de servicios gestionados, subscriptions, assignments, service runs, SLA, deliverables, approvals, delegated connector operations, portfolio health agregado, alerts, evidence y reporting por cliente.

## Modelo de datos

Crear managed service definitions/versions, subscriptions, assignments, runs, deliverables, SLA measurements y delegated connector grants. Partner/tenant scope, vigencia, entitlements, checks, uniqueness, actor, audit y retention.

## Migración

Migración aditiva/idempotente con ledger/checksum/lock, bootstrap versionado de catálogo, postcondiciones, rollback y sin suscripciones automáticas.

## Backend

Catálogo y lifecycle de subscription, assignment, run/deliverable, SLA, approval, connector delegation y portfolio aggregation con privacy threshold. Integrar Integration Hub sin duplicarlo.

## Frontend

Consola de servicios, cartera, SLA, asignaciones, runs, entregables, approvals, connector health y acciones permitidas. Tenant ve servicio contratado, actividad, evidencia y revoke.

## Seguridad, permisos, capabilities y límites

Permisos managed-service admin/operator/customer approver; capabilities y límites por servicio/cliente/run. Secret isolation por connector instance. Probar grant mismatch, entitlement disabled, IDOR, partner A/B, tenant A/B y aggregation privacy.

## Jobs

Service schedules, SLA evaluation, health aggregation, notifications y deliverable generation idempotentes, con scope, timeout, retries, locks y correlation ID.

## Pruebas y CI

Subscription, assignment, scheduled run, approval, SLA, connector delegation/revoke, report aggregation, límites, permissions, partner/tenant isolation y E2E. Regresión completa Integration Hub.

## Documentación

Service catalog, SLA, delegation policy, connector operation, privacy aggregation, runbook, incidents, retention y offboarding dependencies.

## Criterios de cierre

- solo servicios contratados y autorizados se operan;
- credenciales aisladas por tenant;
- SLA y entregables auditables;
- agregados no exponen clientes;
- revoke detiene operaciones futuras.

## Salida obligatoria

SHA, migración, catálogo, endpoints, UI, jobs, SLA, integración, pruebas, aislamiento, riesgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR; no merge ni deploy.
