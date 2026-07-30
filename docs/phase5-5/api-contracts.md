# API Contracts

Estado global: NOT_READY. Ultima actualizacion: 2026-07-29T21:01:13Z.

## Contrato de salida oficial

Los endpoints oficiales devuelven como minimo:

```json
{
  "value": null,
  "unit": "%",
  "status": "completed",
  "formula_code": "F5_5_COMPLIANCE_WEIGHTED",
  "formula_version": 1,
  "period": {},
  "coverage": null,
  "trust_score": null,
  "trust_status": "unknown",
  "source_status": "available",
  "warnings": [],
  "calculation_run_id": "...",
  "explanation_url": "...",
  "lineage_url": "..."
}
```

## Endpoints Paquete 3

- `GET /api/grc/overview`: mantiene contrato legacy y agrega `official_calculations` sin eliminar campos existentes.
- `POST /api/grc/official/:metricKey`: calcula metricas oficiales focalizadas.
- `GET /api/grc/official/health/definitions`: expone definiciones versionadas de health.
- `GET /api/grc/official/calculations/:runId/explanation`: expone explicacion sanitizada del calculo oficial.
- `GET /api/grc/official/calculations/:runId/lineage`: expone lineage sanitizado del calculo oficial.

## Paquete 5

- `GET /api/grc/official/analytics/catalog`
- `GET /api/grc/official/analytics/health-catalog`
- `GET /api/grc/official/analytics/:resultCode`
- `POST /api/grc/official/analytics/:resultCode`

Dashboards y Report Studio consumen resultados oficiales y registran `calculation_consumers` para dashboard, report y export.

## Paquete 4 completed (2026-07-29T21:20:57Z)

Dominios integrados: encuestas, campanas, assurance, muestreo, perdidas, continuidad, activos y proveedores. Los servicios oficiales viven en `backend/src/services/math-governance/*Calculation.service.js`; `phase5Package4Jobs.service.js` define jobs tenant-scoped e idempotentes.

Validacion: `npm run phase5-5:package4-check` ejecuta integraciones por dominio, PostgreSQL efimero con runs/snapshots/lineage Tenant A/B, aislamiento conceptual y E2E tecnico basado en servicios.

## Endpoints Paquete 4

- `POST /api/grc/official/surveys/scoring`
- `POST /api/grc/official/surveys/campaign-analytics`
- `POST /api/grc/official/surveys/cronbach`
- `POST /api/grc/official/assurance/sample-size`
- `POST /api/grc/official/assurance/execution-score`
- `POST /api/grc/official/losses/net-loss`
- `POST /api/grc/official/losses/expected-loss`
- `POST /api/grc/official/losses/var`
- `POST /api/grc/official/losses/monte-carlo`
- `POST /api/grc/official/continuity/availability`
- `POST /api/grc/official/continuity/mtbf`
- `POST /api/grc/official/continuity/mttr`
- `POST /api/grc/official/continuity/sla`
- `POST /api/grc/official/continuity/rto-gap`
- `POST /api/grc/official/continuity/rpo-gap`
- `POST /api/grc/official/assets/criticality`
- `POST /api/grc/official/suppliers/risk`
- `GET /api/grc/official/package4/jobs`
- `POST /api/grc/official/package4/jobs/:jobKey`
