-- =========================================================
-- TCDX ISO SaaS - ISO 9001 audit document pack templates
-- Seed inicial basado en estructura documental de auditoria.
--
-- No copia contenido del ZIP de referencia. Solo registra tipos,
-- carpetas, finalidad, insumos y reglas de generacion dinamica.
-- =========================================================

WITH rows AS (
  SELECT *
  FROM (VALUES
    ('manual_calidad', 'Manual de Calidad', 'manual', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/02_Alcance_SGC_Contexto_y_Partes_Interesadas', 'Define el sistema de gestion, alcance, procesos, responsabilidades y referencias documentales.', 'alcance, procesos, politica, contexto, partes interesadas, responsabilidades, evidencias vigentes'),
    ('politica_calidad', 'Politica de Calidad', 'policy', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/01_Politica_y_Objetivos_de_Calidad', 'Declara compromisos de calidad, enfoque al cliente, cumplimiento y mejora continua.', 'direccion estrategica, compromisos, aprobacion, comunicacion, revision vigente'),
    ('objetivos_calidad', 'Objetivos de Calidad', 'objective_plan', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/01_Politica_y_Objetivos_de_Calidad', 'Establece objetivos medibles, metas, responsables, periodo, seguimiento y resultados.', 'KPIs, metas, responsables, resultados, brechas, acciones asociadas'),
    ('alcance_sgc', 'Alcance del Sistema de Gestion de Calidad', 'context', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/02_Alcance_SGC_Contexto_y_Partes_Interesadas', 'Delimita procesos, ubicaciones, servicios, interfaces y exclusiones justificadas.', 'tenant, operaciones activas, normas activas, procesos, servicios, exclusiones'),
    ('contexto_organizacion', 'Contexto de la Organizacion', 'context', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/02_Alcance_SGC_Contexto_y_Partes_Interesadas', 'Resume factores internos y externos que afectan el SGC.', 'riesgos, oportunidades, cambios internos, cambios externos, resultados de auditoria'),
    ('foda', 'FODA del Sistema de Gestion de Calidad', 'context', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/02_Alcance_SGC_Contexto_y_Partes_Interesadas', 'Organiza fortalezas, oportunidades, debilidades y amenazas con accionabilidad.', 'riesgos, oportunidades, hallazgos, KPIs, contexto operacional'),
    ('partes_interesadas', 'Partes Interesadas y Requisitos', 'interested_parties', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/02_Alcance_SGC_Contexto_y_Partes_Interesadas', 'Identifica partes interesadas, requisitos, expectativas y seguimiento.', 'clientes, proveedores, reguladores, usuarios, requisitos, evidencias de seguimiento'),
    ('mapa_procesos', 'Mapa de Procesos', 'process_map', 'pptx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/03_Mapa_de_Procesos', 'Representa procesos estrategicos, operativos y de soporte con interacciones.', 'procesos, responsables, entradas, salidas, indicadores, controles'),
    ('procedimiento_control_documentos', 'Procedimiento de Control de Documentos', 'procedure', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/05_Control_Documental_y_Registros', 'Define creacion, revision, aprobacion, versionado, publicacion y retiro documental.', 'documentos vigentes, versiones, aprobadores, historicos, control de cambios'),
    ('procedimiento_control_registros', 'Procedimiento de Control de Registros', 'procedure', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/05_Control_Documental_y_Registros', 'Define identificacion, conservacion, proteccion, recuperacion y disposicion de registros.', 'registros, responsables, retencion, evidencia de control, ubicacion'),
    ('procedimiento_prestacion_servicio', 'Procedimiento de Prestacion del Servicio', 'procedure', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/06_Gestion_Operacional_y_Prestacion_del_Servicio', 'Describe planificacion y control de la entrega del servicio.', 'procesos operativos, criterios de aceptacion, tickets, controles, responsables'),
    ('procedimiento_gestion_incidentes', 'Procedimiento de Gestion de Incidentes de Servicio', 'procedure', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/06_Gestion_Operacional_y_Prestacion_del_Servicio', 'Establece registro, clasificacion, tratamiento y cierre de incidentes que afecten el servicio.', 'incidentes, tickets, responsables, tiempos, acciones correctivas, evidencias de cierre'),
    ('procedimiento_gestion_proveedores', 'Procedimiento de Gestion de Proveedores', 'procedure', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/07_Proveedores', 'Define seleccion, evaluacion, seguimiento y reevaluacion de proveedores relevantes.', 'proveedores reales, criticidad, contratos, SLA, evaluaciones, evidencias'),
    ('procedimiento_satisfaccion_cliente', 'Procedimiento de Satisfaccion del Cliente', 'procedure', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/08_Satisfaccion_Cliente', 'Define captura, medicion, analisis y acciones sobre feedback de clientes.', 'encuestas, reclamos, reuniones, correos, NPS, acciones de mejora'),
    ('procedimiento_acciones_correctivas', 'Procedimiento de Acciones Correctivas', 'procedure', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/09_Acciones_Correctivas_y_Mejora_Continua', 'Define registro de no conformidades, causa raiz, acciones, cierre y eficacia.', 'hallazgos, no conformidades, sistema externo de tickets si existe, responsables, plazos, evidencia de eficacia'),
    ('procedimiento_mejora_continua', 'Procedimiento de Mejora Continua', 'procedure', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/09_Acciones_Correctivas_y_Mejora_Continua', 'Describe fuentes de mejora, priorizacion, seguimiento y verificacion.', 'KPIs, auditorias, hallazgos, satisfaccion, riesgos, acciones'),
    ('revision_por_la_direccion', 'Revision por la Direccion', 'management_review', 'docx', '01_DOCUMENTOS_VIGENTES_{{period_year}}/10_Revision_por_la_Direccion', 'Consolida entradas, decisiones, recursos, riesgos, desempeno y oportunidades de mejora.', 'objetivos, auditorias, satisfaccion, proveedores, riesgos, NC, acciones, recursos'),
    ('lista_maestra_documentos', 'Lista Maestra de Documentos', 'record', 'xlsx', '02_REGISTROS_DE_CONTROL_{{period_year}}', 'Registro controlado de documentos vigentes, historicos y obsoletos.', 'documentos, versiones, responsables, estados, fechas, aprobaciones'),
    ('matriz_riesgos_calidad', 'Matriz de Riesgos de Calidad', 'risk_matrix', 'xlsx', '02_REGISTROS_DE_CONTROL_{{period_year}}', 'Registro de riesgos y oportunidades de calidad con tratamiento y estado.', 'riesgos, probabilidad, impacto, controles, tratamientos, responsables'),
    ('matriz_partes_interesadas', 'Matriz de Partes Interesadas', 'record', 'xlsx', '02_REGISTROS_DE_CONTROL_{{period_year}}', 'Registro de partes interesadas, requisitos y seguimiento.', 'partes interesadas, requisitos, frecuencia, evidencia, responsable'),
    ('registro_objetivos_calidad', 'Registro de Objetivos de Calidad', 'record', 'xlsx', '02_REGISTROS_DE_CONTROL_{{period_year}}', 'Seguimiento de objetivos, metas, indicadores, responsables y avance.', 'objetivos, KPIs, metas, resultados, responsables, periodo'),
    ('registro_proveedores', 'Registro de Proveedores', 'record', 'xlsx', '02_REGISTROS_DE_CONTROL_{{period_year}}', 'Listado de proveedores relevantes para el SGC.', 'proveedores, criticidad, servicio, contratos, vigencia'),
    ('evaluacion_proveedores', 'Evaluacion de Proveedores', 'record', 'xlsx', '02_REGISTROS_DE_CONTROL_{{period_year}}', 'Resultados de evaluacion, reevaluacion y acciones sobre proveedores.', 'evaluaciones, criterios, resultados, acciones, evidencias'),
    ('registro_satisfaccion_cliente', 'Registro de Satisfaccion Cliente', 'record', 'xlsx', '02_REGISTROS_DE_CONTROL_{{period_year}}', 'Consolidado de mediciones, reclamos, feedback y acciones.', 'encuestas, feedback, reclamos, resultados, acciones'),
    ('registro_acciones_correctivas', 'Registro de Acciones Correctivas', 'record', 'xlsx', '02_REGISTROS_DE_CONTROL_{{period_year}}', 'Registro trazable de acciones correctivas y eficacia.', 'hallazgos, NC, causa raiz, acciones, responsables, fechas, eficacia'),
    ('registro_revision_direccion', 'Registro de Revision por la Direccion', 'record', 'xlsx', '02_REGISTROS_DE_CONTROL_{{period_year}}', 'Registro de entradas, decisiones y compromisos de revision por la direccion.', 'actas, decisiones, acciones, recursos, responsables'),
    ('indice_evidencias', 'Indice de Evidencias para Auditoria', 'evidence_index', 'xlsx', '03_EVIDENCIAS_PARA_VALIDAR', 'Indice maestro de evidencias asociadas a requisitos, documentos y carpetas.', 'evidencias, controles, documentos, modulos, estados, links'),
    ('evidencias_jira', 'Indice de Evidencias de Tickets o Sistemas Externos', 'evidence_index', 'md', '03_EVIDENCIAS_PARA_VALIDAR/01_Evidencias_Tickets_o_Sistemas_Externos', 'Evidencias operativas provenientes de tickets o sistemas externos si están configurados.', 'tickets opcionales, incidencias, acciones, cierres, responsables'),
    ('evidencias_satisfaccion_cliente', 'Indice de Evidencias de Satisfaccion Cliente', 'evidence_index', 'md', '03_EVIDENCIAS_PARA_VALIDAR/02_Evidencias_Satisfaccion_Cliente', 'Evidencias de encuestas, reclamos, reuniones o feedback de clientes.', 'encuestas, correos, actas, reclamos, acciones'),
    ('evidencias_proveedores', 'Indice de Evidencias de Proveedores', 'evidence_index', 'md', '03_EVIDENCIAS_PARA_VALIDAR/03_Evidencias_Proveedores', 'Evidencias de evaluacion, contratos, SLA y seguimiento de proveedores.', 'proveedores, contratos, evaluaciones, SLA, acciones'),
    ('evidencias_operacion_servicio', 'Indice de Evidencias de Operacion del Servicio', 'evidence_index', 'md', '03_EVIDENCIAS_PARA_VALIDAR/04_Evidencias_Operacion_Servicio', 'Evidencias de operacion, prestacion del servicio y control de salidas.', 'registros operativos, tickets, entregables, aprobaciones'),
    ('evidencias_control_documental', 'Indice de Evidencias de Control Documental', 'evidence_index', 'md', '03_EVIDENCIAS_PARA_VALIDAR/05_Evidencias_Control_Documental', 'Evidencias de versionado, aprobacion, publicacion y retiro documental.', 'lista maestra, versiones, aprobaciones, historicos'),
    ('guia_entrevistas_auditoria', 'Guia de Entrevistas de Auditoria ISO 9001', 'audit_interview_guide', 'docx', '04_ENTREVISTAS_AUDITORIA', 'Preguntas sugeridas para auditoria por proceso, rol, documento y evidencia.', 'procesos, responsables, riesgos, evidencias, hallazgos'),
    ('indice_historico_referencial', 'Indice Historico Referencial no Vigente', 'record', 'md', '05_HISTORICO_REFERENCIAL_NO_PRESENTAR_COMO_VIGENTE', 'Indice de documentos historicos que no deben presentarse como vigentes.', 'documentos obsoletos, historicos, versiones anteriores, advertencias')
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
  'ISO9001',
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
    'generation_rules', jsonb_build_array(
      'usar solo datos reales de plataforma',
      'marcar informacion faltante como [PENDIENTE DE VALIDACION]',
      'marcar evidencia faltante como [REQUIERE EVIDENCIA]',
      'mantener lenguaje formal y auditable',
      'registrar source_trace por dato usado'
    ),
    'zip_reference_role', 'estructura documental, no contenido estatico',
    'recommended_pending_markers', jsonb_build_array(
      '[PENDIENTE DE VALIDACION]',
      '[REQUIERE EVIDENCIA]',
      '[REQUIERE COMPLETAR CON DATO REAL]'
    )
  ),
  'Actua como auditor senior ISO 9001. Genera o actualiza "' || document_name ||
  '" usando exclusivamente datos reales entregados por TCDX Compliance. No inventes proveedores, responsables, fechas, tickets, resultados ni auditorias. Si falta informacion, marca [PENDIENTE DE VALIDACION], [REQUIERE EVIDENCIA] o [REQUIERE COMPLETAR CON DATO REAL]. Relaciona cada afirmacion con source_trace cuando exista y sugiere evidencias en la carpeta ' || folder_path || '.'
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
