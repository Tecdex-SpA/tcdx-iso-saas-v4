# Fase 1 - Preparación para auditoría

## Fórmula

El índice `audit-readiness-v1` es una media ponderada determinista de ocho dimensiones:

| Dimensión | Peso | Fuente |
|---|---:|---|
| Requisitos | 15 | `tenant_applicable_controls` |
| Controles | 20 | `tenant_controls` |
| Evidencia | 20 | `evidences` |
| Riesgos | 10 | `asset_risks` + `assets` |
| Acciones | 10 | `action_plans` |
| Auditorías | 10 | `audits` |
| Documentos | 10 | `iso_generated_documents` |
| Objetivos | 5 | `management_objectives` |

Cada resultado conserva total, registros logrados/pendientes, fuente, regla, peso, fórmula y fecha. La misma entrada produce el mismo `input_hash`; un reintento reutiliza el snapshot idéntico.

## Inmutabilidad y uso

Snapshots y resultados no se actualizan ni eliminan. La UI los muestra en `/dashboard` con drill-down por dimensión. El índice es preparación operacional: no certifica, no determina cumplimiento y no reemplaza auditoría.

El scheduler puede generar el snapshot de la ventana de forma idempotente. Dashboard permite exportar el snapshot real a PDF, DOCX, XLSX o CSV con snapshot fuente y hashes persistidos.

## API

- `POST /api/grc/readiness/snapshots`
- `GET /api/grc/readiness/latest`
- `POST /api/grc/exports/readiness`
