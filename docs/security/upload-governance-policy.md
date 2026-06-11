# Upload Governance Policy

Fecha: 2026-06-11
Rama: `chore/operational-governance-cleanup`
Base: `13b5721`

## Objetivo

Definir una politica de gobernanza de uploads por modulo, tenant y exposicion,
sin modificar runtime. Este documento consolida allowlists, limites, rutas de
storage, exposicion y riesgos inferidos desde el codigo actual.

No se modifican allowlists, storage paths, limites, rutas ni runtime en este
bloque.

## Reglas minimas

- No subir evidencia real de clientes al repositorio.
- No versionar `uploads/`, `qa-results/`, dumps, backups ni artefactos con datos
  de clientes.
- No exponer rutas internas ni paths absolutos en respuestas cliente.
- No ampliar extensiones permitidas sin revision de seguridad, pruebas y owner.
- No permitir path traversal; normalizar y validar todo nombre o path relativo.
- Separar storage publico de storage privado.
- Todo archivo de tenant debe quedar tenant-scoped y descargarse con JWT/RBAC
  cuando no sea un asset deliberadamente publico.
- ZIPs deben tener limites de tamano, cantidad de archivos, extraccion total,
  rutas seguras y manejo de archivos cifrados/metodos no soportados.
- Validar extension y MIME cuando aplique; no confiar solo en `originalname`.
- Registrar uploader, tenant, fecha, modulo, nombre original, path almacenado,
  MIME, tamano y hash cuando el modulo lo soporte.
- Definir retencion y eliminacion segura por modulo.
- Mantener backups de DB y uploads segun politica pre-cliente antes de piloto o
  production.

## Inventario de modulos

