# Runbook minimo de incidentes de seguridad

## Objetivo

Definir contencion, preservacion de evidencia y validacion posterior para incidentes basicos de seguridad en TCDX ISO SaaS v4.

Este runbook no reemplaza un proceso formal de respuesta a incidentes. Sirve como guia minima para actuar sin improvisacion y sin destruir evidencia.

## Reglas generales

- No borrar logs antes de preservar evidencia.
- No publicar tokens, contrasenas ni secretos en tickets, chats o documentos.
- No ejecutar rotaciones destructivas sin aprobacion del responsable.
- No modificar datos de cliente salvo contencion autorizada.
- Registrar hora, responsable, impacto estimado y acciones ejecutadas.

## Sospecha de token filtrado

| Campo | Accion |
|---|---|
| Sintoma | Token JWT completo aparece en log, screenshot, chat, ticket o trafico no autorizado. |
| Contencion inmediata | Revocar sesion si existe mecanismo; forzar logout del usuario afectado; bloquear token en proxy/app si hay lista de revocacion disponible. |
| Evidencia a preservar | Timestamp, request_id, user_id, tenant_id, origen del hallazgo y copia sanitizada sin token completo. |
| Rotacion/revocacion | Cambiar contrasena del usuario si aplica; reducir ventana de exposicion; evaluar rotacion de `JWT_SECRET` si el token permite impacto amplio. |
| Validacion posterior | Confirmar que el token ya no permite acceder; revisar logs por uso posterior; validar que no se imprimen tokens completos. |
| Responsable | Backend + Operaciones. |

## Sospecha de JWT_SECRET comprometido

| Campo | Accion |
|---|---|
| Sintoma | `JWT_SECRET` aparece expuesto, fue compartido, o hay tokens validos no emitidos por el sistema. |
| Contencion inmediata | Congelar altas sensibles; preparar rotacion coordinada; comunicar ventana de invalidacion de sesiones. |
| Evidencia a preservar | Donde se expuso, hora, responsables con acceso, alcance de tenants potencialmente afectados. |
| Rotacion/revocacion | Rotar `JWT_SECRET` en entorno seguro; reiniciar backend; invalidar sesiones existentes; no publicar el nuevo valor. |
| Validacion posterior | Login funciona; tokens anteriores fallan; logs no contienen el secreto; CORS y auth siguen operativos. |
| Responsable | Operaciones + Backend + Responsable de seguridad. |

## Upload malicioso

| Campo | Accion |
|---|---|
| Sintoma | Archivo sospechoso subido, extension inesperada, malware reportado o intento de path traversal. |
| Contencion inmediata | Aislar archivo; bloquear descarga publica si aplica; suspender temporalmente la cuenta o tenant si hay abuso activo. |
| Evidencia a preservar | Metadata del archivo, tenant_id, user_id, request_id, hash del archivo, ruta logica y hora. |
| Rotacion/revocacion | Revocar accesos del usuario si corresponde; no borrar el archivo antes de preservar evidencia autorizada. |
| Validacion posterior | Confirmar allowlist MIME/ext, limite de tamano, nombre saneado y que no se expone path absoluto. |
| Responsable | Backend + Operaciones. |

## Exposicion accidental de logs

| Campo | Accion |
|---|---|
| Sintoma | Logs publicados o compartidos contienen tokens, passwords, secrets, `DATABASE_URL` o PII innecesaria. |
| Contencion inmediata | Retirar acceso al artefacto expuesto; reemplazarlo por version sanitizada; limitar distribucion. |
| Evidencia a preservar | Ubicacion del artefacto, tiempo de exposicion, personas con acceso, campos comprometidos. |
| Rotacion/revocacion | Rotar secretos expuestos; revocar tokens; cambiar contrasenas afectadas si aplica. |
| Validacion posterior | Buscar patrones sensibles en logs recientes; revisar codigo de logging; documentar correccion. |
| Responsable | Operaciones + Backend. |

## Error CORS abierto

| Campo | Accion |
|---|---|
| Sintoma | Preflight permite origen externo no autorizado o `Access-Control-Allow-Origin: *` con credenciales. |
| Contencion inmediata | Restringir temporalmente origen en proxy/app; bloquear origen abusivo si hay evidencia de uso. |
| Evidencia a preservar | Comando curl, headers recibidos, commit/config desplegada, timestamp. |
| Rotacion/revocacion | No suele requerir rotacion por si solo; evaluar tokens si hubo explotacion. |
| Validacion posterior | OPTIONS para origen permitido y origen denegado; verificar que evil origin no se refleje. |
| Responsable | Backend + Operaciones. |

## Usuario con rol incorrecto

| Campo | Accion |
|---|---|
| Sintoma | Usuario puede acceder a funciones de rol superior o no corresponde a su tenant. |
| Contencion inmediata | Desactivar usuario o bajar rol; suspender invitaciones pendientes si aplica. |
| Evidencia a preservar | user_id, tenant_id, rol previo, rol esperado, endpoint accedido, request_id. |
| Rotacion/revocacion | Revocar sesiones del usuario; cambiar credenciales si hay sospecha de compromiso. |
| Validacion posterior | Repetir prueba con token del usuario; validar `/api/me`, menus y endpoint protegido. |
| Responsable | Operaciones + Responsable tenant + Backend. |

## Acceso cross-tenant sospechoso

| Campo | Accion |
|---|---|
| Sintoma | Usuario de tenant A ve, descarga o modifica datos de tenant B. |
| Contencion inmediata | Suspender usuario implicado; pausar endpoints afectados si el impacto es activo; preservar evidencia. |
| Evidencia a preservar | tenant_id origen/destino, user_id, recurso accedido, request_id, URL, hora, payload sanitizado. |
| Rotacion/revocacion | Revocar sesiones del usuario; revisar asignaciones de tenant y roles; no modificar datos sin respaldo. |
| Validacion posterior | Ejecutar `docs/operations/cross-tenant-validation.md`; confirmar reportes, IA y uploads por tenant correcto. |
| Responsable | Backend + Operaciones + Responsable de seguridad. |

## Integracion Google/Zoho comprometida

| Campo | Accion |
|---|---|
| Sintoma | Client secret o refresh token expuesto, permisos no autorizados o actividad anomala de integracion. |
| Contencion inmediata | Revocar token en proveedor; desactivar integracion del tenant afectado; bloquear sincronizaciones nuevas. |
| Evidencia a preservar | tenant_id, proveedor, cuenta conectada, scopes, hora, request_id y logs sanitizados. |
| Rotacion/revocacion | Rotar client secret si se expuso; revocar refresh tokens; reconectar con autorizacion del cliente. |
| Validacion posterior | Sincronizacion controlada; logs muestran metadata sin tokens; errores son de negocio, no stack trace. |
| Responsable | Backend + Operaciones + Responsable tenant. |

## Cierre del incidente

Un incidente se puede cerrar cuando:

- La contencion fue ejecutada y registrada.
- La evidencia minima quedo preservada en formato sanitizado.
- Secretos/tokens afectados fueron revocados o rotados.
- La validacion posterior confirma que el vector ya no esta activo.
- Se registro responsable, fecha de cierre y accion preventiva.
