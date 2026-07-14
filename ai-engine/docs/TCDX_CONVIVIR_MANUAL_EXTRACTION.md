# TCDX Convivir - Extracción de RICE / Reglamento Interno / Manual de Convivencia

## Endpoint recomendado

`POST /api/convivencia/manual/extract-parameters`

Este endpoint es aditivo y especializado para TCDX Convivir. No reemplaza ni altera:

- `GET /health`
- `POST /api/ai/suggest/executive-brief`
- `POST /api/evidences/process`

En TCDX Convivir configurar:

```env
AI_ENGINE_EXTRACT_PATH=/api/convivencia/manual/extract-parameters
```

## Autenticación

Usa el mismo token interno del AI Engine:

- `x-ai-token: $AI_INTERNAL_TOKEN`
- `x-internal-token: $AI_INTERNAL_TOKEN`

No se debe registrar ni exponer el token. Si falta o es inválido, el endpoint responde `401`. Si el AI Engine no tiene token configurado, responde `503`.

## Variables

```env
AI_INTERNAL_TOKEN=<token interno compartido>
AI_ENGINE_DEBUG_SHAPE=false
```

`AI_ENGINE_DEBUG_SHAPE=true` activa logs seguros de forma de respuesta: keys top-level, `raw_text_length`, `pages_processed`, `truncated`, `has_parameters` y conteos de faltas, medidas y protocolos. No registra token, base64 ni texto completo del documento.

Variables opcionales de límite:

- `AI_CONVIVENCIA_MAX_FILE_BYTES`: default 30 MB.
- `AI_CONVIVENCIA_MAX_PDF_PAGES`: default 250 páginas.
- `AI_CONVIVENCIA_MAX_RAW_TEXT_CHARS`: default 260000 caracteres.
- `AI_CONVIVENCIA_MAX_LLM_CONTEXT_CHARS`: default 60000 caracteres.
- `AI_CONVIVENCIA_USE_LLM`: default `true`.

## Payload compatible

```json
{
  "job_type": "extract_convivencia_manual_parameters",
  "payload_version": 1,
  "request_meta": {
    "tenantId": "...",
    "establishmentId": "...",
    "language": "es-CL",
    "product": "tcdx-convivir"
  },
  "evidence": {
    "file_name": "manual.pdf",
    "file_mime_type": "application/pdf",
    "file_size_bytes": 123,
    "file_content_base64": "...",
    "file_content_encoding": "base64",
    "description": "Manual de convivencia escolar existente para extraer parámetros institucionales revisables."
  },
  "control": {
    "code": "manual_convivencia",
    "title": "Manual de convivencia escolar"
  },
  "operation": {
    "purpose": "extract_parameters",
    "expected_output": "structured_convivencia_parameters_json",
    "do_not_summarize": true,
    "requires_human_review": true
  },
  "extraction_schema": {},
  "classification_rules": {},
  "safety_rules": {}
}
```

## Respuesta exitosa

La respuesta exitosa siempre incluye `status: "ok"`, `parameters`, `confidence`, `warnings` y `extraction`.

`parameters` contiene:

- `source`
- `establishment`
- `vision`
- `mission`
- `enfoqueConvivencia`
- `principiosFormativos`
- `governance`
- `policyAreas`
- `misconductTypes`
- `measures`
- `procedures`
- `dueProcess`
- `attenuatingFactors`
- `aggravatingFactors`
- `protocols`
- `aulaSegura`
- `systemBehavior`
- `warnings`

Reglas de seguridad aplicadas por el AI Engine:

- `source.requiresHumanReview=true`
- `aulaSegura.automaticApplicationAllowed=false`
- `aulaSegura.requiresHumanDecision=true`
- `aulaSegura.requiresDueProcess=true`
- `systemBehavior.mustSuggestNotApply=true`
- `systemBehavior.mustNotClaimLegalCompliance=true`

El endpoint no devuelve `raw_text` completo en la respuesta. Solo informa la forma de extracción:

```json
{
  "extraction": {
    "raw_text_length": 12345,
    "pages_processed": 181,
    "truncated": false,
    "extraction_status": "ok"
  }
}
```

## Errores estructurados

Si no se extrae texto suficiente o no se alcanzan familias estructurales mínimas, responde `422` con:

```json
{
  "status": "error",
  "error": "structured_parameters_not_extracted",
  "message": "No se pudieron extraer parámetros de convivencia suficientes.",
  "extraction": {
    "raw_text_length": 1234,
    "pages_processed": 3,
    "truncated": true,
    "extraction_status": "partial"
  },
  "warnings": []
}
```

## PDF/DOCX

PDF:

- Decodifica `file_content_base64`.
- Valida cabecera `%PDF-`.
- Extrae texto con `pypdf`.
- Procesa hasta `AI_CONVIVENCIA_MAX_PDF_PAGES` páginas.
- Marca `truncated=true` si supera páginas o caracteres permitidos.

DOCX:

- Decodifica `file_content_base64`.
- Valida estructura ZIP (`PK`).
- Lee `word/document.xml` con librerías estándar de Python.
- Extrae texto de párrafos sin depender de OCR.

Texto plano:

- Se acepta para checks y fixtures sintéticos no sensibles.
- Producción debe preferir PDF/DOCX enviados por TCDX Convivir.

## Documentos largos

El extractor procesa el texto extraído completo hasta los límites configurados. Para llamadas LLM, prioriza ventanas por secciones relevantes:

- visión/misión;
- convivencia;
- principios;
- faltas leves/graves/gravísimas/apoderados;
- medidas;
- procedimientos/debido proceso;
- atenuantes/agravantes;
- protocolos;
- Aula Segura.

Si el texto excede el contexto del modelo, no declara éxito por haber leído solo 1-2 páginas: valida familias estructurales mínimas antes de responder `ok`.

## Clasificación

Faltas:

- `leve`
- `grave`
- `gravisima`
- `apoderado`

Medidas:

- `disciplinary`
- `formativePedagogical`
- `supportAccompaniment`
- `reparatory`
- `guardianMeasures`
- `protectiveOrCautionary`

Protocolos:

Detecta protocolos anexos como debido proceso, maltrato/abuso sexual infantil, vulneración de derechos, violencia escolar, bullying, alcohol/drogas, embarazo/maternidad/paternidad, identidad de género, accidentes escolares, seguridad escolar, DEC, derivación, reclamos de apoderados, cámaras, NEE y celulares.

## Compatibilidad

`POST /api/evidences/process` mantiene su contrato legacy:

```json
{
  "ok": true,
  "source": "own_ai_140",
  "job_type": "...",
  "extraction": {},
  "assessment": {},
  "chunks": []
}
```

No se agregó dispatch a esa ruta en esta implementación. TCDX Convivir debe usar `AI_ENGINE_EXTRACT_PATH=/api/convivencia/manual/extract-parameters` para obtener `parameters` estructurados.

## Privacidad

- No versionar PDFs reales.
- No imprimir token.
- No imprimir base64.
- No imprimir documentos completos.
- Los logs de debug solo muestran shape y conteos.
