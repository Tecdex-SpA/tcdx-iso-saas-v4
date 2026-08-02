# Prompt 6.5 — Conectores cloud

## Rol

Actúa como principal cloud security integration engineer para AWS, Azure y Google Cloud.

## Contexto y objetivo

Implementa adapters cloud productivos sobre 6.1 para inventario y señales de seguridad autorizadas, normalizadas como observaciones GRC. Cada cloud conserva cuentas/proyectos y permisos separados por tenant.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase6/6-5-cloud-connectors
```

Exige worktree limpio, origin oficial y SHA actual registrado.

## Restricciones

- No usar credenciales estáticas amplias como diseño final.
- No ejecutar cambios en recursos cloud; integración read-only salvo futura aprobación explícita.
- No ingerir secretos o payloads completos innecesarios.
- No declarar validación live sin cuenta sandbox ejecutada.
- No merge, deploy ni producción.

## Alcance

AWS accounts/organizations, recursos seleccionados y Security Hub; Azure subscriptions/resources/Defender; GCP projects/assets/Security Command Center. Implementar onboarding, role/federation, selección de alcance, sync incremental, mapping, health, retry y offboarding.

## Modelo de datos

Reutilizar connector records y mappings. Persistir external account/project references, scope, cursors y fingerprints; no duplicar inventario canónico. Tenant scope y región obligatorios.

## Migración

Migración aditiva solo para brechas del modelo común, con ledger/checksum/lock, idempotencia, rollback y postcondiciones.

## Backend

Adapters read-only, federated credentials, pagination, regional traversal acotado, normalization, dedupe, mapping, health, retry/replay y revoke. Clasificar source unavailable sin convertirlo en control fallido.

## Frontend

Wizard por cloud: método de confianza, cuenta/subscription/project, regiones, servicios, preview, mapping, publicación, sync, runs, health, errores y offboarding.

## Seguridad, permisos, capabilities y límites

Permisos de install/config/sync/revoke; capabilities cloud; límites de cuentas/regiones/recursos/runs. Probar confused deputy, external ID/audience, SSRF, IDOR, token redaction y Tenant A/B.

## Jobs

Discovery y findings sync idempotentes, particionados por cuenta/región, con cursor, rate limit, timeout, retry, dead letter y métricas de costo/volumen.

## Pruebas y CI

Contract tests por cloud, sandbox autorizado, paginación, regiones, 401/403/429/5xx, duplicate records, revoke, mapping, límites, tenant isolation y Playwright. Separar claramente contract, sandbox y live.

## Documentación

Trust setup, permisos mínimos, servicios, regiones, datos, mappings, rate limits, costos, revocación, runbook y nivel de validación.

## Criterios de cierre

- adapters read-only con privilegio mínimo;
- inventario/findings idempotentes;
- mapping trazable;
- revoke/offboarding efectivos;
- aislamiento tenant comprobado.

## Salida obligatoria

SHA, clouds, permisos, adapters, endpoints, UI, jobs, tests, seguridad, límites, riesgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR; no merge ni deploy.
