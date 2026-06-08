# Sprint 4.1 - Diagnostico fortalecido deterministico

## Objetivo

Implementar una primera fase backend para diagnostico fortalecido por norma activa, proceso u operacion, con calculo deterministico de cobertura y recomendaciones de evidencia contextualizadas.

Esta fase no usa IA para decidir cumplimiento. La salida es una sugerencia operativa y requiere revision humana.

## Alcance 4.1

- Lista normas activas del tenant disponibles para diagnostico.
- Calcula resumen por norma activa.
- Agrupa diagnostico por proceso cuando existe `tenant_operations.process_id` o asociaciones `tenant_process_entity_links`.
- Detalla controles por proceso u operacion.
- Detecta evidencias activas, evidencias candidatas, brechas abiertas y acciones abiertas.
- Excluye documentos con `document_index.status = excluded`, `deleted`, `ignored`, `missing` o `error` como cobertura activa.
- Genera recomendaciones deterministicas desde catalogo base de evidencias.
- No crea brechas formales ni planes de accion formales.
- No persiste sugerencias diagnosticas.
- No modifica Google, Zoho ni carga manual.

## Endpoints

Los endpoints se exponen bajo el alias nuevo `/api/diagnostics` y mantienen compatibilidad con el router historico `/api/diagnostic`.

### `GET /api/diagnostics/standards`

Lista normas activas disponibles para diagnostico del tenant autenticado.

Para roles plataforma puede aceptar `tenant_id` por query. Para roles tenant, el tenant se deriva del JWT.

### `GET /api/diagnostics/summary?standard_id=<id>`

Calcula resumen por norma activa.

Tambien acepta `standard_code=ISO9001` cuando no se envia UUID de `tenant_standards.id`.

Filtros soportados:

- `process_id`
- `operation_id`
- `area`
- `responsible_user_id`
- `evidence_status`: `covered`, `partially_covered`, `missing_evidence`, `needs_review`, `not_applicable`
- `gap_status`: `open`, `none`
- `action_status`: `open`, `none`
- `criticality`

### `GET /api/diagnostics/processes?standard_id=<id>`

Devuelve resumen agrupado por proceso. Si no existe capa de proceso para una operacion, agrupa por operacion como fallback no destructivo.

### `GET /api/diagnostics/process-detail?standard_id=<id>&process_id=<id>`

Devuelve controles evaluados, evidencias existentes, evidencias candidatas, brechas, acciones, trazabilidad documental y recomendaciones por proceso.

Tambien acepta `operation_id` para diagnostico por operacion.

### `POST /api/diagnostics/recommendations`

Genera recomendaciones deterministicas con estructura semantica.

Puede recibir un contexto libre:

```json
{
  "standard_code": "ISO9001",
  "clause": "9.1.2",
  "process": "Atencion de Clientes",
  "operation": "Gestion de reclamos",
  "control_description": "Tratamiento de reclamos y satisfaccion del cliente",
  "existing_evidences": []
}
```

O un control real:

```json
{
  "standard_id": "uuid-o-ISO9001",
  "control_id": "tenant_control_id",
  "process_id": "uuid-opcional",
  "operation_id": "uuid-opcional"
}
```

Respuesta base:

```json
{
  "gap_summary": "No existe trazabilidad suficiente para demostrar Atencion de clientes / incidentes / reclamos en Atencion de Clientes.",
  "recommended_evidence": [
    {
      "name": "Registro de atenciones de mesa de soporte",
      "purpose": "Trazar incidentes, reclamos o solicitudes de clientes desde apertura hasta cierre.",
      "recommended_format": ["XLSX", "CSV exportado de sistema de tickets", "PDF generado desde sistema de soporte"],
      "minimum_fields": ["ticket_id", "cliente", "fecha_apertura", "canal", "categoria", "severidad", "responsable", "sla_comprometido", "estado", "accion_realizada", "fecha_cierre", "resultado", "feedback_cliente"],
      "frequency": "Registro continuo; revision mensual.",
      "owner_role": "Responsable de soporte / atencion al cliente.",
      "iso_use": ["seguimiento de satisfaccion del cliente", "tratamiento de reclamos", "control operacional", "mejora continua"],
      "evidence_strength": "primary",
      "how_to_present": "Cargar el registro como XLSX, CSV o PDF consolidado por periodo, indicando responsable, fecha de generacion y fuente del sistema.",
      "suggested_action": "Implementar el registro mensual y cargar los ultimos 3 a 6 meses como evidencia.",
      "confidence": "high"
    }
  ],
  "governance_notice": "Salida deterministica de apoyo. No aprueba cumplimiento, no certifica y requiere revision humana."
}
```

