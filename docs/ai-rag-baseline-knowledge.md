# AI RAG Baseline Knowledge

## Current RAG State

El ai-engine ya tenía `rag_context_service.py` integrado en `senior_auditor_orchestrator.py`. El formato de retorno esperado es:

- `used`
- `results`
- `rag_context_used`
- `source_trace`
- `limitations`

`source_trace` usa objetos `{ source, reference, used_for }` generados por `make_source_trace_item`.

## Qué Es Este RAG Simple

Es una capa RAG determinística sin vector DB, sin embeddings y sin dependencias nuevas. Usa JSON estático con conocimiento práctico y parafraseado de auditoría ISO.

Archivo canónico:

```txt
ai-engine/app/knowledge/iso_baseline_knowledge.json
```

No copia texto normativo propietario. Contiene guidance operativo en español.

## Cobertura

Incluye al menos 8 registros por norma:

- ISO9001
- ISO27001
- ISO42001

Cada registro incluye:

- `id`
- `standard_code`
- `clause_or_domain`
- `topic`
- `keywords`
- `expected_evidence`
- `common_gaps`
- `audit_questions`
- `recommended_actions`
- `closure_criteria`
- `documents_to_request`

## Scoring

La búsqueda determinística usa:

- `+5` por match exacto de `standard_code`
- `+4` por match de cláusula/dominio
- `+3` por match de tópico
- `+2` por cada keyword encontrada en descripción/pregunta
- `+1` por relación con `module_origin`

Devuelve top N según `limit` o `options.rag_limit`.

## Integración

`senior_auditor_orchestrator.py` llama RAG antes de construir prompt o fallback. El prompt compacto recibe la sección:

```txt
CONOCIMIENTO NORMATIVO INTERNO DISPONIBLE
```

El fallback determinístico usa RAG para mejorar:

- evidencia faltante;
- brechas comunes;
- preguntas auditoras;
- acciones recomendadas;
- documentos a solicitar;
- criterios de cierre.

## Validación

```bash
python3 -m json.tool ai-engine/app/knowledge/iso_baseline_knowledge.json >/dev/null
PYTHONPYCACHEPREFIX=/private/tmp/tcdx-pycache python3 -m py_compile ai-engine/app/services/rag_context_service.py
PYTHONPYCACHEPREFIX=/private/tmp/tcdx-pycache python3 -m py_compile ai-engine/app/services/senior_auditor_orchestrator.py
```

## Comportamiento Runtime Esperado

- `engine.used_rag = true` cuando hay match.
- `structured_result.rag_context_used` no vacío.
- `source_trace` incluye `source = rag`.
- `answer` o `structured_result` menciona “Como referencia normativa interna...” cuando aplica.

## Cómo Agregar Registros

Agregar un objeto nuevo en `records[]` con todos los campos requeridos. Mantener contenido en español, práctico y parafraseado.

## Limitaciones

- No hay búsqueda semántica.
- No hay ranking vectorial.
- No sustituye documentos internos del tenant.
- Puede migrarse después a PostgreSQL/pgvector si el volumen de conocimiento crece.
