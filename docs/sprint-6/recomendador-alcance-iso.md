# Sprint 6.2A - Recomendador de alcance ISO

## Objetivo

Sprint 6.2A agrega un recomendador backend para evaluar qué procesos, operaciones o áreas deberían considerarse dentro del alcance de ISO 9001 o ISO/IEC 27001.

La salida es un preview operativo. No modifica alcance real, normas contratadas, lifecycle, certificaciones ni procesos certificados.

## Alcance del sistema de gestión

El endpoint no dice que un proceso se certifica de forma aislada. La formulación funcional es:

> La certificación aplica al sistema de gestión definido en un alcance. Según el contexto disponible, estos procesos, operaciones o áreas se recomiendan para evaluar su inclusión en el alcance.

Toda recomendación requiere revisión humana por la organización y/o auditor competente.

## Endpoint

### `POST /api/iso-scope/recommendations`

Request ISO 9001:

```json
{
  "standard_code": "ISO9001",
  "standard_id": "uuid opcional",
  "process_id": "uuid opcional",
  "include_ai": true,
  "include_sources": true,
  "mode": "scope_recommendation"
}
```

Request ISO 27001:

```json
{
  "standard_code": "ISO27001",
  "include_ai": false,
  "include_sources": true,
  "mode": "scope_recommendation"
}
```

`standard_code` se normaliza desde estas variantes iniciales:

- `ISO9001`, `ISO_9001`, `ISO 9001`
- `ISO27001`, `ISO_27001`, `ISO 27001`

`tenant_id` en body se rechaza siempre con 400. El tenant se resuelve desde JWT; para roles de plataforma se puede usar query `tenant_id` siguiendo el patrón existente.

## Response

```json
{
  "ok": true,
  "data": {
    "standard": {
      "code": "ISO27001",
      "name": "ISO/IEC 27001",
      "focus": "Sistema de gestión de seguridad de la información"
    },
    "status": "scope_recommendation_preview",
    "requires_human_review": true,
    "decision_ready": false,
    "generated_at": "2026-06-09T00:00:00.000Z",
    "generated_by": "uuid",
    "guidance": "La certificación aplica al sistema de gestión definido en un alcance...",
    "recommendations": [
      {
        "scope_item_type": "area",
        "scope_item_id": null,
        "name": "Infraestructura TI",
        "priority": "high",
        "confidence": "high",
        "recommendation": "Evaluar inclusión dentro del alcance ISO 27001.",
        "reason": "Administra activos críticos, respaldos, accesos, disponibilidad y continuidad operacional.",
        "recommended_processes": [
          "Gestión de accesos e identidades",
          "Gestión de incidentes de seguridad"
        ],
        "evidence_needed": [
          "Inventario de activos de información",
          "Registro de accesos, altas, bajas y privilegios"
        ],
        "risk_if_excluded": "El alcance podría omitir activos, accesos, servicios críticos o riesgos que afectan confidencialidad, integridad y disponibilidad.",
        "related_risks": [],
        "related_evidence": [],
        "source_refs": ["source_1", "source_2"]
      }
    ],
    "not_recommended_or_low_priority": [
      {
        "scope_item_type": "process",
        "scope_item_id": "uuid",
        "name": "Proceso administrativo no crítico",
        "reason": "No se observaron señales fuertes; mantener como evaluación de baja prioridad si el alcance formal lo requiere.",
        "confidence": "medium"
      }
    ],
    "sources": [],
    "source_map": {},
    "warnings": [],
    "limitations": [],
    "fallback_used": false,
    "ai_used": false,
    "disclaimer": "Esta recomendación no define automáticamente el alcance de certificación. Debe ser revisada por la organización y el auditor."
  }
}
```

## Reglas ISO 9001

ISO 9001 prioriza calidad, satisfacción del cliente, procesos, productos/servicios, proveedores, no conformidades, competencias, control documental, indicadores y mejora continua.

El motor eleva prioridad cuando detecta:

- impacto directo en cliente, atención, soporte, reclamos o satisfacción;
- entrega de producto/servicio, operaciones, producción, implementación o proyectos;
- compras, proveedores o servicios externos que afectan calidad;
- control de calidad, no conformidades, acciones correctivas y cambios;
- capacitación, competencia, objetivos de calidad e indicadores;
- health bajo, brechas, acciones vencidas o evidencia faltante en el proceso.

No trata como núcleo ISO 9001:

- SoA como documento central;
- vulnerabilidades o controles técnicos de seguridad, salvo impacto en calidad del servicio;
- enfoque puramente tecnológico sin relación con requisitos de cliente/calidad.

## Reglas ISO 27001

ISO/IEC 27001 prioriza seguridad de la información, confidencialidad, integridad, disponibilidad, activos, riesgos, controles, accesos, incidentes, continuidad y proveedores tecnológicos.

