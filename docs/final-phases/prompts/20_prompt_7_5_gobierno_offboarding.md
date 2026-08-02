# Prompt 7.5 — Gobierno, offboarding y cierre MSP

## Rol

Actúa como principal governance architect, privacy/security engineer, SRE y release owner MSP.

## Contexto y objetivo

Cierra Fase 7 con gobierno, retención, portabilidad, revocación y offboarding verificables. Audita todo el ecosistema partner/MSP y evita que queden accesos, jobs, secretos o datos residuales fuera de política.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase7/7-5-governance-offboarding
```

Registrar SHA actual, verificar worktree limpio y acceso QA sin imprimir secretos.

## Restricciones

- No borrar datos fuera del manifiesto y política aprobada.
- No dejar grants, sessions, tokens, webhooks o jobs activos tras offboarding.
- No inventar cumplimiento legal ni certificación.
- No cerrar con deuda de Fases 5/6/7.
- No merge, deploy ni producción desde este prompt.

## Alcance

Versionar políticas de gobierno/retención, data export, customer/partner offboarding, revoke de accesos e integraciones, cancelación de servicios, secret destruction, legal hold, deletion evidence, cierre contractual y QA integral partner/tenant.

## Modelo de datos

Crear policy definitions/versions, retention assignments, offboarding cases/steps/artifacts/approvals, legal holds y deletion attestations. Partner/tenant scope, status machine, checks, timestamps, actor, checksum, audit e inmutabilidad de evidencia.

## Migración

Migración aditiva/idempotente con ledger/checksum/lock, sin aplicar políticas retroactivas automáticamente. Probar upgrade, rollback, legal hold y constraints.

## Backend

Policy lifecycle, export manifest/checksum, offboarding orchestration, revoke grants/sessions/connectors/services, cancel jobs, secret deletion callback, retention/deletion, attestation y audit. Operaciones destructivas con preview, approval y transaction/saga segura.

## Frontend

Centro de gobierno, políticas, retención, legal hold, wizard de offboarding, impacto/preview, approvals, progreso, errores recuperables, exportaciones, attestations e historial.

## Seguridad, permisos, capabilities y límites

Permisos governance/legal/security/offboarding/customer approver; capability MSP governance; límites de exportación/retención. Doble aprobación para destrucción. Probar IDOR, legal hold, replay, partial failure, partner A/B y tenant A/B.

## Jobs

Retention, export, revoke, deletion y verification jobs idempotentes, con manifest, locks, checkpoints, retries acotados, dead letter, rollback compensatorio y alertas.

## Pruebas y CI

PostgreSQL, policy versioning, export/checksum, legal hold, full/partial offboarding, retries, revoke, secret deletion evidence, zero residual jobs/access, partner/tenant isolation, E2E, performance y accessibility. Ejecutar regresión de Fases 5 y 6.

## Documentación

Gobierno, retención, privacidad, export, offboarding, legal hold, incident response, disaster recovery, QA evidence, closeout y riesgos. No afirmar validación runtime no ejecutada.

## Criterios de cierre

- portabilidad verificable por manifest/checksum;
- revocación completa y cero acceso residual;
- legal hold respetado;
- cleanup de jobs/secrets/webhooks probado;
- cero hallazgos altos/críticos;
- revisión independiente aprueba Fase 7.

## Salida obligatoria

Estado, SHA, migración, políticas, endpoints, UI, jobs, pruebas, offboarding, residual checks, aislamiento, hallazgos, riesgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR contra `main` solo con evidencia completa. No merge ni deploy.
