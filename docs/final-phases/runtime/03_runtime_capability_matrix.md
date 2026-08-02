# Matriz runtime de capabilities, entitlements y límites

La validación de rutas críticas aplica el contrato: autenticación + tenant + permiso + capability + entitlement + límite + vigencia. La autoridad permanece en backend; el frontend solo refleja el resultado de la autorización.

| Escenario | Evidencia local | Resultado |
| --- | --- | --- |
| Administrador Tenant A crea y publica métrica | Chromium, `/metricas`, `POST /api/metrics`, cálculo oficial | Permitido |
| Administrador Tenant A crea dashboard y snapshot | Chromium, `/bi`, `POST /api/dashboards`, snapshot | Permitido |
| Administrador Tenant A genera y aprueba reporte | Chromium, `/reportes/studio`, PDF/DOCX/XLSX | Permitido |
| Usuario restringido intenta persistir métrica | Chromium, `POST /api/metrics` | 403 |
| Tenant B lista métricas después de creación en A | Chromium, `GET /api/metrics` con `X-Tenant-Id` B | No contiene la métrica de A |
| Fórmula o fuente sin disponibilidad | contratos y source resolver 5.5 | `source_unavailable`, no cero artificial |

Los inventarios declarativos se regeneran desde rutas y consumidores mediante `scripts/phase5-c1/generate-runtime-inventory.js`. Las rutas fuera de la muestra crítica no se presentan como validadas por esta evidencia; se clasifican mediante el inventario y el plan 5-C11.
