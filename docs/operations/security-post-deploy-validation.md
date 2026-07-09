# Validacion de seguridad post-deploy

## Objetivo

Ejecutar una verificacion corta y repetible despues de cada deploy de TCDX ISO SaaS v4, sin imprimir secretos ni tocar datos productivos.

Usar placeholders en los ejemplos. No copiar tokens completos al reporte.

## Variables locales sugeridas

```bash
BASE_URL="https://tcdx-iso.tecdex.net"
PUBLIC_ORIGIN="https://tcdx-iso.tecdex.net"
DENIED_ORIGIN="https://evil.example"
```

## 1. HTTPS

```bash
curl -I "$BASE_URL"
```

Esperado:

- Respuesta HTTPS valida.
- Sin error de certificado.
- No `502/504`.

## 2. Redirect HTTP a HTTPS

```bash
curl -I "http://tcdx-iso.tecdex.net"
```

Esperado:

- `301`, `302` o `308`.
- `Location: https://tcdx-iso.tecdex.net/`.

## 3. API publica

```bash
curl -i "$BASE_URL/api/health" | head -40
```

Esperado:

- Respuesta JSON de backend.
- `200` o `401` segun proteccion vigente.
- No HTML de error de proxy.
- No `502/504`.

## 4. Login controlado

Ejecutar solo con credenciales de prueba autorizadas y no imprimir token completo:

```bash
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"USUARIO_AUTORIZADO","password":"PASSWORD_AUTORIZADO"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d); const t=j.token||j.accessToken||j.data?.token||j.data?.accessToken||''; console.log(JSON.stringify({ok:!!t, token_length:t.length, user:j.user?.email||j.data?.user?.email||null}))})"
```

Esperado:

- `ok: true`.
- `token_length` mayor que cero.
- No se imprime el token.

## 5. CORS origen permitido

```bash
curl -i -X OPTIONS "$BASE_URL/api/auth/login" \
  -H "Origin: $PUBLIC_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  | head -60
```

Esperado:

- `Access-Control-Allow-Origin: https://tcdx-iso.tecdex.net`.
- Si hay credenciales, `Access-Control-Allow-Credentials: true`.
- No wildcard `*` con credenciales.

## 6. CORS origen denegado

```bash
curl -i -X OPTIONS "$BASE_URL/api/auth/login" \
  -H "Origin: $DENIED_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  | head -60
```

Esperado:

- No devuelve `Access-Control-Allow-Origin: https://evil.example`.
- Puede responder `403` con error JSON controlado.
- No stack trace.

## 7. Headers basicos

```bash
curl -I "$BASE_URL/api/auth/login"
```

Validar presencia:

- `x-content-type-options`.
- `x-frame-options`.
- `referrer-policy`.
- `permissions-policy`.
- `x-ratelimit-limit` y `x-ratelimit-remaining`, si aplica.

## 8. Rate limit basico

Smoke test no destructivo:

```bash
for i in $(seq 1 3); do
  curl -s -o /dev/null -D - "$BASE_URL/api/auth/login" | grep -Ei "x-ratelimit|retry-after|http/"
done
```

Esperado:

- Headers de rate limit presentes.
- No es necesario forzar `429` en produccion.

## 9. Logs sin secretos

En VM backend, sin imprimir `.env` completa:

```bash
cd /home/tecdex/tcdx-iso-saas-v4/backend
grep -n "JWT_SECRET\|CORS_ORIGIN\|CORS_ORIGINS\|UPLOAD\|RATE\|TIMEOUT\|TOKEN_ENCRYPTION_KEY\|DOCUMENT_INTEGRATION_ENCRYPTION_KEY" .env \
  | sed -E 's/(=).+$/=***MASKED***/'
```

Revisar logs recientes:

```bash
journalctl -u tecdex-backend.service -n 500 --no-pager \
  | grep -Ei "password|passwd|pwd|secret|jwt|bearer|token|authorization|db_password|database_url|client_secret|private_key" \
  | tail -80
```

Esperado:

- Sin tokens completos.
- Sin passwords.
- Sin secretos.
- Sin `DATABASE_URL` completa.
- Si aparecen nombres de variables sin valor o mensajes sanitizados, clasificarlos como no sensibles.

## 10. Upload smoke test

Ejecutar solo con token autorizado y archivo controlado de prueba. No subir datos reales de cliente.

```bash
TOKEN="TOKEN_AUTORIZADO_NO_IMPRIMIR"
curl -i -X POST "$BASE_URL/api/evidences/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/archivo-prueba.pdf" \
  | head -80
```

Esperado:

- Si la ruta requiere campos adicionales, el error debe ser JSON usable.
- Si el archivo se acepta, debe respetar limites, MIME/ext allowlist y tenant.
- La respuesta no debe exponer path absoluto interno.

## 11. Admin route protected smoke test

Sin token:

```bash
curl -i "$BASE_URL/api/admin-saas/overview" | head -60
```

Esperado:

- `401` o error JSON de autenticacion.
- No HTML de proxy.
- No stack trace.

Con token tenant no admin, si existe usuario controlado:

```bash
curl -i "$BASE_URL/api/admin-saas/overview" \
  -H "Authorization: Bearer TOKEN_TENANT_NO_ADMIN" \
  | head -80
```

Esperado:

- `403` o acceso denegado por RBAC/permisos.

## 12. IA Compliance sin secretos

```bash
curl -s "$BASE_URL/api/ai-compliance/engine-health" \
  -H "Authorization: Bearer TOKEN_AUTORIZADO_NO_IMPRIMIR" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d); console.log(JSON.stringify({ok:j.ok, degraded:j.degraded, status:j.status, request_id:j.request_id||j.metadata?.request_id||null}))})"
```

Esperado:

- Respuesta JSON.
- Sin prompts completos.
- Sin secretos.
- Sin stack traces.

## 13. Reportes sin rutas internas

Cuando se genere un reporte controlado, revisar solo campos de URL:

```bash
grep -Ei "192\.168\.2\.41|192\.168\.2\.43|bk-v4|www-v4|http://" /tmp/reporte-validacion-sanitizado.json
```

Esperado:

- No aparecen IPs internas ni URLs HTTP expuestas al navegador.
- Las descargas publicas usan `https://tcdx-iso.tecdex.net`.

## Registro de evidencia

Guardar evidencia sanitizada con:

- Fecha y hora.
- Commit desplegado.
- Responsable.
- Outputs sin tokens, sin passwords y sin secretos.
- Resultado: aprobado, aprobado con observaciones o bloqueado.
