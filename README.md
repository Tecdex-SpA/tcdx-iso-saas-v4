# TCDX ISO SaaS

Repositorio privado del proyecto SaaS ISO/TCDX.

## Arquitectura actual

- Base de datos PostgreSQL: 192.168.100.110
- Backend Node.js/Express: 192.168.100.120
- Frontend Next.js: 192.168.100.130
- Motor IA: 192.168.100.140

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
