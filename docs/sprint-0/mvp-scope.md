# Sprint 0 - Alcance MVP cliente

## Regla de entrada
Nada entra visible al MVP si no ayuda directamente al flujo: tenant -> norma -> control -> evidencia -> brecha -> acción -> reporte -> IA trazable.

## Entra al MVP cliente
- Dashboard ejecutivo de cumplimiento.
- Cumplimiento/controles por norma ISO activa.
- Evidencias por control.
- Brechas: hallazgos y no conformidades agrupadas en lenguaje de cumplimiento.
- Planes de acción.
- Reportes ejecutivos/exportes.
- IA Compliance trazable básica, con contexto tenant y registro de sugerencias.
- Configuración mínima: perfil, usuarios para admin, perfil empresa si se usa como insumo contextual.

## Visible recomendado
Dashboard, Cumplimiento, Evidencias, Riesgos, Auditoría, Planes de Acción, Reportes, IA Compliance, Configuración.

## Oculto por rol/feature flag para MVP cliente
Admin SaaS, billing/prefacturación, dealer/cotizador, command centers, AI traces, benchmark IA, knowledge base, lookup externo, objetivos si no está maduro, sync agent, pantallas experimentales, preparación documental y generador documental salvo demo específica.

## Superadmin
Debe conservar Admin SaaS, tenants, módulos contratables, estándares contratados, prefacturación, dealer, auditoría administrativa, cuotas de lookup externo y settings IA.

## Fase enterprise
Health avanzado, KPIs configurables, SoA avanzado, Google/Zoho Drive, generador documental, preparación documental, IA Auditor senior, reportes premium, benchmark IA, procesos/operaciones por tenant.

## Módulos que duplican valor o deben fusionarse visualmente
- `/dashboard`, `/dashboard-v2`, `/dashboard-kpi`: consolidar narrativa de dashboard.
- `/health` y `/administrar-kpis`: para MVP mostrar resumen, dejar administración avanzada oculta.
- `/ia`, `/ia-compliance`, `/ia-auditor`, `/auditorias/ia`, `/auditor-iso`: definir IA Compliance cliente versus IA Auditor diferenciador.
- `/centro-control-iso`, `/command-center-iso`, `/ejecucion-iso`, `/acciones-recomendadas`: pueden alimentar Cumplimiento/Planes de acción sin exponerse como menú independiente.

## No mostrar en demo MVP
Admin SaaS, dealer, cotizador, prefacturación, trazas IA, knowledge base, lookup externo, sync agent, endpoints técnicos, reportes QA, rutas huérfanas, pantallas experimentales no conectadas a flujo comercial.
