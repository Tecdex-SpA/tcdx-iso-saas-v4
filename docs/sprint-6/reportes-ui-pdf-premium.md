# Sprint 6.3 - Reportes Premium UI y PDF/ZIP revisable

## Objetivo

Sprint 6.3 implementa la experiencia visible de Reportes Premium y exportación revisable PDF/ZIP sobre los contratos de Sprint 6.1, 6.2 y 6.2A.

El flujo no aprueba reportes, no certifica cumplimiento y no reemplaza al auditor humano. Todo export exige confirmación explícita de revisión humana.

## Rutas frontend

- `/exportes`: se mantiene como vista existente de reportes/exportes.
- Se agrega una pestaña `Reportes Premium` dentro de la misma vista.
- No se crea módulo paralelo.

La pestaña permite:

1. seleccionar plantilla;
2. definir filtros de norma, proceso y periodo;
3. generar preview estructurado;
4. generar narrativa IA/fallback;
5. revisar fuentes trazables;
6. confirmar revisión humana;
7. exportar PDF o ZIP;
8. generar recomendación de alcance ISO 9001/27001.
9. revisar historial local de Reportes Premium exportados.

## Endpoints backend

Existentes consumidos:

- `GET /api/reports/templates`
- `POST /api/reports/preview`
- `POST /api/reports/narrative`
- `POST /api/iso-scope/recommendations`

Nuevos:

- `POST /api/reports/export/pdf`
- `POST /api/reports/export/zip`

## Request PDF/ZIP

```json
{
  "template_code": "executive_compliance",
  "standard_code": "ISO9001",
  "process_id": "uuid opcional",
  "period_from": "2026-01-01",
  "period_to": "2026-12-31",
  "include_sources": true,
  "include_narrative": true,
  "narrative_style": "executive",
  "language": "es",
  "review_confirmed": true
}
```

Reglas:

- `review_confirmed` debe ser `true`; si no, 400.
- `tenant_id` en body se rechaza con 400.
- `template_code` inválido se rechaza con 400.
- El tenant se resuelve desde JWT.
- Se reutiliza `reportBuilder.buildPreview`.
- Si `include_narrative` no es false, se reutiliza `reportAiNarrative.buildNarrative`.
- No se persiste como aprobado.
- El export queda como `generated_preview_export`.

## PDF

Motor usado:

- `backend/src/reports/services/htmlPdfRenderer.service.js`
- `puppeteer-core`, ya existente en backend.

El PDF incluye:

- portada;
- TCDX Compliance;
- tenant;
- plantilla;
- periodo;
- fecha de generación;
- estado `generated_preview_export`;
- revisión humana requerida;
- resumen/secciones del preview;
- métricas principales;
- narrativa si aplica;
- fuentes resumidas;
- warnings;
- disclaimer obligatorio.

Disclaimer:

> Este reporte es generado por TCDX Compliance como apoyo a la gestión. No constituye certificación, aprobación automática ni reemplaza la revisión de un auditor humano.

## ZIP

`POST /api/reports/export/zip` devuelve un ZIP on-demand con:

- PDF premium;
- `report_preview.json`;
- `report_sources.json`;
- `report_narrative.json` si aplica;
- `metadata.json`.

El ZIP se genera sin dependencia nueva.

## Fuentes

La UI muestra:

- `source_id` interno;
- `source_type`;
- título;
- estado;
- `used_for`;
- `visibility`;
- referencias `excluded_reference` marcadas.

No muestra `provider_file_id` como ID principal. No expone chunks completos, prompts internos, traces IA ni secretos.

## Fix cierre Sprint 6

El cierre comercial de Sprint 6 agrega dos mejoras de UX sobre `/exportes`:

1. historial visible de Reportes Premium;
2. preview estructurado visual, sin JSON crudo como vista principal.

### Historial de Reportes Premium

Implementación elegida:

- historial local en frontend con `localStorage`;
- clave separada por tenant/usuario a partir del JWT;
- sin persistir contenido de reportes;
- sin guardar tokens;
- sin guardar fuentes completas;
- sin guardar datos sensibles;
- sin crear migraciones.

Motivo:

- el backend premium exporta PDF/ZIP on-demand;
- existe `report_exports` para flujos legacy, pero el export premium no registra filas para evitar acoplarlo a FK/rutas históricas sin revisión de modelo;
- Sprint 6 no requiere persistencia global aprobada.

Cada export PDF/ZIP exitoso agrega una entrada con metadata mínima:

- fecha/hora;
- plantilla y `template_code`;
- formato PDF/ZIP;
- estado `generado`;
- usuario si está disponible en el token;
- periodo, norma y proceso si aplican;
- si incluyó narrativa;
- si incluyó fuentes;
- si la narrativa fue fallback;
- nombre del archivo descargado;
- badge de revisión humana confirmada.

