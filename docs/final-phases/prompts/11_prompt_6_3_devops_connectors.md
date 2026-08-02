# Prompt 6.3 — Conectores DevOps

## Rol

Actúa como principal DevSecOps integration engineer para GitHub, GitLab, Azure DevOps y Jenkins.

## Contexto y objetivo

Implementa conectores DevOps sobre 6.1 para convertir repositorios, pipelines y findings autorizados en observaciones semánticas GRC, sin confundir telemetría externa con evidencia aprobada.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase6/6-3-devops-connectors
```

Exige `main` actual y limpio; registra SHA dinámicamente.

## Restricciones

- Least privilege; no tokens personales amplios como solución final.
- No clonar código fuente ni contenido sensible innecesario.
- No convertir findings en no conformidades sin review.
- No declarar proveedor live si solo pasó contract test.
- No merge, deploy ni producción.

## Alcance

GitHub App/OAuth, GitLab OAuth/token administrado, Azure DevOps OAuth y Jenkins credential reference. Sincronizar metadata de repos, branches permitidas, pipelines/runs, deployments, security findings y status; mapear a controles, riesgos, evidencias y calidad.

## Modelo de datos

Usar registros/mappings comunes. Persistir installation/project references, cursors y fingerprints provider-specific solo cuando sean indispensables. Evitar almacenar source code y secretos.

## Migración

Migración aditiva si falta soporte común; ledger/checksum/lock, idempotencia, backfill y rollback probados.

## Backend

Adapters con paginación, rate limit, webhook verification, dedupe, incremental sync, mapping, health, retry, replay y revoke. Sanitizar nombres/URLs y limitar payloads.

## Frontend

Wizard por provider, selector de organización/proyecto/repo, objetos y ramas, scopes, mapping preview, health, runs, errors, retry y revoke. Mostrar nivel real de validación.

## Seguridad, permisos, capabilities y límites

Permisos por instalación/config/sync/revoke; capabilities provider-specific; límites de repos/proyectos/runs/retención. Probar signatures, SSRF, untrusted markdown, IDOR, secrets, Tenant A/B y uninstall.

## Jobs

Sync y webhook jobs idempotentes, cursor transaccional, backoff/jitter, dead letter, timeout, cancellation y métricas.

## Pruebas y CI

Adapter contract suite por provider, webhook replay, pagination, 401/403/429/5xx, token rotation, revoke, mapping, tenant isolation, límites y E2E. Live/sandbox solo con secretos protegidos fuera de PR.

## Documentación

Scopes, installation model, mappings, threat model, provider setup, rate limits, revocation, retention y nivel de validación.

## Criterios de cierre

- cuatro adapters cumplen contrato común;
- no se persiste código/secretos indebidos;
- findings quedan propuestos y trazables;
- revoke/uninstall detiene jobs;
- tenant isolation pasa.

## Salida obligatoria

SHA, providers, adapters, endpoints, UI, jobs, tests por nivel, seguridad, mappings, riesgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR; no merge, deploy ni producción.
