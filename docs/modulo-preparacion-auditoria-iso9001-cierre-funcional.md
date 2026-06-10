# Preparación de Auditoría ISO 9001 - Cierre funcional

## Alcance implementado

El módulo queda usable desde `/auditorias` mediante la pestaña **Preparación documental**. La implementación permite crear paquetes documentales ISO 9001, construir contexto desde datos reales del tenant, generar documentos, revisar pendientes, aprobar borradores, generar índice de evidencias, subir un ZIP documental existente y exportar un paquete ZIP inicial.

La pasada avanzada agrega salida real de documentos, extracción profunda básica desde ZIP, versionado/aprobación y base inicial ISO 27001:2022.

## Archivos principales

| archivo | propósito |
| --- | --- |
| `frontend/src/app/auditorias/page.tsx` | Agrega la pestaña Preparación documental. |
| `frontend/src/components/auditorias/AuditPreparationPanel.tsx` | UI completa de paquetes, contexto, documentos, evidencias, ZIP y export. |
| `backend/src/services/auditPreparation.service.js` | Agrega inventario ZIP, resumen, documentos livianos, export y descarga. |
| `backend/src/services/auditZipExtraction.service.js` | Extrae estructura y texto básico desde ZIP/DOCX/PDF/XLSX/PPTX. |
| `backend/src/services/auditDocumentRenderer.service.js` | Renderiza DOCX/XLSX/PPTX/PDF/MD reales para documentos generados. |
| `backend/src/services/auditPreparationContext.service.js` | Agrega resúmenes de controles, evidencias, auditorías, acciones y guía documental. |
| `backend/src/controllers/auditPreparation.controller.js` | Expone nuevos handlers de summary, documents, uploaded-zips, export y download. |
| `backend/src/routes/auditPreparation.routes.js` | Registra endpoints adicionales. |
| `ai-engine/app/routes/audit_documents.py` | Mejora generación determinística por tipo documental. |
| `ai-engine/prompts/iso9001_audit_document_generator_v1.md` | Documenta estructura mínima por plantilla y reglas de síntesis. |

## Endpoints usados por la UI

| método | endpoint |
| --- | --- |
| GET | `/api/audit-preparation/templates?standard_code=ISO9001` |
| POST | `/api/audit-preparation/packages` |
| GET | `/api/audit-preparation/packages?standard_code=ISO9001&period_year=2026` |
| GET | `/api/audit-preparation/packages/:id` |
| POST | `/api/audit-preparation/packages/:id/build-context` |
| POST | `/api/audit-preparation/packages/:id/generate-documents` |
| POST | `/api/audit-preparation/packages/:id/generate-evidence-index` |
| GET | `/api/audit-preparation/packages/:id/gaps` |
| GET | `/api/audit-preparation/documents/:documentId` |
| PATCH | `/api/audit-preparation/documents/:documentId/status` |
| PATCH | `/api/audit-preparation/evidences/:evidenceId/status` |
| POST | `/api/audit-preparation/upload-zip` |
| GET | `/api/audit-preparation/packages/:id/uploaded-zips` |
| POST | `/api/audit-preparation/packages/:id/export` |
| GET | `/api/audit-preparation/packages/:id/download-export` |

## Variables requeridas

Backend:

```bash
AI_ENGINE_URL=http://ai.tcdx.int:8001
AI_INTERNAL_TOKEN=<AI_INTERNAL_TOKEN>
```

Frontend debe mantener la variable existente de URL API si se usa en el entorno actual.

## BD - SQL nuevo

**SI.**

Antes de probar esta pasada avanzada se debe ejecutar:

```bash
cd /home/tecdex/tcdx-iso-saas
psql -d tecdex_saas -f database/migrations/20260515_audit_preparation_formats_versioning.sql
psql -d tecdex_saas -f database/seeds/20260515_seed_audit_document_templates_iso9001.sql
psql -d tecdex_saas -f database/seeds/20260515_seed_audit_document_templates_iso27001.sql
```