| Modulo | Archivo/ruta backend | Endpoint o flujo | Tipos permitidos | Allowlist actual inferida | Tamano maximo inferido | Storage path inferido | Exposicion | Tenant scoped | Auth/autorizacion | Validaciones existentes | Riesgo principal | Retencion sugerida | Cuotas sugeridas | Owner | Recomendacion | Pendiente tecnico |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Evidencias | `backend/src/routes/evidences.routes.js` | `POST /api/evidences/upload`, `GET /api/evidences/file/:id` | PDF, Word, Excel, CSV, imagenes, TXT | `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.csv`, `.png`, `.jpg`, `.jpeg`, `.txt` con MIME asociado | `EVIDENCE_UPLOAD_MAX_BYTES` o 25 MB | `uploads/evidences` | Privada, descarga autenticada | Si | JWT, tenant access, roles de revision para acciones | Extension+MIME, nombre generado con UUID, size limit, download por ID con tenant check | Office/Excel no confiable, privacidad evidencia, path fallback legacy | Mantener durante ciclo contractual y auditoria; eliminar segura por politica tenant | Cuota por tenant y por evidencia; alertar por tamano total | Backend/Security | Mantener privado y tenant-scoped; agregar hash/retencion formal si falta | Verificar antivirus/DLP y retencion por tenant. |
| Evidence Library manual | `backend/src/routes/evidence-library.routes.js`, `backend/src/services/evidenceLibrary.service.js` | `POST /api/evidence-library/manual-upload/files`, `POST /api/evidence-library/manual-upload/zip` | Documentos, hojas, texto, JSON, imagenes, ZIP contenedor | Archivos: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.csv`, `.txt`, `.json`, `.png`, `.jpg`, `.jpeg`; ZIP solo para flujo ZIP | `EVIDENCE_LIBRARY_UPLOAD_MAX_FILE_BYTES` o 25/50 MB segun capa; `EVIDENCE_LIBRARY_ZIP_MAX_BYTES` 50 MB; extraido 250 MB; max files 50 | `uploads/evidence-library/<tenant>/manual/<date>` | Privada tenant-scoped | Si | JWT heredado, roles read/manage en servicio | Path relativo seguro, allowlist, limite por archivo, limite ZIP, limite extraido, omite cifrados/metodos no soportados | ZIP bombs, Office/Excel, JSON con datos sensibles, volumen por tenant | Retener mientras sea fuente documental activa; purgar versiones obsoletas con aprobacion | Cuota por tenant, max archivos por carga, max ZIP por dia | Backend/Security/Producto | Mantener controles ZIP estrictos; documentar limpieza y hash obligatorio | Verificar runtime de limites efectivos y escaneo malware. |
| Audit reports | `backend/src/routes/audits.routes.js` | `POST /api/audits/upload/:id`, `GET /api/audits/report/:id` | Informes PDF/DOC/DOCX | `.pdf`, `.doc`, `.docx` con MIME PDF/Word | `AUDIT_REPORT_UPLOAD_MAX_BYTES` o 25 MB | `uploads/audit-reports` | Privada, descarga autenticada | Si | JWT, `canManageAudits`, tenant access por audit | Extension+MIME, size limit, filename UUID, tenant check en download | Informe puede contener datos sensibles de auditoria | Retener por periodo legal/contrato auditoria | Cuota por tenant/auditoria; versionado por informe | Backend/QA/Security | Mantener descarga autenticada; no publicar en `/uploads` static | Formalizar retencion y versionado. |
| Audit preparation ZIPs | `backend/src/routes/auditPreparation.routes.js`, `auditPreparation.service.js`, `auditZipExtraction.service.js` | `POST /api/audit-preparation/upload-zip` y flujo de package | ZIP | `.zip` y MIME ZIP/octet-stream aceptado | `AUDIT_PREPARATION_ZIP_MAX_BYTES` o 50 MB; extraccion por servicio usa limites internos | `uploads/audit-preparation-zips` | Privada/interna beta | Parcial, inferido por package/user | JWT global API y servicio audit preparation | Extension+MIME, size limit, safe ZIP paths, omite rutas inseguras | ZIP bombs, path traversal, documentos externos con prompt injection, datos sensibles | Retener solo mientras dure preparacion; purga tras cierre/export | Cuota por package/tenant, max ZIP por periodo | Backend/Security/AI | Mantener beta/interno hasta cubrir QA completa | Verificar limites de extraccion total y politica malware. |
| Audit generated docs | `backend/src/services/auditDocumentRenderer.service.js`, `auditPreparation.controller.js` | `GET /api/audit-preparation/documents/:documentId/download`, package export | DOCX/PDF/XLSX generados, ZIP export | Inferido por renderer/formato solicitado | No se observa limite unico; depende de renderer y template | `uploads/audit-preparation-generated`, `uploads/audit-preparation-exports` | Privada, descarga autenticada | Si, inferido por package/document service | JWT global API y servicio audit preparation | `res.download` desde file service, nombre sanitizado en renderer | Documentos generados pueden contener datos tenant y salidas IA | Retener por package; archivar o purgar tras auditoria | Cuota por package y tamano total generado | Backend/Producto | No exponer paths internos; mantener revision humana antes de publicar | Definir retencion/versionado y limites de generacion. |
| Tenant files | `backend/src/routes/tenant-files.routes.js` | `GET /api/files/tenant/:tenantId/*filePath` | Descarga de archivos tenant existentes | No aplica upload directo en ruta; filePath arbitrario bajo root | No aplica | `uploads/tenants` inferido desde route; requiere verificacion por diferencia posible de raiz | Privada tenant-scoped | Si | JWT global API, platform bypass o tenant exacto | UUID tenant, path relativo normalizado, realpath, stat file, `res.download` | Path traversal y ambiguedad de storage root | Retener segun modulo origen | Cuota por modulo origen | Backend/Security | Mantener solo descarga autenticada; no usar como storage generico sin owner | Verificar runtime del root efectivo y consistencia con public `/uploads/tenants`. |
| Logos/admin SaaS | `backend/src/routes/admin-saas.routes.js` | `PUT /api/admin-saas/tenants/:tenant_id/logo` | Imagen/logo | No se observa fileFilter; limite 5 MB | 5 MB | `uploads/logos` | Publica por `/uploads/logos` | Parcial: asset publico asociado a tenant | JWT/admin SaaS, platform/dealer visibility segun ruta | Filename sanitizado parcial en admin SaaS | SVG/imagen publica, tracking, contenido activo, cache | Retener ultimo logo activo y versiones recientes | Cuota baja por tenant | Platform/Security | Agregar allowlist MIME/extension antes de ampliar uso | Verificar SVG y sanitizacion; definir purge de logos antiguos. |
| Logos tenant legacy | `backend/src/routes/tenants.routes.js`, `backend/src/app.js` | Upload tenant/logo legacy; static `/uploads/logos`, `/uploads/tenant-logos`, `/uploads/tenants/:fileName` | Imagen/logo | En public `/uploads/tenants`: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`; upload legacy no muestra fileFilter | Desconocido en legacy `tenants.routes.js` | `uploads/logos`, `uploads/tenant-logos`, `uploads/tenants` | Publica deliberada | Parcial/no para assets publicos | JWT para rutas API; static publico | Basename/ext y symlink guard en `/uploads/tenants/:fileName`; static directo en otros | SVG publico, falta allowlist en upload legacy, exposicion accidental | Retener logos activos; limpiar huerfanos | Cuota baja por tenant | Platform/Backend | Separar claramente assets publicos de privados | Revisar upload legacy y static directos. |
| Perfil/avatar | `backend/src/routes/user.routes.js` | `POST /api/user/me/avatar`, static `/uploads/profiles` | Imagen de perfil inferida | No se observa allowlist ni limite explicito en route | Desconocido | `uploads/profiles` | Publica por static | Usuario autenticado, no tenant-scoped explicito en path | JWT usuario propio | Multer disk storage simple | Upload de tipo arbitrario si no hay filtro, exposicion publica | Retener avatar activo; borrar reemplazados | Cuota por usuario y limite por archivo | Backend/Security | Agregar allowlist y limite en hardening futuro | Verificar riesgo de content-type y extension. |
| Agent uploads | `backend/src/routes/sync-agent.routes.js` | `POST /api/agent/documents/upload` | Documentos y evidencias desde agente | `pdf`, `docx`, `xlsx`, `csv`, `txt`, `md`, `png`, `jpg`, `jpeg` | `AGENT_UPLOAD_MAX_BYTES` o 50 MB | `uploads/document-sources` | Interna, agente tenant-scoped | Si, via agent/source/tenant | Token agente propio, hash secret, source activa | Memory upload, extension allowlist, safe relative path, path traversal guard | Token agente, volumen, documentos no confiables, tenant isolation | Retener mientras fuente local activa; purga al desconectar | Cuota por source/tenant y rate limit | Integraciones/Security | Mantener tokens fuera de logs; escaneo de contenido | Definir rotacion token agente y retencion. |
| Reports/exportes | `backend/src/routes/reports.routes.js`, `reportPremiumExport.service.js` | `POST /api/reports/generate`, exports PDF/ZIP, `GET /api/reports/download/:id` | PDF generado, ZIP premium temporal | Generado por servidor; no upload usuario directo | Depende renderer; no limite unico observado | Persistente: `uploads/reports/<tenant>`; temporal premium: `os.tmpdir()/tcdx-report-exports` | Privada por API; legacy file_url puede apuntar a `/uploads/reports/...` | Si | JWT, reports RBAC, tenant/dealer/platform access | Tenant folder, download por export ID, RBAC Sprint 2, temp cleanup para premium | Exposicion legacy, documentos sensibles, IA requiere revision humana | Retener segun politica reportes; expirar exports antiguos | Cuota por tenant/mes y tamano total | Backend/Security/Producto | No exponer `/uploads/reports` static; mantener descarga por ID | Definir TTL y limpieza de exports. |
| Document integrations | `backend/src/routes/document-integrations*.js`, `documentGoogleSync.service.js`, `documentContentExtraction.service.js` | Google/Zoho/local mounted/manual documents, `GET /api/document-integrations/documents/:documentId/download` | Remoto o local segun provider | Google/Zoho dependen proveedor; local/manual/agent dependen origen | `MAX_DOWNLOAD_BYTES` inferido en extraccion; provider-dependent | `document_index.local_storage_path`, uploads o `LOCAL_DOCUMENT_ROOT` | Privada tenant-scoped; external download puede devolver URL proveedor | Si, por tenant/source | JWT, tenant assert, source tenant, provider credentials | Tenant query, provider checks, local path bajo uploads/local root para extraccion | Prompt injection, datos externos no confiables, URL externa, credenciales proveedor | Retener indice; cache local segun source policy | Cuota por source/tenant y descargas/analisis | Integraciones/AI/Security | Tratar documentos externos como no confiables; no enviar secretos a IA | Definir redaccion, retencion y reconnect UX por provider. |
| Uploads temporales | `backend/src/services/reportPremiumExport.service.js`, renderers PDF | Render/export temporal | PDF/ZIP generados | Generado por servidor | Depende renderer/flujo | `os.tmpdir()/tcdx-report-exports`, `/tmp` para algunos renderers | Temporal interno | Tenant scoped por payload/proceso, inferido | Depende endpoint que invoca | `fs.unlink` en flujo premium PDF; otros requieren verificacion | Fugas temporales, disco lleno, datos sensibles en `/tmp` | Borrar inmediato o job cleanup diario | Cuota de disco y TTL horas | DevOps/Backend | Monitorear tmp y limpiar con job seguro | Inventariar todos los temporales y TTL. |

## Riesgos especiales

### ZIPs de audit preparation

- Riesgo de ZIP bombs, rutas inseguras, archivos cifrados y metodos no
  soportados.
- Mantener limites de archivo, total extraido y cantidad.
- No extraer paths absolutos, `..` ni entradas con separadores ambiguos.
- Toda evidencia importada desde ZIP requiere revision humana antes de uso
  formal.

### Evidence Library con ZIP

- Permite combinar multiples documentos tenant-scoped.
- Debe conservar max files, max bytes por archivo y max bytes extraidos.
- Requiere cuota por tenant para evitar consumo de disco.

### Excel/Office

- `.xls`, `.xlsx`, `.doc`, `.docx` son inputs no confiables.
- Mantener parser actualizado y evitar macros o contenido activo.
- No registrar contenido completo en logs.

### Logos publicos

- Son assets deliberadamente publicos, pero no deben mezclarse con evidencia ni
  documentos privados.
- SVG requiere especial cuidado por contenido activo y CSP.
- Deben tener allowlist, tamano maximo, sanitizacion de nombre y limpieza de
  versiones antiguas.

### Agent uploads

- Dependen de token agente y source activa.
- No imprimir token ni paths privados.
- Cada archivo debe asociarse a tenant/source y quedar dentro de storage
  autorizado.

### Report exports

- Contienen datos sensibles y posible narrativa IA.
- Deben descargarse por API autenticada y RBAC, no por static publico.
- Requieren TTL, cuota y limpieza de exports antiguos.

### Tenant files

- Deben ser siempre tenant-scoped.
- El root efectivo debe verificarse runtime porque el codigo usa rutas
  inferidas por `__dirname`.
- No debe usarse para exponer evidencia privada mediante static.

## Politica de retencion sugerida

| Tipo | Retencion sugerida |
|---|---|
| Evidencias oficiales | Durante vigencia contractual, auditoria y periodo legal aplicable. |
| Evidencias rechazadas/borrador | 90 a 180 dias o segun politica tenant. |
| Uploads manuales no asociados | 30 a 90 dias con aviso. |
| ZIPs de preparacion | Hasta cierre del package + ventana corta de recuperacion. |
| Report exports | 30 a 180 dias segun plan; borrar exports obsoletos. |
| Logos/avatar | Mantener activo y una version anterior; purgar huerfanos. |
| Temporales | Horas o dias, nunca indefinido. |
| Agent/local source cache | Mientras fuente este activa y bajo cuota. |

## Cuotas sugeridas

- Cuota total por tenant para uploads privados.
- Cuota por modulo: evidencias, evidence library, reports, audit preparation,
  agent sources.
- Limite por archivo y por lote.
- Limite diario/semanal para ZIPs y agent uploads.
- Alertas de disco y de crecimiento anomalo.
- Bloqueo fail-fast si el filesystem de uploads esta lleno o no escribible.

## Requisitos de auditoria

Cada upload privado deberia registrar, cuando aplique:

- `tenant_id`;
- `uploaded_by_user_id` o agente/source ID;
- modulo y endpoint;
- fecha/hora;
- nombre original y nombre almacenado;
- MIME y extension;
- tamano;
- hash/checksum;
- estado de revision;
- resultado de validacion;
- referencia a entidad de negocio.

## Decisiones Sprint 3 Bloque 3

- No se cambia runtime.
- No se amplian allowlists.
- No se mueven storage paths.
- No se borran uploads.
- No se ejecutan scripts.
- Los riesgos quedan documentados para hardening posterior.
