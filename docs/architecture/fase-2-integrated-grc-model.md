# Fase 2 — Modelo GRC integrado

## Núcleo compartido

La migración `20260727_phase2_integrated_grc.sql` agrega 44 tablas o
extensiones funcionales sobre los maestros existentes. Todas las entidades de
cliente llevan `tenant_id`; las relaciones estructurales usan FK y borrado
coherente.

La relación transversal `grc_phase2_relations` se usa únicamente cuando los
dominios no comparten una FK natural. Conserva origen, destino, tipo, estado,
vigencia, procedencia, confianza, creador, aprobador, versión y timestamps.
Antes de insertar, el servicio valida que ambos extremos existan en el mismo
tenant.

## Agregados

| Agregado | Raíz | Historia y dependencias |
|---|---|---|
| Tratamiento | `privacy_processing_activities` | versiones, encargados, DPIA, riesgos, consentimientos, solicitudes y brechas |
| Incidente | `grc_incidents` | historia, timeline, impactos, notificaciones, causas y postmortem |
| Proveedor | `grc_suppliers` | historia, servicios, contratos, evaluaciones, portal y controles de salida |
| Conector | `grc_connector_instances` | ejecuciones, registros normalizados, mappings y dead-letter |

## Cadena operativa

Los maestros de norma/requisito, proceso, activo, proveedor, riesgo, control,
evidencia, métrica, auditoría, hallazgo, no conformidad y remedial no se
duplican. `grc_domain_events`, `grc_rule_executions`,
`grc_operational_alerts`, `grc_metric_observations`,
`grc_control_assurance` y `grc_effectiveness_verifications` conectan la cadena
operacional y dejan explicación reproducible.

## Temporalidad y procedencia

- Actividades de tratamiento guardan snapshot por versión.
- Incidentes, proveedores y evaluaciones guardan historia de transición.
- Relaciones tienen vigencia y versión.
- Registros externos conservan proveedor, ID/versión externa, tiempo
  observado, hash de payload, envelope normalizado y procedencia.
- Métricas sin procedencia son rechazadas por constraint.
- Exportes conservan filtros, versión, fecha, hash y actor.
