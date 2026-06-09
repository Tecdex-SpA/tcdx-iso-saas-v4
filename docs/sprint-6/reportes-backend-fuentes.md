# Sprint 6.1 - Reportes backend con fuentes trazables

## Objetivo

Sprint 6.1 implementa la base backend para reportes de cumplimiento con preview JSON estructurado y fuentes internas trazables. No genera narrativa IA, no llama al IA Engine y no produce PDF premium final.

Los reportes generados quedan siempre como `status: preview`, con `requires_human_review: true`, `ai_narrative_ready: false` y `pdf_ready: false`.

## Alcance

- Catálogo de plantillas de reporte por rol.
- Preview estructurado por plantilla.
- Integración determinística con Health/KPIs de Sprint 5.
- Integración con diagnóstico determinístico de Sprint 4.
- Fuentes normalizadas desde controles, evidencias, documentos, brechas, acciones, riesgos, auditoría y ciclo ISO cuando existan datos.
- Filtros por norma, proceso/operación y periodo.
- Manejo de ausencia de datos con warnings, no error 500.

## Endpoints

### `GET /api/reports/templates`

Lista plantillas disponibles para el rol autenticado.

```json
{
  "ok": true,
  "data": [
    {
      "code": "executive_compliance",
      "name": "Reporte Ejecutivo de Cumplimiento",
      "description": "Resumen ejecutivo de health, brechas, riesgos, acciones y evidencias faltantes.",
      "allowed_roles": ["admin_cumplimiento", "admin", "tenant_admin", "auditor", "ejecutivo_cliente"],
      "supports_standard_filter": true,
      "supports_process_filter": true,
      "supports_period_filter": true,
      "requires_human_review": true,
      "output_modes": ["preview_json"],
      "planned_output_modes": ["pdf", "zip"]
    }
  ]
}
```

### `POST /api/reports/preview`

Genera preview bajo demanda. No persiste reporte, no llama IA y no genera PDF.

```json
{
  "template_code": "executive_compliance",
  "standard_id": "uuid opcional",
  "process_id": "uuid opcional",
  "operation_id": "uuid opcional",
  "period_from": "2026-01-01",
  "period_to": "2026-12-31",
  "include_sources": true,
  "include_sensitive_evidence": false,
  "sections": ["summary", "health", "kpis", "gaps", "actions", "risks", "evidence"]
}
```

Respuesta:

```json
{
  "ok": true,
  "data": {
    "report_id": null,
    "template_code": "executive_compliance",
    "status": "preview",
    "requires_human_review": true,
    "ai_narrative_ready": false,
    "pdf_ready": false,
    "tenant": { "id": "...", "name": "..." },
    "filters": {},
    "sections": [
      { "code": "summary", "title": "Resumen ejecutivo", "data": {} },
      { "code": "health", "title": "Salud del sistema", "data": {} }
    ],
    "sources": [],
    "warnings": [],
    "generated_at": "2026-06-09T00:00:00.000Z",
    "generated_by": "uuid"
  }
}
```

### `GET /api/reports/sources`

Retorna fuentes normalizadas según filtros. Es útil para preview de trazabilidad y para Sprint 6.2.

### `GET /api/reports/health`

Atajo para preview `system_health`.

## Plantillas

- `executive_compliance`: health global, normas activas, KPIs, brechas, acciones, riesgos, evidencias faltantes y disclaimer.
- `system_health`: fórmula, dimensiones, drivers, warnings, health por norma/proceso y KPIs HLT/KPI.
- `gaps_report`: brechas abiertas/críticas, evidencia faltante, estado, antigüedad y acciones relacionadas.
- `controls_report`: controles aplicables, cubiertos, parciales, sin evidencia, evidencia asociada y diagnóstico.
- `evidence_report`: evidencias activas, faltantes, sugeridas, asociaciones y origen documental.
- `risks_report`: riesgos por norma/proceso, criticidad, tratamiento, residual y acciones pendientes.
- `audit_report`: auditorías, hallazgos, evidencias revisadas, acciones y cierre cuando existan datos.
- `iso_lifecycle_report`: etapa, historial, aprobaciones/devoluciones, responsables, comentarios y fechas.
- `document_preparation_report`: documentos encontrados, sugeridos/faltantes y completitud documental.

