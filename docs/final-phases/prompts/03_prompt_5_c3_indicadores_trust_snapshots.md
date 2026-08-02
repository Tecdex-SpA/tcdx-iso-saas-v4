# Prompt 5-C3 — Indicadores, Data Trust y snapshots

## Rol

Actúa como principal engineer de métricas GRC, estadística, producto SaaS y arquitectura de datos.

## Contexto y objetivo

Con 5-C2 cerrado, implementa el catálogo funcional de indicadores y una única cadena oficial de cálculo, trust, interpretación y snapshot. La fórmula es interna; el negocio consume concepto, resultado, tendencia, cobertura, confianza, causa, impacto, recomendación y acción.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase5/c3-indicators-trust-snapshots
```

Exige worktree limpio y registra el SHA actual sin hardcodearlo.

## Restricciones

- Reutilizar registro matemático y capa semántica; no duplicar fórmulas.
- No calcular resultados en frontend.
- No rellenar `source_unavailable` o `unmeasured` con cero.
- No cambiar metodología publicada en sitio.
- No producción, merge ni deploy.

## Alcance

Implementar catálogo funcional, bindings a resultados oficiales, suficiencia, Data Trust por dimensión, freshness, thresholds versionados, interpretación, recomendaciones, acciones propuestas, snapshots y comparaciones. Cubrir como mínimo los conceptos del catálogo documental.

## Modelo de datos

Extender de forma compatible `metric_source_bindings`, `metric_calculation_policies`, snapshots, validations, explanations y comparisons. Agregar solo entidades faltantes para catálogo funcional, interpretación y recomendación, con tenant scope, versionado, vigencia, checksum, actor y auditoría.

## Migración

Migración aditiva e idempotente con ledger y postcondiciones. Preservar resultados históricos. Probar upgrade, reaplicación, checksums e inmutabilidad de versiones publicadas.

## Backend

- resolver indicador por código funcional;
- calcular usando output oficial;
- producir cobertura y trust reales;
- guardar snapshot y comparación;
- explicar warnings, causa e impacto;
- proponer acción sin ejecutarla irreversiblemente;
- exponer historial y lineage.

## Frontend

Actualizar consumers de indicadores para mostrar nombre visible, unidad, tendencia, cobertura, trust, interpretación y acciones. Detalle técnico solo para rol autorizado y bajo divulgación secundaria.

## Seguridad, permisos, capabilities y límites

Separar lectura de negocio, administración metodológica, revisión y publicación. Respetar tenant y catálogo global. Aplicar límites de indicadores, snapshots, retención y frecuencia en backend.

## Jobs

Jobs de cálculo, snapshot, comparación, freshness y alerta: idempotentes, tenant-scoped, con período, correlation ID, timeout, retries y estado persistido.

## Pruebas y CI

Casos normales, límites, nulos, fuente ausente, cobertura insuficiente, trust parcial, thresholds, comparación, historial, inmutabilidad, concurrencia, Tenant A/B, permisos y límites. Verificar igualdad API/UI/snapshot y ejecutar checks de regresión de fases previas.

## Documentación

Actualizar catálogo funcional, fórmula-trazabilidad, fuente, API, seguridad, consumers, runbook y evidencia numérica. Documentar método y limitaciones sin exponerlo como experiencia primaria.

## Criterios de cierre

- catálogo funcional operativo y versionado;
- Data Trust sin constantes prefijadas;
- snapshots reproducibles e inmutables;
- resultado coherente en todos los consumers migrados;
- fuente insuficiente visible y no transformada en cumplimiento;
- cero deuda del bloque.

## Salida obligatoria

Entregar rama, SHA base, indicadores, migración, endpoints, vistas, jobs, pruebas, consistencia, tenant isolation, límites, documentación, riesgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit, push y PR contra `main`; no merge, no deploy y no cambios en producción.
