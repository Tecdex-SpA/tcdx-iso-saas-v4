# Database Overview

## Resumen
| Métrica | Total | Fuente |
|---|---:|---|
| Base de datos | tecdex_saas | función current_database() |
| Versión PostgreSQL | 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1) | current_setting('server_version') |
| Schemas de aplicación detectados | 2 | information_schema.schemata |
| Tablas base | 187 | information_schema.tables |
| Vistas + materialized views | 62 | information_schema.views / pg_catalog.pg_class |
| Funciones/procedimientos | 108 | pg_catalog.pg_proc |
| Triggers | 28 | information_schema.triggers / pg_catalog.pg_trigger |
| Índices | 641 | pg_catalog.pg_indexes |
| Extensiones | 5 | pg_catalog.pg_extension |
| Secuencias | 23 | information_schema.sequences |

## Objetos por schema
| Schema | Tablas | Vistas | Funciones |
| --- | --- | --- | --- |
| ai_core | 27 | 9 | 4 |
| public | 160 | 53 | 104 |

## Observaciones generales
- Señales multi-tenant: 166 tablas con columna `tenant_id`; 55 FKs o columnas estructurales relacionadas con tenants.
- Señales ISO/controles: 101 tablas por nombre asociadas a normas, controles o catálogo.
- Señales IA/conocimiento: 60 tablas y 5 funciones inferidas para IA/conocimiento/trazabilidad.
- Señales evidencias/documentos: 50 tablas inferidas para evidencias, documentos, fuentes o integraciones.
- Señales riesgos/auditoría/acciones: 57 tablas inferidas para auditorías, riesgos, hallazgos, no conformidades o acciones.
- Señales KPI/health: 46 tablas y 26 vistas inferidas.

Fuente: `information_schema`, `pg_catalog`.
