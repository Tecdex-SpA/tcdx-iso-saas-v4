# Mapeo ISO Controls a Catalogo Operativo

## Objetivo

La fase 1.2 conecta la base normativa versionada `iso_controls` con el catalogo operativo existente `controls_catalog`, usando `iso_control_catalog_links` como puente gobernado. El objetivo es medir cobertura, detectar brechas de mapeo y generar sugerencias conservadoras antes de usar la base ISO en diagnostico, IA Auditor o reportes.

## Que no se toca

Esta fase no modifica:

- `standards`
- `controls_catalog`
- `controls_catalog_standards`
- `tenant_standards`
- `tenant_controls`
- `evidences`
- `ai_knowledge_*`
- `report_*`
- `kpi_*`
- frontend
- ai-engine

Solo se escriben filas en `iso_control_catalog_links` y se actualiza `iso_catalog_sync_status`.

## Por que no se toca `controls_catalog`

`controls_catalog` sigue siendo el catalogo operativo usado por los modulos actuales. Cambiarlo ahora podria romper diagnostico, controles por tenant, evidencias, hallazgos o reportes existentes. `iso_controls` queda como fuente normativa versionada; el puente documenta equivalencias sin cambiar la operacion.

## `iso_control_catalog_links`

Esta tabla relaciona un control normativo versionado con un control operativo existente.

Campos clave:

- `iso_control_id`: control maestro versionado.
- `catalog_control_id`: control operativo actual.
- `standard_code` y `version_code`: trazabilidad normativa.
- `relationship_type`: `equivalent`, `partial`, `supports`, `related`, `transition` o `legacy_catalog`.
- `confidence`: nivel de confianza del mapeo.
- `mapping_source`: origen del mapeo.
- `notes`: razon y evidencia del mapeo.

## Vistas `v_iso_*`

La migracion `database/migrations/20260506_iso_control_catalog_mapping.sql` crea vistas de solo lectura:

- `v_iso_control_catalog_coverage`: cobertura por norma/version.
- `v_iso_controls_without_catalog_link`: controles ISO sin link operativo.
- `v_catalog_controls_without_iso_link`: controles operativos sin link ISO.
- `v_iso_catalog_sync_summary`: estado de sincronizacion y cobertura.

La API filtra controles de catalogo con `tenant_id IS NULL` para no exponer datos tenant-specific.

## Reglas de confianza

- `0.95`: coincidencia fuerte por norma, clausula/control y texto muy similar.
- `0.85`: coincidencia por norma, clausula y tema/categoria similar.
- `0.75`: coincidencia por norma y palabras clave relevantes.
- `< 0.75`: no se propone por defecto.

`can_auto_apply=true` solo cuando:

- `confidence >= 0.85`.
- No hay conflicto de link equivalente activo con otro control ISO.
- Para `ISO9001 / 2026_FDIS`, la relacion debe ser `transition`.

En la practica, `ISO9001 / 2026_FDIS` se limita a `confidence <= 0.80`, por lo que queda para revision humana y no se autoaplica.

## Regla especial ISO 9001:2026_FDIS

ISO9001 `2026_FDIS` sigue siendo preparacion de transicion:

- No es certificable.
- No reemplaza ISO9001:2015.
- No genera `tenant_standards`.
- No genera `tenant_controls`.
- Solo puede mapearse como `transition` o `related`.
- No debe usarse para auditoria de certificacion final.

## Aplicar migracion

```bash
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f database/migrations/20260506_iso_control_catalog_mapping.sql
```

## Aplicar seed inicial

```bash
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f database/seeds/20260506_seed_iso_control_catalog_links_initial.sql
```

El seed inserta solo mapeos conservadores si encuentra coincidencias por norma y palabras clave. Si no hay coincidencia clara, no inserta. ISO42001 puede quedar `needs_review` si no hay catalogo operativo suficiente.

## Permisos para backend

Si el backend usa `tecdex_user` y se usara el endpoint `POST /api/iso-control-mapping/apply-suggestions`, el usuario necesita permisos de escritura solo sobre tablas `iso_*`:

```bash
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT SELECT ON ALL TABLES IN SCHEMA public TO tecdex_user;"
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT INSERT, UPDATE ON iso_control_catalog_links, iso_catalog_sync_status TO tecdex_user;"
```

Si no se usara el POST, basta con `SELECT` para los endpoints de lectura y sugerencias.

## Revisar cobertura por SQL

