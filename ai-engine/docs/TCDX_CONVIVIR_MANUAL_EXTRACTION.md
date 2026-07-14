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

`AI_ENGINE_DEBUG_SHAPE=true` activa logs seguros de performance: `endpoint`, `source_shape`, `mime_type`, `file_name`, `base64_length`, `raw_text_length`, `pages_processed`, `truncated`, `deterministic_family_count`, `llm_enabled`, `llm_used`, `llm_timed_out`, `elapsed_ms` y `final_status`. No registra token, base64 ni texto completo del documento.

Variables opcionales de límite:

- `AI_CONVIVENCIA_MAX_FILE_BYTES`: default 30 MB.
- `CONVIVENCIA_MANUAL_LLM_ENABLED`: default `false`.
- `CONVIVENCIA_MANUAL_LLM_TIMEOUT_SECONDS`: default 15 segundos.
- `CONVIVENCIA_MANUAL_TOTAL_TIMEOUT_SECONDS`: default 45 segundos.
- `CONVIVENCIA_MANUAL_MAX_PAGES`: default 120 páginas.
- `CONVIVENCIA_MANUAL_MAX_CHARS`: default 80000 caracteres.
- `CONVIVENCIA_MANUAL_MAX_LLM_CONTEXT_CHARS`: default 60000 caracteres.

El LLM queda deshabilitado por defecto para este endpoint para evitar bloqueos operativos. La extracción base es determinística: primero decodifica y extrae texto, luego clasifica familias estructurales por encabezados, secciones y palabras clave. Si se habilita `CONVIVENCIA_MANUAL_LLM_ENABLED=true`, el LLM solo actúa como enriquecimiento opcional; si falla o supera `CONVIVENCIA_MANUAL_LLM_TIMEOUT_SECONDS`, el endpoint devuelve la extracción determinística con warning.

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
- `misconductMeasureMatrix`
- `derivationRules`
- `communicationRules`
- `evidenceRules`
- `extractionQuality`
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
- faltas, medidas, derivaciones, protocolos, comunicaciones y evidencias incluyen `humanReviewRequired=true`
- medidas y matriz falta-medida incluyen `automaticApplicationAllowed=false`

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
- Procesa hasta `CONVIVENCIA_MANUAL_MAX_PAGES` páginas.
- Marca `truncated=true` si supera páginas o caracteres permitidos.
- Puede detenerse antes si ya encontró suficientes secciones estructurales para una extracción base revisable.

DOCX:

- Decodifica `file_content_base64`.
- Valida estructura ZIP (`PK`).
- Lee `word/document.xml` con librerías estándar de Python.
- Extrae texto de párrafos sin depender de OCR.

Texto plano:

- Se acepta para checks y fixtures sintéticos no sensibles.
- Producción debe preferir PDF/DOCX enviados por TCDX Convivir.

## Documentos largos

El extractor procesa el texto extraído hasta los límites configurados por `CONVIVENCIA_MANUAL_MAX_PAGES`, `CONVIVENCIA_MANUAL_MAX_CHARS` y `CONVIVENCIA_MANUAL_TOTAL_TIMEOUT_SECONDS`. Para llamadas LLM opcionales, prioriza ventanas por secciones relevantes:

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

El endpoint responde `ok` solo si detecta al menos cuatro familias estructurales entre fuente/establecimiento, visión/misión/enfoque, principios, faltas, medidas, procedimientos/debido proceso, protocolos y Aula Segura. La respuesta siempre conserva revisión humana obligatoria, no declara cumplimiento legal automático y no aplica medidas automáticamente.

## Clasificación

Faltas:

- `leve`
- `grave`
- `gravisima`
- `apoderado`

Cada falta se normaliza como objeto operacional:

```json
{
  "code": "GRAVE-001",
  "name": "...",
  "description": "...",
  "severity": "grave",
  "category": "violence_or_aggression",
  "actors": ["student"],
  "sourceSection": "Faltas graves",
  "sourceText": "...",
  "keywords": ["agresión"],
  "suggestedMeasures": ["MED-FORM-001"],
  "requiresGuardianNotification": true,
  "requiresCaseOpening": true,
  "requiresDerivation": false,
  "requiresEvidence": true,
  "aulaSeguraRisk": false,
  "humanReviewRequired": true
}
```

