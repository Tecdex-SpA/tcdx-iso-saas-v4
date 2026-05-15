# Preparación documental - formatos y versionado

## Objetivo

El módulo genera artefactos documentales reales para demo comercial controlada, manteniendo preview Markdown para revisión interna. La salida ya no depende únicamente de texto plano.

## Formatos soportados

| `output_format` | salida | motor |
| --- | --- | --- |
| `docx` | Documento Word OOXML básico con portada TCDX, metadatos, secciones y pendientes | generador OOXML interno |
| `xlsx` | Libro Excel con tabla documental o matriz | `xlsx` |
| `pptx` | Presentación OOXML básica para mapa/proceso o resumen | generador OOXML interno |
| `pdf` | PDF nativo con estilo corporativo sobrio | `pdfkit` |
| `md` | Markdown técnico o preview | texto interno |

Los archivos se guardan en `backend/uploads/audit-preparation-generated` y se descargan mediante endpoint autenticado:

```txt
GET /api/audit-preparation/documents/:documentId/download
```

## Versionado y aprobación

La migración `20260515_audit_preparation_formats_versioning.sql` agrega campos mínimos de control ISO:

- `version`
- `revision_number`
- `document_status`
- `prepared_by`
- `reviewed_by`
- `approved_by`
- `approved_at`
- `effective_from`
- `expires_at`
- `supersedes_document_id`
- `is_current`
- `approval_notes`
- `rejection_reason`
- `original_file_url`
- `generated_file_url`
- `file_hash`
- `source_trace_json`
- `change_summary_json`

Estados disponibles:

```txt
draft
imported
analyzed
generated
updated_from_platform
requires_validation
in_review
approved
rejected
obsolete
superseded
published
exported
```

## Preservación de originales

Si el ZIP subido contiene un documento que coincide con una plantilla, el sistema registra referencia al original y conserva el ZIP intacto.

Para DOCX existe una estrategia segura de preservación parcial:

- si el documento original contiene un marcador compatible (`{{TCDX_CONTENT}}`, `{{tcdx_content}}`, `{{contenido_tcdx}}`, `[TCDX_CONTENT]` o `[CONTENIDO_TCDX]`), el backend actualiza una copia DOCX reemplazando sólo el párrafo del marcador y mantiene el resto del paquete OOXML intacto;
- se conservan estilos, encabezados, pies, imágenes, numeración y tablas originales en la medida en que estén definidos fuera del marcador reemplazado;
- el archivo original del cliente no se sobrescribe;
- si no hay marcador compatible o no es técnicamente seguro modificar el DOCX, el sistema genera una copia TCDX nueva, registra la razón en `change_summary_json` y deja el documento en `requires_validation` cuando corresponde.

La UI muestra si la estrategia fue:

- `preserve_exact_with_markers`
- `preserve_original_attach_generated_annex`
- `generate_tcdx_new`

## Conversión DOCX a PDF

Cuando `AUDIT_DOCX_TO_PDF_ENABLED=true` y un template requiere PDF, el backend genera primero un DOCX fuente y luego intenta convertirlo con LibreOffice headless:

```bash
libreoffice --headless --convert-to pdf --outdir <output_dir> <input_docx>
```

Variables:

```env
AUDIT_DOCX_TO_PDF_ENABLED=false
LIBREOFFICE_BIN=/usr/bin/libreoffice
AUDIT_DOCX_TO_PDF_TIMEOUT_MS=60000
```

Paquetes Ubuntu:

```bash
sudo apt-get install -y libreoffice fonts-dejavu fonts-liberation
```

Si LibreOffice no está disponible, la generación no falla; se registra `pdf_conversion_error` y se usa PDF nativo TCDX como fallback.

## Export ZIP

El export incluye:

- documentos reales por carpeta documental;
- previews Markdown en `99_RESPALDO_GENERACIONES`;
- originales del cliente en `06_ORIGINALES_CLIENTE_NO_MODIFICADOS`;
- lista maestra documental XLSX;
- índice de evidencias;
- reporte de brechas;
- trazabilidad TCDX en JSON;
- README del paquete.

## Limitaciones técnicas

- El DOCX generado usa OOXML básico; no requiere LibreOffice.
- La conversión DOCX a PDF no se realiza automáticamente. Cuando se requiere PDF, se genera PDF nativo desde contenido estructurado.
- PPTX inicial es básico y apto para demo, no reemplaza diseño editorial completo.
- La preservación visual exacta del documento cliente fuera de marcadores compatibles requiere una fase posterior con plantillas DOCX marcadas o motor especializado.
