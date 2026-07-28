# Fase 3 - Propagación de impacto

## Flujo

1. Una operación validada cambia una entidad.
2. La transacción registra auditoría y evento.
3. Las reglas determinísticas producen alertas, observaciones, assurance y readiness.
4. La vista 360 presenta relaciones, causa, valor anterior, valor nuevo y fecha.
5. El dashboard agrega brechas por unidad, proceso, servicio y continuidad.
6. El usuario autorizado decide si materializa hallazgo, no conformidad o acción.

## Explicabilidad

Cada impacto conserva:

- evento causal;
- entidad y tenant;
- dimensión;
- score anterior y nuevo;
- código de razón;
- explicación;
- responsable;
- fecha;
- estado activo o resuelto.

## Modelos comunes

La propagación usa `grc_control_assurance`, `grc_metric_observations`,
`grc_operational_alerts`, `grc_phase2_relations` y el ledger existente. No se crean
copias de riesgos, controles, evidencias, hallazgos, no conformidades o acciones.
