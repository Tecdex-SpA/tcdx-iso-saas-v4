# Prompt 7.3 — Soporte y acceso delegado

## Rol

Actúa como principal support platform engineer, security architect de acceso privilegiado y especialista en auditoría.

## Contexto y objetivo

Implementa soporte MSP con casos, SLA, comunicación, evidencia y acceso break-glass controlado. El cliente conserva visibilidad y capacidad de revocación; toda acción delegada se atribuye al actor real.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase7/7-3-support-access
```

Worktree limpio y SHA actual obligatorios.

## Restricciones

- No contraseñas compartidas, impersonación silenciosa ni grants indefinidos.
- No break-glass sin justificación, aprobación, alerta y expiración.
- No adjuntos inseguros ni PII en logs.
- No ocultar actividad al tenant.
- No merge, deploy ni producción.

## Alcance

Casos de soporte, severidad/prioridad, SLA, participantes, comentarios, attachments, escalaciones, approvals, delegated support sessions, break-glass, customer portal, post-access review y reporting operacional.

## Modelo de datos

Crear support cases/events/comments/attachments/SLA evaluations, access requests/approvals/sessions/actions/reviews. Scope partner/tenant, status checks, valid_until, reason, actor, approver, correlation ID, hash y retention.

## Migración

Migración aditiva/idempotente con ledger/checksum/lock, constraints de caducidad/aprobación, postcondiciones, rollback y sin grants por defecto.

## Backend

Case lifecycle, SLA clock con timezone/calendario, secure files, notifications, access request/approve/start/end/revoke, action audit y post-review. Forzar scope en cada request y job.

## Frontend

Cola y detalle de soporte, SLA, comentarios/archivos, escalación, solicitud/aprobación, banner de sesión delegada, countdown/revoke y portal de cliente con historial.

## Seguridad, permisos, capabilities y límites

Roles support agent/manager/customer approver; capability support MSP; límites de casos, archivos y sesiones. Doble aprobación configurable para break-glass. Probar IDOR, expired token, replay, file isolation, partner A/B y tenant A/B.

## Jobs

SLA timers, escalations, session expiry, reminders y post-review jobs idempotentes, con locks, timeout, retry y audit.

## Pruebas y CI

Lifecycle, SLA/timezone, files, approval, deny, expiry, revoke, break-glass, attribution, notifications, tenant visibility, partner/tenant isolation, permisos, límites y Playwright.

## Documentación

Support policy, SLA, access policy, break-glass threat model, file handling, audit, incident response, runbook y retention.

## Criterios de cierre

- soporte tenant-scoped y SLA verificable;
- acceso delegado aprobado/caduco/revocable;
- actor real visible en cada acción;
- tenant ve y controla actividad;
- cero fuga de archivos/datos.

## Salida obligatoria

SHA, migración, entidades, endpoints, UI, jobs, SLA, security tests, aislamiento, riesgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR; no merge, deploy ni producción.
