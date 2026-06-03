# Database Live Map - TCDX Compliance

## Objetivo
Mapeo estructural de la base PostgreSQL real de TCDX Compliance para entender schemas, tablas, columnas, constraints, índices, vistas, funciones, triggers, sequences, extensiones, RLS, privilegios visibles y preparación para MVP/procesos/IA.

## Alcance
Solo inspección estructural con metadatos de `information_schema` y `pg_catalog`. No se consultaron filas de negocio, no se hicieron conteos de tablas de negocio, no se generaron dumps y no se ejecutaron migraciones.

## Restricciones aplicadas
- Sin `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `VACUUM FULL` ni `REINDEX`.
- Sin lectura de passwords, tokens, documentos, evidencias, logs o registros de negocio.
- La contraseña no fue escrita en archivos ni documentación.

## Conexión
- Host: `192.168.2.30`
- Puerto: `5432`
- Base: `tecdex_saas`
- Usuario: `tecdex_user`
- Fecha/hora del análisis: `2026-05-28T14:34:41.599Z`

## Advertencia
Este reporte es de solo lectura y no reemplaza migraciones, backups ni documentación de código. Los hallazgos son estructurales y deben validarse antes de cambios productivos.

## Documentos generados
1. [README.md](./README.md)
2. [connection-validation.md](./connection-validation.md)
3. [database-overview.md](./database-overview.md)
4. [schemas.md](./schemas.md)
5. [tables.md](./tables.md)
6. [columns.md](./columns.md)
7. [primary-keys.md](./primary-keys.md)
8. [foreign-keys.md](./foreign-keys.md)
9. [indexes.md](./indexes.md)
10. [constraints.md](./constraints.md)
11. [views.md](./views.md)
12. [functions.md](./functions.md)
13. [triggers.md](./triggers.md)
14. [sequences.md](./sequences.md)
15. [extensions.md](./extensions.md)
16. [rls-policies.md](./rls-policies.md)
17. [roles-privileges.md](./roles-privileges.md)
18. [tenant-structure-review.md](./tenant-structure-review.md)
19. [security-structure-review.md](./security-structure-review.md)
20. [module-data-map.md](./module-data-map.md)
21. [kpi-health-data-map.md](./kpi-health-data-map.md)
22. [ai-data-map.md](./ai-data-map.md)
23. [evidence-document-data-map.md](./evidence-document-data-map.md)
24. [audit-risk-action-data-map.md](./audit-risk-action-data-map.md)
25. [process-operations-readiness.md](./process-operations-readiness.md)
26. [database-risks-and-findings.md](./database-risks-and-findings.md)
27. [database-map-summary.md](./database-map-summary.md)
