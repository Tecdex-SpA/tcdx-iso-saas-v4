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
export API="http://192.168.100.120:3000"
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
