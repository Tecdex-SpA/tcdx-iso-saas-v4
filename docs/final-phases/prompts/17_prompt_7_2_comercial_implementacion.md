# Prompt 7.2 — Comercial e implementación MSP

## Rol

Actúa como principal product engineer de SaaS B2B, comercial partner, onboarding e implementación GRC.

## Contexto y objetivo

Sobre 7.1, implementa pipeline comercial y ejecución de onboarding por partner con entitlements, límites, plantillas y trazabilidad. Ningún lead u oportunidad concede acceso al tenant.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase7/7-2-commercial-implementation
```

Resolver SHA actual y abortar con worktree no limpio.

## Restricciones

- No almacenar datos de prospectos sin base/retención declarada.
- No activar tenant/capability por pipeline sin aprobación comercial autorizada.
- No alterar precios, planes o límites desde frontend.
- No mezclar datos de cartera entre partners.
- No merge, deploy ni producción.

## Alcance

Leads, opportunities, proposals, plan/pack selection, approval, conversion, implementation projects, templates, milestones, checklists, evidence, owners, status, handoff y customer acceptance.

## Modelo de datos

Crear entidades MSP commercial pipeline, proposals/versions, implementation projects/templates/milestones/tasks/evidence y acceptance. PK/FK/checks, partner/tenant scope, currency, versioning, status transitions, actor y audit.

## Migración

Migración aditiva/idempotente, ledger/checksum/lock, seed de estados versionado, postcondiciones, rollback y tenant-safe backfill.

## Backend

APIs de pipeline, proposal versioning, approval, conversion transaccional, project/template lifecycle, progress, evidence y handoff. Resolver plan/capability/limit mediante servicio comercial oficial.

## Frontend

Pipeline operativo, detalle de oportunidad, configurador de propuesta sin manipulación de precio, proyecto de implementación, checklist, evidencia, responsables, progreso, riesgos y aceptación.

## Seguridad, permisos, capabilities y límites

Permisos sales/approver/implementation/partner-admin; capability MSP commercial; límites de leads/clientes/proyectos. Tenant solo ve implementación propia y aprobación que le corresponde.

## Jobs

Expiración de propuestas, reminders, milestone alerts y handoff jobs idempotentes, con partner/tenant, retries y audit.

## Pruebas y CI

Versiones, moneda, aprobación, idempotent conversion, entitlements, límites concurrentes, template clone, progress, acceptance, partner A/B, tenant A/B, RBAC y Playwright.

## Documentación

Modelo comercial, transitions, entitlements, implementation methodology, API, UX, runbook, privacidad y evidence retention.

## Criterios de cierre

- pipeline no concede acceso;
- propuesta/version/aprobación auditadas;
- conversión idempotente y comercialmente consistente;
- implementación trazable hasta aceptación;
- aislamiento partner/tenant pasa.

## Salida obligatoria

SHA, migración, entidades, endpoints, UI, jobs, entitlements, pruebas, aislamiento, riesgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR; no merge ni deploy.
