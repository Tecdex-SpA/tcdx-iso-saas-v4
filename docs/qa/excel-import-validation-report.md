# Reporte de validación del motor universal Excel

## Alcance

Validación local de parser, generación, contratos, backend y frontend. No incluye deploy ni
migración productiva.

## Casos automatizados

- BOM, CRLF y encabezado repetido.
- Columnas reordenadas, extra y duplicadas.
- Fila `example` excluida.
- Libro con hojas esperadas.
- Listas desplegables y encabezado congelado.
- Checksum SHA-256.
- Fórmula, macro, enlace externo, firma corrupta y extensión activa rechazados.
- Definiciones de las tres olas y clasificación de entidades bloqueadas.
- Regresión exacta: `owner_email` y `unit_code` del encabezado no se convierten en datos.

## Resultado esperado de regresión

Con el archivo:

```text
owner_email=owner_email
unit_code=unit_code
```

en una segunda fila de encabezado, la fila se excluye antes de validar relaciones. La siguiente
fila real conserva `owner@tenant.test` y `TI`. Por tanto no se emiten:

```text
owner_email: owner_email no existe dentro de esta empresa.
unit_code: unit_code no existe dentro de esta empresa.
```

## Validaciones de cierre

Los resultados reales se registran al final de la ejecución:

| Control | Estado |
| --- | --- |
| Parser y plantillas | PASS - `npm run imports:check` |
| Backend syntax/check | PASS - `npm --prefix backend run check` |
| Backend unit tests | PASS - `npm --prefix backend test` |
| PostgreSQL integration | PASS - base temporal, cadena 9, sin ejecución productiva |
| RBAC/tenant contracts | PASS - `tenant_isolation_findings=0` |
| Frontend lint/typecheck/tests/build | PASS |
| Secret/debt scan | PASS - `npm run phase3:security-check` |
| `git diff --check` | PASS |

La integración PostgreSQL aplicó de forma temporal la migración
`20260730_universal_excel_import` con checksum
`6dced1b0e66330342487c44a933790bbfe1659457480c6b427e3b5e2ba2c9730`.
El resultado fue `VERIFIED_PHASE3_POSTGRES`, con preview, diez entidades operables,
duplicados, relaciones legibles, rollback y protección de cambios posteriores verificados.

No se declara Fase 3 cerrada desde este documento.
