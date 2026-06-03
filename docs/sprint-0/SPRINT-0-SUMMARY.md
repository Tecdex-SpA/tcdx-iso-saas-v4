# Sprint 0 - Summary

## Resumen ejecutivo
Sprint 0 documenta el estado real del repo sin implementar Sprint 1 ni tocar lógica de producto. El sistema ya tiene una base SaaS multi-tenant amplia: backend Express, frontend Next App Router, PostgreSQL versionado parcialmente, AI Engine FastAPI y muchos scripts QA. El MVP comercial debe reducir la exposición visual a un flujo claro: tenant -> norma -> control -> evidencia -> brecha -> acción -> reporte -> IA trazable.

## Hallazgos principales
- Backend: 62 route files; la mayoría protegida por JWT/RBAC global en `app.js`.
- Frontend: 39 pages; navegación real se concentra en `Sidebar.tsx` y guards en `AppLayout.tsx`.
- DB: 31 migraciones, 15 seeds, 12 QA fixes; hay tablas nuevas y muchas tablas core inferidas como preexistentes.
- IA: AI Engine real en `ai-engine`, integrado por token interno y context builders.
- QA: `qa-results` contiene gran volumen de artefactos y archivos `token.txt` que deben revisarse.

## Riesgos críticos
1. Posibles tokens JWT o credenciales de QA versionadas en `qa-results/**/token.txt`.
2. Cross-tenant access si endpoints con `tenant_id` por params no validan contra JWT/rol.
3. OAuth/sync-agent y archivos tenant tienen montaje especial o exposición pública que requiere revisión específica.
4. Scripts SQL QA/fixes contienen operaciones peligrosas; no ejecutar sin DBA/respaldo.

## Riesgos medios
- Duplicación funcional en dashboards, IA, command centers y rutas legacy.
- Separación controller/service irregular.
- DB real no inspeccionada, posible drift frente a migraciones.
- Health/KPI/reportes pueden requerir índices y pruebas de performance por tenant.

## Quick wins
- Ocultar en MVP cliente módulos internos por rol/feature flag sin borrar archivos.
- Consolidar menú demo alrededor de 9 entradas recomendadas.
- Limpiar o mover artefactos QA tras revisar tokens.
- Crear pruebas negativas cross-tenant para módulos core.

## Core MVP
Dashboard, Diagnóstico, Controles, Evidencias, Brechas/Hallazgos/NC, Planes de Acción, Reportes, RBAC, Multi-tenant, IA Compliance trazable básica.

## Módulos a ocultar
Admin SaaS, billing/prefacturación, dealer/cotizador, command centers, AI traces, benchmark, knowledge base, lookup externo, sync agent, preparación/generador documental salvo demo aprobada.

## Estado seguridad/RBAC/multi-tenant
Base razonable con JWT, RBAC por lista positiva y tenant en JWT. Requiere hardening y pruebas de tenant por endpoint antes de ampliar demo/producción.

## Estado KPIs/health
Existen endpoints, vistas y paneles avanzados. Para MVP conviene mostrar resumen ejecutivo y ocultar administración KPI avanzada.

## Estado IA
Hay integración real backend <-> AI Engine y trazabilidad parcial por tablas/logs. Para MVP, limitar a IA Compliance con fuentes/contexto y dejar IA Auditor senior como diferenciador controlado.

## Decisión recomendada para Sprint 1
Diseñar Perfil empresa + Procesos/Operaciones como capa transversal no destructiva, conectada a controles, evidencias, riesgos, planes, KPIs, reportes e IA.

## Acciones manuales pendientes
- Revisar `qa-results/**/token.txt` sin exponer contenido y rotar tokens si son reales.
- Inspeccionar DB real `192.168.2.30` contra migraciones.
- Aprobar estrategia de ocultamiento MVP por rol/feature flag.
- Aprobar modelo conceptual de procesos/operaciones antes de cualquier migración.
