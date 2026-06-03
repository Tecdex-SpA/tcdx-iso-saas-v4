# Sprint 0 - Arquitectura actual

## Arquitectura general
- `database/`: PostgreSQL, migraciones, seeds y fixes SQL. DB conocida: `192.168.2.30`.
- `backend/`: Node.js + Express, rutas REST, JWT/RBAC, servicios IA/reportes/KPI/evidencias. VM conocida: `192.168.2.31`.
- `frontend/`: Next.js App Router + Tailwind, Sidebar/AppLayout con guards de rol/módulos. VM conocida: `192.168.2.33`.
- `ai-engine/`: FastAPI + servicios LLM/RAG/guardrails, health checks y rutas IA. VM conocida: `192.168.2.34`.
- `scripts/`: QA, deploy, backup, runtime checks.
- `deploy/templates`: nginx y systemd templates.

## Flujo de autenticación
Login en `/api/auth/login`; backend firma JWT con tenant/rol; frontend guarda `localStorage.token`; AppLayout valida expiración y rol; backend valida JWT en `auth.js` y aplica `enforceApiAccess`.

## Flujo multi-tenant
JWT aporta tenant; rutas también reciben tenant por params. Backend valida estado del tenant en auth y cada módulo debería validar acceso antes de query. Superadmin y dealer tienen reglas especiales.

## Flujos core
- Controles: `tenant-standards` define normas/operaciones; `controls` carga catálogo/workbench; health se recalcula tras cambios.
- Evidencias: upload/list/approve/file, integración documental, análisis IA y relación con controles.
- Riesgos: activos y matriz ISO risk matrix; diferenciador para MVP.
- Auditoría: auditorías, ejecución, hallazgos, no conformidades, preparación documental e IA Auditor.
- Reportes: `/api/reports` genera jobs/reportes PDF/exports y usa enrichment IA opcional.
- IA: backend arma contexto, llama AI Engine con token interno y guarda logs/sugerencias/runs.

## Operación conocida
- Backend: `sudo systemctl restart tecdex-backend`.
- Frontend: `npm run build`, `npm start`.
- AI Engine: `sudo systemctl start ai-engine`.
- No se reinició ningún servicio en Sprint 0.

## Puntos débiles detectados
- Variantes/duplicados funcionales visibles pueden confundir demo MVP.
- Separación route/controller/service irregular.
- Artefactos QA versionados con posible material sensible.
- DB productiva no fue inspeccionada; drift entre migraciones y realidad queda pendiente.
- Futura capa procesos/operaciones debe integrarse de forma transversal, no como módulo aislado.
