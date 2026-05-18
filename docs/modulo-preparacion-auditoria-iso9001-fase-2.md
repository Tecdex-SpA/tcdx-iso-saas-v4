# Módulo Preparación de Auditoría ISO 9001 - Fase 2

## Alcance implementado

La primera parte de esta fase agregó backend, ai-engine y documentación para las fases 4, 5 y 6. El cierre funcional posterior integra la preparación documental dentro de `/auditorias`, agrega análisis básico de ZIP, export inicial a ZIP y mejora la generación determinística para producir documentos ISO 9001 más auditables.

## Servicios creados

| archivo | propósito |
| --- | --- |
| `backend/src/services/auditPreparationContext.service.js` | Construye contexto documental multi-tenant desde fuentes reales y tolera tablas/columnas ausentes. |
| `backend/src/services/auditPreparation.service.js` | Orquesta paquetes, contexto, generación documental, índice de evidencias, gaps, estados y carga ZIP inicial. |
| `backend/src/controllers/auditPreparation.controller.js` | Controlador HTTP con respuestas seguras y sin stack traces. |
| `backend/src/routes/auditPreparation.routes.js` | Rutas `/api/audit-preparation` protegidas por auth/RBAC global. |
| `ai-engine/app/routes/audit_documents.py` | Endpoint documental `POST /api/ai-compliance/audit-documents/generate`. |
| `ai-engine/prompts/iso9001_audit_document_generator_v1.md` | Prompt base versionado para generación documental ISO 9001. |

## Endpoints backend

Todos los endpoints quedan detrás de `auth` y `enforceApiAccess`, y el RBAC permite lectura a roles tenant de lectura y escritura a `admin`, `tenant_admin` y `auditor`.

| método | endpoint | descripción |
| --- | --- | --- |
| GET | `/api/audit-preparation/templates?standard_code=ISO9001` | Lista plantillas activas. |
| POST | `/api/audit-preparation/packages` | Crea paquete documental. |
| GET | `/api/audit-preparation/packages` | Lista paquetes del tenant. |
| GET | `/api/audit-preparation/packages/:id` | Detalle del paquete, documentos, evidencias, runs y ZIPs. |
| POST | `/api/audit-preparation/packages/:id/build-context` | Construye contexto y guarda resumen/trazabilidad. |
| POST | `/api/audit-preparation/packages/:id/generate-documents` | Genera documentos con ai-engine por plantilla. |
| POST | `/api/audit-preparation/packages/:id/generate-evidence-index` | Genera índice inicial de evidencias. |
| GET | `/api/audit-preparation/packages/:id/gaps` | Devuelve brechas críticas, medias, menores y fuentes no disponibles. |
| PATCH | `/api/audit-preparation/documents/:documentId/status` | Actualiza estado documental validando tenant. |
| PATCH | `/api/audit-preparation/evidences/:evidenceId/status` | Actualiza estado de evidencia validando tenant. |
| POST | `/api/audit-preparation/upload-zip` | Registra ZIP documental subido; análisis profundo queda preparado para próxima fase. |
| GET | `/api/audit-preparation/packages/:id/summary` | Resumen liviano para UI. |
| GET | `/api/audit-preparation/packages/:id/documents` | Lista documentos del paquete. |
| GET | `/api/audit-preparation/documents/:documentId` | Detalle de documento generado, pendientes y trazabilidad. |
| GET | `/api/audit-preparation/packages/:id/uploaded-zips` | Lista ZIPs registrados para el paquete. |
| POST | `/api/audit-preparation/packages/:id/export` | Exporta ZIP inicial con estructura documental y Markdown. |
| GET | `/api/audit-preparation/packages/:id/download-export` | Descarga autenticada del último ZIP exportado. |

## Endpoint ai-engine

`POST /api/ai-compliance/audit-documents/generate`

Requiere header interno:

```txt
X-AI-Token: $AI_INTERNAL_TOKEN
```

Entrada mínima:

```json
{
  "tenant_id": "TENANT_ID",
  "standard_code": "ISO9001",
  "period_year": 2026,
  "generation_scope": "general_preparation",
  "document_template": {
    "template_key": "manual_calidad",
    "document_name": "Manual de Calidad",
    "document_type": "manual",
    "template_schema_json": {}
  },
  "context": {},
  "generation_rules": {
    "do_not_invent": true,
    "mark_missing_information": true,
    "formal_audit_language": true,
    "iso9001_focus": true,
    "include_source_trace": true
  }
}
```

Salida:

