# Sprint 3.5 - Normalizacion de estados en document_index

## Objetivo

Normalizar documentos activos que quedaron con `document_index.status = 'updated'`.

El estado visible de un documento/carpeta activo debe ser `indexed`. La operacion de sincronizacion se conserva en `metadata_json.last_sync_operation`.

## Migracion

Archivo:

```text
database/migrations/20260608_normalize_document_index_updated_status.sql
```

La migracion:

- convierte `status = 'updated'` a `status = 'indexed'`;
- conserva auditoria en `metadata_json`;
- no toca filas `excluded`;
- no borra documentos;
- no modifica conectores ni sincronizadores.

Campos agregados en metadata:

```json
{
  "last_sync_operation": "updated",
  "status_normalized_from": "updated",
  "status_normalized_at": "<timestamp DB>"
}
```

## Validacion DB

Antes:

```sql
SELECT provider, status, count(*) AS total
FROM document_index
WHERE provider IN ('google_drive','zoho_workdrive')
GROUP BY provider, status
ORDER BY provider, status;
```

Despues no deberian quedar filas activas con `status = 'updated'`:

```sql
SELECT count(*) AS updated_remaining
FROM document_index
WHERE status = 'updated';
```

Validar metadata en una muestra:

```sql
SELECT id, provider, status, metadata_json->>'status_normalized_from' AS normalized_from
FROM document_index
WHERE metadata_json->>'status_normalized_from' = 'updated'
LIMIT 20;
```

## Rollback

No se recomienda revertir datos normalizados salvo necesidad operativa. Si se requiere rollback de datos:

```sql
UPDATE document_index
SET status = 'updated'
WHERE metadata_json->>'status_normalized_from' = 'updated'
  AND status = 'indexed';
```

Ejecutar rollback solo con backup y aprobacion operativa.
