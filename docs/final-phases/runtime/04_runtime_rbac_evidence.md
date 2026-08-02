# Evidencia RBAC y aislamiento tenant de 5-C1

## Fixtures sintéticos

- Tenant A: `70000000-0000-0000-0000-000000000701`.
- Tenant B: `70000000-0000-0000-0000-000000000702`.
- Roles: administrador A, lector restringido A y administrador B.
- Datos: métricas, resultados oficiales, dashboard, snapshot y reporte generados durante la ejecución local.

## Pruebas realizadas

| Prueba | Capa | Resultado |
| --- | --- | --- |
| Login y contexto de tenant | navegador/API | PASS |
| Lectura del Portal GRC como admin A | navegador/API | PASS |
| Mutación administrativa como admin A | navegador/API | PASS |
| Mutación administrativa como restringido A | API observada desde navegador | PASS: 403 |
| Lectura de datos de A desde sesión de B | API observada desde navegador | PASS: sin dato creado en A |
| Aislamiento de source resolver | pruebas 5.5 | PASS |
| Aislamiento PostgreSQL de fórmulas, runs, snapshots y lineage | integración PostgreSQL 5.5 | PASS |

No se elevaron roles ni se desactivaron gates para pasar pruebas. No se usa una cuenta real ni una URL remota.
