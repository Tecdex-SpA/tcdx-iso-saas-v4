-- =========================================================
-- TCDX ISO SaaS - ISO 9001 audit document pack knowledge
-- Dataset: iso9001_audit_document_pack_structure_v1
-- =========================================================

WITH dataset AS (
  INSERT INTO ai_knowledge_datasets (
    dataset_name,
    schema_version,
    generated_on,
    language,
    scope,
    source_file_name,
    metadata_json,
    is_active
  )
  VALUES (
    'iso9001_audit_document_pack_structure_v1',
    '1.0.0',
    '2026-05-15',
    'es',
    'global',
    '20260515_seed_ai_knowledge_iso9001_audit_documents.sql',
    jsonb_build_object(
      'purpose', jsonb_build_array(
        'estructura documental ISO 9001 para preparacion de auditoria',
        'reglas de no invencion',
        'mapeo entre documentos y modulos de plataforma'
      ),
      'no_copyrighted_iso_text', true
    ),
    true
  )
  ON CONFLICT (dataset_name, schema_version, generated_on, scope)
  DO UPDATE SET
    language = EXCLUDED.language,
    source_file_name = EXCLUDED.source_file_name,
    metadata_json = EXCLUDED.metadata_json,
    is_active = true,
    updated_at = now(),
    imported_at = now()
  RETURNING id
),
clear_old AS (
  DELETE FROM ai_knowledge_records
  WHERE dataset_id = (SELECT id FROM dataset)
),
clear_old_standards AS (
  DELETE FROM ai_knowledge_standards
  WHERE dataset_id = (SELECT id FROM dataset)
),
standard_row AS (
  INSERT INTO ai_knowledge_standards (
    dataset_id,
    norma,
    norma_key,
    edicion_estado,
    status,
    standard_type,
    uses_hls_annex_sl,
    certifiable_or_assurable,
    objective,
    principal_control_areas_json,
    related_standards_json,
    verified_public_crosswalks_json,
    notes_json,
    source_refs_json,
    scope_public_summary,
    key_definitions_json,
    structure_profile_json,
    record_count,
    raw_json
  )
  SELECT
    id,
    'ISO 9001:2015',
    'ISO9001',
    'vigente',
    'active',
    'management_system',
    true,
    'certifiable',
    'Guiar la preparacion documental de auditoria ISO 9001 usando datos reales de plataforma.',
    jsonb_build_array('contexto', 'liderazgo', 'planificacion', 'soporte', 'operacion', 'evaluacion', 'mejora'),
    jsonb_build_array('ISO9001'),
    '[]'::jsonb,
    jsonb_build_array('Contenido paraphraseado y operativo; no reproduce texto de norma.'),
    jsonb_build_array('internal_baseline'),
    'Conocimiento interno para generar carpeta documental auditable ISO 9001 sin inventar datos.',
    jsonb_build_array('paquete documental', 'evidencia', 'pendiente', 'trazabilidad'),
    jsonb_build_object(
      'folders', jsonb_build_array(
        '00_INDICE_Y_GUIA_DE_USO',
        '01_DOCUMENTOS_VIGENTES',
        '02_REGISTROS_DE_CONTROL',
        '03_EVIDENCIAS_PARA_VALIDAR',
        '04_ENTREVISTAS_AUDITORIA',
        '05_HISTORICO_REFERENCIAL_NO_PRESENTAR_COMO_VIGENTE',
        '99_RESPALDO_GENERACIONES'
      )
    ),
    15,
    jsonb_build_object('dataset', 'iso9001_audit_document_pack_structure_v1')
  FROM dataset
)
INSERT INTO ai_knowledge_records (
  dataset_id,
  record_id,
  norma,
  norma_key,
  edicion_estado,
  coverage_type,
  clausula_o_control,
  titulo,
  descripcion_resumen,
  que_exige,
  ejemplos_evidencia_json,
  hallazgos_tipicos_json,
  acciones_correctivas_sugeridas_json,
  palabras_clave_tags_json,
  related_norms_json,
  source_refs_json,
  standard_type,
  uses_hls_annex_sl,
  norma_objetivo,
  scope_public_summary,
  verified_public_crosswalks_json,
  embedding_text,
  search_text,
  is_draft,
  is_active,
  raw_json
)
SELECT
  (SELECT id FROM dataset),
  record_id,
  'ISO 9001:2015',
  'ISO9001',
  'vigente',
  coverage_type,
  clause_or_control,
  title,
  summary,
  requirement,
  evidences,
  gaps,
  actions,
  tags,
  jsonb_build_array('ISO9001'),
  jsonb_build_array('internal_baseline'),
  'management_system',
  true,
  'Preparacion documental auditable ISO 9001',
  'Uso interno para redaccion, revision y actualizacion documental con datos reales.',
  '[]'::jsonb,
  concat_ws(' | ', title, summary, requirement),
  concat_ws(' | ', title, summary, requirement, evidences::text, gaps::text, actions::text, tags::text),
  false,
  true,
  jsonb_build_object('folder_or_document_type', coverage_type)