El blob de descarga queda disponible solo mientras vive la sesión de navegador. Después de refrescar la página, el historial conserva la metadata, pero muestra:

> Disponible solo durante la sesión actual. Vuelva a exportar para descargar nuevamente.

### Preview visual sin JSON crudo

El preview de `POST /api/reports/preview` se renderiza en componentes visuales:

- resumen ejecutivo con tenant, periodo, plantilla, fecha, estado y revisión humana;
- tarjetas de métricas principales;
- health con score, estado, drivers y dimensiones si existen;
- KPIs en tabla;
- brechas en tabla/lista;
- acciones en tabla;
- riesgos en tabla;
- evidencias en tabla;
- controles en tabla;
- auditoría/lifecycle/preparación documental en listas legibles;
- fuentes en tabla trazable.

Si llega una estructura no mapeada, la UI usa un panel key-value limitado. Para roles Admin/Auditor se habilita `Ver detalle técnico sanitizado`, cerrado por defecto. Ese detalle elimina claves sensibles como `provider_file_id`, prompts, traces, chunks, textos completos, tokens, secretos y URLs internas.

## Revisión humana

La UI exige checkbox:

> Confirmo revisión humana

El backend exige:

```json
{ "review_confirmed": true }
```

Sin confirmación, no se genera PDF/ZIP.

## Permisos

Los endpoints nuevos quedan bajo `/api/reports`, con RBAC existente de reportes y validación interna de plantilla desde Sprint 6.1.

- Ejecutivo Cliente: plantillas ejecutivas/health disponibles según backend, sin fuentes sensibles.
- Admin Cumplimiento/Admin/Tenant Admin: reportes operativos y ejecutivos.
- Auditor: auditoría, controles, evidencias, brechas y ciclo según plantillas permitidas.
- Responsable Área: limitado por el modelo de alcance existente.
- Partner/Dealer: sin acceso a operación interna del cliente.
- Superadmin: flujo interno separado.

## Criterios de aceptación

- `/exportes` muestra `Reportes Premium`.
- Se listan plantillas desde `GET /api/reports/templates`.
- La UI genera preview 6.1.
- La UI genera narrativa 6.2.
- Se ven fuentes trazables.
- Se ve bloque de recomendación de alcance ISO.
- Se ve `Historial de Reportes Premium`.
- Cada export exitoso agrega metadata mínima al historial local.
- El preview se renderiza como tarjetas/tablas/listas.
- JSON técnico, si aparece, queda colapsado y sanitizado.
- PDF se exporta solo con revisión humana confirmada.
- ZIP incluye PDF y JSON de trazabilidad.
- PDF incluye disclaimer.
- No se exponen prompts/traces.
- No se usa `provider_file_id` como ID principal.
- No se modifica alcance ni aprobación final.
- No se rompe Sprint 6.1/6.2/6.2A.

## Pruebas manuales

Admin Cumplimiento:

1. Entrar a `/exportes`.
2. Abrir `Reportes Premium`.
3. Elegir `Reporte Ejecutivo de Cumplimiento`.
4. Generar preview.
5. Generar narrativa IA/fallback.
6. Revisar fuentes.
7. Confirmar revisión humana.
8. Exportar PDF.
9. Exportar ZIP.
10. Ver entradas en `Historial de Reportes Premium`.
11. Reintentar descarga desde historial durante la sesión.
12. Limpiar historial local.
13. Abrir PDF y validar portada, métricas, secciones, fuentes y disclaimer.

Auditor:

1. Elegir reporte de auditoría, controles o evidencias.
2. Generar preview/narrativa.
3. Validar trazabilidad.
4. Exportar si el rol lo permite.

Ejecutivo:

1. Validar que solo estén disponibles plantillas permitidas por backend.
2. Confirmar que no se exponen fuentes sensibles.

Recomendador de alcance:

1. ISO9001 debe orientar a calidad, cliente, procesos, proveedores y mejora.
2. ISO27001 debe orientar a seguridad, activos, accesos, continuidad e incidentes.

## Riesgos pendientes

- El render PDF depende de Chrome/Chromium no-Snap o `PUPPETEER_EXECUTABLE_PATH`.
- El endpoint export on-demand no registra historial en `report_exports` para evitar FK legacy y migraciones.
- El historial premium es local por tenant/usuario; no es auditoría persistente ni evidencia formal.
- La descarga desde historial solo funciona en la sesión que conserva el blob en memoria.
- El selector de proceso usa UUID opcional; un selector completo por proceso puede mejorarse sin bloquear el flujo 6.3.
- La revisión humana queda como confirmación de export, no como workflow formal de aprobación.
