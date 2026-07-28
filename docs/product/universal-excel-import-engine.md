# Motor universal de importación Excel

## Objetivo

El motor concentra definiciones, plantillas, parsing, validación, confirmación, auditoría y
rollback. Excel `.xlsx` es el formato principal; CSV es secundario y usa el mismo contrato de
columnas.

## Componentes

- `importDefinitions.js`: registro declarativo versionado de entidades, campos, relaciones,
  permisos, capability, políticas y límites.
- `excelWorkbook.js`: generación y parsing OOXML sin ejecutar fórmulas.
- `universalImport.service.js`: autorización, catálogos tenant-scoped, preview, confirmación,
  historial, archivo de errores y rollback.
- `imports.routes.js`: contratos `/api/imports` y carga en memoria acotada.
- `grc_phase3_import_batches` / `grc_phase3_import_rows`: ledger por lote y fila.
- `grc_import_files`: metadata y SHA-256; no conserva el binario.
- `grc_import_cell_errors`: errores por celda.
- `grc_import_audit_events`: trazabilidad de preview, confirmación y rollback.

## Contratos

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/imports/definitions` | Definiciones y disponibilidad |
| GET | `/api/imports/definitions/:entityType` | Contrato de una entidad |
| GET | `/api/imports/templates/:entityType.xlsx` | Plantilla Excel tenant-scoped |
| GET | `/api/imports/catalogs/:entityType.xlsx` | Libro con catálogos vigentes |
| POST | `/api/imports/preview` | Preview multipart, sin mutar dominio |
| GET | `/api/imports/:batchId` | Lote y filas del tenant |
| POST | `/api/imports/:batchId/confirm` | Confirmación explícita |
| POST | `/api/imports/:batchId/rollback` | Reversión exclusiva del lote |
| GET | `/api/imports/:batchId/errors.xlsx` | Plantilla corregible con Errores |
| GET | `/api/imports/history` | Historial tenant-scoped |

## Plantilla

- `Instrucciones`: propósito, orden, formatos, duplicados, seguridad y campos.
- `Datos`: `__row_type`, encabezados técnicos, fila `example`, comentarios, filtro y encabezado
  congelado. La fila `example` nunca se importa.
- `Catálogos`: códigos, correos y etiquetas del tenant actual.
- `Errores`: se agrega al libro devuelto cuando el preview tiene rechazos.

Las listas desplegables se generan como validaciones OOXML sobre `Datos`. Los usuarios relacionan
entidades mediante `owner_email`, `unit_code`, `process_code`, `service_code`, `risk_code`,
`plan_code`, `metric_code` y otros códigos legibles.

## Normalización y relaciones

- Se elimina BOM de claves y valores.
- Se preserva el orden arbitrario de columnas.
- Se ignoran filas vacías, ejemplo y encabezados repetidos.
- Se aplica `trim`; las claves se comparan sin distinguir mayúsculas/minúsculas.
- La búsqueda es exacta. Cero coincidencias produce `REFERENCE_NOT_FOUND`; más de una produce
  `REFERENCE_AMBIGUOUS`.
- El lookup solo contiene filas del tenant autenticado.
- Los errores incluyen columna, código, mensaje, sugerencia y valores válidos acotados.

## Duplicados

Las definiciones versionadas admiten `create_only`, `update_existing`, `create_or_update` y
`reject_duplicates`. El preview etiqueta cada fila como `create`, `update` o `no_change` y guarda
los campos modificados. Entidades sin actualización genérica segura exponen solo creación y
rechazo.

## Rollback

Los registros creados se eliminan únicamente si conservan provenance del lote y no han avanzado
de estado o versión. Las actualizaciones guardan snapshot y versión; si el registro cambió después
de la importación, el rollback se bloquea. Una reversión queda auditada y nunca borra datos
preexistentes ajenos al lote.

## Seguridad

- Solo `.xlsx` y CSV secundario; `.xls`, `.xlsm`, `.xlsb` se rechazan.
- MIME y firma ZIP/OOXML verificados.
- Máximo 5 MB, 5.000 filas, 100 columnas, 4 hojas, 1.000 entradas ZIP y 20 MB expandidos.
- CRC ZIP, rechazo de macros, `.bin`, enlaces externos y fórmulas.
- No se evalúan fórmulas ni se ejecutan macros.
- Texto potencialmente interpretable como fórmula se neutraliza al generar libros.
- Carga en memoria acotada, un archivo, y rate limit por tenant/usuario.
- Auth, capability `grc_phase3_operations`, permiso `operations.import` y tenant scope.
- Logs sin contenido de celdas, archivos, tokens o secretos; conservan `request_id`.

## Compatibilidad CSV

El defecto observado ocurría cuando un segundo encabezado llegaba como fila de datos. El parser
anterior tampoco removía BOM. El parser común ahora maneja BOM, CRLF, comillas, columnas
reordenadas y encabezado repetido. Por ello `owner_email` y `unit_code` ya no se validan como
valores de negocio.
