# Prompt 6.1 — Fundación de Integration Hub

## Rol

Actúa como principal integration architect, security engineer OAuth, especialista en jobs e infraestructura SaaS multi-tenant.

## Contexto y objetivo

Inicia Fase 6 únicamente con Fase 5 cerrada. Consolida el framework existente de conectores en una fundación productiva común: catálogo, instancias, credenciales, mappings semánticos, sincronización, health, retries, dead letter, revocación y auditoría.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase6/6-1-integration-foundation
```

Exige SHA actual, origin oficial y worktree limpio.

## Restricciones

- No conectar proveedores reales sin credenciales QA autorizadas.
- No guardar secretos en texto claro, logs, artifacts o Git.
- No permitir adapters con SQL/código arbitrario ni bypass tenant.
- No declarar un proveedor validado en vivo con solo sandbox/contratos.
- No merge, deploy ni producción.

## Alcance

Auditar y reutilizar `grc_connector_*`, adapters existentes y UI actual. Completar lifecycle install/configure/authorize/test/sync/map/monitor/retry/revoke/delete; contrato de adapter; catalog/instance/run/record/mapping/dead-letter; observabilidad y UX Integration Hub.

## Modelo de datos

Extender solo las tablas existentes cuando falten versiones, secret references, cursors, rate-limit state, consent, scopes, health, mapping version o retention. Todo tenant-scoped, cifrado/referenciado, auditable y con unicidad por provider/instance.

## Migración

Migración aditiva, idempotente, con ledger/checksum/lock, backfill seguro y postcondiciones. Probar reaplicación, rollback y compatibilidad con instancias actuales.

## Backend

Definir adapter interface tipada; OAuth/state/PKCE cuando aplique; vault/secret provider; incremental sync; pagination; rate limiting; idempotency; mapping a source contracts; health; retry/replay/revoke; errores sanitizados.

## Frontend

Centro de integraciones operacional: catálogo, instalación, configuración por formulario, scopes, autorización, test, mapping, preview, sync, runs, health, errores, retry, revocación y audit log. Sin JSON como interfaz primaria.

## Seguridad, permisos, capabilities y límites

Separar view/install/configure/authorize/sync/retry/revoke/admin. Aplicar capability Integration Hub y límites de instancias, ejecuciones, registros, retención y concurrencia. Probar CSRF/state, secret redaction, SSRF, IDOR y Tenant A/B.

## Jobs

Workers comunes con tenant, provider, instance, cursor, idempotency key, timeout, backoff, jitter, max attempts, dead letter, correlation ID, métricas y cancelación segura.

## Pruebas y CI

Adapter contract suite, PostgreSQL, secret handling, OAuth state, mapping, sync idempotente, retry/dead letter, revocación, tenant A/B, permisos, límites y Playwright. CI usa sandboxes/doubles de protocolo controlados, no mocks que omitan auth/tenant.

## Documentación

Arquitectura, adapter contract, threat model, API, runbook, secrets, scopes, provider validation levels, incident response y consumer map.

## Criterios de cierre

- lifecycle común operativo;
- secretos no recuperables por API/UI/log;
- mapping versionado a capa semántica;
- sync idempotente y observable;
- revocación efectiva;
- aislamiento tenant probado.

## Salida obligatoria

Entregar SHA, migración, tablas, endpoints, UI, adapter contract, jobs, seguridad, tests, validación por nivel, riesgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR; no merge, no deploy ni cambios en producción.
