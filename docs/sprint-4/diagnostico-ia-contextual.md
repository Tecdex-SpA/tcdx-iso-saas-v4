# Sprint 4.2 - IA contextual trazable para diagnostico fortalecido

## Objetivo

Agregar una capa de enriquecimiento IA sobre el diagnostico deterministico de Sprint 4.1.

La IA no reemplaza el calculo base. El estado de cobertura, evidencias existentes, evidencias candidatas, brechas y acciones se obtienen primero desde `diagnostic.service.js`. La IA solo enriquece redaccion, priorizacion, explicacion auditora y adaptacion contextual.

## Endpoint

### `POST /api/diagnostics/ai-contextual-recommendations`

Alias compatible:

- `POST /api/diagnostic/ai-contextual-recommendations`

Payload:

```json
{
  "standard_id": "uuid",
  "process_id": "uuid opcional",
  "operation_id": "uuid opcional",
  "control_id": "uuid opcional",
  "include_chunks": true,
  "max_chunks": 8,
  "mode": "diagnostic_enrichment"
}
```

Tambien acepta `standard_code` cuando no se envia `standard_id`.

Respuesta:

```json
{
  "ok": true,
  "data": {
    "standard_id": "uuid",
    "standard_code": "ISO9001",
    "process_id": "uuid opcional",
    "operation_id": "uuid opcional",
    "generated_at": "2026-06-08T00:00:00.000Z",
    "mode": "diagnostic_enrichment",
    "items": [
      {
        "control_id": "uuid",
        "catalog_control_id": "uuid",
        "control_code": "9.1.2",
        "control_name": "Satisfaccion del cliente",
        "process_id": "uuid",
        "process_name": "Atencion de Clientes",
        "operation_id": "uuid",
        "operation_name": "Gestion de reclamos",
        "deterministic_status": "missing_evidence",
        "ai_assessment": {
          "summary": "Resumen auditor trazable.",
          "gap_statement": "No existe evidencia suficiente de trazabilidad de atenciones, reclamos o incidentes de clientes.",
          "audit_relevance": "Permite demostrar satisfaccion del cliente, tratamiento de reclamos, control operacional y mejora continua.",
          "confidence": "high",
          "confidence_reason": "La confianza se basa en ausencia explicita de evidencias activas asociadas."
        },
        "recommended_evidence": [
          {
            "name": "Registro de atenciones de mesa de soporte",
            "purpose": "Trazar solicitudes desde apertura hasta cierre.",
            "recommended_formats": ["XLSX", "CSV exportado de sistema de tickets", "PDF"],
            "minimum_fields": ["ticket_id", "cliente", "fecha_apertura", "canal", "categoria", "severidad", "responsable", "sla_comprometido", "estado", "accion_realizada", "fecha_cierre", "feedback_cliente"],
            "frequency": "Registro continuo; revision mensual.",
            "owner_role": "Responsable de soporte / atencion al cliente.",
            "how_to_present": "Cargar exportacion mensual indicando periodo, responsable, fuente y fecha de generacion.",
            "iso_use": ["satisfaccion del cliente", "tratamiento de reclamos", "mejora continua"],
            "evidence_strength": "primary",
            "maturity_level": "intermediate"
          }
        ],
        "suggested_actions": [
          {
            "title": "Implementar o cargar Registro de atenciones de mesa de soporte",
            "description": "Cargar los ultimos 3 a 6 meses y asociarlos al control.",
            "priority": "high",
            "suggested_owner": "Responsable de soporte / atencion al cliente.",
            "suggested_due_days": 15,
            "human_review_required": true
          }
        ],
        "sources": [
          {
            "source_type": "absence",
            "source_id": null,
            "document_title": null,
            "chunk_id": null,
            "snippet": "",
            "reason": "No se encontraron documentos activos asociados ni chunks semanticos suficientes."
          }
        ],
        "human_review_required": true
      }
    ],
    "warnings": [],
    "metadata": {
      "deterministic_source": "diagnostic.service",
      "ai_engine_used": true,
      "ai_items_received": 1,
      "human_review_required": true,
      "persistence": "not_persisted",
      "ai_trace_exposed": false
    }
  }
}
```

## Implementacion

Servicio backend:

- `backend/src/services/diagnosticAi.service.js`

Responsabilidades:

- ejecuta `diagnosticService.buildDiagnostic`;
- selecciona controles relevantes, priorizando `missing_evidence`, `needs_review` y `partially_covered`;
- carga contexto organizacional desde `tenant_company_profiles` y `tenant_applicability_profiles` si existe;
- carga chunks desde `tenant_evidence_chunks` solo para fuentes del tenant;
- filtra documentos `excluded`, `deleted`, `ignored`, `missing` y `error`;
- construye payload seguro para `aiEngineClient.analyzeWithSeniorAuditor`;
- valida y normaliza respuesta;
- aplica fallback deterministico si IA no responde, responde mal o no cumple el contrato;
- no persiste recomendaciones.