## Permisos

RBAC global:

- `GET /api/diagnostics/*`: roles tenant de lectura, incluido ejecutivo/viewer.
- `POST /api/diagnostics/recommendations`: admin, admin cumplimiento, auditor y roles operativos autorizados.
- `POST` de aceptacion formal de brechas o acciones no se implementa en 4.1.

Reglas adicionales:

- `tenant_id` se deriva del JWT para roles tenant.
- Roles plataforma pueden consultar otro tenant con `tenant_id`.
- `responsable_area`, `area_owner` y `operativo` solo ven controles asignados por `tenant_controls.responsible_user_id`, `tenant_operations.owner_user_id` o `tenant_processes.owner_user_id` cuando esas columnas existen.
- `dealer` no tiene acceso al flujo de diagnostico cliente.

## Reglas deterministicas

Por cada control aplicable:

- `covered`: existe evidencia activa primaria y el control esta en estado de cumplimiento sin brecha abierta.
- `partially_covered`: existe evidencia activa o candidata, pero falta suficiencia, validacion o cierre completo.
- `missing_evidence`: no existe evidencia activa ni candidata suficiente.
- `needs_review`: hay evidencia candidata de baja confianza o estado pendiente que requiere revision humana.
- `not_applicable`: el control esta marcado explicitamente como no aplicable.

No cuentan como cobertura activa:

- `document_index.status` en `excluded`, `deleted`, `ignored`, `missing` o `error`.
- Evidencias con estado `deleted`, `rechazada` o `rejected`.
- Sugerencias semanticas no aceptadas como evidencia formal, aunque pueden elevar el estado a `partially_covered` o `needs_review`.

## Catalogo inicial

El catalogo base vive en `backend/src/services/evidenceRecommendationCatalog.js` e incluye:

- Atencion de clientes / incidentes / reclamos.
- Evaluacion de proveedores.
- Control documental.
- Capacitacion y competencia.
- Riesgos.
- Auditoria interna.
- No conformidades y acciones correctivas.
- Seguridad de informacion.
- IA / ISO 42001.

Cada recomendacion incluye nombre, proposito, formatos, campos minimos, frecuencia, responsable sugerido, uso ISO, fuerza de evidencia, madurez, forma de presentacion, accion sugerida, confianza y razon.

## Criterios de aceptacion 4.1

- Un tenant autenticado puede listar normas activas para diagnostico.
- El sistema calcula cobertura por norma activa sin crear registros nuevos.
- El sistema agrupa por proceso u operacion.
- Los controles sin evidencia quedan identificados.
- Las evidencias excluidas no cuentan como cobertura activa.
- Las recomendaciones explican que falta, por que falta, evidencia recomendada, formato, campos minimos, responsable, frecuencia, valor ISO y accion operacional.
- La salida incluye advertencia de revision humana.
- No se crean brechas ni planes de accion sin accion humana.
- No se expone informacion cross-tenant.

## Pruebas manuales sugeridas

1. Autenticarse como admin de tenant demo.
2. Ejecutar `GET /api/diagnostics/standards`.
3. Tomar una norma activa y ejecutar `GET /api/diagnostics/summary?standard_id=<id>`.
4. Ejecutar `GET /api/diagnostics/processes?standard_id=<id>`.
5. Elegir proceso u operacion y ejecutar `GET /api/diagnostics/process-detail?standard_id=<id>&process_id=<id>`.
6. Verificar que controles sin evidencia tengan recomendaciones concretas.
7. Excluir un documento en Biblioteca Documental y confirmar que no cuenta como cobertura activa.
8. Probar con usuario de otro tenant y confirmar `403`.
9. Probar `POST /api/diagnostics/recommendations` como ejecutivo y confirmar denegacion RBAC.
10. Probar responsable de area y confirmar que solo ve controles asignados.

## Riesgos y pendientes

- 4.2 debe incorporar IA contextual como enriquecimiento trazable, sin decidir cumplimiento.
- 4.3 debe agregar UI en Cumplimiento y Auditoria, aceptacion humana y conversion controlada a brecha o plan.
- La relacion proceso-control depende de datos de Sprint 2/3. Si un tenant no tiene `process_id` ni links operacionales, el fallback es agrupacion por operacion.
- La calidad de recomendaciones depende del texto de control, proceso, operacion y evidencia existente.
- Las pruebas cross-tenant completas requieren tokens reales por rol en ambiente demo.