```json
{
  "status": "ok",
  "document": {
    "title": "Manual de Calidad",
    "version": "1.0",
    "period_year": 2026,
    "sections": [],
    "content_markdown": "",
    "content_json": {},
    "pending_items": [],
    "evidence_suggestions": [],
    "source_trace": {}
  }
}
```

La generación actual es determinística y conservadora: no inventa proveedores, responsables, fechas ni resultados. Si falta información, marca pendientes con `[PENDIENTE DE VALIDACIÓN]`, `[REQUIERE EVIDENCIA]` o `[REQUIERE COMPLETAR CON DATO REAL]`.

## Contexto documental

`buildAuditPreparationContext` devuelve:

```json
{
  "tenant": {},
  "standard": {},
  "period": {},
  "audit": {},
  "documents": {},
  "risks": [],
  "controls": [],
  "evidences": [],
  "audits": [],
  "findings": [],
  "nonconformities": [],
  "corrective_actions": [],
  "action_plans": [],
  "suppliers": [],
  "supplier_evaluations": [],
  "customer_satisfaction": [],
  "kpis": [],
  "document_control": [],
  "jira_items": [],
  "uploaded_zip": {},
  "gaps": [],
  "pending_items": [],
  "source_trace": {},
  "completion_summary": {}
}
```

El servicio verifica existencia de tablas y columnas antes de consultar. Si una fuente no existe o no permite filtrar por `tenant_id`, no falla: agrega brecha limpia y `source_trace.available=false`.

## Knowledge base documental

Se agrega una migración mínima no destructiva para `ai_knowledge_*` y un seed:

- `database/migrations/20260515_ai_knowledge_tables_minimal.sql`
- `database/seeds/20260515_seed_ai_knowledge_iso9001_audit_documents.sql`

Dataset:

```txt
iso9001_audit_document_pack_structure_v1
```

Incluye 15 registros sobre estructura de carpeta, manual, política, objetivos, contexto/FODA, partes interesadas, mapa de procesos, riesgos, control documental, proveedores, satisfacción cliente, acciones correctivas, revisión por la dirección, índice de evidencias y guía de entrevistas.

## Flujo desde Auditorías

La vista `/auditorias` incluye la pestaña **Preparación documental**. Desde ahí el usuario puede:

- crear un paquete documental ISO 9001 por año;
- listar paquetes existentes;
- construir contexto desde la plataforma;
- ver readiness score, fuentes disponibles/no disponibles y brechas;
- seleccionar plantillas y generar documentos;
- revisar contenido Markdown, pendientes, evidencias sugeridas y trazabilidad;
- aprobar documentos o marcarlos como `requires_validation`;
- generar índice de evidencias;
- subir un ZIP documental existente;
- exportar una carpeta ZIP inicial con estructura de auditoría.

La pestaña no reemplaza el programa de auditorías ni IA Auditor. Es una capacidad integrada y accesible dentro del workspace consolidado de Auditorías.

## ZIP documental

`POST /api/audit-preparation/upload-zip` ahora guarda el ZIP, calcula hash, registra metadata e inventaría su estructura interna sin ejecutar ni modificar archivos. El análisis básico detecta:

- cantidad de archivos y carpetas;
- extensiones;
- carpetas detectadas;
- archivos con posible path traversal;
- documentos que coinciden por nombre o carpeta con plantillas ISO 9001;
- archivos no mapeados.

El resultado queda en `audit_uploaded_zip_files.detected_structure_json` e incorpora el ZIP como fuente en el contexto documental. El ZIP original se conserva intacto.

## Export inicial

`POST /api/audit-preparation/packages/:id/export` genera un ZIP inicial con:

- `README.md` del paquete;
- documentos generados como Markdown;
- `03_EVIDENCIAS_PARA_VALIDAR/00_INDICE_EVIDENCIAS.md`;
- `00_PENDIENTES_PARA_AUDITORIA.md`;
- `99_RESPALDO_GENERACIONES/00_INVENTARIO_DOCUMENTAL.json`.

Los `folder_path` de plantillas reemplazan `{{period_year}}` por el año del paquete. El ZIP queda disponible mediante descarga autenticada en `/api/audit-preparation/packages/:id/download-export`.

## Calidad documental

El ai-engine genera salidas determinísticas más específicas por `template_key`:

