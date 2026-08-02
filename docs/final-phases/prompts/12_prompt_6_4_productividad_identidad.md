# Prompt 6.4 — Productividad e identidad

## Rol

Actúa como principal engineer de Microsoft Graph, Google Workspace, identidad, privacidad y autorización SaaS.

## Contexto y objetivo

Completa Microsoft 365/Graph y Google Workspace sobre 6.1 para obtener observaciones autorizadas de identidad, colaboración y evidencias, con consentimiento y minimización de datos.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase6/6-4-productivity-identity
```

Worktree limpio y SHA actual registrados antes de editar.

## Restricciones

- No sincronizar correo, documentos o PII sin caso de uso y consentimiento explícito.
- No mapear grupos externos directamente a privilegios altos sin aprobación local.
- No guardar refresh tokens fuera del secret provider.
- No afirmar conexión live sin ejecución autorizada.
- No merge, deploy ni producción.

## Alcance

Microsoft Graph: tenant consent, users/groups, selected sites/files metadata y audit/security signals autorizados. Google Workspace: domain-wide consent cuando corresponda, users/groups, Drive metadata seleccionada y audit signals. Implementar sync incremental, mapping, health, revocation y data minimization.

## Modelo de datos

Reutilizar connector records; persistir external identity mappings, consent/scopes, cursors y retention policy. No duplicar usuarios internos ni almacenar contenido no requerido.

## Migración

Migración aditiva/idempotente para mappings/consent si falta soporte. Ledger, checksum, rollback y limpieza por revocación probados.

## Backend

Adapters con OAuth/admin consent, delta tokens, pagination, mapping de identidades, dedupe, selected resources, retry, revoke y erasure workflow. Nunca elevar rol por un dato externo sin policy aprobada.

## Frontend

Wizard de consentimiento, selección de recursos, mapping de usuarios/grupos, preview, publicación, sync, health, runs, errores, retención y revoke.

## Seguridad, permisos, capabilities y límites

Permisos de consent/admin mapping/sync/revoke; capabilities por provider; límites de usuarios/grupos/recursos/runs. Probar consent spoofing, state, PII redaction, IDOR, tenant A/B, deprovision y revocation.

## Jobs

Directory sync, delta sync, resource sync y erasure jobs idempotentes, con cursor, período, rate limit, timeout, retry y dead letter.

## Pruebas y CI

Contract tests, sandbox tenant cuando exista, delta expiration, pagination, duplicate identity, revoke, erasure, mapping approval, tenant isolation, permisos y Playwright. Secret-dependent tests fuera de pull_request.

## Documentación

Scopes y justificación, datos tratados, retención, consentimiento, mappings, revocation, privacidad, runbook y nivel de validación.

## Criterios de cierre

- consentimiento y scopes mínimos;
- identidad externa no eleva permisos automáticamente;
- incremental sync idempotente;
- revocación/erasure efectivos;
- tenant isolation y privacidad probados.

## Salida obligatoria

SHA, providers, scopes, datos, endpoints, UI, jobs, pruebas, privacidad, limitaciones, PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR; no merge ni deploy.
