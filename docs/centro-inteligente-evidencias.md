# Centro Inteligente de Evidencias — Etapa 1

## Objetivo

Reemplazar funcionalmente la vista actual de `Evidencias` por una evolución controlada llamada **Centro Inteligente de Evidencias**, conservando la operación existente y agregando una base técnica para documentos externos conectados.

Esta etapa no implementa OAuth real, extracción de texto ni análisis IA avanzado. Prepara la arquitectura mínima segura para avanzar a Google Drive en Etapa 2 y análisis IA en Etapa 3.

## Arquitectura detectada

- Frontend de evidencias actual: `frontend/src/app/evidencias/page.tsx`.
- Backend de evidencias actual: `backend/src/routes/evidences.routes.js`.
- Montaje actual de evidencias: `app.use('/api/evidences', evidencesRoutes)` en `backend/src/app.js`.
- La vista actual ya contiene carga manual, listado, revisión humana, integración con IA de evidencias y foco por parámetros de búsqueda.

Por ese motivo, esta etapa usa una estrategia conservadora: no reemplazar de golpe el archivo completo de evidencias, sino agregar base documental y preparar la nueva experiencia para integrarse en pestañas dentro de `/evidencias`.

## Funcionalidades antiguas que se conservan

- Listado de evidencias actuales.
- Carga manual de evidencias.
- Aprobación/rechazo humano.
- Asociación con controles operativos.
- Integración con plan de acción cuando se entra desde remediación.
- Trazabilidad IA existente de evidencias.
- Seguridad multi-tenant ya implementada en rutas actuales.

## Funcionalidades nuevas preparadas

- Proveedores documentales preparados:
  - Google Drive.
  - OneDrive.
  - SharePoint.
- Tablas base para integraciones documentales.
- Tablas base para fuentes documentales por tenant.
- Tabla de documentos externos indexados.
- Tabla de logs de sincronización.
- Tabla de análisis IA documental futuro.
- Tabla de sugerencias documentales revisables.
- Tabla puente entre evidencias formales y documentos externos.
- Rutas backend base para proveedores, integraciones, fuentes, documentos, sugerencias y logs.

## Tablas creadas

La migración está en:

```bash
database/migrations/20260512_001_centro_inteligente_evidencias_base.sql
```

Tablas:

- `tenant_integrations`
- `tenant_document_sources`
- `document_index`
- `document_sync_logs`
- `document_ai_analysis`
- `document_association_suggestions`
- `evidence_document_links`

La tabla `evidences` no se modifica ni se elimina.

## Backend agregado

Archivo nuevo:

```bash
backend/src/routes/document-integrations.routes.js
```

Endpoints base:

```text
GET  /api/document-integrations/providers
GET  /api/document-integrations/integrations
POST /api/document-integrations/integrations/prepared
POST /api/document-integrations/integrations/:integrationId/disconnect
GET  /api/document-integrations/sources
POST /api/document-integrations/sources
POST /api/document-integrations/sources/:sourceId/sync
GET  /api/document-integrations/documents
GET  /api/document-integrations/suggestions
POST /api/document-integrations/suggestions/:suggestionId/reject
GET  /api/document-integrations/sync-logs
```

Todos los endpoints usan `auth`, validan tenant y no exponen tokens.

## Parche manual requerido en backend/src/app.js

Agregar import cerca de las demás rutas:

```js
const documentIntegrationsRoutes = require('./routes/document-integrations.routes');
```

Agregar montaje cerca de evidencias:

```js
app.use('/api/document-integrations', documentIntegrationsRoutes);
```

Ubicación sugerida:

```js
app.use('/api/evidences', evidencesRoutes);
app.use('/api/document-integrations', documentIntegrationsRoutes);
```

## Variables de entorno preparadas