FROM (VALUES
  ('iso9001_pack_structure', 'estructura_documental', 'Carpeta documental ISO 9001', 'Estructura de carpetas para preparar auditoria externa.', 'Debe separar documentos vigentes, registros, evidencias, entrevistas, historico referencial y respaldos de generaciones.', jsonb_build_array('inventario documental', 'indice de evidencias', 'resumen de brechas'), jsonb_build_array('documentos vigentes mezclados con historicos', 'sin inventario', 'sin trazabilidad'), jsonb_build_array('Crear inventario', 'Separar historicos', 'Vincular evidencias por carpeta'), jsonb_build_array('carpeta', 'zip', 'auditoria', 'inventario')),
  ('iso9001_manual_calidad', 'manual', 'Manual de Calidad', 'Documento maestro que resume alcance, procesos, responsabilidades y referencias del SGC.', 'Debe basarse en alcance real, procesos, politica, contexto, partes interesadas y documentos vigentes.', jsonb_build_array('alcance SGC', 'mapa de procesos', 'politica de calidad'), jsonb_build_array('alcance generico', 'procesos sin responsable', 'referencias sin version'), jsonb_build_array('Completar alcance real', 'Vincular procesos activos', 'Marcar responsables pendientes'), jsonb_build_array('manual', 'alcance', 'procesos')),
  ('iso9001_politica_calidad', 'policy', 'Politica de Calidad', 'Declaracion formal de compromisos de calidad y mejora continua.', 'Debe reflejar direccion estrategica real, enfoque al cliente, cumplimiento y comunicacion.', jsonb_build_array('politica aprobada', 'comunicacion interna', 'revision vigente'), jsonb_build_array('politica sin fecha', 'sin evidencia de comunicacion'), jsonb_build_array('Solicitar aprobacion formal', 'Registrar evidencia de comunicacion'), jsonb_build_array('politica', 'liderazgo')),
  ('iso9001_objetivos_calidad', 'objective_plan', 'Objetivos de Calidad', 'Objetivos medibles con metas, responsables, periodo y seguimiento.', 'Debe usar KPIs reales, metas y acciones asociadas cuando existan.', jsonb_build_array('KPI vigente', 'meta anual', 'responsable', 'resultado'), jsonb_build_array('objetivos no medibles', 'sin responsable', 'sin resultado'), jsonb_build_array('Definir indicadores medibles', 'Agregar responsables y seguimiento'), jsonb_build_array('objetivos', 'kpi', 'metas')),
  ('iso9001_contexto_foda', 'context', 'Contexto y FODA', 'Analisis operativo de factores internos y externos, riesgos y oportunidades.', 'Debe conectar riesgos, oportunidades, cambios y hallazgos disponibles.', jsonb_build_array('matriz FODA', 'riesgos de calidad', 'acta de revision'), jsonb_build_array('FODA generico', 'sin acciones derivadas'), jsonb_build_array('Cruzar FODA con riesgos y acciones reales'), jsonb_build_array('contexto', 'foda', 'riesgos')),
  ('iso9001_partes_interesadas', 'interested_parties', 'Partes interesadas', 'Matriz de partes interesadas, requisitos y seguimiento.', 'Debe identificar clientes, proveedores, reguladores, usuarios internos y requisitos verificables.', jsonb_build_array('matriz de partes interesadas', 'registro de requisitos', 'seguimiento'), jsonb_build_array('partes genericas', 'sin requisitos verificables'), jsonb_build_array('Completar requisitos por parte interesada', 'Agregar evidencia de seguimiento'), jsonb_build_array('partes interesadas', 'requisitos')),
  ('iso9001_mapa_procesos', 'process_map', 'Mapa de procesos', 'Representacion de procesos estrategicos, operativos y de soporte.', 'Debe usar procesos reales, entradas, salidas, indicadores y responsables.', jsonb_build_array('mapa vigente', 'fichas de proceso', 'indicadores'), jsonb_build_array('procesos sin responsable', 'sin entradas o salidas'), jsonb_build_array('Completar ficha de proceso', 'Vincular controles e indicadores'), jsonb_build_array('procesos', 'mapa')),
  ('iso9001_matriz_riesgos', 'risk_matrix', 'Matriz de riesgos de calidad', 'Registro de riesgos, controles, tratamientos y responsables.', 'Debe usar riesgos reales, estado, impacto, probabilidad y planes asociados.', jsonb_build_array('matriz de riesgos', 'planes de tratamiento', 'evidencia de seguimiento'), jsonb_build_array('riesgos sin tratamiento', 'sin responsable', 'sin fecha'), jsonb_build_array('Actualizar tratamiento', 'Asignar responsables', 'Vincular evidencias'), jsonb_build_array('riesgos', 'matriz')),
  ('iso9001_control_documental', 'procedure', 'Control documental', 'Procedimiento y registros para creacion, revision, aprobacion, versionado y retiro.', 'Debe controlar documentos vigentes, historicos, versiones y aprobaciones.', jsonb_build_array('lista maestra', 'historial de cambios', 'aprobaciones'), jsonb_build_array('versiones inconsistentes', 'historicos presentados como vigentes'), jsonb_build_array('Separar historicos', 'Actualizar lista maestra', 'Validar aprobacion'), jsonb_build_array('documentos', 'versiones')),
  ('iso9001_proveedores', 'procedure', 'Gestion de proveedores', 'Seleccion, evaluacion, seguimiento y reevaluacion de proveedores relevantes.', 'Debe usar proveedores reales, criticidad, evaluaciones, contratos o SLA.', jsonb_build_array('registro de proveedores', 'evaluacion', 'contrato o SLA'), jsonb_build_array('proveedores genericos', 'sin criticidad', 'sin evaluacion'), jsonb_build_array('Completar proveedor real', 'Agregar evaluacion y evidencia'), jsonb_build_array('proveedores', 'evaluacion')),
  ('iso9001_satisfaccion_cliente', 'record', 'Satisfaccion cliente', 'Registro de mediciones, feedback, reclamos y acciones.', 'Debe basarse en encuestas, correos, reuniones, reclamos o evidencia equivalente.', jsonb_build_array('encuesta', 'reclamo', 'feedback', 'accion asociada'), jsonb_build_array('resultado inventado', 'sin evidencia de cliente'), jsonb_build_array('Cargar evidencia de feedback', 'Vincular acciones de mejora'), jsonb_build_array('cliente', 'satisfaccion')),
  ('iso9001_acciones_correctivas', 'record', 'Acciones correctivas', 'Trazabilidad desde hallazgo o no conformidad hasta causa raiz, accion, cierre y eficacia.', 'Debe usar hallazgos, no conformidades, Jira o planes de accion reales.', jsonb_build_array('registro de acciones', 'causa raiz', 'evidencia de cierre'), jsonb_build_array('sin eficacia', 'acciones vencidas', 'sin causa raiz'), jsonb_build_array('Completar causa raiz', 'Validar eficacia', 'Cerrar vencimientos'), jsonb_build_array('acciones correctivas', 'hallazgos', 'no conformidades')),
  ('iso9001_revision_direccion', 'management_review', 'Revision por la direccion', 'Documento que consolida desempeno del SGC, decisiones, recursos y oportunidades.', 'Debe incluir objetivos, auditorias, satisfaccion cliente, proveedores, riesgos, NC, acciones y recursos usando datos reales.', jsonb_build_array('acta de revision', 'KPIs', 'auditorias', 'decisiones'), jsonb_build_array('acta sin decisiones', 'datos sin evidencia'), jsonb_build_array('Completar entradas obligatorias', 'Registrar decisiones y responsables'), jsonb_build_array('revision direccion', 'kpi', 'decisiones')),
  ('iso9001_indice_evidencias', 'evidence_index', 'Indice de evidencias', 'Indice maestro de evidencias por documento, requisito, modulo y carpeta sugerida.', 'Debe listar evidencias reales y marcar faltantes como pendientes.', jsonb_build_array('indice maestro', 'archivos vinculados', 'estado de evidencia'), jsonb_build_array('evidencia sin relacion', 'faltan archivos clave'), jsonb_build_array('Vincular evidencia a documento', 'Crear pendientes por carpeta'), jsonb_build_array('evidencias', 'indice')),
  ('iso9001_guia_entrevistas', 'audit_interview_guide', 'Guia de entrevistas de auditoria', 'Preguntas sugeridas por proceso, rol, documento y evidencia.', 'Debe formular preguntas basadas en procesos, riesgos, controles y evidencias disponibles.', jsonb_build_array('guia de preguntas', 'roles entrevistados', 'evidencias solicitadas'), jsonb_build_array('preguntas genericas', 'sin foco en evidencias'), jsonb_build_array('Ajustar preguntas por proceso real', 'Agregar evidencia esperada'), jsonb_build_array('entrevistas', 'auditoria', 'preguntas'))
) AS r(record_id, coverage_type, title, summary, requirement, evidences, gaps, actions, tags);
