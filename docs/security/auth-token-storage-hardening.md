# Auth Token Storage Hardening

## Estado

Excepcion arquitectonica controlada. La sesion web sigue usando JWT bearer persistido en `localStorage` hasta ejecutar una migracion completa a cookie `HttpOnly`.

## Justificacion

No se implementa una migracion parcial en este cierre porque el contrato actual esta distribuido en el frontend:

- `frontend/src/utils/auth.ts` persiste y lee `localStorage.getItem('token')`.
- Las pantallas y componentes envian `Authorization: Bearer <token>` de forma directa.
- La busqueda local del repositorio muestra mas de 300 referencias a `localStorage` de token o bearer headers.
- El backend emite el token en JSON desde `/api/auth/login` y el middleware de auth lee bearer.
- Aunque CORS tiene `credentials: true`, la migracion completa requiere validar dominio, SameSite, Secure, reverse proxy y logout con `Set-Cookie`/clear-cookie en el entorno real.

Cambiar solo una parte dejaria sesiones inconsistentes o dobles fuentes de verdad para auth/RBAC/multi-tenant.

## Controles Compensatorios Vigentes

- No se encontraron usos de `dangerouslySetInnerHTML`, `eval(` ni `new Function` en `frontend/src`, `backend/src`, `agent` o `ai-engine` durante este cierre.
- ESLint frontend esta en 0 warnings / 0 errors segun baseline de la rama.
- Los logs backend sensibles revisados no imprimen tokens, cookies, passwords, cuerpos completos ni archivos completos; usan contexto acotado y errores sanitizados.
- El middleware backend conserva validacion JWT con algoritmo `HS256` y opciones de issuer/audience cuando estan configuradas.
- Produccion falla al iniciar si no existe secreto JWT explicito y fuerte.

## Plan Cerrado de Migracion

1. Backend: agregar emision de cookie `HttpOnly; Secure; SameSite=Lax` o `SameSite=None; Secure` segun dominio final, en `/api/auth/login`.
2. Backend: agregar `/api/auth/logout` que limpie la cookie con los mismos atributos de dominio/path.
3. Backend: cambiar middleware auth para leer cookie primero y bearer como compatibilidad temporal auditada.
4. Frontend: encapsular fetch/API client para usar `credentials: 'include'` de forma consistente.
5. Frontend: eliminar persistencia de JWT en `localStorage` y migrar derivacion de usuario/rol/tenant a `/api/auth/validate` o endpoint `/api/me/session`.
6. Infraestructura: validar CORS allowlist, dominio publico, TLS, proxy headers y atributos `SameSite` en staging.
7. Pruebas: cubrir login, logout, expiracion, refresh de pagina, RBAC, cambio de tenant, descargas autorizadas y flujos multipart.
8. Transicion: desplegar bearer fallback por una ventana corta, medir uso y retirarlo en una version posterior.

## Criterio de Cierre Futuro

- Ninguna referencia a `localStorage` para JWT.
- Ningun bearer header generado por UI para endpoints de sesion web.
- Cookies `HttpOnly` verificadas en staging y produccion.
- Logout invalida la cookie y no quedan tokens reutilizables en almacenamiento web.
