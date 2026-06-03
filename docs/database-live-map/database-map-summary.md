# Database Map Summary

## Estado general
La base `tecdex_saas` en PostgreSQL 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1) muestra una estructura SaaS multi-tenant amplia, con 187 tablas, 62 vistas, 108 funciones, 28 triggers, 641 índices y 5 extensiones visibles para `tecdex_user`.

## Madurez estructural
- Multi-tenant: 166 tablas con `tenant_id`; buena señal estructural, aunque se detectan oportunidades de índices y validación cross-tenant.
- MVP compliance: cubre normas ISO, controles, evidencias, brechas, acciones, reportes e IA/conocimiento por estructura.
- KPI/health: hay objetos estructurales dedicados a snapshots, health, scores o vistas agregadas.
- IA/PLN/NLP: existen tablas y funciones relacionadas con IA/conocimiento/trazabilidad; pgvector no aparece instalado, por lo que RAG vectorial nativo debe confirmarse.
- Procesos/operaciones: preparación parcial o no madura; requiere diseño transversal antes de Sprint funcional.

## Principales riesgos
- Crítica: El usuario de conexión tiene privilegios potencialmente de escritura o creación.
- Media: No se detectó RLS habilitado en tablas de aplicación.
- Media: Hay objetos con tenant_id sin índice evidente; la revisión de performance debe enfocarse en tablas persistentes.
- Media: Existen objetos sin primary key detectada; la lista incluye vistas y tablas de backup/legacy que requieren revisión separada.
- Media: Existen columnas con nombres sensibles.

## Preparación para MVP
La DB parece cubrir el flujo tenant -> norma -> control -> evidencia -> brecha -> acción -> reporte -> IA trazable. La prioridad es endurecer aislamiento tenant, reducir exposición de módulos internos y validar que tablas core tengan PK/FK/índices suficientes.

## Preparación para PLN/NLP
Revisar si la estrategia será pg_trgm, pgvector, motor externo o híbrida. No leer ni exportar datos sensibles para entrenamientos o pruebas sin autorización explícita.

## Preparación para procesos/operaciones
Diseñar `tenant_processes` y `tenant_operations` como capa transversal y luego vincular controles, evidencias, riesgos, planes, KPIs, health, reportes e IA.

## Recomendaciones prioritarias
1. Usar usuario DB estrictamente read-only para futuras auditorías.
2. Validar objetos con `tenant_id` sin índice tenant evidente, priorizando tablas persistentes de alto volumen.
3. Revisar objetos sin PK, separando vistas normales de tablas backup/legacy/QA.
4. Definir RLS sí/no con pruebas cross-tenant obligatorias.
5. Aprobar modelo de procesos/operaciones antes de migraciones.

## Próximos pasos
Revisión humana de hallazgos, comparación con migraciones versionadas, y creación de backlog técnico sin ejecutar cambios en DB todavía.
