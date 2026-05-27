# Fuentes Documentales Tenant-Scoped

Este módulo permite que cada tenant conecte e indexe sus propias fuentes documentales sin compartir información con otros clientes.

## Modelo Multi-Tenant

Todo recurso documental queda asociado a `tenant_id`:

- `tenant_document_sources`
- `tenant_document_provider_credentials`
- `document_index`
- `document_sync_logs`
- `document_association_suggestions`
- `evidence_document_links`
- `tenant_sync_agents`
- `tenant_sync_agent_pairing_codes`

Para usuarios tenant normales el backend obtiene el tenant desde el JWT. Los endpoints operativos no aceptan `tenant_id` del frontend como fuente de verdad. Sólo roles plataforma/superadmin pueden operar cross-tenant en rutas explícitas.

## Qué Guarda `.env`

Configuración global de plataforma:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_DRIVE_SCOPES`
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REDIRECT_URI`
- `ZOHO_ACCOUNTS_BASE_URL`
- `ZOHO_API_BASE_URL`
- `DOCUMENT_INTEGRATION_ENCRYPTION_KEY`
- `LOCAL_DOCUMENT_ROOT`
- `AGENT_TOKEN_SIGNING_SECRET`

No se guardan carpetas, tokens ni credenciales de tenants en `.env`.

## Qué Guarda BD

La BD guarda configuración tenant-scoped:

- Fuente documental y carpeta seleccionada.
- Tokens OAuth cifrados.
- Estado de sincronización.
- Documentos indexados.
- Códigos de vinculación de agente hasheados.
- Tokens de agente hasheados.

Los tokens OAuth nunca se devuelven al frontend ni se escriben en logs.

## Google Drive

1. Entrar a Evidencias.
2. Abrir Fuentes documentales.
3. Conectar Google Drive.
4. Autorizar OAuth.
5. Seleccionar carpeta específica.
6. Sincronizar.

La integración existente se mantiene. OAuth usa `state` firmado con `tenant_id`, `user_id`, provider, nonce e intención.

Scopes recomendados:

```text
https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email
```

`drive.readonly` es necesario para listar, descargar archivos binarios y exportar Google Docs/Sheets/Slides que la cuenta conectada puede leer. Si una credencial antigua sólo tiene `drive.metadata.readonly` o un scope parcial, el backend responde:

```json
{
  "ok": false,
  "code": "GOOGLE_RECONNECT_REQUIRED",
  "error": "Debe reconectar Google Drive para conceder permisos de lectura/exportación de la carpeta seleccionada."
}
```

En ese caso el usuario debe reconectar Google Drive con una cuenta que tenga permisos de lectura sobre la carpeta seleccionada y sus subcarpetas. Si un archivo puntual no fue compartido con esa cuenta, el análisis responde `GOOGLE_FILE_ACCESS_DENIED` y el documento queda marcado como `error` sin romper toda la sincronización.

La sincronización:

- Usa paginación completa de Google Drive.
- Ignora `trashed=true`.
- Usa `supportsAllDrives=true` e `includeItemsFromAllDrives=true` para soportar Shared Drives cuando la cuenta tiene acceso.
- Si `include_subfolders=true`, recorre subcarpetas y guarda `relative_path`.
- Si `include_subfolders=false`, indexa sólo archivos directos de la carpeta raíz.

## Zoho WorkDrive

Zoho usa:

- `ZOHO_ACCOUNTS_BASE_URL` para OAuth.
- `ZOHO_API_BASE_URL` para API WorkDrive.

El conector implementa OAuth, listado de carpetas y sincronización básica encapsulada. Si Zoho no está configurado, los endpoints responden:

```json
{
  "ok": false,
  "code": "ZOHO_CONNECTOR_NOT_CONFIGURED",
  "error": "Conector Zoho no configurado"
}
```

Los endpoints y scopes fueron implementados contra la familia WorkDrive/Zoho Files API documentada por Zoho. Si un data center o plan usa variantes de endpoint, ajustar sólo las variables de entorno y el servicio `zohoWorkdriveClient.service.js`.

## Carpeta Compartida Montada

`mounted_share` está pensado para carpetas montadas por Tecdex o un administrador técnico en el backend.

Ejemplo:

```bash
LOCAL_DOCUMENT_ROOT=/home/tecdex/document-sources
folder_path=rieltec/evidencias
```

Ruta final:

```text
/home/tecdex/document-sources/rieltec/evidencias
```

Validaciones:

- No acepta rutas absolutas.
- No acepta `..`.
- No sigue symlinks fuera del root.
- No lista directorios fuera del root.
- Sólo indexa extensiones permitidas: `pdf`, `docx`, `xlsx`, `csv`, `txt`, `md`, `png`, `jpg`, `jpeg`.