Los códigos son estables por severidad y orden (`LEVE-001`, `GRAVE-001`, `GRAVISIMA-001`, `APODERADO-001`). Si el manual trae numeración original se conserva en `originalIndex`. Riesgos como armas, drogas, agresión sexual, lesiones graves, incendio, amenaza grave o afectación grave se marcan como `aulaSeguraRisk=true` sin habilitar aplicación automática.

Medidas:

- `disciplinary`
- `formativePedagogical`
- `supportAccompaniment`
- `reparatory`
- `guardianMeasures`
- `protectiveOrCautionary`

Cada medida se normaliza como objeto:

```json
{
  "code": "MED-DISC-001",
  "name": "...",
  "description": "...",
  "type": "disciplinary",
  "sourceSection": "Medidas disciplinarias",
  "sourceText": "...",
  "applicableTo": [],
  "compatibleSeverities": ["leve", "grave", "gravisima"],
  "requiresGuardianNotification": false,
  "requiresEvidence": true,
  "requiresDueProcess": true,
  "automaticApplicationAllowed": false,
  "humanReviewRequired": true
}
```

Suspensión, condicionalidad, expulsión y cancelación de matrícula se marcan con `requiresDueProcess=true`. Medidas formativas/pedagógicas, reparatorias, apoyo/acompañamiento y cautelares/protectoras se extraen en familias separadas.

Protocolos:

Detecta protocolos anexos como debido proceso, maltrato/abuso sexual infantil, vulneración de derechos, violencia escolar, bullying, alcohol/drogas, embarazo/maternidad/paternidad, identidad de género, accidentes escolares, seguridad escolar, DEC, derivación, reclamos de apoderados, cámaras, NEE y celulares. Los protocolos se devuelven con código, categoría, disparadores, roles responsables, etapas, plazos, evidencias, canales de comunicación, autoridades externas y `sourceText` breve.

Categorías soportadas:

- `due_process`
- `abuse_or_sexual_aggression`
- `rights_violation`
- `bullying_or_violence`
- `drugs_alcohol`
- `pregnancy_parenthood`
- `gender_identity`
- `accident_safety`
- `emergency`
- `digital_violence`
- `inclusion_nee`
- `dec`
- `complaints`
- `cameras`
- `devices`
- `other`

## Familias Operacionales

`misconductMeasureMatrix` asocia faltas con medidas sugeridas, nunca automáticas:

```json
{
  "misconductCode": "GRAVE-001",
  "suggestedMeasureCodes": ["MED-FORM-001", "MED-SUP-001"],
  "rationale": "Sugerencia base para falta grave...",
  "requiresHumanValidation": true,
  "automaticApplicationAllowed": false
}
```

`derivationRules` detecta derivaciones a convivencia, orientación, dupla psicosocial, psicología, inspectoría general, dirección, CESFAM, OPD/OLN, Tribunal de Familia, Carabineros, PDI, Fiscalía, redes de apoyo y especialistas externos.

`communicationRules` detecta correo electrónico, teléfono, carta certificada, página web, redes sociales, entrevista/citación presencial y notificación escrita.

`evidenceRules` detecta acta, entrevista, registro escrito, hoja de vida, evidencia documental, medios verificadores, correo electrónico, denuncia y certificados médicos cuando aparezcan.

`procedures.operational` y `operationalProcedures` entregan estructuras con etapas como notificación, descargos, prueba, resolución, reconsideración/apelación, consulta a Consejo de Profesores, decisión de Dirección y denuncia dentro de 24 horas cuando corresponda.

`extractionQuality` resume cobertura:

```json
{
  "familiesDetected": ["misconductLeve", "protocols"],
  "counts": {
    "misconductLeve": 0,
    "misconductGrave": 0,
    "misconductGravisima": 0,
    "misconductApoderado": 0,
    "measuresDisciplinary": 0,
    "measuresFormative": 0,
    "measuresSupport": 0,
    "measuresReparatory": 0,
    "protocols": 0,
    "derivationRules": 0,
    "procedures": 0
  },
  "coverageWarnings": [],
  "requiresHumanReview": true
}
```

## Segmentación

La extracción determinística segmenta encabezados con numeración, mayúsculas, variantes con/sin tilde, tablas convertidas a texto, viñetas y listas numeradas. Reconoce bloques de faltas, medidas, derivaciones, procedimientos, debido proceso, condicionalidad, expulsión/cancelación, Aula Segura, atenuantes, agravantes, protocolos/anexos, comunicaciones, confidencialidad, plan de gestión y encargado/a de convivencia.

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
