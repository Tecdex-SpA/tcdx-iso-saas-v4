# Prompt 7.1 — Fundación MSP

## Rol

Actúa como principal SaaS architect para ecosistemas partner/MSP, seguridad delegada, PostgreSQL y producto enterprise.

## Contexto y objetivo

Inicia Fase 7 solo con Fases 5 y 6 cerradas. Implementa partner, cartera de clientes, memberships, acceso delegado, consentimiento y consola MSP sin debilitar la frontera tenant ni convertir al partner en superadministrador global.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase7/7-1-msp-foundation
```

Registra SHA actual y exige worktree limpio/origin oficial.

## Restricciones

- No acceso implícito a tenants por pertenecer a un partner.
- No credenciales compartidas ni impersonación silenciosa.
- No agregados que permitan reidentificar otro cliente.
- No usar Fase 7 para reparar producto base.
- No merge, deploy ni producción.

## Alcance

Partner organizations, users, client relationships, memberships, scopes, consent, delegated sessions, invitations, portfolio summary y audit. Implementar lifecycle onboarding/suspend/revoke y consola mínima.

## Modelo de datos

Crear tablas MSP de organización, memberships, client relationships, access grants, invitations y audit events según el modelo semántico. UUID, tenant/partner scope, status, valid_from/to, reason, approver, checks, índices, unicidad, auditoría y retención.

## Migración

Migración aditiva/idempotente con ledger/checksum/lock, bootstrap mínimo, postcondiciones, rollback y pruebas contra datos existentes. Ningún backfill concede acceso.

## Backend

- CRUD partner autorizado;
- relación partner-cliente con consentimiento;
- grants de alcance/acciones y caducidad;
- sesión delegada explícita;
- portfolio agregado;
- revocación inmediata;
- audit trail y correlation ID.

## Frontend

Consola MSP con cartera, estado, alertas agregadas, solicitudes de acceso y cambio explícito de contexto. Tenant ve partner, grants y actividad; puede revocar. Banner persistente durante sesión delegada.

## Seguridad, permisos, capabilities y límites

Roles partner separados de roles tenant. Permisos granulares por cliente/acción, capability MSP y límites de clientes/usuarios/sesiones. Probar IDOR, cross-partner, cross-tenant, expired grant, suspend/revoke y platform-admin.

## Jobs

Expiración de grants/invitations, resumen de cartera y notificaciones idempotentes, tenant/partner scoped, con timeout, retries y auditoría.

## Pruebas y CI

PostgreSQL, API, E2E partner/cliente, dos partners y dos tenants, permisos positivos/negativos, caducidad, revoke, agregación, límites y accesibilidad. Integrar checks y `git diff --check`.

## Documentación

Arquitectura MSP, threat model, RBAC, consent, data boundaries, API, UX, runbook, incident response y retention.

## Criterios de cierre

- relación partner-cliente explícita;
- acceso delegado con scope, aprobación y caducidad;
- revocación inmediata;
- cero fuga partner/tenant;
- consola y auditoría operacionales.

## Salida obligatoria

SHA, migración, tablas, endpoints, UI, roles, grants, jobs, pruebas, aislamiento, riesgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR; no merge, deploy ni producción.
