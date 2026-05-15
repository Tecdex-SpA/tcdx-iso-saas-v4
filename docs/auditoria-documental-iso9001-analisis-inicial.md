# Auditoría documental ISO 9001 - análisis inicial

## Alcance de esta pasada

Esta primera ejecución cubre únicamente Fase 1, Fase 2 y Fase 3:

- análisis de arquitectura existente;
- modelo de datos mínimo para paquetes documentales de auditoría;
- seed inicial de plantillas ISO 9001 basado en la estructura del ZIP de referencia.

No se implementó frontend ni endpoints backend en esta pasada.

## ZIP de referencia

Archivo revisado sin extraer ni copiar contenido estático:

`/Users/andresbarouh/Downloads/Auditoría 2026-20260515T151343Z-3-001.zip`

La estructura observada confirma un paquete documental de auditoría con estas zonas:

- `00_INDICE_Y_GUIA_DE_USO`
- `01_DOCUMENTOS_VIGENTES_2026`
- `02_REGISTROS_DE_CONTROL_2026`
- `03_EVIDENCIAS_PARA_VALIDAR`
- `04_ENTREVISTAS_AUDITORIA`
- `05_HISTORICO_REFERENCIAL_NO_PRESENTAR_COMO_VIGENTE`
- `99_RESPALDO_TANDAS_APROBADAS`

El ZIP se usa solo como referencia de arquitectura documental, tipos de documento y carpetas. No se importó contenido literal como documento estático.

## Módulos existentes reutilizables

| módulo | archivos relevantes | uso para preparación documental |
| --- | --- | --- |
| Auditorías | `backend/src/routes/audits.routes.js`, `frontend/src/app/auditorias/page.tsx` | Asociar paquete por `audit_id`, fechas, responsable, estado y ejecución. |
| IA Auditor / ai-engine | `backend/src/routes/ai-auditor.routes.js`, `backend/src/services/aiEngineClient.service.js`, `ai-engine/app/services/senior_auditor_orchestrator.py` | Reutilizar patrón de contexto, trazabilidad y respuesta estructurada en fases posteriores. |
| Documentos ISO | `backend/src/routes/iso-document-generator.routes.js`, `backend/src/services/isoDocumentGenerator.service.js`, `database/migrations/20260506_iso_document_generator.sql` | Base útil para generación de documentos, pero no modela carpeta/ZIP de auditoría. |
| Knowledge ISO | `backend/src/routes/iso-knowledge.routes.js`, `database/migrations/20260506_iso_knowledge_base.sql` | Fuente normativa resumida y segura para prompts y plantillas futuras. |
| Evidencias | `backend/src/routes/evidences.routes.js`, `backend/src/services/evidence-ai.service.js` | Índice de evidencias, relación con controles y análisis de evidencia. |
| Controles / salud efectiva | `backend/src/routes/controls.routes.js`, `backend/src/services/aiContextBuilder.service.js`, vistas `v_iso_control_effective_health`, `v_iso_effective_kpi_summary` | Priorización documental por controles, brechas y evidencia faltante. |
| Riesgos | `backend/src/routes/iso-risk-matrix.routes.js`, `backend/src/services/isoRiskMatrix.service.js` | Insumo para matriz de riesgos de calidad y revisión por dirección. |
| Hallazgos / NC / acciones | `backend/src/routes/findings.routes.js`, `backend/src/routes/nonconformities.routes.js`, `backend/src/routes/action-plans.routes.js` | Acciones correctivas, mejora continua y cierre de auditoría. |
| Reportes | `backend/src/routes/reports.routes.js`, `backend/src/reports/templates/*` | Referencia para export premium y ZIP/PDF en fases posteriores. |
| Integración documentos/Drive | `backend/src/routes/document-integrations*.routes.js`, `backend/src/services/documentGoogleSync.service.js` | Potencial fuente de documentos vigentes e índice documental. |

## Tablas existentes reutilizables

- `tenants`, `users`
- `audits`
- `tenant_standards`
- `tenant_controls`
- `evidences`
- `findings`
- `tenant_nonconformities`
- `action_plans`
- `iso_standards`, `iso_standard_versions`, `iso_controls`, `iso_evidence_expectations`
- `iso_generated_documents`
- `report_exports`
- `v_iso_control_effective_health`
- `v_iso_effective_kpi_summary`

## Brechas detectadas

- No existe una entidad de paquete/carpeta documental de auditoría.
- No existe historial formal de ZIP documental subido y analizado.
- No existe tabla de documentos por paquete con pendientes, evidencia asociada y resumen de cambios.
- No existe índice documental de evidencias por carpeta de auditoría.
- Las plantillas ISO existentes cubren políticas/procedimientos generales, pero no una estructura de paquete de auditoría ISO 9001 lista para exportar.

## Propuesta de implementación mínima segura

1. Crear tablas `audit_preparation_*` independientes, multi-tenant y no destructivas.
2. Crear seed `audit_document_templates` para ISO 9001:2015 con carpetas y tipos inspirados en el ZIP.
3. En fases siguientes, construir contexto desde fuentes reales usando servicios existentes y `aiContextBuilder` como referencia.
4. Integrar endpoints bajo `/api/audit-preparation` con `auth` y RBAC.
5. Integrar la experiencia como tab/sección dentro de `/auditorias`, sin crear módulo aislado.
6. Implementar export ZIP inicial con documentos generados en Markdown/HTML/PDF antes de DOCX/XLSX avanzado.

## Estado después de Fase 4, 5 y 6

Se agregó la base backend y ai-engine para operar la preparación documental sin frontend todavía:

- contexto documental multi-tenant en `backend/src/services/auditPreparationContext.service.js`;
- servicio principal en `backend/src/services/auditPreparation.service.js`;
- controlador y rutas `/api/audit-preparation`;
- cliente backend hacia ai-engine para `generateAuditDocument`;
- endpoint ai-engine `POST /api/ai-compliance/audit-documents/generate`;
- prompt versionado `ai-engine/prompts/iso9001_audit_document_generator_v1.md`;
- migración y seed opcionales para knowledge base documental `iso9001_audit_document_pack_structure_v1`.

La documentación operativa de esta fase quedó en `docs/modulo-preparacion-auditoria-iso9001-fase-2.md`, incluyendo comandos exactos de BD, despliegue y validación.
