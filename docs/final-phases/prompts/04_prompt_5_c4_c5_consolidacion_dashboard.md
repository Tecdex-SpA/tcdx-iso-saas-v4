# Prompt 5-C4/C5 — Consolidación GRC y dashboards

## Rol

Actúa como principal full-stack engineer, product designer enterprise GRC y especialista en visualización accesible.

## Contexto y objetivo

Con 5-C3 cerrado, consolida Riesgo 360, Control 360, Cumplimiento 360, Centro de Datos y Confianza, Centro Ejecutivo y Centro Operativo. Todos consumen outputs oficiales; no mantienen cálculos ni semánticas paralelas.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase5/c4-c5-grc-dashboard
```

Exige `main` actual y limpio; registra el SHA resuelto en ejecución.

## Restricciones

- No fórmulas, SQL, tablas o códigos técnicos como contenido primario.
- No cálculos frontend ni datasets mock.
- No eliminar capacidades, filtros, acciones o permisos existentes.
- No inventar certificación ni confianza no medida.
- No producción, merge ni deploy.

## Alcance

Implementar las seis vistas especificadas en `05_especificacion_experiencia_grc_premium.md`, consolidar consumers legacy, crear drill-down y acciones, y completar dashboards/versiones/widgets/snapshots. Mantener navegación, responsive y accesibilidad.

## Modelo de datos

Reutilizar outputs, snapshots, comparisons, explanations, dashboards y widgets existentes. Agregar solo persistencia faltante para layout/version/publication con tenant scope, auditoría, orden, tamaño, filtros y checksum.

## Migración

Si falta persistencia, crear migración aditiva e idempotente con upgrade de configuraciones existentes y prueba de rollback. No duplicar tablas equivalentes ni ejecutar deploy.

## Backend

- APIs agregadas por vista con contrato oficial;
- filtros, período, dimensiones, comparison y drill-down;
- acciones autorizadas y auditadas;
- persistencia/publicación de dashboard;
- snapshot consistente;
- compatibilidad de endpoints legacy mediante adaptadores.

## Frontend

Construir flujos operacionales reales: filtros, cards, gráficas, tablas, drill-down, acciones, preview, guardado, publicación y snapshot. Implementar loading, empty, error, success, parcial y no medido. Usar librerías existentes e iconografía coherente.

## Seguridad, permisos, capabilities y límites

Validar cada vista y acción en backend y UI. Separar lectura, edición y publicación. Aplicar límites de dashboards/widgets/snapshots y selección platform-admin. Probar acceso directo por ID ajeno.

## Jobs

Jobs de materialización y snapshot idempotentes, con período, tenant, timeout, retries y observabilidad. No bloquear requests largos con generación síncrona.

## Pruebas y CI

Unitarias, PostgreSQL, API, componentes y Playwright para crear/publicar dashboard, agregar/mover widget, generar snapshot, drill-down y acciones. Verificar Tenant A/B, permisos, viewports, WCAG AA y consistencia de cifras entre vistas.

## Documentación

Actualizar contratos API, consumers, UX, accesibilidad, runbook, evidencia E2E y matriz de cierre. Registrar consumers retirados o adaptados.

## Criterios de cierre

- mismo concepto y snapshot en todas las vistas;
- cero cálculo frontend;
- dashboards persistidos y publicables;
- acciones reales, no botones descriptivos;
- todos los estados y viewports validados;
- consumers paralelos retirados.

## Salida obligatoria

Informar SHA, vistas, componentes, endpoints, persistencia, consumers migrados, E2E, accesibilidad, tenant isolation, snapshots, riesgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR contra `main`; no merge, no deploy, no deuda intencional.
