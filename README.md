# TCDX ISO SaaS

Repositorio privado del proyecto SaaS ISO/TCDX.

## Arquitectura actual

- Base de datos PostgreSQL: db.tcdx.int
- Backend Node.js/Express: bk.tcdx.int
- Frontend Next.js: www.tcdx.int
- Motor IA: ai.tcdx.int

## Estructura

- backend/: API Node.js/Express
- frontend/: Frontend Next.js
- ia-engine/: Motor IA
- database/: migraciones, seeds y scripts SQL
- docs/: documentación técnica, implementación y operación
- scripts/: scripts de respaldo, deploy y validación

## Importante

No subir archivos sensibles:

- .env reales
- passwords
- tokens
- respaldos .sql, .dump, .tar.gz
- uploads reales
- evidencias de clientes
- certificados privados
- llaves SSH
- node_modules
- .next
- venv
