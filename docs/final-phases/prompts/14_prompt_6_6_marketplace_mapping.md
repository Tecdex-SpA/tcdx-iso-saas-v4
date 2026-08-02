# Prompt 6.6 — Marketplace y mappings

## Rol

Actúa como principal product engineer SaaS, integration marketplace architect y especialista en entitlements.

## Contexto y objetivo

Con adapters implementados, crea marketplace, instalación comercial y catálogo versionado de mappings. El tenant debe conocer capacidad, costo/límite, scopes, datos y nivel de validación antes de instalar.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase6/6-6-marketplace-mapping
```

Registrar SHA actual; worktree limpio obligatorio.

## Restricciones

- No instalar sin entitlement y permiso.
- No publicar mapping sin validación/revisión.
- No ocultar scopes, límites, retención o nivel de validación.
- No vender como live un adapter probado solo por contrato.
- No merge, deploy ni producción.

## Alcance

Catálogo comercial/técnico de conectores, planes/packs/limits, install/uninstall, versiones y compatibilidad, mapping templates, clone/preview/validate/review/publish/retire, UX de marketplace y administración SaaS.

## Modelo de datos

Implementar o extender definiciones/versiones de marketplace, plan bindings, connector entitlements y mapping templates/versions. PK/FK/checks, tenant/global scope, vigencia, checksum, auditoría e inmutabilidad publicada.

## Migración

Migración aditiva/idempotente con bootstrap versionado, ledger/checksum/lock, upgrade de catálogo y rollback probado.

## Backend

- catalog y detail;
- entitlement/limit resolution;
- install/uninstall transaccional;
- mapping template lifecycle;
- compatibility validation;
- preview y diff;
- audit y history.

## Frontend

Marketplace searchable, ficha de conector, scopes/datos/limits, install flow, configuration link, mappings por formulario, preview, validation, review/publication e historial. Estados de unavailable/plan-required explícitos.

## Seguridad, permisos, capabilities y límites

Permisos SaaS catalog admin, tenant install/config y mapping publish. Capability por provider/pack; límites atómicos. Probar price/plan tampering, IDOR, cross-tenant template, downgrade y uninstall.

## Jobs

Jobs de catálogo, compatibility scan y deprecation notification idempotentes. Desinstalación cancela jobs del conector y preserva auditoría según retención.

## Pruebas y CI

Bootstrap, checksum, versiones, install/uninstall, entitlements, límites concurrentes, mapping lifecycle, compatibilidad, Tenant A/B, permisos y E2E marketplace. Regresión de adapters y `git diff --check`.

## Documentación

Catálogo, lifecycle, planes, límites, mapping methodology, deprecation, offboarding, runbook y validación por provider.

## Criterios de cierre

- instalación depende de entitlement real;
- mappings publicados son versionados/inmutables;
- UX informa scopes, datos y límites;
- uninstall detiene sync y revoca acceso;
- tenant isolation pasa.

## Salida obligatoria

SHA, migración, catálogo, endpoints, UI, entitlements, mappings, tests, riesgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR; no merge ni deploy.
