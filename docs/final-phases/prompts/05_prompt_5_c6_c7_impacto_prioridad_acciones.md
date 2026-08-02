# Prompt 5-C6/C7 — Impacto, prioridad y acciones

## Rol

Actúa como principal engineer GRC, arquitecto de grafos relacionales, seguridad y sistemas de decisión explicables.

## Contexto y objetivo

Con vistas 360 y dashboards consolidados, implementa el Impact Graph, prioridad y acciones propuestas. Cada inferencia debe ser trazable, versionada, tenant-scoped y revisable; el sistema apoya decisiones, no ejecuta consecuencias irreversibles sin aprobación.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase5/c6-c7-impact-actions
```

Registrar SHA actual de `main`; no continuar con cambios locales.

## Restricciones

- No inferir causalidad cuando solo existe correlación.
- No crear relaciones cross-tenant ni aristas sin vigencia/fuente.
- No usar pesos ocultos ni acciones automáticas irreversibles.
- No exponer fórmulas al rol de negocio.
- No producción, merge ni deploy.

## Alcance

Construir relaciones de impacto entre riesgo, control, requisito, evidencia, hallazgo, acción, proceso, activo, proveedor, incidente, pérdida y continuidad. Calcular prioridad con factores versionados; generar recomendaciones, propuestas de acción, decisiones y seguimiento auditado.

## Modelo de datos

Implementar `grc_impact_edge_types`, `grc_impact_edges`, versiones, `grc_priority_policies`, versiones, evaluaciones, decisiones y acciones propuestas según el modelo semántico. Incluir tenant, source record, confidence, direction, status, valid_from/to, actor y correlation ID.

## Migración

Migración aditiva/idempotente con FK, checks de self-link, índices de recorrido, unicidad por vigencia e inmutabilidad publicada. Probar ciclos, aristas expiradas, reintento y rollback.

## Backend

- CRUD y publicación de tipos/políticas autorizados;
- graph traversal acotado y tenant-scoped;
- evaluación de impacto y prioridad reproducible;
- explicación de factores y evidencia;
- propuesta, aprobación, rechazo y conversión a acción;
- historial y lineage.

## Frontend

Crear vistas accesibles de causa, impacto y prioridad con filtros, tabla alternativa al grafo, drill-down, evidencia, confidence, recomendaciones y flujo de aprobación. No depender solo del color ni usar visualización ornamental.

## Seguridad, permisos, capabilities y límites

Separar ver, gestionar relaciones, publicar política, evaluar, aprobar y ejecutar acción. Aplicar capability y límites de nodos, aristas, profundidad, evaluaciones y retención. Probar Tenant A/B y platform-admin.

## Jobs

Jobs idempotentes para materializar impacto, reevaluar prioridad y caducar aristas, con lotes acotados, período, tenant, timeout, retries y métricas.

## Pruebas y CI

Probar grafo vacío, ciclos, duplicados, vigencia, source unavailable, confidence, prioridad conocida, empate, cambio de versión, aprobación/rechazo, concurrencia, Tenant A/B, permisos, límites y E2E completo. Integrar checks deterministas y `git diff --check`.

## Documentación

Actualizar arquitectura, API, seguridad, metodología de prioridad, consumers, UX, runbook y evidencia. Diferenciar causa demostrada, dependencia e inferencia.

## Criterios de cierre

- aristas reales y explicables;
- prioridad determinista/versionada;
- propuesta no se convierte sin autorización;
- historial y lineage completos;
- no hay fuga cross-tenant ni loops no acotados;
- cero deuda del bloque.

## Salida obligatoria

Entregar SHA, migración, modelo, endpoints, vistas, jobs, pruebas, E2E, aislamiento, rendimiento del traversal, hallazgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR; no merge, no deploy ni modificación de producción.
