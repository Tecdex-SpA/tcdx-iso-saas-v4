# Fase 5 — Lineage e Impact Graph

`data_lineage_edges` registra relaciones tenant-scoped:

- `derived_from`
- `measured_from`
- `validated_by`
- `supported_by`
- `affects`
- `aggregates`
- `reported_in`
- `snapshot_of`

Endpoints:

- `GET /api/data/lineage/:entityType/:entityId`
- `GET /api/data/impact/:entityType/:entityId`

La navegación usa CTE recursiva limitada a profundidad 5 para evitar ciclos infinitos. No se introduce base de grafos adicional.
