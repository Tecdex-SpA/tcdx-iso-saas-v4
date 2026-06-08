# Sprint 3.5 - Exclusiones del indice documental

## Alcance

La Biblioteca Documental permite ocultar documentos o carpetas indexadas que no sirven para la revision actual sin borrar archivos del proveedor ni registros historicos.

El cambio aplica solo a `/evidencias` y a los endpoints de `evidence-library`. No modifica conectores, OAuth, sincronizadores, carga manual, analisis semantico ni asociaciones existentes.

## Modelo

La exclusion se registra en `tenant_document_index_exclusions` y se refleja en `document_index.status = 'excluded'`.

Estados visibles:

- `version=active`: muestra documentos activos; acepta `indexed` y `updated`, y oculta `excluded`.
- `version=excluded`: muestra solo elementos excluidos o con exclusion activa.
- `version=all`: muestra activos y excluidos.

`updated` se conserva como activo. No se normaliza en este sprint.

## Endpoints

Excluir item:

```http
POST /api/evidence-library/index/exclusions
```

```json
{
  "source_type": "document_index",
  "source_id": "<document_index_uuid>",
  "scope": "item",
  "reason": "not_useful",
  "notes": ""
}
```

Excluir carpeta y contenido indexado:

```json
{
  "source_type": "document_index",
  "source_id": "<document_index_uuid>",
  "scope": "subtree",
  "reason": "not_useful",
  "notes": ""
}
```

Restaurar:

```http
POST /api/evidence-library/index/restore
```

```json
{
  "source_type": "document_index",
  "source_id": "<document_index_uuid>",
  "restore_scope": "item"
}
```

Para carpetas:

```json
{
  "source_type": "document_index",
  "source_id": "<document_index_uuid>",
  "restore_scope": "subtree"
}
```

## Reglas

- No se acepta `tenant_id` desde frontend.
- El tenant se deriva del JWT/contexto autenticado.
- Solo se excluyen/restauran filas de `document_index` del tenant autenticado.
- No se borran archivos en Google Drive, Zoho WorkDrive ni carga manual.
- No se borran asociaciones historicas en `tenant_document_object_links`.
- No se borran perfiles semanticos, chunks ni sugerencias.
- Documentos excluidos no pueden analizarse ni asociarse hasta ser restaurados.

## Carpetas y subtree

Para `scope=subtree`, el backend busca descendientes por jerarquia indexada:

- Google Drive: metadata de padre y arreglo `parents`.
- Zoho WorkDrive: `metadata_json.zoho.parent_folder_id`.
- Metadatos genericos: `parent_folder_id`, `parent_id`, `source_folder_id`.
- Rutas relativas dentro de la misma fuente cuando existen.

Si no hay jerarquia exacta suficiente, se excluye solo el item seleccionado y se devuelve warning seguro.

## Rollback

Rollback de codigo:

```bash
git revert -m 1 <MERGE_COMMIT_HASH>
./scripts/deploy-vms.sh
```

La migracion es no destructiva. Si se aplico, se recomienda dejar la tabla/constraint sin uso tras rollback de codigo. No eliminar registros de exclusion sin backup y aprobacion.
