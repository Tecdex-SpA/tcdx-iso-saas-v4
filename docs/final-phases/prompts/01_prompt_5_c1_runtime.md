# Prompt 5-C1 — Auditoría runtime integral

## Rol

Actúa como principal engineer de QA, seguridad multi-tenant, PostgreSQL y operación SaaS GRC.

## Contexto y objetivo

Audita el runtime real de TCDX ISO SaaS v4 y reconcilia la evidencia estática de `docs/final-phases/preparation/` con aplicación, API, jobs, PostgreSQL y artefactos. No implementes capacidades nuevas: establece una línea base reproducible y corrige solo defectos bloqueantes demostrados por la auditoría.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase5/c1-runtime-audit
```

Exige worktree limpio, origin oficial y registra el SHA actual de `main`; no uses un SHA fijo.

## Restricciones

- No usar datos reales, secretos, bypasses, mocks de autorización ni servicios falsos.
- No declarar operativo por existencia de archivos, tablas o endpoints.
- No modificar producción ni ejecutar deploy.
- No ampliar alcance hacia 5-C2.
- No ocultar errores, reintentos, skips ni deuda.

## Alcance

1. Inventariar rutas, endpoints, jobs, migraciones, consumers, dashboards, reportes y artefactos de Fase 5.
2. Validar localmente PostgreSQL efímero, backend y frontend.
3. Ejecutar E2E de navegador para rol autorizado, restringido, Tenant A y Tenant B.
4. Comprobar consistencia de valor, unidad, período, fórmula, versión, cobertura, trust, run y snapshot.
5. Medir accesibilidad, rendimiento, logs, correlation ID y cleanup.
6. Clasificar cada capacidad con el vocabulario de la auditoría estática.

## Modelo de datos y migración

No crear migración salvo que una prueba revele un bloqueo crítico y la corrección aditiva sea indispensable. Verificar físicamente tablas, FK, checks, índices, tenant scope, inmutabilidad, retención, ledger, checksums y migraciones idempotentes. Cualquier corrección requiere prueba PostgreSQL y rollback documentado.

## Backend y frontend

- Backend: probar contratos, errores sanitizados, permisos, capabilities, límites, jobs, snapshots y lineage.
- Frontend: probar rutas y acciones reales, estados loading/empty/error/success, navegación, accesibilidad y ausencia de cálculos paralelos.
- Registrar fórmulas o códigos técnicos visibles en experiencia de negocio como hallazgo.

## Seguridad, permisos, capabilities y límites

Ejecutar positivos, negativos, acceso por ID ajeno, descarga ajena, mutación ajena y selección platform-admin. Verificar límites en backend y concurrencia. Ningún test puede elevar roles o desactivar gates.

## Jobs y operación

Comprobar idempotencia, retries acotados, timeout, dead letter, correlation ID, tenant scope y error sanitizado. Limpiar fixtures por run manifest.

## Pruebas y CI

- tests backend y frontend existentes;
- integración PostgreSQL;
- E2E Playwright real;
- tenant isolation y RBAC;
- generación/apertura de PDF, DOCX y XLSX;
- accesibilidad y rendimiento medidos;
- `git diff --check`.

Agregar checks a CI solo cuando sean deterministas y no dependan de secretos en pull requests. Runtime QA debe permanecer separado y protegido.

## Documentación

Actualizar auditoría, matriz de cierre, QA, evidencia runtime, endpoint-consumer matrix y ledger. Marcar lo no ejecutable como `NO_VERIFICADO_RUNTIME` con bloqueo exacto.

## Criterios de cierre

- inventario runtime completo;
- cero hallazgos críticos sin disposición;
- E2E y PostgreSQL con evidencia real;
- cleanup y repositorio limpios;
- resultados no exagerados;
- no queda deuda interna de 5-C1.

## Salida obligatoria

Informar rama, SHA base actual, archivos, capacidades por estado, pruebas, E2E, PostgreSQL, tenant A/B, artefactos, accesibilidad, rendimiento, hallazgos, bloqueos externos y URL del PR.

## Git y prohibiciones finales

No merge. No deploy.

Hacer commit explícito, push y PR contra `main`. No hacer merge. No ejecutar deploy. No dejar deuda intencional.
