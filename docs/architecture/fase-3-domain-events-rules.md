# Fase 3 - Eventos y reglas

## Ledger

Los eventos se registran en `grc_domain_events` con tenant, aggregate, versión,
correlation ID, idempotency key, actor y provenance. Las reglas ejecutadas quedan en
`grc_rule_executions`.

## Reglas determinísticas principales

| Evento | Consecuencia |
|---|---|
| Proceso crítico sin BIA | Alerta crítica, KRI, degradación readiness y recomendación |
| BIA aprobado | Mejora explicable de readiness y KPI |
| BIA vencido | Alerta, KRI, degradación y recomendación |
| Plan vencido | Alerta, degradación, assurance de control si está relacionado |
| Prueba fallida | Alerta crítica, KRI, degradación y acciones recomendadas |
| RTO/RPO incumplido | Alerta crítica, métrica y degradación |
| KPI/KRI en umbral | Alerta; el crítico degrada readiness |
| Dependencia crítica de proveedor | Alerta, KRI y cambio de readiness |
| Riesgo cuantitativo aprobado | Observación de exposición anualizada |

Las recomendaciones no crean automáticamente hallazgos, no conformidades ni acciones.
La materialización exige permiso y revisión humana en los flujos comunes.

## Idempotencia

Códigos raíz, relaciones, dependencias y mediciones usan claves únicas tenant-scoped.
Actualizaciones y transiciones consultan primero el ledger por idempotency key; un
reintento devuelve el evento existente sin crear una nueva versión, historial ni
efectos duplicados.
