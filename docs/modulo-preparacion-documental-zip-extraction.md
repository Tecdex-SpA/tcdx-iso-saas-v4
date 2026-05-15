# Preparación documental - extracción ZIP

## Objetivo

El endpoint `POST /api/audit-preparation/upload-zip` permite cargar un paquete documental existente y analizarlo sin modificar el archivo original.

## Seguridad

El backend valida:

- extensión `.zip`;
- MIME ZIP conocido o MIME vacío de navegador;
- tamaño máximo `AUDIT_PREPARATION_ZIP_MAX_BYTES` con default 50 MB;
- rutas internas inseguras (`..`, rutas absolutas o drive letters);
- tenant del paquete y usuario autenticado.

No se ejecutan macros ni archivos del ZIP.

## Extracción

El servicio `auditZipExtraction.service.js` lee el directorio central ZIP y extrae contenido soportado en memoria con límite por archivo.

Formatos analizados:

- DOCX: `mammoth`
- PDF: `pdf-parse`
- XLSX/XLS: `xlsx`
- PPTX: lectura básica de XML interno
- TXT/CSV/MD: texto plano

El análisis guarda en `audit_uploaded_zip_files.detected_structure_json`:

- `file_count`
- `folder_count`
- `folders`
- `detected_documents`
- `matched_templates`
- `unmatched_files`
- `duplicates`
- `conflicts`
- `warnings`

## Clasificación

Cada documento detectado puede incluir:

- tipo probable;
- vigencia probable;
- MIME detectado por extensión;
- `crc32` del registro ZIP y `sha256` cuando el contenido pudo extraerse de forma segura;
- versión o año detectado en nombre/texto cuando exista;
- parser usado;
- extracto textual;
- encabezados DOCX y tablas simples cuando el archivo lo permite;
- hojas, encabezados y primeras filas útiles para XLSX;
- texto de slides y notas básicas para PPTX;
- template sugerida;
- carpeta sugerida;
- warnings de extracción.

Categorías típicas:

- política;
- objetivos;
- alcance;
- contexto/FODA;
- partes interesadas;
- mapa de procesos;
- procedimiento;
- registro;
- matriz de riesgos;
- índice de evidencias;
- auditoría;
- revisión por la dirección;
- plantilla;
- histórico/obsoleto;
- desconocido.

## Conflictos detectados

El análisis registra conflictos razonables para revisión documental:

- duplicados por hash o por nombre normalizado;
- múltiples versiones probables del mismo documento;
- documentos sin versión explícita;
- documentos antiguos marcados como vigentes;
- documentos sin fecha, versión o vigencia confirmable;
- PDF textual insuficiente marcado como `pdf_scanned_or_low_text`.

## Limitaciones

- PDF escaneado sin OCR no produce texto útil.
- DOC binario antiguo no se analiza profundamente.
- PPTX se extrae por XML de slides, no por layout visual.
- El mapeo a plantillas es heurístico por nombre, carpeta y texto.
- El ZIP original se conserva intacto; los documentos actualizados se generan como nuevos artefactos TCDX.