Agregar en `backend/.env` cuando se avance a Etapa 2:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_DRIVE_SCOPES=https://www.googleapis.com/auth/drive.metadata.readonly
TOKEN_ENCRYPTION_KEY=
AI_ENGINE_URL=http://192.168.100.140:8001
```

Microsoft futuro:

```bash
MS_CLIENT_ID=
MS_CLIENT_SECRET=
MS_TENANT_ID=
MS_REDIRECT_URI=
MS_GRAPH_SCOPES=
```

En Etapa 1 no se usan credenciales reales.

## Paso a paso manual

### 1. Preparar rama local

```bash
cd ~/repos/tcdx-iso-saas
git status
git branch
git pull origin main
git checkout -b feature/centro-inteligente-evidencias-etapa1
```

### 2. Traer cambios desde GitHub

```bash
git fetch origin feature/centro-inteligente-evidencias-etapa1
git checkout feature/centro-inteligente-evidencias-etapa1
git pull origin feature/centro-inteligente-evidencias-etapa1
```

### 3. Aplicar parche manual en backend/src/app.js

Editar:

```bash
nano backend/src/app.js
```

Agregar:

```js
const documentIntegrationsRoutes = require('./routes/document-integrations.routes');
```

Y luego:

```js
app.use('/api/document-integrations', documentIntegrationsRoutes);
```

### 4. Aplicar migración BD

```bash
psql -h 192.168.100.110 -U tecdex -d tecdex_saas -f database/migrations/20260512_001_centro_inteligente_evidencias_base.sql
```

### 5. Validar tablas

```bash
psql -h 192.168.100.110 -U tecdex -d tecdex_saas
```

Dentro de `psql`:

```sql
SELECT COUNT(*) FROM tenant_integrations;
SELECT COUNT(*) FROM tenant_document_sources;
SELECT COUNT(*) FROM document_index;
SELECT COUNT(*) FROM document_association_suggestions;
SELECT COUNT(*) FROM evidence_document_links;
```

### 6. Validar backend local

```bash
cd ~/repos/tcdx-iso-saas/backend
npm install
npm test
```

### 7. Validar frontend

```bash
cd ~/repos/tcdx-iso-saas/frontend
npm install
npm run build
```

### 8. Commit manual si agregaste el parche en app.js

```bash
cd ~/repos/tcdx-iso-saas
git status
git add .
git commit -m "feat: mount intelligent evidence document integrations routes"
git log --oneline -5
```

### 9. Push

```bash
git push origin feature/centro-inteligente-evidencias-etapa1
```

### 10. Deploy con script global

```bash
cd ~/repos/tcdx-iso-saas
./scripts/deploy-vms.sh
```

### 11. Deploy manual backend si hace falta

```bash
ssh tecdex@192.168.100.120
cd /home/tecdex/backend
git pull origin main
npm install
sudo systemctl restart tecdex-backend
sudo systemctl status tecdex-backend --no-pager
```

### 12. Deploy manual frontend si hace falta

```bash
ssh tecdex@192.168.100.130
cd /home/tecdex/frontend
git pull origin main
npm install
npm run build
npm start
```

## Validaciones post-deploy

Backend health:

```bash
curl http://192.168.100.120:3000/
```

Con token real:

```bash
TOKEN="PEGAR_TOKEN_REAL"
TENANT_ID="PEGAR_TENANT_ID_REAL"

curl -H "Authorization: Bearer $TOKEN" "http://192.168.100.120:3000/api/document-integrations/providers"

curl -H "Authorization: Bearer $TOKEN" "http://192.168.100.120:3000/api/document-integrations/integrations?tenant_id=$TENANT_ID"

curl -H "Authorization: Bearer $TOKEN" "http://192.168.100.120:3000/api/document-integrations/sources?tenant_id=$TENANT_ID"

curl -H "Authorization: Bearer $TOKEN" "http://192.168.100.120:3000/api/document-integrations/documents?tenant_id=$TENANT_ID"

