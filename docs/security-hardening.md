# Security hardening

## Cambios aplicados

- Reportes sensibles: `/uploads/reports` dejó de servirse como carpeta pública. La descarga se realiza por `GET /api/reports/download/:id` con JWT, RBAC y validación de tenant.
- Evidencias: se agregó `fileFilter` de `multer` con validación de extensión y MIME type para formatos permitidos.
- Google OAuth: se mantiene público solo el callback OAuth; el inicio de conexión sigue autenticado dentro del router.
- JWT: se agregó `backend/src/config/security.js` para centralizar secreto, opciones de firma y verificación. `JWT_SECRET` es la variable oficial y se mantienen fallbacks temporales.
- PostgreSQL: se agregaron límites de pool, timeouts, SSL opcional y `application_name`.
- Usuarios: se agregó política de contraseña fuerte en backend y validación visual mínima en el frontend de administración.
- Errores: los cambios nuevos evitan devolver secretos, SQLSTATE o stack traces al cliente.

## Archivos principales modificados

- `backend/src/app.js`
- `backend/src/config/db.js`
- `backend/src/config/security.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/reports.routes.js`
- `backend/src/routes/evidences.routes.js`
- `backend/src/routes/users.routes.js`
- `backend/src/routes/document-integrations-google.routes.js`
- `backend/src/routes/ai-external-lookup.routes.js`
- `backend/src/routes/ai-feedback.routes.js`
- `backend/src/routes/health.js`
- `backend/src/services/auth.service.js`
- `backend/src/services/evidence-ai.service.js`
- `backend/src/utils/passwordPolicy.js`
- `frontend/src/app/exportes/page.tsx`
- `frontend/src/app/usuarios/page.tsx`

## Variables nuevas o relevantes

- `JWT_SECRET`: secreto oficial para firmar y verificar JWT.
- `JWT_EXPIRES_IN`: expiración del token. Default: `8h`.
- `JWT_ISSUER`: opcional. Se usa solo si está configurado.
- `JWT_AUDIENCE`: opcional. Se usa solo si está configurado.
- `DB_POOL_MAX`: máximo de conexiones del pool. Default: `10`.
- `DB_IDLE_TIMEOUT_MS`: timeout idle del pool. Default: `30000`.
- `DB_CONNECTION_TIMEOUT_MS`: timeout de conexión. Default: `5000`.
- `DB_SSL`: `true` activa SSL.
- `DB_SSL_REJECT_UNAUTHORIZED`: `false` permite certificados no verificados cuando el proveedor cloud lo requiere.
- `DB_STATEMENT_TIMEOUT_MS`: timeout de statement opcional.
- `DB_QUERY_TIMEOUT_MS`: timeout de query opcional.
- `EVIDENCE_UPLOAD_MAX_BYTES`: tamaño máximo de evidencia.

## Validación esperada

Backend:

```bash
cd backend
npm install
npm run check
npm test
```

Frontend:

```bash
cd frontend
npm install
npm run build
```

Pruebas funcionales:

1. `GET /uploads/reports/...` no debe servir archivos públicamente.
2. `GET /api/reports/download/:id` debe descargar con `Authorization: Bearer $TOKEN`.
3. Login y validate deben seguir funcionando con el payload JWT actual.
4. Crear usuario con contraseña débil debe fallar con `PASSWORD_POLICY_FAILED`.
5. Editar usuario sin password debe funcionar.
6. Editar usuario con password débil debe fallar.
7. Subir evidencia `.pdf` debe funcionar.
8. Subir `.js`, `.html` o `.svg` como evidencia debe fallar.
9. Google OAuth callback debe seguir redirigiendo sin JWT.
10. Usuario de tenant A no debe descargar reportes de tenant B.

## Resultado de `npm audit`

Backend:

- `basic-ftp <=5.3.0`: high, fix sugerido por `npm audit fix`.
- `xlsx`: high, sin fix disponible reportado por npm. Mitigación aplicada en esta pasada: validación estricta de tipos de archivo en evidencias y mantenimiento de límite `EVIDENCE_UPLOAD_MAX_BYTES`.
- `ip-address <=10.1.0`: moderate.

Frontend:

- `next`: high, npm sugiere `npm audit fix --force` hacia `next@16.2.6`, fuera del rango declarado actual. No se aplicó automáticamente para evitar cambio de versión no quirúrgico.
- `postcss <8.5.10`: moderate, asociado a la actualización forzada sugerida.

No se ejecutaron actualizaciones automáticas de dependencias en esta pasada para no introducir cambios mayores sin QA dedicada.

## Deploy

Backend VM:

```bash
cd /home/tecdex/backend
npm install
npm run check
sudo systemctl restart tecdex-backend
sudo systemctl status tecdex-backend --no-pager
```

Frontend VM:

```bash
cd /home/tecdex/frontend
npm install
npm run build
npm start
```

Motor IA:

No requiere cambios para esta pasada.

## Rollback por archivo crítico

- Reportes: revertir `backend/src/app.js`, `backend/src/routes/reports.routes.js` y `frontend/src/app/exportes/page.tsx` restaura el acceso estático anterior.
- JWT: revertir `backend/src/config/security.js`, `backend/src/middleware/auth.js` y `backend/src/services/auth.service.js` vuelve a la lógica previa.
- Uploads: revertir `backend/src/routes/evidences.routes.js` remueve el filtro de archivo.
- Usuarios: revertir `backend/src/utils/passwordPolicy.js`, `backend/src/routes/users.routes.js` y `frontend/src/app/usuarios/page.tsx` remueve la política de contraseña.
