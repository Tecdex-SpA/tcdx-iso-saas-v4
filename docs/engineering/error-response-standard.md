# Error Response Standard

Fecha: 2026-06-11
Rama: `chore/operational-governance-cleanup`
Base: `13b5721`

## Objetivo

Definir un formato JSON estable para errores API de ISOS-SAAS-TECDEX y un plan
gradual de adopcion que reduzca ambiguedad sin romper frontend, integraciones,
QA runtime ni rutas legacy.

Este documento no cambia runtime. La adopcion en backend requiere bloque
posterior aprobado, pruebas y revision de consumidores.

## Alcance

Aplica a nuevas rutas API, middleware central y endpoints core cuando se toquen
por mantenimiento. No exige reescribir todas las rutas existentes en bloque.

Quedan fuera de este bloque:

- cambios en `backend/src/app.js`;
- cambios en rutas o middleware backend;
- cambios frontend;
- cambios AI Engine;
- cambios scripts o database.

## Inventario de formatos actuales

La revision estatica detecto formatos mixtos:

| Formato | Uso detectado | Riesgo |
|---|---|---|
| `{ ok: false, code, error }` | Rutas nuevas, uploads, tenant scope, sync agent, integraciones documentales. | Falta `request_id` y `message` consistente en algunas respuestas. |
| `{ ok: false, error_code, code, message, error, request_id }` | Rate limiter y `securityErrorHandler` en `backend/src/app.js`; algunas rutas IA. | Compatible pero redundante; `error_code` debe considerarse alias temporal. |
| `{ error: "..." }` | Rutas legacy/core como auditorias, search, SoA, KPI, assets, users. | Dificulta manejo uniforme en frontend y QA. |
| `{ success: false }` o variantes | Endpoints historicos y respuestas antiguas. | Semantica distinta a `ok`; requiere compatibilidad gradual. |
| HTML/archivo/stream con error JSON parcial | Descargas, uploads y rutas static. | Deben preservar headers/contratos de descarga. |

Tambien existe infraestructura parcial:

- `backend/src/app.js` crea `req.requestId` desde `x-request-id` o genera uno.
- `backend/src/app.js` setea header `X-Request-Id`.
- `securityErrorHandler` existe al final de `backend/src/app.js`.
- Rutas legacy/core responden directamente y no pasan por un helper comun.

## Formato estandar recomendado

Errores:

```json
{
  "ok": false,
  "code": "STRING_STABLE",
  "message": "Mensaje seguro",
  "request_id": "uuid-or-correlation-id",
  "details": {}
}
```

Exito, solo para endpoints que puedan adoptarlo sin romper consumidores:

```json
{
  "ok": true,
  "data": {},
  "request_id": "uuid-or-correlation-id"
}
```

### Campos

| Campo | Requerido | Descripcion |
|---|---|---|
| `ok` | Si | `false` en errores, `true` en exito. |
| `code` | Si | Codigo estable, uppercase, sin datos dinamicos. |
| `message` | Si | Mensaje seguro para usuario/API client. |
| `request_id` | Si cuando exista | Valor de `req.requestId` o `null` si no aplica. |
| `details` | Opcional | Objeto seguro, acotado y sin secretos. |

Aliases temporales permitidos durante migracion:

- `error`: puede duplicar `message` para consumidores legacy.
- `error_code`: puede duplicar `code` en endpoints ya publicados.
- `success`: no usar en endpoints nuevos; mantener solo por compatibilidad.

## Reglas de seguridad

- No exponer stack traces en produccion.
- No exponer secretos, tokens, cookies, passwords, API keys ni headers
  Authorization.
- No exponer SQL raw, queries parametrizadas completas, nombres de tablas
  sensibles ni errores internos de driver.
- No exponer paths internos sensibles del filesystem.
- No incluir IDs de recursos cross-tenant si la respuesta debe ser `403/404`
  opaca.
- `details` debe ser seguro, corto y orientado a cliente API.
- Logs internos pueden incluir mas contexto operacional, pero separados de la
  respuesta cliente y sin secretos.
- En uploads, no devolver ruta absoluta; devolver codigo y mensaje seguro.
- En IA, indicar indisponibilidad o revision requerida sin revelar prompts,
  trazas privadas, chunks o proveedor si no corresponde.

## Codigos minimos

| Code | HTTP sugerido | Uso |
|---|---:|---|
| `AUTH_REQUIRED` | 401 | Falta token, token invalido o sesion requerida. |
| `FORBIDDEN` | 403 | Usuario autenticado sin permiso. |
| `TENANT_FORBIDDEN` | 403 o 404 | Acceso a tenant ajeno; preferir opacidad si el recurso no debe revelarse. |
| `NOT_FOUND` | 404 | Recurso inexistente o no visible. |
| `VALIDATION_ERROR` | 400 | Payload, query o path invalido. |
| `INTERNAL_ERROR` | 500 | Error inesperado seguro para cliente. |
| `RATE_LIMITED` | 429 | Limite de requests superado. |
| `UPLOAD_REJECTED` | 400 | Upload rechazado por politica general. |
| `FILE_TOO_LARGE` | 413 o 400 | Archivo excede limite. |
| `UNSUPPORTED_FILE_TYPE` | 400 | Extension o MIME no permitido. |
| `AI_UNAVAILABLE` | 503 | Motor IA/proveedor no disponible. |
| `AI_REVIEW_REQUIRED` | 409 o 422 | Salida IA existe pero requiere revision humana antes de aplicarse. |

