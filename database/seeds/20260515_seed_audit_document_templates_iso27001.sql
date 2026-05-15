-- =========================================================
-- TCDX ISO SaaS - ISO 27001 audit document pack templates
--
-- Base commercial seed for ISO 27001:2022. It reuses the
-- audit preparation engine and does not attempt a full SGSI
-- document universe in this pass.
-- =========================================================

WITH rows AS (
  SELECT *
  FROM (VALUES
    ('alcance_sgsi', 'Alcance del Sistema de Gestion de Seguridad de la Informacion', 'context', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/01_Alcance_y_Contexto_SGSI', 'Define limites, ubicaciones, procesos, activos y exclusiones del SGSI.', 'tenant, activos, procesos, normas activas, controles, exclusiones justificadas'),
    ('politica_seguridad_informacion', 'Politica de Seguridad de la Informacion', 'policy', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/02_Politicas_SGSI', 'Declara compromisos de seguridad, cumplimiento, mejora y responsabilidades.', 'direccion estrategica, roles, controles, incidentes, aprobacion, comunicacion'),
    ('declaracion_aplicabilidad_soa', 'Declaracion de Aplicabilidad SoA', 'record', 'xlsx', '02_REGISTROS_DE_CONTROL_{{period_year}}', 'Registro de controles aplicables, justificacion, estado y evidencia.', 'controles ISO27001, aplicabilidad, justificacion, evidencia, estado'),
    ('matriz_riesgos_sgsi', 'Matriz de Riesgos SGSI', 'risk_matrix', 'xlsx', '02_REGISTROS_DE_CONTROL_{{period_year}}', 'Consolida riesgos de seguridad, impacto, probabilidad, tratamiento y responsables.', 'activos, amenazas, vulnerabilidades, controles, hallazgos, acciones'),
    ('procedimiento_gestion_incidentes_seguridad', 'Procedimiento de Gestion de Incidentes de Seguridad', 'procedure', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/03_Procedimientos_SGSI', 'Define reporte, clasificacion, contencion, investigacion y cierre de incidentes.', 'incidentes, responsables, evidencias, tiempos, lecciones aprendidas'),
    ('procedimiento_control_accesos', 'Procedimiento de Control de Accesos', 'procedure', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/03_Procedimientos_SGSI', 'Define altas, bajas, cambios, privilegios, revisiones y evidencias de acceso.', 'usuarios, roles, permisos, revisiones, hallazgos, evidencias'),
    ('revision_direccion_sgsi', 'Revision por la Direccion SGSI', 'management_review', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/04_Revision_por_la_Direccion_SGSI', 'Resume desempeno del SGSI, riesgos, incidentes, auditorias, acciones y decisiones.', 'KPIs, riesgos, incidentes, auditorias, no conformidades, recursos, decisiones'),
    ('programa_auditoria_interna_sgsi', 'Programa de Auditoria Interna SGSI', 'record', 'xlsx', '02_REGISTROS_DE_CONTROL_{{period_year}}', 'Planifica auditorias internas SGSI, alcance, criterios, responsables y estado.', 'auditorias, controles, fechas, responsables, hallazgos, acciones'),
    ('indice_evidencias_sgsi', 'Indice de Evidencias SGSI', 'evidence_index', 'xlsx', '03_EVIDENCIAS_PARA_VALIDAR', 'Indice maestro de evidencias de seguridad asociadas a controles y documentos.', 'evidencias, controles, documentos, registros, estado, carpeta sugerida')
  ) AS t(template_key, document_name, document_type, output_format, folder_path, purpose, required_inputs)
)
INSERT INTO audit_document_templates (
  standard_code,
  template_key,
  document_name,
  document_type,
  output_format,
  folder_path,
  version,
  is_active,
  template_schema_json,
  ai_prompt_template
)
SELECT
  'ISO27001',
  template_key,
  document_name,
  document_type,
  output_format,
  folder_path,
  '1.0',
  true,
  jsonb_build_object(
    'purpose', purpose,
    'required_inputs', required_inputs,
    'standard_version', 'ISO 27001:2022',
    'generation_rules', jsonb_build_array(
      'usar solo datos reales de plataforma',
      'marcar informacion faltante como [PENDIENTE DE VALIDACION]',
      'marcar evidencia faltante como [REQUIERE EVIDENCIA]',
      'no inventar controles, riesgos, incidentes, responsables ni fechas',
      'registrar source_trace por dato usado'
    )
  ),
  'Actua como auditor senior ISO 27001:2022. Genera o actualiza "' || document_name ||
  '" usando exclusivamente datos reales entregados por TCDX Compliance. No inventes responsables, riesgos, incidentes, fechas, resultados ni evidencias. Si falta informacion, marca [PENDIENTE DE VALIDACION], [REQUIERE EVIDENCIA] o [REQUIERE COMPLETAR CON DATO REAL].'
FROM rows
ON CONFLICT (standard_code, template_key)
DO UPDATE SET
  document_name = EXCLUDED.document_name,
  document_type = EXCLUDED.document_type,
  output_format = EXCLUDED.output_format,
  folder_path = EXCLUDED.folder_path,
  version = EXCLUDED.version,
  is_active = EXCLUDED.is_active,
  template_schema_json = EXCLUDED.template_schema_json,
  ai_prompt_template = EXCLUDED.ai_prompt_template,
  updated_at = now();
