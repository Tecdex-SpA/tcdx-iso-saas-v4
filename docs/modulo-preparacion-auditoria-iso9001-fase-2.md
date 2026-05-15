# Módulo Preparación de Auditoría ISO 9001 - Fase 2

## Alcance implementado

Esta pasada agrega backend, ai-engine y documentación para las fases 4, 5 y 6. No incluye frontend ni export ZIP completo.

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

## Limitaciones de esta fase

- No se implementó frontend.
- No se descomprime ni analiza profundamente el ZIP todavía; solo se registra metadata, hash, paquete asociado y estado inicial.
- No se implementó export ZIP completo.
- La generación documental en ai-engine es determinística y segura; LLM/Ollama puede incorporarse después sobre este contrato.

## BD - Antes de probar esta pasada

**SI.**

Motivo: el backend nuevo depende de las 6 tablas `audit_preparation_*`, las 34 plantillas ISO 9001 y, si se quiere activar knowledge documental, de las tablas `ai_knowledge_*`.

VM: `192.168.100.110`

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

VM backend `192.168.100.120`:

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

VM IA `192.168.100.140`:

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

## Pendiente para la siguiente pasada

- Integración frontend dentro de `/auditorias`.
- Análisis profundo del ZIP y mapeo automático a plantillas.
- Actualización de documentos importados preservando estructura.
- Export ZIP con Markdown/PDF y estructura completa.