El motor eleva prioridad cuando detecta:

- activos de información críticos o datos sensibles;
- infraestructura TI, sistemas, cloud, software o desarrollo;
- soporte con acceso a información de clientes;
- administración de usuarios, accesos y privilegios;
- incidentes, vulnerabilidades, monitoreo/logs o cambios TI;
- continuidad operacional, respaldos y restauración;
- riesgos de seguridad altos/críticos o tratamientos pendientes.

No trata como núcleo ISO 27001:

- satisfacción de clientes como eje central;
- reclamos comerciales salvo entrada de incidente o impacto de seguridad;
- evaluación de proveedores genérica sin foco en seguridad.

## Fuentes

El servicio usa contexto tenant-scoped:

- `tenant_processes` y `tenant_operations`;
- áreas inferidas desde procesos/operaciones;
- `assets` y `asset_risks` cuando existen;
- `iso_risk_matrix_items`;
- incidentes si existe tabla `security_incidents` o `incidents`;
- health por norma/proceso;
- diagnóstico fortalecido;
- fuentes normalizadas desde `reportSources.service.js`.

Reglas:

- No se usa `provider_file_id` como identificador interno.
- No se incluyen fuentes de otro tenant.
- Documentos `excluded`, `ignored`, `missing`, `deleted` o `error` no cuentan como evidencia activa.
- Si una fuente excluida aparece por contexto, queda como `excluded_reference`.
- No se exponen chunks completos, prompts internos, traces IA, secretos ni URLs internas sensibles.
- Cada recomendación intenta incluir `source_refs` hacia `source_map`.

## IA opcional

`include_ai=false` usa solo reglas determinísticas.

`include_ai=true` llama IA Engine con payload sanitizado y fuentes autorizadas para mejorar razonamiento/redacción. La IA no decide alcance final. Si IA falla, no está configurada o devuelve salida no usable, el backend responde `ok: true` con fallback determinístico:

- `fallback_used: true`
- `ai_used: false`
- `requires_human_review: true`
- `decision_ready: false`

## Permisos

- Admin Cumplimiento/Admin/Tenant Admin: puede generar recomendaciones.
- Auditor: puede generar y revisar recomendaciones.
- Ejecutivo Cliente: puede recibir salida orientativa, sin aprobar ni modificar alcance.
- Responsable Área: salida limitada por el alcance de datos disponible; si no hay asignación granular se devuelve warning.
- Partner/Dealer: sin acceso al flujo interno del cliente.
- Superadmin/plataforma: acceso separado para operación interna, usando tenant objetivo por query si aplica.

## Pruebas curl

```bash
curl -X POST https://<backend>/api/iso-scope/recommendations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"standard_code":"ISO9001","include_ai":false,"include_sources":true,"mode":"scope_recommendation"}'

curl -X POST https://<backend>/api/iso-scope/recommendations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"standard_code":"ISO27001","include_ai":false,"include_sources":true,"mode":"scope_recommendation"}'

curl -X POST https://<backend>/api/iso-scope/recommendations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"standard_code":"ISO9001","include_ai":true,"include_sources":true}'

curl -X POST https://<backend>/api/iso-scope/recommendations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"standard_code":"ISO27001","tenant_id":"00000000-0000-0000-0000-000000000000"}'

curl -X POST https://<backend>/api/iso-scope/recommendations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"standard_code":"ISO14001"}'

curl -X POST https://<backend>/api/iso-scope/recommendations \
  -H "Content-Type: application/json" \
  -d '{"standard_code":"ISO9001"}'
```

## Criterios de aceptación

- Existe `POST /api/iso-scope/recommendations`.
- ISO 9001 recomienda alcance con foco en calidad, cliente, procesos, proveedores, no conformidades y mejora.
- ISO 27001 recomienda alcance con foco en seguridad, activos, riesgos, accesos, continuidad e incidentes.
- Cada recomendación incluye razón, prioridad, evidencia necesaria y riesgo de exclusión.
- La respuesta aclara que no define alcance automáticamente.
- `requires_human_review = true`.
- `decision_ready = false`.
- `tenant_id` en body se rechaza con 400.
- `standard_code` inválido se controla con 400.
- Sin token responde 401 por middleware global.
- IA caída no rompe el endpoint; usa fallback determinístico.
- No rompe Sprint 6.1, 6.2, Health/KPIs ni Diagnóstico Fortalecido.

## Riesgos pendientes

- Alcance granular por responsable de área depende de asignaciones existentes en procesos/operaciones/controles.
- Si el tenant no tiene procesos, operaciones o activos cargados, la confianza será baja.
- La IA Engine puede devolver formatos parciales; el backend solo acepta salida usable y mantiene fallback.
- Persistir decisión, aprobación, PDF, UI premium o workflow documental queda fuera de Sprint 6.2A.
