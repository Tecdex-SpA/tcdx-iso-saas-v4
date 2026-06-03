# Sprint 0 - Clasificación de módulos

| Módulo | Ruta frontend | Ruta backend | Estado | Decisión MVP | Motivo |
| --- | --- | --- | --- | --- | --- |
| Dashboard | /dashboard, /dashboard-v2, /dashboard-kpi | /api/dashboard, /api/dashboard-v2, /api/dashboard-controls | Core MVP | Visible: usar /dashboard como entrada | Necesario para ejecutivo; fusionar variantes. |
| Diagnóstico | /diagnostico | /api/diagnostic, /api/iso-express-diagnostic | Core MVP | Visible para admin/auditor limitado | Entrada a brechas y plan. |
| Controles | /controles | /api/controls, /api/tenant-standards | Core MVP | Visible | Centro del flujo norma-control. |
| Evidencias | /evidencias | /api/evidences, /api/document-integrations | Core MVP | Visible; integrations opcional | Prueba de cumplimiento. |
| Brechas/Hallazgos/NC | /hallazgos, /no-conformidades | /api/findings, /api/nonconformities | Core MVP | Visible agrupado | Resultado de diagnóstico/auditoría. |
| Planes de acción | /plan-accion, /acciones-recomendadas | /api/action-plans, /api/iso-recommended-actions, /api/iso-operational-execution | Core MVP | Visible como Planes de Acción | Cerrar brechas. |
| Reportes | /exportes | /api/reports | Core MVP | Visible | Salida ejecutiva. |
| IA Compliance | /ia-compliance, /ia-compliance/sugerencias | /api/ai-compliance, /api/ai-compliance/answer | Core MVP IA | Visible con entitlement | Trazabilidad básica. |
| Riesgos | /matriz-riesgo, /activos | /api/iso-risk-matrix, /api/assets | Diferenciador | Visible limitado o fase 1.5 | Aporta, pero no bloquear MVP. |
| Auditoría | /auditorias, /auditorias/ejecucion | /api/audits, /api/audit-execution | Diferenciador/Core parcial | Visible si maduro | Puede entrar como agrupación Auditoría. |
| IA Auditor | /ia-auditor, /auditorias/ia, /auditor-iso | /api/ai-auditor, /api/iso-auditor | Diferenciador | Ocultar o demo controlada | Potente pero puede distraer MVP. |
| KPIs/Health | /health, /administrar-kpis | /health, /api/kpis | Diferenciador | Resumen visible; admin oculto | Medición avanzada. |
| SoA | /soa | /api/soa | Futuro/Enterprise | Ocultar salvo ISO27001 madura | Especializado. |
| Documentos/preparación | /documentos, auditorias panel preparación | /api/iso-document-generator, /api/audit-preparation | Futuro/Enterprise | Ocultar MVP | Generador documental premium. |
| Admin SaaS | /admin-saas, /empresas | /api/admin-saas, /api/tenants | Interno | Solo superadmin | Operación TCDX. |
| Billing/dealer | /dealer, /cotizador, /prefacturacion | /api/quotes, /api/billing | Interno/Partner | Ocultar cliente | Comercial/partner. |
| AI técnico | sin página directa, traces/knowledge/benchmark | /api/ai-traces, /api/ai-knowledge, /api/ai-compliance/benchmark, /api/ai-external-lookup | Interno | Ocultar MVP | Gobernanza técnica. |