```sql
SELECT *
FROM v_iso_control_catalog_coverage
ORDER BY standard_code, version_code;
```

```sql
SELECT standard_code, version_code, relationship_type, COUNT(*)
FROM iso_control_catalog_links
WHERE is_active IS DISTINCT FROM false
GROUP BY standard_code, version_code, relationship_type
ORDER BY standard_code, version_code, relationship_type;
```

```sql
SELECT standard_code, version_code, sync_target, sync_status, linked_controls_count, total_iso_controls_count
FROM iso_catalog_sync_status
WHERE sync_target = 'controls_catalog'
ORDER BY standard_code, version_code;
```

## Validar que no cambiaron tablas operativas

```sql
SELECT 'standards' AS table_name, COUNT(*) FROM standards
UNION ALL SELECT 'tenant_standards', COUNT(*) FROM tenant_standards
UNION ALL SELECT 'controls_catalog', COUNT(*) FROM controls_catalog
UNION ALL SELECT 'tenant_controls', COUNT(*) FROM tenant_controls
UNION ALL SELECT 'evidences', COUNT(*) FROM evidences;
```

Conteos esperados:

- `standards`: 26
- `tenant_standards`: 23
- `controls_catalog`: 3237
- `tenant_controls`: 1358
- `evidences`: 205

## Endpoints

Todos requieren JWT y RBAC:

- `GET /api/iso-control-mapping/coverage`
- `GET /api/iso-control-mapping/unlinked-iso-controls`
- `GET /api/iso-control-mapping/unlinked-catalog-controls`
- `GET /api/iso-control-mapping/catalog-links`
- `GET /api/iso-control-mapping/suggestions?standard_code=ISO9001&version_code=2015`
- `GET /api/iso-control-mapping/sync-status`
- `POST /api/iso-control-mapping/apply-suggestions`

El POST acepta:

```json
{
  "standard_code": "ISO9001",
  "version_code": "2015",
  "min_confidence": 0.85,
  "dry_run": true
}
```

`dry_run` es `true` por defecto. Con `dry_run=false` solo aplica sugerencias con `can_auto_apply=true`.

## Curls de validacion

