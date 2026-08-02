# Prompt 6.7 — Cierre de Integration Hub

## Rol

Actúa como principal QA integration engineer, SRE, security reviewer y release owner.

## Contexto y objetivo

Valida y cierra Fase 6 sin ampliar funcionalidad. Debe distinguir evidencia contract, sandbox y live para cada provider y demostrar aislamiento, revocación, resiliencia, observabilidad y operación segura.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase6/6-7-integration-closeout
```

Exige `main` actual y limpio; valida secretos sin imprimirlos.

## Restricciones

- No proveedores reales sin sandbox/credencial autorizada.
- No falsear live validation ni aceptar skips.
- No dejar tokens activos, subscriptions huérfanas o QA data.
- No iniciar Fase 7 con deuda de Integration Hub.
- No merge, deploy ni producción desde este prompt.

## Alcance

Auditar catálogo, instancias, adapters, mappings, marketplace, jobs, health, retry, dead letter, revoke/offboarding, UI y documentación. Ejecutar pruebas por provider y matriz de nivel de validación.

## Modelo de datos y migración

No diseñar nuevas entidades. Validar migraciones en PostgreSQL efímero/QA: ledger, checksums, constraints, índices, tenant scope, retention y cleanup. Corregir solo brechas demostradas.

## Backend y frontend

Backend: contrato común, OAuth, secrets, sync, mapping, health, retry/replay/revoke. Frontend: lifecycle completo por UI, errores accionables, estados y accesibilidad. Ningún botón sin operación real.

## Seguridad, permisos, capabilities y límites

Ejecutar threat cases: OAuth state/PKCE, webhook signatures, SSRF, secret redaction, IDOR, scopes, revoke, Tenant A/B, platform-admin, entitlement y límite concurrente.

## Jobs y operación

Probar idempotencia, cursor recovery, 429/5xx, timeout, cancellation, dead letter, replay, metrics/alerts y offboarding. Verificar cero procesos y fixtures al finalizar.

## Pruebas y CI

Contract suites de todos los adapters, sandboxes disponibles, E2E navegador, PostgreSQL, security, performance, accessibility y regression Fase 5. Secret-dependent runtime QA en workflow protegido; PR CI no usa credenciales ficticias.

## Documentación

Closeout, provider matrix, scopes, mappings, QA evidence, runbooks, SLO, incident response, revoke/offboarding y limitaciones. Marcar `NO_VERIFICADO_RUNTIME` donde falten credenciales reales.

## Criterios de cierre

- todos los providers cumplen contrato común;
- cada nivel de validación está probado y documentado;
- revoke/offboarding y cleanup pasan;
- cero hallazgos altos/críticos;
- CI y runtime QA correspondiente pasan;
- Fase 5 permanece sin regresiones.

## Salida obligatoria

Estado, SHA, providers por nivel, pruebas, sandboxes/live, seguridad, jobs, UI, cleanup, hallazgos, bloqueos, riesgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR solo con cierre completo; no merge, no deploy y no iniciar Fase 7.
