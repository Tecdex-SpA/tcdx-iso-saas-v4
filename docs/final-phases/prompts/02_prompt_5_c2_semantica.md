# Prompt 5-C2 — Capa semántica GRC

## Rol

Actúa como principal data architect PostgreSQL, especialista GRC, seguridad multi-tenant y backend Node.js.

## Contexto y objetivo

Con 5-C1 cerrado, implementa la capa semántica oficial que convierte fuentes operacionales en observaciones canónicas, suficientes, trazables y versionadas. Reutiliza `official_formula_*`, calculation runs y source contracts existentes; no crea un motor matemático paralelo.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase5/c2-semantic-layer
```

Exige `main` actual, worktree limpio y origin oficial. Registra el SHA obtenido, sin fijarlo en el prompt.

## Restricciones

- PostgreSQL es fuente de verdad y backend es autoridad.
- No permitir SQL, fórmulas o código arbitrario configurable.
- No inventar ceros ni marcar disponible una fuente inexistente.
- No exponer tablas, columnas o adaptadores al usuario de negocio.
- No modificar producción, no merge y no deploy.

## Alcance

Implementar contratos, versiones, field mappings, observaciones canónicas, relaciones, suficiencia, quality, freshness, lineage y snapshots de fuente. Adaptar fuentes legacy solo mediante contratos explícitos. Resolver duplicados activos sin romper contratos externos.

## Modelo de datos

Implementar las entidades especificadas en `04_modelo_semantico_datos_grc.md`: `semantic_source_contracts`, versiones, mappings, observations, observation relations y evaluaciones de suficiencia. Definir UUID, tenant scope, PK/FK, checks, índices, unicidad, actor, correlation ID, checksum, metadata controlada, versionado e inmutabilidad publicada.

## Migración

Crear migración aditiva e idempotente, runner con ledger/checksum/advisory lock y postcondiciones. Probar primera aplicación, segunda aplicación, checksum incompatible, rollback y esquema con datos sintéticos. Agregar al deploy oficial sin ejecutarlo.

## Backend

- registro y publicación de source contracts;
- mapeo tipado y preview;
- resolución tenant-scoped;
- validación de unidad, período, timezone, cardinalidad y cobertura;
- hash y snapshot reproducibles;
- API de observaciones, suficiencia y lineage;
- adaptadores legacy declarados.

## Frontend

Crear administración técnica autorizada para contratos y mappings, con formulario, validación, preview, diff, publicación e historial. Usuarios de negocio solo ven concepto, disponibilidad, cobertura, trust e interpretación.

## Seguridad, permisos, capabilities y límites

Definir permisos separados de ver, editar, revisar y publicar. Proteger catálogo global y selección de tenant. Aplicar capability de gobierno matemático y límites de contratos, mappings, registros y retención en backend.

## Jobs

Implementar jobs idempotentes de ingestión, validación, snapshot y freshness, con tenant, período, idempotency key, retries, timeout, estado y error sanitizado.

## Pruebas y CI

Cubrir migración PostgreSQL, checksum, inmutabilidad, validación de contratos, ambigüedad, fuente ausente, duplicados, timezone, unidad, Tenant A/B, permisos, límites, jobs y UI. Integrar checks deterministas a CI y ejecutar `git diff --check`.

## Documentación

Actualizar arquitectura, source contracts, seguridad, API, migraciones, runbook, inventario, mapa de consumers y trazabilidad.

## Criterios de cierre

- observación canónica persistida y reproducible;
- lineage fuente a snapshot completo;
- fuente ausente nunca aparece como cero;
- tenant isolation PostgreSQL/API/UI probado;
- adapters legacy explícitos;
- cero duplicación matemática activa.

## Salida obligatoria

Informar SHA base, migración, tablas, endpoints, UI técnica, adapters, pruebas PostgreSQL, aislamiento, jobs, consumers migrados, riesgos y URL del PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit y push solo de cambios del bloque; crear PR contra `main`. No merge, no deploy y ninguna deuda intencional.