- `manual_calidad`: portada, control documental, objetivo, alcance, contexto, partes interesadas, procesos, liderazgo, riesgos, operación, desempeño, mejora, evidencias y pendientes.
- `revision_por_la_direccion`: entradas, acciones previas, cambios, KPIs, satisfacción cliente, proveedores, auditorías, hallazgos, riesgos, recursos, decisiones y pendientes.
- `politica_calidad`: declaración, compromisos, enfoque al cliente, cumplimiento, mejora, comunicación y pendientes.
- `objetivos_calidad`: tabla Markdown de objetivo, KPI, meta, responsable, periodo, estado, evidencia y pendiente.
- `indice_evidencias`: tabla Markdown de requisito/documento, evidencia, fuente, carpeta sugerida, estado y observación.
- `guia_entrevistas_auditoria`: preguntas por rol/proceso, evidencia esperada, riesgo asociado y señales de alerta.

La regla sigue siendo conservadora: no inventar proveedores, responsables, fechas, resultados ni tickets. Cuando falta información se marca con los placeholders definidos.

## Limitaciones actuales

- La pasada de cierre funcional avanzado ya agrega extracción textual básica desde ZIP para DOCX/PDF/XLSX/PPTX y artefactos reales DOCX/XLSX/PPTX/PDF/MD según plantilla.
- La edición in-place preservando formato exacto del DOCX original sigue condicionada a documentos con estructura/marcadores compatibles; por defecto se conserva el original intacto y se genera versión TCDX nueva.
- La generación sigue siendo determinística y segura; un refinamiento LLM puede añadirse después usando el mismo contrato.
- Fuentes inexistentes como proveedores, satisfacción cliente o riesgos se muestran como brechas accionables, no como errores.

## Corrección de compatibilidad con schema real

### Error detectado

Durante pruebas reales de `POST /api/audit-preparation/packages/:id/build-context`, backend devolvió error genérico y el log interno mostró:

```txt
column "updated_at" does not exist
```

El origen era una consulta central del context builder que asumía columnas fijas en tablas heredadas. En el schema real:

- `tenants` no tiene `updated_at`;
- `audits` no tiene `updated_at` y usa `iso` en vez de `standard_code`;
- `evidences` no tiene `updated_at` ni `standard_code`;
- `risks` no existe en este entorno.

### Corrección aplicada

- `auditPreparationContext.service.js` ahora usa introspección por tabla antes de seleccionar columnas.
- Las fuentes opcionales se consultan con selección dinámica y solo usan columnas existentes.
- `tenants` e `iso_standards` ya no usan columnas hardcodeadas no verificadas.
- `evidences` se consulta por `tenant_id` y período cuando no hay filtro directo por norma, registrando gap `evidences_standard_filter_unavailable`.
- `risks` ausente no falla el contexto; queda como `source_trace.available=false` con `reason=table_not_found`.
- El controller ya no expone códigos PostgreSQL como `42703` al cliente en errores 500; el detalle técnico queda solo en logs.
- El cliente backend de ai-engine usa el header correcto `x-ai-token`.

### Header correcto ai-engine

Backend debe llamar ai-engine con:

```txt
x-ai-token: $AI_INTERNAL_TOKEN
```

Variables esperadas:

```bash
AI_INTERNAL_TOKEN=<AI_INTERNAL_TOKEN>
AI_ENGINE_URL=http://ai.tcdx.int:8001
```

También se acepta `AI_ENGINE_TOKEN` o `AI_TOKEN` como fallback temporal si `AI_INTERNAL_TOKEN` no está definido.

### SQL adicional

**No se requiere SQL nuevo.**

La corrección fue backend-only. No se agregan columnas a `tenants`, `audits`, `evidences` ni tablas heredadas.

### Validaciones de corrección

```bash
node -c backend/src/services/auditPreparationContext.service.js
node -c backend/src/services/auditPreparation.service.js
node -c backend/src/controllers/auditPreparation.controller.js
node -c backend/src/routes/auditPreparation.routes.js
node -c backend/src/services/aiEngineClient.service.js
node -c backend/src/app.js
cd backend && npm run check
cd backend && npm test
git diff --check
```

Resultado esperado en runtime:

- `build-context` devuelve `ok=true`.
- Puede incluir `gaps`, fuentes no disponibles y `source_trace`, pero no debe fallar por `42703`.
- `generate-documents` no debe fallar por contexto ni por `Unauthorized AI internal token`.

## BD - Antes de probar esta pasada

**SI.**

Motivo: el backend nuevo depende de las 6 tablas `audit_preparation_*`, las 34 plantillas ISO 9001 y, si se quiere activar knowledge documental, de las tablas `ai_knowledge_*`.

