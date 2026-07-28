# Fase 3 - Modelo operacional GRC

## Cadena principal

```text
Unidad -> Proceso -> Servicio -> Dependencia -> Riesgo -> Control -> Requisito
       -> Evidencia -> KPI/KRI -> BIA -> Plan -> Prueba -> Brecha -> Acción
       -> Efectividad -> Readiness
```

## Entidades nuevas

- `grc_organizational_units`
- `grc_operational_services`
- `grc_operational_dependencies`
- `grc_bia_assessments` y `grc_bia_impacts`
- `grc_continuity_plans` y `grc_continuity_tests`
- `grc_crisis_activations` y `grc_crisis_log`
- `grc_metric_definitions` y `grc_metric_measurements`
- `grc_quantitative_risk_assessments`
- `grc_phase3_state_history`
- `grc_phase3_readiness_impacts`

`tenant_processes` se extiende de forma aditiva. Riesgos, controles, requisitos,
evidencias, incidentes, proveedores, auditorías, hallazgos, no conformidades y acciones
siguen usando sus modelos comunes.

## Relaciones

Las relaciones GRC reutilizan `grc_phase2_relations`, con tipos explícitos ampliados.
Las dependencias operacionales usan `grc_operational_dependencies` porque requieren
criticidad, obligatoriedad, alternativa y tolerancia temporal propias.

## Versionado

BIA, planes, métricas y riesgo cuantitativo tienen versión, aprobación y estado. Las
transiciones se registran en historial y en el ledger de eventos.