No se modifico `ai-engine` en Sprint 4.2. Se reutiliza el endpoint existente:

- `/api/ai/senior-auditor/analyze`

## Reglas de IA

Prompt interno aplicado desde backend:

- eres auditor ISO senior;
- trabajas solo con el contexto entregado;
- no inventas documentos existentes;
- si no hay evidencia, declaras ausencia explicita;
- no certificas ni apruebas cumplimiento;
- no cierras brechas;
- no creas acciones formales;
- toda accion requiere revision humana;
- produces JSON valido;
- no expones trazas internas ni razonamiento privado.

## Fallback

Si IA Engine no esta disponible, devuelve JSON invalido, no respeta contrato o cae en fallback interno:

- se devuelven las recomendaciones de `evidenceRecommendationEngine.service.js`;
- se agrega warning `AI_ENRICHMENT_UNAVAILABLE` o `AI_RESPONSE_SCHEMA_FALLBACK`;
- no se bloquea el diagnostico;
- `human_review_required` permanece en `true`;
- `metadata.persistence` queda en `not_persisted`.

## Seguridad

- JWT y RBAC se aplican por middleware global.
- Roles tenant no pueden forzar otro `tenant_id`.
- `responsable_area`, `area_owner` y `operativo` heredan la visibilidad limitada de `diagnostic.service.js`.
- Dealer no accede al flujo cliente.
- No se envia a IA ningun token, credencial OAuth, `provider_file_id`, URL de archivo, hash, ruta local ni trace interno crudo.
- Chunks de documentos excluidos no se consultan ni se exponen.
- La salida visible muestra fuentes normalizadas: `document_index`, `evidence`, `chunk` o `absence`.

## Permisos

- `GET /api/diagnostics/*`: roles tenant de lectura.
- `POST /api/diagnostics/ai-contextual-recommendations`: admin, admin cumplimiento, auditor y roles operativos autorizados.
- Ejecutivo/viewer puede ver resumen deterministico, pero no ejecutar enriquecimiento IA contextual.

## Ejemplo curl

```bash
curl -sS -X POST "$BACKEND_URL/api/diagnostics/ai-contextual-recommendations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "standard_id": "'"$STANDARD_ID"'",
    "process_id": "'"$PROCESS_ID"'",
    "include_chunks": true,
    "max_chunks": 8,
    "mode": "diagnostic_enrichment"
  }' | jq
```

Por control puntual:

```bash
curl -sS -X POST "$BACKEND_URL/api/diagnostics/ai-contextual-recommendations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "standard_id": "'"$STANDARD_ID"'",
    "control_id": "'"$TENANT_CONTROL_ID"'",
    "include_chunks": true
  }' | jq
```

## Pruebas manuales

1. Autenticarse como admin cumplimiento o auditor.
2. Ejecutar `GET /api/diagnostics/standards`.
3. Ejecutar `GET /api/diagnostics/process-detail?standard_id=<id>&process_id=<id>`.
4. Ejecutar `POST /api/diagnostics/ai-contextual-recommendations`.
5. Confirmar que cada item incluye:
   - estado deterministico;
   - brecha o explicacion;
   - evidencia recomendada;
   - formatos;
   - campos minimos;
   - responsable sugerido;
   - frecuencia;
   - valor ISO;
   - accion sugerida;
   - fuentes o razon de ausencia;
   - `human_review_required: true`.
6. Probar con usuario ejecutivo/viewer y confirmar denegacion del `POST`.
7. Probar con usuario de otro tenant y confirmar `403`.
8. Excluir un documento en Biblioteca Documental y confirmar que sus chunks no aparecen.

## Criterios de aceptacion

- La IA parte del diagnostico deterministico y no recalcula cumplimiento desde cero.
- El endpoint responde aunque IA Engine no este disponible.
- No se crean brechas ni planes de accion.
- No se persisten recomendaciones.
- No se exponen traces internos del motor IA.
- No se usan documentos excluidos como evidencia activa ni como fuente de chunks.
- La salida declara ausencia explicita cuando no hay evidencia.

## Pendientes para 4.3

- UI en Cumplimiento y Auditoria.
- Botones de aceptacion humana para convertir sugerencia en brecha formal o plan de accion.
- Persistencia opcional de sugerencias revisables si se define tabla compatible.
- Pruebas E2E por rol con tokens reales del tenant demo.
