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
- parser usado;
- extracto textual;
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
- desconocido.

## Limitaciones

- PDF escaneado sin OCR no produce texto útil.
- DOC binario antiguo no se analiza profundamente.
- PPTX se extrae por XML de slides, no por layout visual.
- El mapeo a plantillas es heurístico por nombre, carpeta y texto.
- El ZIP original se conserva intacto; los documentos actualizados se generan como nuevos artefactos TCDX.
