# Continuity Methodologies

Estado: Paquete 4 completed.

## Formulas

- Availability = `(TotalTime - Downtime) / TotalTime * 100`.
- Availability alternativa = `MTBF / (MTBF + MTTR) * 100`.
- MTBF = OperatingTime / Failures.
- MTTR = sum(RepairTime) / Incidents.
- SLA = CasesWithinSLA / ApplicableCases * 100.
- RTO/RPO gap = actual - objetivo.

## Reglas

- Unidades declaradas en horas salvo contrato especifico.
- Downtime, MTBF y MTTR negativos se rechazan.
- RTO/RPO no se mezclan sin unidad.