VM: `db.tcdx.int`

Usuario recomendado: usuario PostgreSQL de la aplicación, normalmente `tecdex` o el usuario configurado en `.env` (`DB_USER`).

Base de datos destino: `tecdex_saas`.

Comandos:

```bash
cd /home/tecdex/tcdx-iso-saas
psql -d tecdex_saas -f database/migrations/20260515_audit_preparation_iso9001.sql
psql -d tecdex_saas -f database/seeds/20260515_seed_audit_document_templates_iso9001.sql
psql -d tecdex_saas -f database/migrations/20260515_ai_knowledge_tables_minimal.sql
psql -d tecdex_saas -f database/seeds/20260515_seed_ai_knowledge_iso9001_audit_documents.sql
```

Si el repo está en otra ruta en la VM DB, ejecutar los mismos archivos desde la ruta real del checkout.

## BD - Después de desplegar esta pasada

**NO, si ya ejecutaste los SQL anteriores antes de probar.**

Motivo: esta pasada no requiere migraciones runtime adicionales fuera de los cuatro SQL listados.

Si no los ejecutaste antes, ejecútalos antes de levantar pruebas sobre backend.

## Validación BD

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'audit_%'
ORDER BY table_name;

SELECT COUNT(*) AS templates_iso9001
FROM audit_document_templates
WHERE standard_code = 'ISO9001';

SELECT COUNT(*) AS packages_count
FROM audit_preparation_packages;

SELECT COUNT(*) AS knowledge_datasets
FROM ai_knowledge_datasets
WHERE dataset_name = 'iso9001_audit_document_pack_structure_v1';

SELECT COUNT(*) AS knowledge_records
FROM ai_knowledge_records r
JOIN ai_knowledge_datasets d ON d.id = r.dataset_id
WHERE d.dataset_name = 'iso9001_audit_document_pack_structure_v1';
```

Resultado esperado:

- `templates_iso9001 = 34`
- `knowledge_datasets = 1`
- `knowledge_records = 15`

## Backend - despliegue

VM backend `bk.tcdx.int`:

```bash
cd /home/tecdex/backend
git pull
npm install
node -c src/services/auditPreparationContext.service.js
node -c src/services/auditPreparation.service.js
node -c src/controllers/auditPreparation.controller.js
node -c src/routes/auditPreparation.routes.js
node -c src/services/aiEngineClient.service.js
node -c src/app.js
sudo systemctl restart tecdex-backend
sudo systemctl status tecdex-backend --no-pager
```

## AI engine - despliegue

VM IA `ai.tcdx.int`:

```bash
cd /home/tecdex/ai-engine
git pull
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile app/routes/audit_documents.py main.py
sudo systemctl restart ai-engine
curl -s http://localhost:8001/health | python3 -m json.tool
```

## Pruebas curl

Listar plantillas:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/audit-preparation/templates?standard_code=ISO9001" \
  | python3 -m json.tool
```

Crear paquete:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/audit-preparation/packages" \
  -d '{
    "standard_code":"ISO9001",
    "period_year":2026,
    "package_name":"Auditoría Credex ISO 9001 2026"
  }' | python3 -m json.tool
```

Construir contexto:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/build-context" \
  | python3 -m json.tool
```

Generar documentos seleccionados:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/generate-documents" \
  -d '{
    "template_keys":["manual_calidad","revision_por_la_direccion"],
    "generation_scope":"general_preparation"
  }' | python3 -m json.tool
```

Generar índice de evidencias:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/generate-evidence-index" \
  | python3 -m json.tool
```

Consultar gaps:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/gaps" \
  | python3 -m json.tool
```

Registrar ZIP:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -F "file=@/ruta/local/paquete-documental.zip" \
  -F "standard_code=ISO9001" \
  -F "period_year=2026" \
  -F "package_name=Auditoría Credex ISO 9001 2026" \
  "http://localhost:3000/api/audit-preparation/upload-zip" \
  | python3 -m json.tool
```

Exportar paquete:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/export" \
  | python3 -m json.tool
```

Descargar ZIP exportado:

```bash
curl -L -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/download-export" \
  -o audit-preparation.zip
```

## Pendientes posteriores

- Extracción profunda de texto desde DOCX/PDF del ZIP importado.
- Actualización automática documento-a-documento preservando el formato original.
- Export DOCX/XLSX/PDF además de Markdown.
- Integración posterior con IA Auditor para sugerir cierre de brechas desde el paquete documental.