```bash
export API="http://bk.tcdx.int:3000"
export TOKEN="PEGAR_TOKEN_VALIDO"

curl -s "$API/api/iso-control-mapping/coverage" \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s "$API/api/iso-control-mapping/suggestions?standard_code=ISO9001&version_code=2015" \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s "$API/api/iso-control-mapping/suggestions?standard_code=ISO27001&version_code=2022" \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s "$API/api/iso-control-mapping/suggestions?standard_code=ISO9001&version_code=2026_FDIS" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Script:

```bash
bash scripts/validate-iso-control-mapping.sh
```

## Como se evita doble fuente de verdad

- `iso_controls` define la fuente normativa versionada.
- `controls_catalog` conserva la fuente operativa actual.
- `iso_control_catalog_links` declara el vinculo y su confianza.
- `iso_catalog_sync_status` comunica si el mapeo esta parcial, completo o necesita revision.
- Ningun endpoint de esta fase inicializa controles tenant ni cambia evidencia.

## Uso futuro

En fases siguientes, diagnostico, IA Auditor y reportes podran:

1. Leer requisitos desde `iso_controls`.
2. Cruzar con `iso_control_catalog_links`.
3. Resolver estado operativo via `controls_catalog` y `tenant_controls`.
4. Evaluar evidencia por tenant sin mezclar datos.
5. Reportar brechas de cobertura normativa y operativa separadamente.

## Riesgos pendientes

- La calidad del mapeo depende del texto historico de `controls_catalog`.
- Puede haber controles operativos personalizados con `tenant_id`; la API los excluye.
- ISO42001 puede requerir catalogo operativo nuevo antes de uso comercial pleno.
- ISO9001 2026_FDIS debe mantenerse fuera de flujos de certificacion final.

## Aplicacion controlada de sugerencias

La fase 1.3 refuerza `POST /api/iso-control-mapping/apply-suggestions` para convertir candidatos confiables en links reales bajo gobierno. El endpoint ya existia desde la fase 1.2; ahora queda con resumen de aplicacion, bloqueo explicito de normas en revision y log de ejecucion.

Endpoint:

```bash
curl -s -X POST "$API/api/iso-control-mapping/apply-suggestions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"standard_code":"ISO9001","version_code":"2015","min_confidence":0.85,"dry_run":true}' | jq
```

Respuesta esperada:

```json
{
  "ok": true,
  "success": true,
  "dry_run": true,
  "standard_code": "ISO9001",
  "version_code": "2015",
  "min_confidence": 0.85,
  "summary": {
    "candidates_total": 0,
    "can_auto_apply": 0,
    "would_apply": 0,
    "applied": 0,
    "skipped": 0,
    "conflicts": 0
  },
  "items": []
}
```

### Dry-run vs apply real

`dry_run=true`:

- No escribe en `iso_control_catalog_links`.
- No actualiza `iso_catalog_sync_status`.
- Registra una fila liviana en `iso_control_mapping_apply_log` para trazabilidad.
- Devuelve cuantas sugerencias podria aplicar.

`dry_run=false`:

- Solo aplica sugerencias con `can_auto_apply=true`.
- Solo escribe en `iso_control_catalog_links`.
- Actualiza `iso_catalog_sync_status` para `sync_target='controls_catalog'`.
- Registra resultado en `iso_control_mapping_apply_log`.
- No toca tablas operativas ni datos de tenants.

### Roles necesarios

Los endpoints `GET` usan RBAC de lectura para usuarios autenticados con acceso API.

`POST /apply-suggestions` requiere rol administrador:

- `admin`
- `tenant_admin`
- roles plataforma equivalentes

La regla RBAC de `/api/iso-control-mapping` mantiene GET para lectura y POST para roles administrativos.

### Normas con autoaplicacion permitida

En esta fase solo se permite apply real para:

- `ISO9001 / 2015`
- `ISO27001 / 2022`

Condiciones:

- `confidence >= 0.85`
- `can_auto_apply=true`
- sin conflicto de `catalog_control_id` vinculado como `equivalent` a otro `iso_control_id`
- `relationship_type` permitido: `equivalent`, `partial`, `supports`, `related`, `legacy_catalog`

### Normas en revision

`ISO9001 / 2026_FDIS`:

- Solo dry-run.
- No se trata como certificable.
- No se aplica como `equivalent`.
- Cualquier mapeo futuro debe ser `transition` o `related` y con revision humana.

`ISO42001 / 2023`:

- Queda en revision.
- No se autoaplica en esta fase aunque existan candidatos.
- Requiere curaduria y posiblemente nuevos controles operativos.

## Cola de revision

```bash
curl -s "$API/api/iso-control-mapping/review-queue?min_confidence=0.75" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Parametros:

- `standard_code`
- `version_code`
- `min_confidence`
- `max_confidence`
- `include_auto_applicable=true|false`

Por defecto devuelve candidatos no autoaplicables o que requieren revision humana.

## Resumen de aplicacion

```bash
curl -s "$API/api/iso-control-mapping/application-summary" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Incluye:

- cobertura por norma/version;
- links por `relationship_type`;
- links por `mapping_source`;
- `sync_status`;
- controles ISO sin link;
- controles de catalogo global sin link;
- ultimas ejecuciones de apply/dry-run.

## Migracion de log

Aplicar:

```bash
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f database/migrations/20260506_iso_control_mapping_apply_log.sql
```

Permisos si el backend usa `tecdex_user`:

```bash
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT INSERT, UPDATE ON iso_control_catalog_links, iso_catalog_sync_status TO tecdex_user;"
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT SELECT, INSERT ON iso_control_mapping_apply_log TO tecdex_user;"
```

## Validacion fase 1.3

Dry-run:

```bash
export API="http://bk.tcdx.int:3000"
export TOKEN="TOKEN_VALIDO"
export APPLY_REAL="false"
export MIN_CONFIDENCE="0.85"

bash scripts/validate-iso-control-mapping.sh
```

Apply real controlado:

```bash
export APPLY_REAL="true"
bash scripts/validate-iso-control-mapping.sh
```

Con `APPLY_REAL=true`, el script solo aplica ISO9001:2015 e ISO27001:2022. No aplica ISO9001:2026_FDIS ni ISO42001.

## Rollback logico

No borrar links. Si un mapeo debe desactivarse:

```sql
UPDATE iso_control_catalog_links
SET is_active = false,
    updated_at = now(),
    notes = coalesce(notes, '') || ' | desactivado por revision humana'
WHERE id = 'UUID_DEL_LINK';
```

Esta operacion solo afecta tabla `iso_*` y conserva trazabilidad historica.