curl -H "Authorization: Bearer $TOKEN" "http://192.168.100.120:3000/api/document-integrations/suggestions?tenant_id=$TENANT_ID"
```

Frontend:

```text
http://192.168.100.130:3000/evidencias
```

Validar:

- La vista actual de evidencias sigue cargando.
- Sidebar y header siguen persistentes.
- Evidencias existentes siguen visibles.
- Carga manual sigue funcionando.
- No aparecen datos de otro tenant.
- No hay errores 401/403 inesperados.

## Rollback recomendado

### Código

```bash
git revert COMMIT_ID
git push origin main
./scripts/deploy-vms.sh
```

### Base de datos

Como esta etapa no modifica la tabla `evidences`, el rollback de BD consiste en eliminar solo las tablas nuevas de integración documental, en orden inverso de dependencias:

1. `evidence_document_links`
2. `document_association_suggestions`
3. `document_ai_analysis`
4. `document_sync_logs`
5. `document_index`
6. `tenant_document_sources`
7. `tenant_integrations`

Ejecutar ese rollback solo si no existen datos útiles de prueba que se quieran conservar.

## Checklist Etapa 1

- [ ] Migración aplicada.
- [ ] Tablas nuevas visibles.
- [ ] Ruta backend montada en `app.js`.
- [ ] `npm test` backend OK.
- [ ] `npm run build` frontend OK.
- [ ] `/evidencias` sigue cargando.
- [ ] Evidencias existentes visibles.
- [ ] Carga manual operativa.
- [ ] Endpoints `/api/document-integrations/*` responden con token.
- [ ] Sin OAuth real todavía.
- [ ] Sin análisis IA documental avanzado todavía.

## Próxima etapa

Etapa 2:

- Google Drive OAuth real.
- Scopes mínimos.
- Selección/registro de carpeta.
- Indexación real de metadata.
- Logs reales de sincronización.

No avanzar a Etapa 2 sin validar Etapa 1.
\n\n## Etapa 3.5 — Sugerencias IA revisables desde análisis documental\n\nAl ejecutar `POST /api/document-integrations/documents/:documentId/analyze`, el backend guarda el análisis en `document_ai_analysis` y, si el `ai-engine` devuelve `suggested_controls` o `suggested_targets` de tipo `control`, crea sugerencias pendientes en `document_association_suggestions`.\n\n### Reglas de seguridad\n\n- No se crean evidencias formales automáticamente.\n- No se aprueba cumplimiento automáticamente.\n- No se modifican controles, riesgos, hallazgos, no conformidades, auditorías ni planes de acción.\n- Toda sugerencia queda con `status = 'pending'`.\n- La revisión humana sigue siendo obligatoria.\n- Se evita duplicar sugerencias pendientes por `tenant_id`, `document_id`, `target_type`, `suggested_standard_code` y `suggested_control_ref`.\n\n### Alcance actual\n\nLa primera implementación crea únicamente sugerencias `target_type = 'control'`. Las asociaciones a riesgos, hallazgos, no conformidades, auditorías, activos y planes de acción quedan preparadas para fases posteriores.\n\n### Validación SQL\n\n```sql\nSELECT\n  id,\n  tenant_id,\n  document_id,\n  target_type,\n  suggested_standard_code,\n  suggested_control_ref,\n  confidence_score,\n  status,\n  created_at\nFROM document_association_suggestions\nWHERE document_id = 'DOCUMENT_ID'\nORDER BY created_at DESC;\n```\n


## Sincronización recursiva Google Drive

La fuente documental Google Drive se sincroniza desde una carpeta específica seleccionada por el usuario. No se sincroniza `root` por defecto.

### Reglas de seguridad

- La fuente debe pertenecer al tenant autenticado.
- La integración debe pertenecer al mismo tenant.
- No se exponen access tokens ni refresh tokens.
- No se crean evidencias automáticamente.
- No se aprueba cumplimiento automáticamente.
- No se modifican controles, riesgos, hallazgos, no conformidades, auditorías ni planes de acción.

### Recorrido de carpetas

El backend recorre subcarpetas de forma controlada:

- `max_depth` por defecto: 5.
- `max_files` por defecto: 1000.
- Uso de `visitedFolderIds` para evitar loops.
- Paginación hasta `nextPageToken = null`.
- Si una carpeta o archivo falla, se registra warning y continúa el proceso.

### Metadata documental

Cada archivo indexado conserva su ruta lógica en:

- `metadata_json.google.folder_path`
- `metadata_json.folder_path`
- `metadata_json.google.parent_folder_id`

Las carpetas se usan para recorrido, pero no se muestran como documentos analizables por defecto.

### Frontend /evidencias

La tabla de documentos indexados usa scroll interno, búsqueda y filtros, evitando que la página completa crezca indefinidamente.


## Evidencias integradas pendientes de aprobación

El flujo documental queda separado en tres etapas:

1. **Sugerencia IA**
   - Se crea en `document_association_suggestions`.
   - No modifica cumplimiento.
   - No crea evidencia formal por sí sola.

2. **Promoción a evidencia formal**
   - Se crea una fila en `evidences`.
   - `evidence_type = 'documento_integrado'`.
   - `status = 'pendiente'`.
   - `validated = false`.
   - No impacta salud, KPI ni cumplimiento todavía.

3. **Aprobación humana**
   - Un usuario autorizado aprueba mediante `PUT /api/evidences/approve/:id`.
   - Roles esperados: `superadmin`, `tenant_admin`, `admin` o `auditor`.
   - Al aprobar:
     - `status = 'aprobada'`.
     - `validated = true`.
     - Se registra `reviewed_by` y `reviewed_at`.
     - Se refresca salud de controles y snapshots KPI.
   - Recién en esta etapa puede impactar cumplimiento.

La vista `/evidencias` incluye el panel **Evidencias integradas pendientes de aprobación**, con scroll interno, búsqueda y acciones humanas de aprobar/rechazar.
