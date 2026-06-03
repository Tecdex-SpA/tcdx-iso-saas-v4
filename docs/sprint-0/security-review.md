# Sprint 0 - Revisión seguridad y buenas prácticas

## JWT y RBAC
- JWT se valida en `backend/src/middleware/auth.js` con secreto desde `backend/src/config/security.js`.
- `enforceApiAccess` aplica lista positiva por prefijo y método read/write.
- Riesgo controlado: `auth.js` permite JWT sin tenant para no romper rutas; los endpoints deben validar tenant explícitamente.

## Secrets y env
- Solo se detectaron `.env.example`: `.env.example`, `backend/.env.example`, `frontend/.env.example`, `ai-engine/.env.example`.
- No se detectaron `.env` reales en el repo por `find`.
- Existen docs con placeholders `<secret>` o variables vacías, sin valores reales observados.
- Riesgo: `qa-results/**/token.txt` existe por patrón; revisar manualmente y purgar si contiene JWT reales.

## CORS, headers y rate limiting
- `backend/src/app.js` define CORS allowlist desde env + URLs conocidas, headers de seguridad básicos y rate limiter en memoria para auth/AI/default.
- Rate limiter en memoria no escala entre procesos/VMs; suficiente para MVP simple, no para cluster.

## Uploads y archivos
- Express sirve static public uploads para logos/perfiles/tenant logos.
- `/uploads/tenants/:fileName` valida basename, extensión y symlink; correcto para assets públicos.
- Evidencias/auditorías usan multer y rutas autenticadas; validar límites de tamaño y tipos en cada route file antes de producción amplia.

## Comandos shell/eval
- Backend usa `execFile` en servicios de OCR/conversión documental, menos riesgoso que `exec`, pero requiere allowlist de binarios, timeout y sandbox.
- Scripts QA usan `eval` controlado en Python para aserciones; no es parte runtime producto.

## Backups/ZIPs/dumps
- ZIP versionado: `docs/inventory-tcdx-20260526_1353.zip`.
- No se detectaron dumps por patrón.
- `qa-results` contiene logs, JSON, headers, PDFs y tokens de QA; alto candidato de limpieza segura tras respaldo/validación.

## Riesgos críticos
1. Revisar y eliminar del repo, si corresponde, `qa-results/**/token.txt` por posible exposición de tokens.
2. Validar cross-tenant en rutas con `tenant_id` por params, especialmente archivos, evidencias, reportes, dashboard, health e IA.
3. Revisar OAuth/sync-agent montados antes del middleware global.

## Recomendaciones
No corregir en Sprint 0 salvo documentación. Abrir tickets para secret hygiene, pruebas negativas RBAC/tenant, hardening uploads y limpieza de artefactos QA.
