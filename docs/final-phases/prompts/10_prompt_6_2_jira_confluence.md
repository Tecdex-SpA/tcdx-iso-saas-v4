# Prompt 6.2 — Jira y Confluence Cloud

## Rol

Actúa como principal Atlassian integration engineer, especialista OAuth 2.0, seguridad y mapeo GRC.

## Contexto y objetivo

Sobre la fundación 6.1, llevar Jira Cloud y Confluence Cloud a operación real, con consentimiento, scopes mínimos, incremental sync, mappings semánticos, revocación y evidencia de sandbox autorizado.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase6/6-2-jira-confluence
```

Resolver SHA actual; worktree limpio obligatorio.

## Restricciones

- No pedir scopes amplios sin caso de uso.
- No almacenar tokens en tablas/logs sin protección oficial.
- No crear riesgos, controles o acciones irreversibles desde un issue/página sin aprobación.
- No afirmar conexión en vivo sin sandbox y credenciales ejecutadas.
- No merge, deploy ni producción.

## Alcance

Jira: sites, projects, issue types, issues, status, assignee, labels, links, changelog y attachments permitidos. Confluence: sites, spaces, pages, versions, labels y restricciones. Implementar full/incremental sync, webhook cuando sea viable, mapping y health.

## Modelo de datos

Reutilizar connector records/mappings; agregar solo metadatos provider-specific indispensables, cursors y webhook subscriptions. No duplicar entidades GRC canónicas.

## Migración

Migración aditiva solo si el modelo común no soporta cursor/webhook; ledger, checksum, idempotencia, rollback y postcondiciones.

## Backend

Adapters Atlassian con OAuth, cloudId, paginación, backoff, delta strategy, attachment allowlist, normalization, mapping preview, sync/replay/revoke y webhook verification.

## Frontend

Wizard para autorizar sitio, elegir proyectos/espacios, seleccionar objetos/campos, preview mapping, publicar, sincronizar, revisar runs/errores y revocar.

## Seguridad, permisos, capabilities y límites

Permisos de instalación/configuración/sync/revoke; capability por connector y límites de instancias/proyectos/espacios/registros. Probar state, webhook signature, SSRF, HTML no confiable, archivos, IDOR y tenant A/B.

## Jobs

Full sync, incremental sync, webhook ingest, retry y dead-letter idempotentes, con cursor transaccional y rate limit Atlassian.

## Pruebas y CI

Contract tests con respuestas protocol-realistic, sandbox autorizado, expiración/refresh/revocation, pagination, retry 429, mapping, duplicate webhook, tenant isolation, permisos y Playwright. Separar claramente sandbox de validación live.

## Documentación

Scopes, objetos, mappings, limitaciones, rate limits, setup sandbox, revocación, runbook, privacidad y nivel de validación.

## Criterios de cierre

- Jira y Confluence completan lifecycle;
- incremental sync sin duplicados;
- mappings aprobables y trazables;
- revocación detiene acceso;
- secrets redacted y tenant isolation verificado.

## Salida obligatoria

SHA, adapters, scopes, endpoints, UI, jobs, mappings, pruebas contract/sandbox, aislamiento, limitaciones, PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR; no merge ni deploy.
