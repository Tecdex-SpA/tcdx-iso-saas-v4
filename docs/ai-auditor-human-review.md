# IA Auditor Senior — Revisión humana

## Objetivo

La Fase 3M permite marcar una ejecución histórica de IA Auditor como revisada por una persona.

Esto no crea ni modifica registros críticos de cumplimiento. Solo actualiza campos de gobernanza en `ai_auditor_runs`.

## Estados

- `pending`: pendiente.
- `reviewed`: revisado.
- `accepted`: aceptado.
- `rejected`: rechazado.
- `needs_more_evidence`: requiere más evidencia.

## Endpoint

`PATCH /api/ai-auditor/history/:id/review`

Body:

```json
{
  "review_status": "accepted",
  "comment": "Comentario de revisión humana"
}
```

## Seguridad

- Usa `tenant_id` desde JWT.
- No acepta `tenant_id` externo.
- Valida que la ejecución histórica pertenezca al tenant autenticado.
- No modifica controles, hallazgos, planes, evidencias ni no conformidades.
- La revisión humana no equivale a cierre formal de auditoría.

## Validación

El QA `scripts/qa-ai-auditor-full.sh` valida el endpoint de revisión y luego consulta el detalle histórico para confirmar persistencia.

## Uso en PDF ejecutivo

Desde Fase 3N, el PDF histórico de IA Auditor muestra el estado de revisión humana, comentario, revisor y fecha de revisión.

Esta información documenta gobernanza sobre el análisis IA, pero no representa aprobación automática de controles ni cierre formal de auditoría.
