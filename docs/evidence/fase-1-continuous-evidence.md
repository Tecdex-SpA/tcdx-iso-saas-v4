# Fase 1 - Evidencia continua

## Alcance

La vista `/evidencias` incorpora solicitudes únicas o recurrentes sin duplicar la biblioteca existente. Se registran propietario, revisor, aprobador, vencimiento, vigencia, requisitos asociados, entregas, versiones, revisiones y enlaces compartidos.

## Recurrencia

Frecuencias admitidas: diaria, semanal, mensual, trimestral, semestral, anual, personalizada y por evento. `schedule_id + occurrence_key` es único por tenant para que un reintento no duplique ocurrencias.

El scheduler procesa ocurrencias vencidas bajo lock tenant, marca solicitudes/aprobaciones expiradas y genera eventos de aviso/escalamiento según políticas, sin destinatarios ni plazos hardcodeados.

## Revisión

Estados: `draft`, `requested`, `submitted`, `under_review`, `approved`, `rejected`, `expired`, `cancelled`, `superseded`. Un rechazo requiere causa. La misma evidencia puede enlazarse a varios controles, requisitos, frameworks, auditorías y riesgos mediante `grc_evidence_links`.

## Calidad explicable

`evidence-quality-v1` pondera vigencia, aprobación, completitud, formato, fuente, integridad, responsable, consistencia y cobertura. El resultado conserva pesos, factores, contribuciones, fecha y limitaciones. No acredita conformidad y siempre requiere revisión humana.

## API

- `GET/POST /api/grc/evidence/requests`
- `POST /api/grc/evidence/submissions/:id/review`
- `POST /api/grc/evidence/:id/quality`
- `POST /api/grc/exports/evidence`
