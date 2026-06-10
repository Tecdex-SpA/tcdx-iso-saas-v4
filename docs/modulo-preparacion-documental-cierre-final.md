# Preparación documental ISO / TCDX - cierre final

## Alcance comercial real

El módulo queda apto para demo comercial controlada y primeros clientes ISO 9001:2015 / ISO 27001:2022. Permite crear paquetes documentales, subir ZIPs existentes, extraer inventario, generar documentos reales, revisar/aprobar, exportar ZIP profesional y usar fuentes documentales alternativas sin inventar datos.

## Implementado

- OCR opcional para PDFs escaneados en ZIP.
- Preservación DOCX por marcadores TCDX.
- Estrategia honesta de original conservado + anexo TCDX cuando no hay marcador seguro.
- Conversión opcional DOCX a PDF con LibreOffice headless.
- Fuentes documentales normalizadas para proveedores, satisfacción, reclamos, encuestas, control documental, riesgos, procesos y partes interesadas.
- Lint específico para Preparación documental.
- Base ISO27001 ampliada.

## OCR

Variables:

```env
AUDIT_OCR_ENABLED=false
AUDIT_OCR_MAX_PAGES=10
AUDIT_OCR_LANG=spa+eng
AUDIT_OCR_TIMEOUT_MS=45000
PDFTOPPM_BIN=pdftoppm
TESSERACT_BIN=tesseract
```

Paquetes Ubuntu recomendados:

```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-spa tesseract-ocr-eng poppler-utils
```

Si OCR está deshabilitado, un PDF escaneado queda marcado con warning claro. Si está habilitado, se procesa hasta `AUDIT_OCR_MAX_PAGES` y se registran:

- `ocr_attempted`
- `ocr_success`
- `ocr_pages_processed`
- `ocr_error`
- `extraction_method`

## DOCX y marcadores

Ver `docs/plantillas-docx-marcadores-tcdx.md`.

Modos:

- `preserve_exact_with_markers`
- `preserve_original_attach_generated_annex`
- `generate_tcdx_new`

El ZIP original nunca se sobrescribe.

## DOCX a PDF

Variables:

```env
AUDIT_DOCX_TO_PDF_ENABLED=false
LIBREOFFICE_BIN=/usr/bin/libreoffice
AUDIT_DOCX_TO_PDF_TIMEOUT_MS=60000
```

Paquetes Ubuntu recomendados:

```bash
sudo apt-get install -y libreoffice fonts-dejavu fonts-liberation
```

Si LibreOffice no existe o falla, el backend no rompe la generación y usa PDF nativo como fallback cuando aplica.

## Fuentes documentales alternativas

Migración:

```txt
database/migrations/20260515_audit_preparation_documentary_sources.sql
```

Permite alimentar documentos desde:

- `manual`
- `zip`
- `evidence`
- `system`

Tipos:

```txt
supplier
supplier_evaluation
customer_satisfaction
complaint
survey
document_control
risk
process
interested_party
other
```

Estas fuentes no reemplazan módulos formales. Si una fuente es parcial, se marca como `requires_validation`.

## Endpoints nuevos

```txt
GET    /api/audit-preparation/documentary-sources
POST   /api/audit-preparation/documentary-sources
PUT    /api/audit-preparation/documentary-sources/:sourceId
DELETE /api/audit-preparation/documentary-sources/:sourceId
```

## SQL

Ejecutar en DB VM:

```bash
cd /home/tecdex/tcdx-iso-saas
sudo -u postgres psql -d tecdex_saas -f database/migrations/20260515_audit_preparation_documentary_sources.sql
sudo -u postgres psql -d tecdex_saas -f database/seeds/20260515_seed_audit_document_templates_iso27001.sql
```

Validación:

```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'audit_documentary_sources';
SELECT COUNT(*) FROM audit_document_templates WHERE standard_code = 'ISO9001';
SELECT COUNT(*) FROM audit_document_templates WHERE standard_code = 'ISO27001';
```

## Curl

```bash
TOKEN=$(curl -s -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"<qa-user-email>","password":"<qa-user-password>"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/audit-preparation/templates?standard_code=ISO9001" | python3 -m json.tool

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/audit-preparation/templates?standard_code=ISO27001" | python3 -m json.tool

curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/audit-preparation/packages" \
  -d '{"standard_code":"ISO9001","period_year":2026,"package_name":"Auditoría ISO 9001 2026"}' | python3 -m json.tool

curl -s -H "Authorization: Bearer $TOKEN" \
  -F "file=@/ruta/paquete.zip" \
  -F "package_id=$PACKAGE_ID" \
  -F "standard_code=ISO9001" \
  -F "period_year=2026" \
  "http://localhost:3000/api/audit-preparation/upload-zip" | python3 -m json.tool

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/audit-preparation/documentary-sources?package_id=$PACKAGE_ID" | python3 -m json.tool

curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/audit-preparation/documentary-sources" \
  -d '{"package_id":"'$PACKAGE_ID'","standard_code":"ISO9001","period_year":2026,"source_type":"supplier","title":"Evidencia proveedor crítico","description":"Fuente manual para revisión documental"}' | python3 -m json.tool

curl -s -H "Authorization: Bearer $TOKEN" \
  -X POST "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/build-context" | python3 -m json.tool

curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/generate-documents" \
  -d '{"template_keys":["manual_calidad","revision_por_la_direccion"],"generation_scope":"general_preparation"}' | python3 -m json.tool

curl -L -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/audit-preparation/documents/$DOCUMENT_ID/download" \
  -o documento-generado.bin

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/audit-preparation/documents/$DOCUMENT_ID/history" | python3 -m json.tool

curl -s -H "Authorization: Bearer $TOKEN" \
  -X POST "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/export" | python3 -m json.tool

curl -L -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/audit-preparation/packages/$PACKAGE_ID/download-export" \
  -o paquete-auditoria.zip
```

## Deploy

Backend:

```bash
cd /home/tecdex/backend
git pull
npm install
sudo systemctl restart tecdex-backend
sudo systemctl status tecdex-backend --no-pager
```

AI engine:

```bash
cd /home/tecdex/ai-engine
git pull
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile app/routes/audit_documents.py main.py
sudo systemctl restart ai-engine
sudo systemctl status ai-engine --no-pager
```

Frontend:

```bash
cd /home/tecdex/frontend
git pull
npm install
npm run build
npm start
```

Script global disponible desde Mac:

```bash
./scripts/push-deploy.sh
```

## Mejoras futuras no bloqueantes

- OCR avanzado con IA visual.
- DMS/ECM empresarial completo.
- Integración real con Jira u otros sistemas externos.
- Plantillas editoriales DOCX avanzadas por cliente.
