# Fase 5 — Eventos de pérdida

`loss_events` conserva:

- código, tipo, fechas, causa e impacto;
- relación opcional con proceso, servicio, riesgo, proveedor, incidente, control, evidencia y acción;
- `gross_loss`, `recoveries`, `net_loss`, moneda y estado;
- auditoría por actor y timestamps.

Regla implementada:

`net_loss = gross_loss - recoveries`. La base rechaza pérdida neta negativa y el backend valida antes de escribir.