Codigos especificos de dominio pueden mantenerse, por ejemplo
`ZOHO_RECONNECT_REQUIRED`, `EVIDENCE_FILE_TYPE_NOT_ALLOWED`,
`REPORT_EXPORT_FORBIDDEN` o `RBAC_DENIED`, siempre que el formato externo sea
compatible.

## Mapeo HTTP

| Familia | HTTP | Regla |
|---|---:|---|
| Autenticacion | 401 | Falta/expira token. |
| Autorizacion | 403 | Rol, permiso o tenant denegado. |
| Opacidad cross-tenant | 403/404 | Evitar confirmar existencia cuando aplique. |
| Validacion | 400/422 | Preferir 400 para payload simple; 422 para reglas semanticas si se adopta. |
| Conflicto de estado | 409 | Recurso conectado/desconectado, revision requerida, estado incompatible. |
| Rate limit | 429 | Incluir `Retry-After` cuando aplique. |
| Upload demasiado grande | 413 | Aceptar 400 legacy hasta migracion. |
| Servicio externo/IA no disponible | 503 | Sin exponer proveedor/secreto. |
| Error inesperado | 500 | Mensaje generico y `request_id`. |

## Compatibilidad con formatos existentes

Durante la transicion, endpoints existentes pueden responder con aliases:

```json
{
  "ok": false,
  "code": "TENANT_FORBIDDEN",
  "error_code": "TENANT_FORBIDDEN",
  "message": "No autorizado para este tenant",
  "error": "No autorizado para este tenant",
  "request_id": "req-...",
  "details": {}
}
```

Reglas de compatibilidad:

- No eliminar `error` en endpoints consumidos por frontend hasta revisar
  consumidores.
- No eliminar `error_code` donde ya se publico en QA o scripts.
- No convertir descargas a JSON si el contrato exitoso es archivo/stream.
- No cambiar status HTTP cross-tenant si QA espera `403/404`.
- No cambiar endpoints legacy solo para limpiar estilo.

## Estrategia de adopcion gradual

### Fase 1: documentar

Estado actual de Sprint 3. Se publica este estandar y se registra la deuda.
No hay cambio runtime.

### Fase 2: middleware central

Solo con aprobacion posterior, evaluar un helper o ajuste central minimo para
errores que ya llegan a `securityErrorHandler`.

Criterios de seguridad:

- mantener `error` y `error_code` como alias temporal;
- preservar `request_id`;
- no cambiar respuestas directas de rutas legacy;
- `backend npm test`, `npm run check`, smoke y QA core deben pasar.

### Fase 3: endpoints core nuevos

Aplicar el formato estandar a rutas nuevas y endpoints core que se modifiquen
por una razon funcional, por ejemplo RBAC, tenant scope, uploads o IA.

### Fase 4: rutas legacy

Migrar rutas legacy solo cuando:

- se toquen por bug real o hardening;
- exista consumidor frontend/API revisado;
- haya QA especifica;
- se mantengan aliases temporales si el frontend los usa.

## Criterios para no modificar rutas legacy

No modificar una ruta legacy si:

- el cambio solo es estetico;
- no existe prueba o QA para el consumidor;
- la ruta devuelve archivos o streams;
- la ruta tiene dependencias frontend no revisadas;
- cambiar `error` a `message` puede romper UI;
- el endpoint participa en demo/piloto estable y no hay bug actual.

## Ejemplos seguros

Validacion:

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "tenant_id es obligatorio",
  "request_id": "req-123",
  "details": {
    "field": "tenant_id"
  }
}
```

Tenant ajeno:

```json
{
  "ok": false,
  "code": "TENANT_FORBIDDEN",
  "message": "No autorizado para este tenant",
  "request_id": "req-123",
  "details": {}
}
```

IA no disponible:

```json
{
  "ok": false,
  "code": "AI_UNAVAILABLE",
  "message": "El asistente IA no esta disponible temporalmente. Intenta nuevamente mas tarde.",
  "request_id": "req-123",
  "details": {
    "fallback_available": true
  }
}
```

Upload rechazado:

```json
{
  "ok": false,
  "code": "UNSUPPORTED_FILE_TYPE",
  "message": "Tipo de archivo no permitido",
  "request_id": "req-123",
  "details": {
    "allowed_extensions": [".pdf", ".docx", ".xlsx"]
  }
}
```

## Ejemplos prohibidos

No responder con stack trace:

```json
{
  "ok": false,
  "code": "INTERNAL_ERROR",
  "message": "TypeError: Cannot read properties of undefined at /home/tecdex/backend/src/routes/...",
  "stack": "..."
}
```

No responder con SQL raw:

```json
{
  "ok": false,
  "code": "INTERNAL_ERROR",
  "message": "select * from users where email='cliente@empresa.com' failed"
}
```

No responder con secretos o headers:

```json
{
  "ok": false,
  "code": "AUTH_REQUIRED",
  "details": {
    "authorization": "Bearer eyJ..."
  }
}
```

No responder con paths internos:

```json
{
  "ok": false,
  "code": "FILE_NOT_FOUND",
  "message": "/home/tecdex/backend/uploads/evidences/tenant-a/private.pdf no existe"
}
```

## Decision Sprint 3 Bloque 2

No se aplica cambio runtime en este bloque. El estandar queda definido para
adopcion gradual posterior y para nuevos endpoints o hardening aprobado.