## Contrato de fuente

```json
{
  "source_id": "uuid interno",
  "source_type": "document_index",
  "title": "Nombre visible",
  "provider": "google_drive",
  "status": "indexed",
  "related_standard_id": "...",
  "related_process_id": "...",
  "related_control_id": "...",
  "evidence_strength": "primary",
  "used_for": "coverage",
  "visibility": "operational",
  "reference": {
    "table": "document_index",
    "id": "uuid interno"
  }
}
```

Reglas:

- `source_id` es siempre un identificador interno; no se usa `provider_file_id`.
- Documentos `excluded`, `ignored`, `missing`, `deleted` o `error` no cuentan como cobertura.
- Documentos excluidos pueden aparecer solo como `used_for: excluded_reference` cuando el reporte y el rol lo permiten.
- No se exponen chunks completos ni traces IA.
- Ejecutivo recibe fuentes reducidas; roles operativos/auditor tienen trazabilidad más amplia.

## Permisos

- Admin Cumplimiento/Admin/Tenant Admin: acceso a plantillas operativas y fuentes.
- Auditor: acceso a reportes de auditoría, controles, evidencias, brechas, riesgos y ciclo.
- Ejecutivo Cliente: `executive_compliance` y `system_health`, con evidencia sensible reducida.
- Responsable Área: reportes operativos según RBAC actual; si no hay alcance granular, se documenta como limitación.
- Partner/Dealer: sin acceso al flujo de operación interna del cliente.

## Relación con Sprints 6.2 y 6.3

Sprint 6.2 podrá consumir el preview y `sources` para narrativa IA con fuentes. Sprint 6.3 podrá usar el mismo contrato para UI y PDF premium. Sprint 6.1 no aprueba, no certifica, no genera narrativa IA y no exporta PDF final.

## Pruebas curl

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  https://<backend>/api/reports/templates

curl -X POST https://<backend>/api/reports/preview \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"template_code":"executive_compliance","include_sources":true}'

curl -X POST https://<backend>/api/reports/preview \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"template_code":"system_health","include_sources":true}'

curl -X POST https://<backend>/api/reports/preview \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"template_code":"gaps_report","include_sources":true}'

curl https://<backend>/api/reports/sources \
  -H "Authorization: Bearer <TOKEN>"
```

Pruebas negativas:

- Sin token: debe responder 401 por middleware global.
- Rol sin permiso o partner/dealer: debe responder 403 o lista vacía en plantillas.
- `tenant_id` en body de preview: debe responder 400.
- `standard_id` o `process_id` inválido: debe responder 400/404 controlado.
- Sin datos: debe responder `ok: true` con `warnings`.

## Criterios de aceptación

- `GET /api/reports/templates` responde plantillas por rol.
- `POST /api/reports/preview` responde JSON estable por plantilla.
- Health/KPIs aparecen en preview.
- Brechas, controles, evidencias, riesgos, auditoría y lifecycle aparecen cuando existen datos.
- Fuentes normalizadas respetan tenant scope.
- Excluidos no cuentan como cobertura activa.
- No se llama IA.
- No se genera PDF premium final.
- Todos los reportes quedan con revisión humana requerida.

## Riesgos pendientes

- Alcance granular por área depende de la matriz RBAC/datos de asignación existente.
- La sección auditoría/lifecycle usa consultas defensivas y puede devolver warnings si faltan tablas o columnas.
- Sprint 6.2 debe diseñar la narrativa IA sin exponer prompts/traces y citando solo fuentes autorizadas.
- Sprint 6.3 debe implementar UI/PDF usando este contrato sin crear reportes finales automáticamente.
