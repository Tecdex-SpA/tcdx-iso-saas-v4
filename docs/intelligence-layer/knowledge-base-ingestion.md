# Knowledge Base v2 - Ingestion

## Conversion Markdown a JSONL

Comando:

```bash
node backend/scripts/convert-knowledge-md-to-jsonl.js
```

Entrada:

```text
database/seeds/knowledge/base_conocimiento_iso_grc_ia_tcdx_1000_registros.md
```

Salidas:

```text
database/seeds/knowledge/knowledge_base_seed_v2.jsonl
database/seeds/knowledge/knowledge_base_seed_v2.summary.json
```

Validaciones del conversor:

- Parseo por tabla Markdown y encabezados.
- Falla si hay menos de 950 registros validos.
- Advierte si el total es distinto de 1000.
- Valida `license_class`.
- Rechaza HTML/script.
- Rechaza filas sin `item_key`, `intent_summary`, `evidence_expectation`, `audit_question`, `common_gap`, `recommended_action` o `use_in_system`.
- Genera resumen por familia, estandar, severidad y licencia.

## Carga a PostgreSQL

Comando:

```bash
node backend/scripts/load-knowledge-base-seed.js
```

La carga es idempotente por `item_key`.

Comportamiento:

- Upsert de `knowledge_sources`.
- Upsert de `knowledge_items`.
- Reemplazo controlado de tablas hijas por `item_key`.
- Registro de `knowledge_import_runs`.
- Separacion entre KB global y datos tenant.

## Orden esperado

1. Aplicar migracion `20260707_knowledge_base_v2_intelligence_layer.sql`.
2. Ejecutar conversor.
3. Ejecutar loader.
4. Verificar `knowledge_import_runs.status = success`.
5. Probar `GET /api/knowledge-base/search`.
6. Probar `GET /api/intelligence/brief/:tenantId` con JWT del tenant correcto.

## Degradacion segura

Si las tablas no existen o la KB no esta cargada, los servicios no deben inventar conclusiones. El brief responde con baja confianza, warnings y `knowledge_context.total_available_items = 0`.
