# Sprint 0 - Encaje futuro de procesos y operaciones

## Principio
No implementar en Sprint 0. La futura administración de procesos debe ser una capa transversal que conecte tenant, perfil empresa, normas, controles, evidencias, brechas, riesgos, acciones, KPIs, reportes e IA.

## Backend
- Crear módulo futuro `processes` o `tenant-processes` con helper tenant centralizado.
- Integrar con `tenant-standards.routes.js`, `controls.routes.js`, `evidences.routes.js`, `findings.routes.js`, `action-plans.routes.js`, `health.js`, `reports.routes.js`, `ai-compliance.routes.js`.
- Evitar lógica duplicada en cada route; extraer services para relación proceso/control/evidencia.

## Frontend
- Insertar bajo Configuración o Cumplimiento: Perfil empresa -> Procesos -> Operaciones.
- No agregar menú extra si no aporta al flujo MVP; usar filtros/contexto en Cumplimiento, Evidencias, Riesgos, Acciones, Reportes e IA.

## Database
- Entidades candidatas no destructivas: `tenant_processes`, `tenant_operations` o extensión ordenada de `tenant_standard_operations` si calza.
- Relaciones candidatas: proceso-control, proceso-evidencia, proceso-riesgo, proceso-action-plan, proceso-KPI.
- Requiere índices por `tenant_id`, `process_id`, `operation_id`, `standard_code`, `status`.

## KPIs y health
Agregar agregaciones por proceso: cumplimiento, salud, evidencias pendientes, brechas abiertas, acciones vencidas, riesgos altos.

## Diagnóstico
ISO Express debe poder calcular brechas por proceso y norma, no solo por tenant/norma.

## Evidencias
Evidencias deben poder enlazarse a proceso/control y a fuente documental; Google/Zoho/sync agent deben conservar tenant/process context.

## Riesgos
Riesgos deben mapear proceso, activo, control mitigante, brecha y acción.

## Reportes
Reportes ejecutivos deben permitir corte por proceso, área, norma y criticidad.

## IA Engine
Context builders deben recibir proceso/operación como dimensión primaria para que IA Auditor razone sobre la operación real, no solo sobre catálogo ISO.
