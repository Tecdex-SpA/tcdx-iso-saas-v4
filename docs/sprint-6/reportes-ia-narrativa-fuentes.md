# Sprint 6.2 - Narrativa IA operacional con fuentes

## Objetivo

Sprint 6.2 agrega narrativa operacional asistida por IA sobre los previews de Sprint 6.1. La narrativa usa solo el preview estructurado, fuentes autorizadas y datos internos ya expuestos por el contrato de reportes.

No genera PDF, no aprueba reportes, no certifica cumplimiento y no reemplaza la revision humana.

## Endpoint

### `POST /api/reports/narrative`

Genera una narrativa preliminar para una plantilla de reporte.

Request:

```json
{
  "template_code": "executive_compliance",
  "standard_id": "uuid opcional",
  "process_id": "uuid opcional",
  "period_from": "2026-01-01",
  "period_to": "2026-12-31",
  "include_sources": true,
  "include_sensitive_evidence": false,
  "sections": [
    "summary",
    "health",
    "kpis",
    "gaps",
    "actions",
    "risks",
    "evidence",
    "audit",
    "lifecycle"
  ],
  "narrative_style": "executive",
  "language": "es",
  "max_source_items": 20
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "template_code": "executive_compliance",
    "status": "narrative_preview",
    "requires_human_review": true,
    "ai_narrative_ready": true,
    "pdf_ready": false,
    "tenant": { "id": "...", "name": "..." },
    "filters": {
      "standard_id": null,
      "process_id": null,
      "period_from": "2026-01-01",
      "period_to": "2026-12-31",
      "narrative_style": "executive",
      "language": "es",
      "max_source_items": 20
    },
    "narrative": {
      "executive_summary": "...",
      "key_findings": [
        {
          "title": "...",
          "description": "...",
          "severity": "high",
          "source_refs": ["source_1"],
          "confidence": "high"
        }
      ],
      "health_interpretation": "...",
      "gaps_interpretation": "...",
      "risks_interpretation": "...",
      "evidence_interpretation": "...",
      "recommended_actions": [
        {
          "title": "...",
          "description": "...",
          "priority": "high",
          "source_refs": ["source_2"],
          "requires_human_review": true
        }
      ],
      "limitations": ["..."],
      "disclaimer": "Este analisis es asistido por IA y requiere revision humana. No constituye certificacion ni aprobacion automatica."
    },
    "sources": [],
    "source_map": {},
    "warnings": [],
    "fallback_used": false,
    "generated_at": "2026-06-09T00:00:00.000Z",
    "generated_by": "uuid"
  }
}
```

## Estilos narrativos

- `executive`: resumen sobrio para gerencia; foco en health, riesgos, brechas criticas y acciones prioritarias.
- `audit`: narrativa trazable; foco en controles, evidencias, hallazgos, no conformidades y fuentes.
- `operational`: foco en acciones, responsables, procesos, prioridades y cierre operativo.

Si `narrative_style` es invalido, el backend usa `executive` y agrega warning. Para roles ejecutivos se fuerza `executive`.

## Reglas de fuentes

- El endpoint llama primero a `reportBuilder.buildPreview`; no recalcula manualmente el preview.
- `tenant_id` nunca se acepta desde body; se resuelve desde JWT o query solo para roles de plataforma ya soportados por 6.1.
- La narrativa solo recibe fuentes ya autorizadas por el preview.
- `source_refs` apuntan a `source_map` (`source_1`, `source_2`, etc.), no a IDs externos.
- No se usa `provider_file_id` como ID interno ni se envia al IA Engine.
- No se envian chunks completos, prompts internos, traces, tokens, secretos ni URLs internas sensibles.
- Documentos `excluded`, `ignored`, `missing`, `deleted` o `error` no cuentan como cobertura activa. Si aparecen, quedan como `excluded_reference` o contexto no activo.
- Ejecutivo Cliente recibe fuentes resumidas por el filtro de preview 6.1.

## Fallback

Si IA Engine no responde, no esta configurado, esta deshabilitado por plan o devuelve una respuesta no usable, el endpoint mantiene `ok: true` y responde narrativa deterministica:

- `fallback_used: true`
- resumen basico sobre health, brechas, riesgos, acciones y evidencias;
- hallazgos derivados de las secciones del preview;
- acciones recomendadas con `requires_human_review: true`;
- limitacion explicita: `No fue posible generar narrativa IA. Se muestra narrativa deterministica basada en datos del reporte.`

Solo se devuelve error cuando el token, permisos, plantilla o filtros son invalidos.

## Permisos

El endpoint hereda RBAC de `POST /api/reports/preview`:

- Admin Cumplimiento/Admin/Tenant Admin: puede generar narrativa de reportes operativos.
- Auditor: puede generar narrativa de auditoria, controles, evidencias, brechas, riesgos y ciclo segun plantillas permitidas.
- Ejecutivo Cliente: puede `executive_compliance` y `system_health` resumidos; no recibe detalle sensible ni narrativa de auditoria detallada.
- Responsable Area: limitado por plantillas operativas y el alcance que soporte el modelo actual.
- Partner/Dealer: sin acceso al flujo interno del cliente.
- Superadmin/plataforma: separado del flujo demo cliente; solo usa tenant objetivo por los mecanismos ya soportados por 6.1.

## Criterios de aceptacion

- `POST /api/reports/narrative` existe.
- Reutiliza `reportBuilder.buildPreview`.
- Rechaza `tenant_id` en body.
- No persiste reportes finales.
- No genera PDF.
- No toca Google Drive, Zoho WorkDrive ni carga manual.
- No rompe Biblioteca Documental, Diagnostico Fortalecido, Health/KPIs ni Sprint 6.1.
- Las fuentes son las del preview autorizado.
- Cada hallazgo y accion incluye `source_refs` cuando hay fuentes disponibles.
- `requires_human_review` queda en `true`.
- `pdf_ready` queda en `false`.
- IA caida usa fallback y no produce 500.

## Ejemplos curl

```bash
curl -X POST https://<backend>/api/reports/narrative \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"template_code":"executive_compliance","include_sources":true,"narrative_style":"executive","language":"es"}'

curl -X POST https://<backend>/api/reports/narrative \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"template_code":"system_health","include_sources":true,"sections":["summary","health","kpis","actions"],"narrative_style":"executive"}'

curl -X POST https://<backend>/api/reports/narrative \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"template_code":"gaps_report","include_sources":true,"sections":["summary","gaps","actions","evidence"],"narrative_style":"audit"}'

curl -X POST https://<backend>/api/reports/narrative \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"template_code":"executive_compliance","tenant_id":"00000000-0000-0000-0000-000000000000"}'

curl -X POST https://<backend>/api/reports/narrative \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"template_code":"plantilla_inexistente"}'

curl -X POST https://<backend>/api/reports/narrative \
  -H "Content-Type: application/json" \
  -d '{"template_code":"executive_compliance"}'
```

## Riesgos pendientes

- El alcance granular de Responsable Area depende de datos/asignaciones existentes.
- El IA Engine actual puede devolver formatos parciales; el backend normaliza y completa con fallback deterministico.
- La narrativa no debe reutilizarse como reporte aprobado hasta que exista flujo de aprobacion humano.
- La UI premium, PDF, ZIP, firma y workflow documental quedan fuera de Sprint 6.2.

## Relacion con otros sprints

- Sprint 6.1: fuente obligatoria del preview y contrato de fuentes.
- Sprint 6.2A: fuera de alcance; no se implementa en este sprint.
- Sprint 6.3: UI/PDF premium quedan pendientes.
