# Runbook de importación Excel

## Precondiciones

- Tenant operativo con `grc_phase3_operations` habilitado.
- Usuario con `operations.import`.
- Catálogos previos creados.
- Migración `20260730_universal_excel_import` aplicada por el runner privilegiado.

## Operación

1. Abra `/importaciones`.
2. Seleccione la entidad y revise sus dependencias.
3. Descargue la plantilla Excel.
4. Complete `Datos` usando las listas y la hoja `Catálogos`.
5. No altere nombres de columnas ni use fórmulas, macros, UUID o secretos.
6. Cargue el `.xlsx`.
7. Revise el preview y filtre filas rechazadas.
8. Si hay errores, descargue el libro corregible, ajuste y vuelva a cargar.
9. Seleccione la política de duplicados permitida.
10. Confirme explícitamente.
11. Registre el `batchId` y el resultado.

Orden inicial: Unidades, Procesos, Servicios, BIA, Planes, Pruebas, Indicadores, Mediciones y
Riesgo cuantitativo. Proveedores no dependen de la estructura, pero requieren un responsable
válido cuando se informa `owner_email`.

## Rollback

1. Abra el lote en el historial.
2. Compruebe que no existan cambios posteriores.
3. Ejecute rollback.
4. Revise `rolled_back_rows` y `rollback_blocked_rows`.
5. Si hay bloqueos, no elimine datos manualmente; revise versiones y relaciones.

## Errores frecuentes

| Código | Acción |
| --- | --- |
| `REFERENCE_NOT_FOUND` | Use un valor exacto de Catálogos |
| `REFERENCE_AMBIGUOUS` | Corrija la duplicidad del catálogo |
| `IMPORT_FORMULA_REJECTED` | Reemplace fórmulas por valores |
| `IMPORT_MACRO_REJECTED` | Guarde como `.xlsx` sin macros |
| `IMPORT_ZIP_BOMB_REJECTED` | Reduzca el archivo y regenérelo |
| `DUPLICATE_IN_BATCH` | Conserve una sola fila por clave |
| `UPDATE_TARGET_NOT_FOUND` | Use crear/actualizar o cree primero el registro |

## Post-deploy

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git pull --ff-only origin main
./scripts/deploy-vms.sh
```

El deploy debe recibir `MIGRATION_DATABASE_URL` mediante el archivo protegido configurado; nunca
por argumentos ni archivos versionados. Después valide `GET /api/imports/definitions`, descargue
una plantilla, ejecute preview con datos sintéticos y haga rollback del lote. No use datos reales
en QA.

## Respuesta a incidentes

Ante archivo malicioso o procesamiento anómalo: no confirme, conserve `request_id` y `batchId`,
revise el error sanitizado y elimine el archivo local del operador. El backend descarta el binario
después del parsing. Ante sospecha cross-tenant, suspenda importaciones del tenant y revise
`grc_import_audit_events` sin copiar valores sensibles.