Si `LOCAL_DOCUMENT_ROOT` no está configurado, responde `MOUNTED_SHARE_NOT_CONFIGURED`, no `500`.

## TCDX Sync Agent

Primera versión Node.js CLI:

```bash
cd agent/tcdx-sync-agent
npm install
npm run check
node agent.js register --base-url https://HOST --pairing-code CODIGO --folder /ruta/local
node agent.js sync
node agent.js status
```

El agente:

- Guarda configuración local en `~/.tcdx-sync-agent/config.json`.
- No envía rutas absolutas al backend.
- No acepta `tenant_id` manual.
- Usa `agent_token` para deducir tenant/source en backend.
- Ignora temporales como `.DS_Store`, `Thumbs.db`, `~$*`, `*.tmp`.

## Flujo Cliente

1. Entrar a Evidencias.
2. Abrir Fuentes documentales.
3. Conectar fuente externa.
4. Seleccionar proveedor.
5. Autorizar OAuth o vincular agente.
6. Seleccionar carpeta.
7. Sincronizar.
8. Revisar sugerencias.
9. Aprobar evidencia formal.

## Sincronización Incremental

Cada fuente mantiene documentos en `document_index` con clave lógica:

```text
tenant_id + provider + provider_file_id
```

Para Google Drive, `provider_file_id` es el ID real del archivo. Por eso una segunda sincronización de la misma carpeta no duplica documentos, aunque cambie el nombre, ruta o versión.

Estados principales:

- `indexed`: archivo nuevo indexado.
- `updated`: archivo existente con checksum, versión, metadata o ruta actualizada.
- `missing`: archivo que pertenecía a la fuente y ya no apareció en la sincronización actual.
- `ignored`: duplicado histórico preservado para trazabilidad.
- `error`: archivo con problema controlado, por ejemplo falta de permiso de lectura.

Los documentos `missing`, `ignored` o `error` no se borran automáticamente y no eliminan evidencias históricas.

## Desconectar Fuente

La acción “Desconectar” realiza soft delete:

- `status='disconnected'`
- `sync_enabled=false`

No borra `document_index`, evidencias, sugerencias ni tokens OAuth por defecto. La fuente desconectada no se sincroniza ni permite análisis nuevo. Para volver a operar Google Drive, el usuario debe reconectar OAuth o crear una fuente nueva según el caso.

## Seguridad Google Drive

- Tokens cifrados en BD.
- Tokens nunca retornan al frontend.
- No se registran headers `Authorization`.
- Toda query usa `tenant_id`.
- No existen fuentes globales compartidas entre tenants.

No se crea evidencia automáticamente. Toda evidencia promovida queda pendiente, con revisión humana obligatoria.

## Endpoints Principales

- `GET /api/document-integrations/sources`
- `POST /api/document-integrations/sources`
- `GET /api/document-integrations/sources/:sourceId`
- `PATCH /api/document-integrations/sources/:sourceId`
- `DELETE /api/document-integrations/sources/:sourceId`
- `POST /api/document-integrations/sources/:sourceId/sync`
- `GET /api/document-integrations/sources/:sourceId/documents`
- `GET /api/document-integrations/documents/:documentId/download`
- `GET /api/document-integrations/zoho/oauth/start`
- `GET /api/document-integrations/zoho/oauth/callback`
- `GET /api/document-integrations/zoho/folders`
- `POST /api/document-integrations/zoho/sources`
- `POST /api/document-integrations/zoho/sync`
- `POST /api/document-integrations/agents/pairing-codes`
- `POST /api/agent/register`
- `POST /api/agent/heartbeat`
- `GET /api/agent/config`
- `POST /api/agent/documents/index`
- `POST /api/agent/documents/upload`

## QA

Script principal:

```bash
scripts/test-document-sources-tenant-isolation-flow.sh
```

Valida:

- Token requerido.
- Creación de fuente local agent.
- Bloqueo de path traversal en mounted share.
- Zoho no configurado como error controlado.
- Pairing code.
- Registro de agente.
- Heartbeat.
- Indexación de manifest sin aceptar tenant_id del body.
- No leak de secretos.
- Aislamiento tenant B si se entregan credenciales.

## Limitaciones Conocidas

- Zoho puede requerir ajuste fino por data center o plan WorkDrive específico.
- El agente local es CLI mínimo; no incluye instalador Windows/macOS todavía.
- La sincronización Google existente indexa metadata y referencias; descarga binaria directa depende de permisos del documento.
- `manual_upload` se apoya en el flujo de carga existente de evidencias.
