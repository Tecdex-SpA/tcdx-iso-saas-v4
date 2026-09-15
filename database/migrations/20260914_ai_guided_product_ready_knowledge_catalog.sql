-- =========================================================
-- TCDX ISO SaaS v4
-- AI Guided canonical product-ready knowledge catalog
--
-- Forward-only, idempotent, tenant-neutral reference data for runtime
-- problem_type_code coverage. Content is operational derived_summary,
-- not official ISO text.
-- =========================================================

BEGIN;

DO $$
DECLARE
  source_key_value text := 'tecdx_ai_guided_problem_catalog_v1';
  catalog jsonb := $catalog$
[
  {"problem_type_code":"access_review_missing","default_domain":"access_management","standard_code":"ISO27001","title":"Revisión de accesos pendiente o no demostrada","intent_summary":"Orientación operativa para analizar ausencia de revisión periódica de accesos, privilegios o matriz vigente.","common_gap":"No existe trazabilidad suficiente de revisión, aprobación o corrección de accesos para el periodo evaluado.","recommended_action":"Ejecutar revisión de accesos con responsables autorizados, registrar excepciones y documentar las correcciones aprobadas.","evidence_expectation":"Acta o registro de revisión de accesos con fecha, alcance, sistemas incluidos, aprobador, resultados, excepciones y evidencia de correcciones cuando aplique.","audit_question":"¿La revisión cubre usuarios, perfiles privilegiados, cuentas inactivas y cambios aprobados dentro del periodo evaluado?","rule_hint":"No tratar ausencia de matriz, fecha, aprobador o resultado como evidencia suficiente.","severity_default":"alta"},
  {"problem_type_code":"backup_restore_test_missing","default_domain":"backup_restore","standard_code":null,"title":"Prueba de restauración no demostrada","intent_summary":"Orientación operativa para brechas de respaldo y restauración sin evidencia objetiva.","common_gap":"Hay política o respaldo declarado, pero no evidencia de restauración probada y resultado documentado.","recommended_action":"Ejecutar o recopilar prueba de restauración representativa, registrar alcance, resultado, responsables y lecciones aprendidas.","evidence_expectation":"Registro de prueba de restauración con fecha, sistema o dataset probado, resultado, tiempos, responsable y aprobación.","audit_question":"¿La evidencia demuestra restauración exitosa y no sólo existencia de respaldos?","rule_hint":"No asumir continuidad operacional sólo por jobs de backup exitosos.","severity_default":"alta"},
  {"problem_type_code":"kpi_deteriorated","default_domain":"kpi_management","standard_code":null,"title":"KPI deteriorado requiere análisis","intent_summary":"Orientación operativa para indicadores con tendencia o umbral deteriorado.","common_gap":"El indicador muestra deterioro sin análisis de causa, acción asociada o trazabilidad de seguimiento.","recommended_action":"Analizar causa del deterioro, registrar acción correctiva o preventiva y definir seguimiento con responsable.","evidence_expectation":"Ficha o registro de KPI con valor, periodo, fuente, umbral, análisis de causa, acción y seguimiento.","audit_question":"¿El deterioro está sustentado por fuente vigente y tiene acción proporcional registrada?","rule_hint":"No convertir ausencia de medición en valor cero ni en cumplimiento.","severity_default":"media"},
  {"problem_type_code":"kpi_without_source","default_domain":"kpi_management","standard_code":null,"title":"KPI sin fuente verificable","intent_summary":"Orientación operativa para indicadores sin fuente o linaje de medición claro.","common_gap":"El KPI se muestra sin fuente, método de cálculo, periodo o responsable de datos verificable.","recommended_action":"Registrar fuente, periodo, fórmula, responsable y evidencia de extracción o cálculo del KPI.","evidence_expectation":"Definición del KPI con fuente, fórmula, responsable, periodo de medición y registro de dato usado.","audit_question":"¿Puede reconstruirse el valor desde una fuente autorizada sin inferencias manuales?","rule_hint":"No deducir efectividad o cumplimiento desde un KPI sin linaje.","severity_default":"media"},
  {"problem_type_code":"risk_without_treatment","default_domain":"risk_management","standard_code":null,"title":"Riesgo sin tratamiento definido","intent_summary":"Orientación operativa para riesgos identificados sin plan de tratamiento trazable.","common_gap":"Existe riesgo registrado, pero no tratamiento, responsable, plazo o decisión aceptada sustentada.","recommended_action":"Definir tratamiento, responsable, plazo, evidencia esperada y criterio de aceptación o seguimiento.","evidence_expectation":"Registro de riesgo con evaluación, decisión de tratamiento, responsable, plazo y estado de seguimiento.","audit_question":"¿La decisión de tratamiento está aprobada y es proporcional al nivel de riesgo?","rule_hint":"No tratar riesgo sin acción como mitigado.","severity_default":"alta"},
  {"problem_type_code":"high_residual_risk","default_domain":"risk_management","standard_code":null,"title":"Riesgo residual alto requiere seguimiento","intent_summary":"Orientación operativa para riesgos residuales altos o críticos.","common_gap":"El riesgo residual permanece alto sin escalamiento, tratamiento adicional o aceptación formal sustentada.","recommended_action":"Escalar el riesgo, revisar tratamiento residual y registrar decisión con dueño autorizado.","evidence_expectation":"Registro de riesgo residual con justificación, aprobación, tratamiento complementario o aceptación formal.","audit_question":"¿El riesgo residual alto tiene dueño, decisión y seguimiento vigente?","rule_hint":"No inferir aceptación de riesgo por ausencia de nuevas acciones.","severity_default":"alta"},
  {"problem_type_code":"asset_without_owner","default_domain":"asset_management","standard_code":null,"title":"Activo sin propietario definido","intent_summary":"Orientación operativa para activos sin dueño responsable o accountability clara.","common_gap":"El activo figura en inventario sin propietario, criticidad o responsabilidades de protección asignadas.","recommended_action":"Asignar propietario del activo, validar criticidad y registrar responsabilidades operativas.","evidence_expectation":"Inventario actualizado con activo, propietario, criticidad, fecha de revisión y aprobación.","audit_question":"¿El propietario asignado puede aprobar uso, cambios y medidas de protección del activo?","rule_hint":"No considerar inventario completo si falta ownership de activos relevantes.","severity_default":"media"},
  {"problem_type_code":"supplier_without_evaluation","default_domain":"supplier_management","standard_code":null,"title":"Proveedor sin evaluación vigente","intent_summary":"Orientación operativa para proveedores críticos sin evaluación, homologación o reevaluación documentada.","common_gap":"El proveedor opera o presta servicio crítico sin evaluación vigente o criterios documentados.","recommended_action":"Evaluar o reevaluar al proveedor, registrar criterios, resultado, aprobación y acciones derivadas.","evidence_expectation":"Registro de evaluación de proveedor con alcance, criterios, resultado, vigencia, aprobador y plan de acción si aplica.","audit_question":"¿La evaluación cubre criticidad, desempeño, requisitos contractuales y riesgos relevantes?","rule_hint":"No equiparar contrato vigente con evaluación de proveedor vigente.","severity_default":"media"},
  {"problem_type_code":"training_without_record","default_domain":"training_competence","standard_code":null,"title":"Capacitación o competencia sin registro","intent_summary":"Orientación operativa para formación, competencia o toma de conciencia sin evidencia.","common_gap":"La actividad de formación o competencia no tiene asistencia, evaluación, fecha o relación con rol requerido.","recommended_action":"Recopilar o ejecutar registro de capacitación/competencia con participantes, contenido, fecha y evaluación cuando aplique.","evidence_expectation":"Registro de capacitación o competencia con fecha, participantes, contenido, relator/responsable y evaluación o confirmación.","audit_question":"¿La evidencia demuestra competencia o toma de conciencia para el rol afectado?","rule_hint":"No considerar suficiente una convocatoria sin asistencia o resultado.","severity_default":"media"},
  {"problem_type_code":"management_review_gap","default_domain":"management_review","standard_code":null,"title":"Brecha en revisión por la dirección","intent_summary":"Orientación operativa para revisión gerencial incompleta o no evidenciada.","common_gap":"Faltan entradas, decisiones, acciones o seguimiento de revisión por la dirección.","recommended_action":"Completar acta o registro de revisión con entradas requeridas por el sistema, decisiones, responsables y seguimiento.","evidence_expectation":"Acta de revisión gerencial con agenda, entradas evaluadas, decisiones, acciones, responsables y fechas de seguimiento.","audit_question":"¿La revisión deja decisiones trazables y acciones cuando detecta brechas?","rule_hint":"No tratar una reunión sin decisiones documentadas como revisión completa.","severity_default":"media"},
  {"problem_type_code":"document_obsolete","default_domain":"document_control","standard_code":null,"title":"Documento obsoleto o no vigente","intent_summary":"Orientación operativa para documentos vencidos, no controlados o desactualizados.","common_gap":"El documento usado no coincide con versión vigente, aprobación o distribución controlada.","recommended_action":"Actualizar o retirar documento obsoleto, publicar versión vigente y registrar aprobación/comunicación.","evidence_expectation":"Historial documental con versión, fecha, aprobador, motivo de cambio y evidencia de retiro o publicación.","audit_question":"¿Los usuarios acceden a la versión vigente y se controla el uso de versiones obsoletas?","rule_hint":"No aceptar copia local sin control como documento vigente.","severity_default":"media"},
  {"problem_type_code":"procedure_missing","default_domain":"document_control","standard_code":null,"title":"Procedimiento requerido no documentado","intent_summary":"Orientación operativa para actividades que requieren procedimiento o método documentado.","common_gap":"La actividad se ejecuta sin procedimiento, alcance, roles o criterios mínimos definidos.","recommended_action":"Documentar procedimiento o método, aprobarlo y comunicar responsabilidades de ejecución.","evidence_expectation":"Procedimiento aprobado con objetivo, alcance, roles, frecuencia, registros generados y control de cambios.","audit_question":"¿El procedimiento define claramente cómo se ejecuta, registra y controla la actividad?","rule_hint":"No reemplazar procedimiento requerido por instrucciones verbales.","severity_default":"media"},
  {"problem_type_code":"procedure_not_implemented","default_domain":"operational_control","standard_code":null,"title":"Procedimiento definido no implementado","intent_summary":"Orientación operativa para procedimientos aprobados sin ejecución demostrada.","common_gap":"Existe procedimiento, pero no registros de ejecución, seguimiento o responsables para el periodo.","recommended_action":"Ejecutar el procedimiento pendiente o documentar la ejecución real con registros y responsables.","evidence_expectation":"Registro operativo del procedimiento con fecha, responsable, resultado, desviaciones y acciones cuando aplique.","audit_question":"¿La ejecución real coincide con la frecuencia, alcance y roles definidos?","rule_hint":"No asumir implementación sólo por tener procedimiento aprobado.","severity_default":"media"},
  {"problem_type_code":"control_not_executed","default_domain":"operational_control","standard_code":null,"title":"Control no ejecutado","intent_summary":"Orientación operativa para controles pendientes o sin evidencia de ejecución.","common_gap":"El control tiene diseño o asignación, pero no hay evidencia de ejecución en el periodo aplicable.","recommended_action":"Ejecutar el control, registrar resultado y documentar excepciones o acciones derivadas.","evidence_expectation":"Registro de ejecución del control con periodo, responsable, resultado, evidencia adjunta y revisión.","audit_question":"¿La evidencia demuestra ejecución del control y no sólo planificación?","rule_hint":"No convertir control sin ejecución en control efectivo.","severity_default":"alta"},
  {"problem_type_code":"finding_open","default_domain":"internal_audit","standard_code":null,"title":"Hallazgo abierto requiere tratamiento","intent_summary":"Orientación operativa para hallazgos abiertos que requieren análisis y acción.","common_gap":"El hallazgo permanece abierto sin causa, acción, responsable, plazo o evidencia de avance suficientes.","recommended_action":"Confirmar causa, definir acción con responsable y registrar evidencia de tratamiento y seguimiento.","evidence_expectation":"Registro de hallazgo con estado, causa, acción, responsable, plazo, evidencia de avance y revisión.","audit_question":"¿El hallazgo tiene tratamiento proporcional y evidencia objetiva antes de cualquier cierre?","rule_hint":"No cerrar automáticamente hallazgos por recomendación de IA.","severity_default":"media"},
  {"problem_type_code":"finding_recurrent","default_domain":"continuous_improvement","standard_code":null,"title":"Hallazgo recurrente requiere causa sistémica","intent_summary":"Orientación operativa para recurrencia de hallazgos o brechas similares.","common_gap":"La misma brecha se repite sin análisis sistémico ni acción preventiva eficaz demostrada.","recommended_action":"Analizar recurrencia, identificar causa sistémica y definir acción preventiva verificable.","evidence_expectation":"Análisis de recurrencia con casos comparados, causa sistémica, acción preventiva y verificación posterior.","audit_question":"¿La acción reduce la probabilidad de repetición y tiene seguimiento comprobable?","rule_hint":"No interpretar cierre anterior como efectividad preventiva.","severity_default":"alta"},
  {"problem_type_code":"nonconformity_open","default_domain":"nonconformity_management","standard_code":null,"title":"No conformidad abierta requiere corrección y acción","intent_summary":"Orientación operativa para no conformidades abiertas o de severidad alta.","common_gap":"La no conformidad no tiene corrección, análisis de causa, acción correctiva o validación documentada.","recommended_action":"Definir corrección inmediata, causa raíz, acción correctiva, responsable y evidencia de verificación.","evidence_expectation":"Registro de no conformidad con declaración, evidencia objetiva, causa, acción, responsable, plazo y verificación.","audit_question":"¿La evidencia permite validar corrección y acción sin auto-cierre ni inferencia?","rule_hint":"No afirmar conformidad hasta revisión humana y evidencia objetiva suficiente.","severity_default":"alta"},
  {"problem_type_code":"action_overdue","default_domain":"corrective_actions","standard_code":null,"title":"Acción vencida requiere replanificación controlada","intent_summary":"Orientación operativa para acciones correctivas o preventivas vencidas.","common_gap":"La acción está vencida sin justificación, reprogramación aprobada o evidencia de avance.","recommended_action":"Revisar causa del atraso, actualizar plazo con aprobación y registrar acciones de contención si corresponde.","evidence_expectation":"Registro de acción con vencimiento original, motivo de atraso, nuevo plazo aprobado, responsable y avance.","audit_question":"¿La replanificación mantiene control sobre el riesgo o brecha original?","rule_hint":"No cambiar fechas sin trazabilidad de aprobación.","severity_default":"media"},
  {"problem_type_code":"action_without_evidence","default_domain":"corrective_actions","standard_code":null,"title":"Acción sin evidencia de implementación","intent_summary":"Orientación operativa para acciones marcadas como realizadas sin respaldo objetivo.","common_gap":"La acción indica avance o cierre, pero no tiene evidencia de ejecución, revisión o resultado.","recommended_action":"Adjuntar evidencia objetiva de implementación y registrar revisión antes de solicitar cierre.","evidence_expectation":"Evidencia de implementación con fecha, responsable, resultado, vínculo a acción y aprobación o revisión.","audit_question":"¿La evidencia demuestra que la acción fue implementada y revisada?","rule_hint":"No inferir implementación por cambio manual de estado.","severity_default":"media"},
  {"problem_type_code":"missing_evidence","default_domain":"evidence_management","standard_code":null,"title":"Evidencia faltante","intent_summary":"Orientación operativa para requisitos, controles o acciones sin evidencia objetiva disponible.","common_gap":"No existe evidencia adjunta o trazable para demostrar ejecución, revisión, resultado o aprobación.","recommended_action":"Identificar el registro esperado, recopilar evidencia objetiva o declarar explícitamente la ausencia y abrir acción de tratamiento.","evidence_expectation":"Evidencia objetiva con fecha, periodo, responsable, resultado, alcance y vínculo al control, requisito, hallazgo o acción aplicable.","audit_question":"¿La evidencia permite demostrar qué ocurrió, cuándo, quién aprobó y a qué alcance aplica?","rule_hint":"No convertir ausencia de evidencia en cumplimiento ni en valor cero.","severity_default":"media"},
  {"problem_type_code":"weak_evidence","default_domain":"evidence_management","standard_code":null,"title":"Evidencia insuficiente o débil","intent_summary":"Orientación operativa para evidencias incompletas, ambiguas o sin atributos mínimos.","common_gap":"La evidencia existe, pero carece de fecha, responsable, alcance, resultado o vínculo verificable.","recommended_action":"Solicitar evidencia complementaria con atributos mínimos y registrar criterio de aceptación.","evidence_expectation":"Evidencia complementaria que incluya fecha, responsable, alcance, resultado, aprobación y relación con el requisito evaluado.","audit_question":"¿La evidencia permite validación independiente sin depender de explicación verbal?","rule_hint":"No aceptar capturas aisladas sin contexto mínimo como evidencia suficiente.","severity_default":"media"},
  {"problem_type_code":"expired_evidence","default_domain":"evidence_management","standard_code":null,"title":"Evidencia vencida o fuera de periodo","intent_summary":"Orientación operativa para evidencia no vigente o que no cubre el periodo evaluado.","common_gap":"La evidencia corresponde a un periodo anterior, está vencida o no demuestra vigencia actual.","recommended_action":"Solicitar evidencia vigente del periodo aplicable o documentar brecha y plan de actualización.","evidence_expectation":"Registro vigente con periodo aplicable, fecha, responsable, estado actual y aprobación cuando corresponda.","audit_question":"¿La evidencia corresponde al periodo y versión evaluados?","rule_hint":"No reutilizar evidencia vencida para demostrar cumplimiento actual.","severity_default":"media"},
  {"problem_type_code":"invalid_evidence","default_domain":"evidence_management","standard_code":null,"title":"Evidencia inválida para el requisito","intent_summary":"Orientación operativa para evidencia que no demuestra el hecho requerido.","common_gap":"El archivo o registro adjunto no prueba ejecución, aprobación, resultado o alcance requerido.","recommended_action":"Rechazar o marcar como insuficiente la evidencia, explicar el motivo y solicitar respaldo adecuado.","evidence_expectation":"Evidencia reemplazada o complementaria que demuestre directamente el requisito, control o acción aplicable.","audit_question":"¿El documento demuestra el hecho evaluado o sólo se relaciona indirectamente?","rule_hint":"No aceptar evidencia irrelevante por coincidencia de nombre o tema.","severity_default":"media"},
  {"problem_type_code":"control_without_owner","default_domain":"operational_control","standard_code":null,"title":"Control sin responsable asignado","intent_summary":"Orientación operativa para controles sin dueño, ejecutor o revisor claramente asignado.","common_gap":"El control carece de ownership y por tanto no hay accountability de ejecución o revisión.","recommended_action":"Asignar dueño del control, ejecutor y revisor, y actualizar matriz de responsabilidades.","evidence_expectation":"Matriz o ficha de control con dueño, ejecutor, revisor, frecuencia, fecha de actualización y aprobación.","audit_question":"¿El responsable asignado tiene autoridad para ejecutar, revisar y corregir el control?","rule_hint":"No considerar operativo un control sin accountability definida.","severity_default":"media"},
  {"problem_type_code":"control_overdue_review","default_domain":"operational_control","standard_code":null,"title":"Revisión de control vencida","intent_summary":"Orientación operativa para controles cuya revisión periódica está atrasada.","common_gap":"La revisión del control no se realizó o no se documentó dentro de la frecuencia definida.","recommended_action":"Ejecutar revisión del control, registrar cambios necesarios y actualizar evidencia de aprobación.","evidence_expectation":"Registro de revisión de control con fecha, responsable, resultado, cambios, aprobación y próximo vencimiento.","audit_question":"¿La revisión confirma que el diseño y la ejecución del control siguen siendo adecuados?","rule_hint":"No extender vigencia de revisión sin evidencia de evaluación.","severity_default":"media"}
]
$catalog$::jsonb;
  entry jsonb;
  expected_count integer;
  actual_count integer;
  coverage_count integer;
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026091403) THEN
    RAISE EXCEPTION 'AI Guided product-ready knowledge catalog migration lock unavailable';
  END IF;

  IF to_regclass('public.knowledge_sources') IS NULL
     OR to_regclass('public.knowledge_items') IS NULL
     OR to_regclass('public.knowledge_mappings') IS NULL
     OR to_regclass('public.knowledge_common_gaps') IS NULL
     OR to_regclass('public.knowledge_recommended_actions') IS NULL
     OR to_regclass('public.knowledge_evidence_expectations') IS NULL
     OR to_regclass('public.knowledge_audit_questions') IS NULL
     OR to_regclass('public.knowledge_rules') IS NULL
     OR to_regclass('public.knowledge_rule_hints') IS NULL THEN
    RAISE EXCEPTION 'AI Guided canonical knowledge tables are required before loading product-ready catalog';
  END IF;

  INSERT INTO public.knowledge_sources (
    source_key, source_name, source_type, license_class, use_in_system,
    source_file, seed_version, metadata_json, updated_at
  )
  VALUES (
    source_key_value,
    'TCDX AI Guided problem catalog v1',
    'tcdx_internal_methodology',
    'derived_summary',
    ARRAY['ai_guided','recommendations','evidence_expectations','audit_questions']::text[],
    'database/migrations/20260914_ai_guided_product_ready_knowledge_catalog.sql',
    'ai-guided-product-ready-v1',
    jsonb_build_object(
      'provenance', 'derived_summary',
      'official_standard_text', false,
      'tenant_specific', false,
      'contract', 'runtime_problem_type_catalog'
    ),
    now()
  )
  ON CONFLICT (source_key) DO UPDATE SET
    source_name = EXCLUDED.source_name,
    source_type = EXCLUDED.source_type,
    license_class = EXCLUDED.license_class,
    use_in_system = EXCLUDED.use_in_system,
    source_file = EXCLUDED.source_file,
    seed_version = EXCLUDED.seed_version,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

  FOR entry IN SELECT value FROM jsonb_array_elements(catalog)
  LOOP
    INSERT INTO public.knowledge_items (
      item_key, source_key, source_record_id, standard_family, standard_code,
      clause_or_control, domain, item_type, title, intent_summary,
      license_class, use_in_system, search_text, tags, severity_default,
      raw_json, is_active, updated_at
    )
    VALUES (
      entry->>'problem_type_code',
      source_key_value,
      entry->>'problem_type_code',
      'GRC',
      NULLIF(entry->>'standard_code', ''),
      'AI-GUIDED',
      entry->>'default_domain',
      'ai_guided_problem_catalog',
      entry->>'title',
      entry->>'intent_summary',
      'derived_summary',
      ARRAY['ai_guided','recommendations','evidence_expectations','audit_questions']::text[],
      concat_ws(' ', entry->>'problem_type_code', entry->>'default_domain', entry->>'title', entry->>'intent_summary', entry->>'common_gap', entry->>'recommended_action', entry->>'evidence_expectation'),
      ARRAY['ai_guided', 'runtime_problem', entry->>'problem_type_code', entry->>'default_domain']::text[],
      entry->>'severity_default',
      jsonb_build_object(
        'catalog_entry', entry,
        'provenance', 'derived_summary',
        'official_standard_text', false,
        'can_auto_close', false
      ),
      true,
      now()
    )
    ON CONFLICT (item_key) DO UPDATE SET
      source_record_id = EXCLUDED.source_record_id,
      standard_family = EXCLUDED.standard_family,
      standard_code = EXCLUDED.standard_code,
      clause_or_control = EXCLUDED.clause_or_control,
      domain = EXCLUDED.domain,
      item_type = EXCLUDED.item_type,
      title = EXCLUDED.title,
      intent_summary = EXCLUDED.intent_summary,
      license_class = EXCLUDED.license_class,
      use_in_system = EXCLUDED.use_in_system,
      search_text = EXCLUDED.search_text,
      tags = EXCLUDED.tags,
      severity_default = EXCLUDED.severity_default,
      raw_json = EXCLUDED.raw_json,
      is_active = true,
      updated_at = now()
    WHERE knowledge_items.source_key = source_key_value;

    IF EXISTS (
      SELECT 1 FROM public.knowledge_items
      WHERE item_key = entry->>'problem_type_code'
        AND source_key = source_key_value
    ) THEN
      INSERT INTO public.knowledge_common_gaps (item_key, gap_text, severity_default, metadata_json, updated_at)
      SELECT entry->>'problem_type_code', entry->>'common_gap', entry->>'severity_default',
             jsonb_build_object('provenance','derived_summary','official_standard_text',false), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM public.knowledge_common_gaps
        WHERE item_key = entry->>'problem_type_code'
          AND gap_text = entry->>'common_gap'
      );

      INSERT INTO public.knowledge_recommended_actions (item_key, action_text, action_basis, priority_default, metadata_json, updated_at)
      SELECT entry->>'problem_type_code', entry->>'recommended_action', 'derived_summary', entry->>'severity_default',
             jsonb_build_object('provenance','derived_summary','official_standard_text',false,'recommendation_only',true), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM public.knowledge_recommended_actions
        WHERE item_key = entry->>'problem_type_code'
          AND action_text = entry->>'recommended_action'
      );

      INSERT INTO public.knowledge_evidence_expectations (item_key, expectation_text, evidence_type, required_level, metadata_json, updated_at)
      SELECT entry->>'problem_type_code', entry->>'evidence_expectation', 'objective_record', 'minimum',
             jsonb_build_object('provenance','derived_summary','official_standard_text',false), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM public.knowledge_evidence_expectations
        WHERE item_key = entry->>'problem_type_code'
          AND expectation_text = entry->>'evidence_expectation'
      );

      INSERT INTO public.knowledge_audit_questions (item_key, question_text, question_type, metadata_json, updated_at)
      SELECT entry->>'problem_type_code', entry->>'audit_question', 'audit',
             jsonb_build_object('provenance','derived_summary','official_standard_text',false), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM public.knowledge_audit_questions
        WHERE item_key = entry->>'problem_type_code'
          AND question_text = entry->>'audit_question'
      );

      INSERT INTO public.knowledge_rules (item_key, rule_key, rule_type, rule_text, severity_default, metadata_json, updated_at)
      VALUES (
        entry->>'problem_type_code',
        'ai_guided_rule:' || (entry->>'problem_type_code'),
        'guardrail_hint',
        entry->>'rule_hint',
        entry->>'severity_default',
        jsonb_build_object('provenance','derived_summary','official_standard_text',false,'no_auto_close',true),
        now()
      )
      ON CONFLICT (item_key, rule_key) DO UPDATE SET
        rule_type = EXCLUDED.rule_type,
        rule_text = EXCLUDED.rule_text,
        severity_default = EXCLUDED.severity_default,
        metadata_json = EXCLUDED.metadata_json,
        updated_at = now();

      INSERT INTO public.knowledge_rule_hints (item_key, hint_text, severity_default, metadata_json, updated_at)
      SELECT entry->>'problem_type_code', entry->>'rule_hint', entry->>'severity_default',
             jsonb_build_object('provenance','derived_summary','official_standard_text',false,'no_auto_close',true), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM public.knowledge_rule_hints
        WHERE item_key = entry->>'problem_type_code'
          AND hint_text = entry->>'rule_hint'
      );

      INSERT INTO public.knowledge_mappings (
        item_key, mapping_key, target_type, target_key, entity_type,
        standard_family, standard_code, clause_or_control, domain,
        match_weight, tags, confidence, metadata_json, updated_at
      )
      SELECT
        entry->>'problem_type_code',
        'ai_guided_catalog_map:' || (entry->>'problem_type_code'),
        'problem_type',
        entry->>'problem_type_code',
        'audit_finding',
        'GRC',
        NULLIF(entry->>'standard_code', ''),
        'AI-GUIDED',
        entry->>'default_domain',
        1.00,
        ARRAY['ai_guided', 'runtime_problem', entry->>'problem_type_code', entry->>'default_domain']::text[],
        0.9000,
        jsonb_build_object('provenance','derived_summary','official_standard_text',false),
        now()
      WHERE NOT EXISTS (
        SELECT 1 FROM public.knowledge_mappings
        WHERE item_key = entry->>'problem_type_code'
          AND mapping_key = 'ai_guided_catalog_map:' || (entry->>'problem_type_code')
      );
    END IF;
  END LOOP;

  expected_count := jsonb_array_length(catalog);
  SELECT count(*) INTO actual_count
  FROM public.knowledge_items
  WHERE source_key = source_key_value
    AND item_type = 'ai_guided_problem_catalog'
    AND is_active IS DISTINCT FROM false;

  IF actual_count <> expected_count THEN
    RAISE EXCEPTION 'AI Guided catalog coverage mismatch: expected %, found %', expected_count, actual_count;
  END IF;

  SELECT count(*) INTO coverage_count
  FROM public.knowledge_items i
  WHERE i.item_key IN ('access_review_missing','missing_evidence')
    AND i.source_key = source_key_value
    AND EXISTS (SELECT 1 FROM public.knowledge_mappings m WHERE m.item_key = i.item_key)
    AND EXISTS (SELECT 1 FROM public.knowledge_recommended_actions a WHERE a.item_key = i.item_key)
    AND EXISTS (SELECT 1 FROM public.knowledge_evidence_expectations e WHERE e.item_key = i.item_key);

  IF coverage_count <> 2 THEN
    RAISE EXCEPTION 'AI Guided required problem coverage missing for access_review_missing or missing_evidence';
  END IF;
END $$;

COMMIT;