La migración agrega campos de archivo real, hash, formato, versión, revisión, revisión/aprobación, vigencia, obsolescencia y estado actual en `audit_package_documents`. Los seeds dejan ISO 9001 sin dependencia funcional de Jira y agregan plantillas mínimas ISO 27001.

## Validaciones BD

```sql
SELECT id, tenant_id, standard_code, period_year, package_name, status, latest_export_file_url, generated_at
FROM audit_preparation_packages
ORDER BY generated_at DESC
LIMIT 10;

SELECT document_name, document_status, created_at
FROM audit_package_documents
ORDER BY created_at DESC
LIMIT 10;

SELECT run_type, status, error_message, created_at
FROM audit_document_generation_runs
ORDER BY created_at DESC
LIMIT 10;

SELECT evidence_name, source_module, status, created_at
FROM audit_evidence_index
ORDER BY created_at DESC
LIMIT 10;

SELECT original_filename, standard_code, period_year, analysis_status, created_at, detected_structure_json
FROM audit_uploaded_zip_files
ORDER BY created_at DESC
LIMIT 5;

SELECT COUNT(*) AS templates_iso27001
FROM audit_document_templates
WHERE standard_code = 'ISO27001';
```

## Pruebas curl

Login:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<qa-user-email>","password":"<qa-user-password>"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("token",""))')
```

Listar templates:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/audit-preparation/templates?standard_code=ISO9001" \
  | python3 -m json.tool
```

Crear package:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/audit-preparation/packages" \
  -d '{"standard_code":"ISO9001","period_year":2026,"package_name":"Auditoría Credex ISO 9001 2026"}' \
  | python3 -m json.tool
```

Construir contexto:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/build-context" \
  | python3 -m json.tool
```

Consultar gaps:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/gaps" \
  | python3 -m json.tool
```

Generar documentos:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/generate-documents" \
  -d '{"template_keys":["manual_calidad","revision_por_la_direccion"],"generation_scope":"general_preparation"}' \
  | python3 -m json.tool
```

Generar índice de evidencias:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/generate-evidence-index" \
  | python3 -m json.tool
```

Actualizar estado documental:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X PATCH "http://localhost:3000/api/audit-preparation/documents/$DOCUMENT_ID/status" \
  -d '{"document_status":"approved"}' \
  | python3 -m json.tool
```

Subir ZIP:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -F "file=@/ruta/local/Auditoria_Credex_ISO9001_2026.zip" \
  -F "standard_code=ISO9001" \
  -F "period_year=2026" \
  -F "package_id=$PACKAGE_ID" \
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

Descargar export:

```bash
curl -L -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/download-export" \
  -o audit-preparation.zip
```

## Deploy

Backend VM `bk.tcdx.int`:

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

AI engine VM `ai.tcdx.int`:

```bash
cd /home/tecdex/ai-engine
git pull
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile app/routes/audit_documents.py main.py
sudo systemctl restart ai-engine
curl -s http://localhost:8001/health | python3 -m json.tool
```

Frontend VM `www.tcdx.int`:

```bash
cd /home/tecdex/frontend
git pull
npm install
npm run build
npm start
```

## Limitaciones conocidas

- La extracción ZIP obtiene texto de DOCX/PDF/XLSX/PPTX cuando el archivo y parser lo permiten; no ejecuta macros ni modifica originales.
- La preservación de formato original queda en modo conservador: el ZIP original se conserva intacto y el sistema genera una versión TCDX nueva. La edición in-place preservando estilos del DOCX original requiere plantillas/markers compatibles y queda como evolución.
- La exportación incluye documentos reales DOCX/XLSX/PPTX/PDF/MD según plantilla, más preview Markdown en respaldo.
- Las fuentes que no existen en el schema real se muestran como brechas accionables.
- El refinamiento con LLM puede mejorar redacción más adelante, pero el flujo no depende de Ollama para quedar usable.
