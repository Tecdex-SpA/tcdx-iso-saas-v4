-- RBAC-03 continuity: definitive commercial plan capability matrix.
-- This is not an RBAC role/permission migration. It normalizes the commercial
-- catalog so standard tenant plans are capability-precise:
-- ISO = ONLY_ISO
-- ISO_RISK = ISO + OPERATIONAL_RISK_ONLY
-- GRC = ALL_TENANT_COMMERCIAL_CAPABILITIES

BEGIN;

UPDATE commercial_plans
SET
  display_name = CASE plan_key
    WHEN 'pyme' THEN 'ISO'
    WHEN 'empresa' THEN 'ISO + Riesgo Operativo'
    WHEN 'enterprise' THEN 'GRC'
    ELSE display_name
  END,
  description = CASE plan_key
    WHEN 'pyme' THEN 'Solo funcionalidades ISO: dashboard, normas/alcance, diagnostico, cumplimiento, controles, evidencias, SOA, ciclo de vida, auditorias, hallazgos, no conformidades, acciones, riesgos ISO, matriz de riesgo ISO, metricas y reportes ISO necesarios.'
    WHEN 'empresa' THEN 'ISO mas exclusivamente Riesgo Operativo: registro operacional, controles asociados, BIA, continuidad, crisis, eventos de perdida, riesgo cuantitativo, procesos, unidades, servicios e indicadores del dominio.'
    WHEN 'enterprise' THEN 'Todas las capacidades tenant comercializables del sistema, sujetas a tenant activo, suscripcion activa, modulo activo, RBAC y scope.'
    ELSE description
  END,
  updated_at = now()
WHERE plan_key IN ('pyme', 'empresa', 'enterprise');

CREATE TEMP TABLE commercial_standard_capability_catalog (
  capability_key text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL,
  required_permission text,
  module_key text NOT NULL,
  module_display_name text NOT NULL,
  module_description text NOT NULL,
  module_sort_order integer NOT NULL,
  feature_key text NOT NULL,
  feature_display_name text NOT NULL,
  feature_description text NOT NULL,
  classification text NOT NULL CHECK (classification IN ('ISO_ONLY','OPERATIONAL_RISK_EXTENSION','GRC_ADVANCED'))
) ON COMMIT DROP;

INSERT INTO commercial_standard_capability_catalog (
  capability_key, display_name, description, required_permission,
  module_key, module_display_name, module_description, module_sort_order,
  feature_key, feature_display_name, feature_description, classification
)
VALUES
  ('core.dashboard','Dashboard base','Acceso al resumen operacional del tenant.','dashboards.read','core','Core operativo','Base operativa multi-tenant.',10,'core.dashboard','Dashboard base','Dashboard de entrada del tenant.','ISO_ONLY'),
  ('core.reports','Reportes ISO','Reportes/exportes estrictamente asociados a ISO.','reports.read','core','Core operativo','Base operativa multi-tenant.',10,'core.reports','Reportes ISO','Reportes base ISO.','ISO_ONLY'),
  ('iso.compliance','Cumplimiento ISO','Gestion ISO, diagnostico, controles, SOA, auditorias, hallazgos y no conformidades.','framework.read','iso','ISO','Gestion funcional ISO.',20,'iso_compliance_core','Cumplimiento ISO','Funcionalidad central de cumplimiento ISO.','ISO_ONLY'),
  ('iso.risk','Riesgos ISO','Riesgos ISO y matriz de riesgo ISO.','risk_matrix.view','risks','Riesgos ISO','Riesgos y matriz de riesgo ISO.',30,'iso_risk_core','Riesgos ISO','Gestion de riesgos ISO.','ISO_ONLY'),
  ('iso.actions','Acciones ISO','Planes de accion y acciones recomendadas relacionadas con cumplimiento ISO.','actions.read','iso','ISO','Gestion funcional ISO.',20,'iso_actions_core','Acciones ISO','Acciones y planes de mejora ISO.','ISO_ONLY'),
  ('evidence.library','Evidencias ISO','Evidencias y documentos/evidencia normativa ISO.','evidences.view','evidences','Evidencias ISO','Biblioteca de evidencias y documentos ISO.',40,'evidence_library_core','Biblioteca de evidencias','Gestion documental y evidencias ISO.','ISO_ONLY'),
  ('iso.health','Health ISO','Health/estado ISO y metricas estrictamente necesarias para gestion ISO.','framework.read','health','Health ISO','Estado, health y KPIs minimos ISO.',50,'iso_health_core','Health ISO','Estado ISO y KPIs minimos.','ISO_ONLY'),

  ('grc.phase3','Riesgo Operativo','Procesos, unidades, servicios, BIA, continuidad, crisis e indicadores de riesgo operacional.','operations.dashboard.read','operations_grc','Riesgo Operativo','Operacion, BIA, continuidad y crisis.',60,'operational_risk_core','Riesgo Operativo','Dominio de riesgo operacional.','OPERATIONAL_RISK_EXTENSION'),
  ('imports.excel','Importacion operacional','Importacion necesaria para operar el dominio de riesgo operacional.','operations.import','operations_grc','Riesgo Operativo','Operacion, BIA, continuidad y crisis.',60,'operational_imports','Importacion operacional','Carga controlada para operaciones/riesgo operacional.','OPERATIONAL_RISK_EXTENSION'),
  ('risk.quantitative','Riesgo cuantitativo','Escenarios cuantitativos y exposicion financiera operacional.','quantitative_risk.read','risk_manager','Risk Manager','Riesgo operacional cuantitativo y metodologia.',70,'operational_quantitative_risk','Riesgo cuantitativo','Cuantificacion operacional.','OPERATIONAL_RISK_EXTENSION'),
  ('methodology.risk','Metodologias de riesgo','Escalas, matrices y scoring versionado para riesgo operacional.','quantitative_risk.read','risk_manager','Risk Manager','Riesgo operacional cuantitativo y metodologia.',70,'operational_risk_methodology','Metodologias de riesgo','Metodologia operacional.','OPERATIONAL_RISK_EXTENSION'),
  ('loss.events','Eventos de perdida','Registro de perdidas, recuperaciones y KRI de riesgo operacional.','loss_events.read','operational_losses','Eventos de perdida','Perdidas operacionales.',80,'operational_loss_events','Eventos de perdida','Eventos de perdida operacional.','OPERATIONAL_RISK_EXTENSION'),

  ('grc.phase1','Nucleo GRC avanzado','Workflow GRC transversal, readiness y auditoria avanzada.','workflow.read','grc_core','GRC central','Workflow, readiness y auditoria avanzada.',90,'grc.phase1','Nucleo GRC avanzado','Workflow GRC transversal.','GRC_ADVANCED'),
  ('grc.phase2','GRC integrado','Privacidad, incidentes, proveedores, conectores y relaciones GRC.','workflow.read','integrated_grc','GRC integrado','Privacidad, incidentes, TPRM y conectores.',100,'grc.phase2','GRC integrado','Dominios GRC integrados.','GRC_ADVANCED'),
  ('tprm.suppliers','Proveedores y terceros','Gestion de proveedores, terceros y TPRM.','suppliers.read','integrated_grc','GRC integrado','Privacidad, incidentes, TPRM y conectores.',100,'tprm.suppliers','TPRM','Proveedores y terceros.','GRC_ADVANCED'),
  ('data.governance','Gobierno de datos','Catalogo maestro, ownership y definiciones.','data.catalog.read','data_governance','Datos y confianza','Gobierno, calidad, lineage e impacto de datos.',110,'data_governance_core','Datos gobernados','Gobierno de datos.','GRC_ADVANCED'),
  ('metrics.data_trust','Data Trust','Score de confianza explicable y determinista.','data.quality.read','data_governance','Datos y confianza','Gobierno, calidad, lineage e impacto de datos.',110,'data_governance_core','Datos gobernados','Gobierno de datos.','GRC_ADVANCED'),
  ('data.lineage','Lineage de datos','Trazabilidad extremo a extremo.','data.lineage.read','data_governance','Datos y confianza','Gobierno, calidad, lineage e impacto de datos.',110,'data_governance_core','Datos gobernados','Gobierno de datos.','GRC_ADVANCED'),
  ('data.impact_graph','Impact Graph GRC','Grafo de impacto dato-metrica-riesgo-control.','data.lineage.read','data_governance','Datos y confianza','Gobierno, calidad, lineage e impacto de datos.',110,'data_governance_core','Datos gobernados','Gobierno de datos.','GRC_ADVANCED'),
  ('data.semantic_layer','Capa semantica GRC','Contratos, mappings, observaciones, calidad, freshness, suficiencia y lineage.','semantic.contracts.read','data_governance','Datos y confianza','Gobierno, calidad, lineage e impacto de datos.',110,'data_governance_core','Datos gobernados','Gobierno de datos.','GRC_ADVANCED'),
  ('metrics.catalog','Catalogo de metricas','Metricas versionadas KPI/KRI/KCI/KQI/SLA.','metrics.read','metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.',120,'metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','GRC_ADVANCED'),
  ('metrics.engine','Motor de metricas','Calculo declarativo y mediciones reproducibles.','metrics.measure','metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.',120,'metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','GRC_ADVANCED'),
  ('bi.dashboard_builder','Dashboard builder','Dashboards y widgets gobernados.','dashboards.read','metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.',120,'metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','GRC_ADVANCED'),
  ('bi.executive_dashboards','Dashboards ejecutivos','Dashboards ejecutivos GRC predefinidos.','dashboards.read','metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.',120,'metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','GRC_ADVANCED'),
  ('metrics.indicators.read','Indicadores funcionales','Consulta funcional de indicadores oficiales.','metrics.read','metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.',120,'metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','GRC_ADVANCED'),
  ('metrics.indicators.technical','Detalle tecnico de indicadores','Metodologia, binding, lineage y checksums.','data.lineage.read','metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.',120,'metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','GRC_ADVANCED'),
  ('metrics.methodology.manage','Administrar metodologia','Crea versiones de catalogo, binding, politicas y thresholds.','metrics.manage','metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.',120,'metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','GRC_ADVANCED'),
  ('metrics.methodology.review','Revisar metodologia','Revisa definiciones, thresholds y politicas.','metrics.validate','metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.',120,'metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','GRC_ADVANCED'),
  ('metrics.methodology.publish','Publicar metodologia','Publica versiones inmutables.','metrics.publish','metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.',120,'metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','GRC_ADVANCED'),
  ('metrics.snapshots.publish','Publicar snapshots','Crea y publica snapshots oficiales.','metrics.measure','metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.',120,'metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','GRC_ADVANCED'),
  ('metrics.comparisons.read','Comparar indicadores','Consulta comparaciones metodologicamente compatibles.','metrics.read','metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.',120,'metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','GRC_ADVANCED'),
  ('metrics.actions.propose','Proponer acciones','Crea propuestas reversibles desde indicadores.','metrics.measure','metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.',120,'metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','GRC_ADVANCED'),
  ('metrics.actions.review','Revisar acciones propuestas','Acepta o rechaza propuestas sin ejecucion automatica.','metrics.validate','metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.',120,'metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','GRC_ADVANCED'),
  ('metrics.jobs.run','Ejecutar jobs de indicadores','Ejecuta jobs tenant-scoped e idempotentes.','metrics.recalculate','metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.',120,'metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','GRC_ADVANCED'),
  ('surveys.engine','Motor de encuestas','Encuestas, campanas, respuestas y scoring.','surveys.read','surveys_assessments','Encuestas y evaluaciones','Encuestas, campanas y evaluaciones GRC.',130,'surveys_assessments_core','Encuestas y evaluaciones','Encuestas, campanas y scoring.','GRC_ADVANCED'),
  ('assurance.testing','Tests de assurance','Tests de controles, riesgos, activos y evidencias.','assurance_tests.read','assurance_loss','Assurance','Tests de assurance GRC avanzados.',140,'assurance_testing','Assurance','Tests de assurance.','GRC_ADVANCED'),
  ('reporting.studio','Report Studio','Definiciones, emisiones e historial de reportes.','reports.read','report_studio','Report Studio','Reporting gobernado PDF DOCX XLSX y scheduling.',150,'report_studio_core','Report Studio','Reporting gobernado.','GRC_ADVANCED'),
  ('reporting.pdf','Reportes PDF','Generacion de PDF valido.','reports.generate','report_studio','Report Studio','Reporting gobernado PDF DOCX XLSX y scheduling.',150,'report_studio_core','Report Studio','Reporting gobernado.','GRC_ADVANCED'),
  ('reporting.docx','Reportes DOCX','Generacion de DOCX valido.','reports.generate','report_studio','Report Studio','Reporting gobernado PDF DOCX XLSX y scheduling.',150,'report_studio_core','Report Studio','Reporting gobernado.','GRC_ADVANCED'),
  ('reporting.xlsx','Reportes XLSX','Generacion XLSX valido.','reports.generate','report_studio','Report Studio','Reporting gobernado PDF DOCX XLSX y scheduling.',150,'report_studio_core','Report Studio','Reporting gobernado.','GRC_ADVANCED'),
  ('reporting.scheduled','Reporting programado','Programacion gobernada de reportes.','reports.schedule','report_studio','Report Studio','Reporting gobernado PDF DOCX XLSX y scheduling.',150,'report_studio_core','Report Studio','Reporting gobernado.','GRC_ADVANCED'),
  ('reports.premium','Reportes Premium','Exportacion avanzada PDF y ZIP.','grc.export.generate','premium_reports','Reportes Premium','Exportaciones ejecutivas y paquetes avanzados.',160,'premium_reports_core','Reportes Premium','Reportes premium.','GRC_ADVANCED'),
  ('workpapers.audit','Papeles de trabajo','Plantillas reutilizables para auditoria interna.','commercial.workpaper.read','audit_workpapers','Papeles de trabajo','Workpapers avanzados de auditoria.',170,'audit_workpapers_core','Papeles de trabajo','Plantillas avanzadas.','GRC_ADVANCED'),
  ('ai.compliance','IA Compliance','Analisis asistido de cumplimiento con limites de uso.','ai_compliance.read','ai_compliance','IA Compliance','IA Compliance e IA Auditor avanzadas.',180,'ai_compliance_core','IA Compliance','Analisis asistido avanzado.','GRC_ADVANCED'),
  ('ai.auditor','IA Auditor','Auditoria asistida avanzada con validacion humana.','audit.review','ai_compliance','IA Compliance','IA Compliance e IA Auditor avanzadas.',180,'ai_auditor_core','IA Auditor','Auditoria asistida avanzada.','GRC_ADVANCED');

INSERT INTO commercial_modules (module_key, display_name, description, status, sort_order)
SELECT DISTINCT module_key, module_display_name, module_description, 'active', module_sort_order
FROM commercial_standard_capability_catalog
ON CONFLICT (module_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    status = 'active',
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

INSERT INTO commercial_features (feature_key, display_name, description, status)
SELECT DISTINCT feature_key, feature_display_name, feature_description, 'active'
FROM commercial_standard_capability_catalog
ON CONFLICT (feature_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    status = 'active',
    updated_at = now();

INSERT INTO commercial_technical_capabilities (capability_key, display_name, description, required_permission, status, metadata)
SELECT
  capability_key,
  display_name,
  description,
  required_permission,
  'active',
  jsonb_build_object(
    'commercial_classification', classification,
    'standard_plan_matrix', '20260828_definitive'
  )
FROM commercial_standard_capability_catalog
ON CONFLICT (capability_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    required_permission = EXCLUDED.required_permission,
    status = 'active',
    metadata = COALESCE(commercial_technical_capabilities.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now();

INSERT INTO module_features (module_key, feature_key)
SELECT DISTINCT module_key, feature_key
FROM commercial_standard_capability_catalog
ON CONFLICT (module_key, feature_key) DO NOTHING;

INSERT INTO feature_capabilities (feature_key, capability_key)
SELECT DISTINCT feature_key, capability_key
FROM commercial_standard_capability_catalog
ON CONFLICT (feature_key, capability_key) DO NOTHING;

CREATE TEMP TABLE commercial_standard_plan_capabilities (
  plan_key text NOT NULL,
  capability_key text NOT NULL,
  PRIMARY KEY (plan_key, capability_key)
) ON COMMIT DROP;

INSERT INTO commercial_standard_plan_capabilities (plan_key, capability_key)
SELECT 'pyme', capability_key
FROM commercial_standard_capability_catalog
WHERE classification = 'ISO_ONLY'
UNION ALL
SELECT 'empresa', capability_key
FROM commercial_standard_capability_catalog
WHERE classification IN ('ISO_ONLY','OPERATIONAL_RISK_EXTENSION')
UNION ALL
SELECT 'enterprise', capability_key
FROM commercial_standard_capability_catalog
WHERE classification IN ('ISO_ONLY','OPERATIONAL_RISK_EXTENSION','GRC_ADVANCED');

CREATE TEMP TABLE commercial_standard_plan_modules (
  plan_key text NOT NULL,
  module_key text NOT NULL,
  PRIMARY KEY (plan_key, module_key)
) ON COMMIT DROP;

INSERT INTO commercial_standard_plan_modules (plan_key, module_key)
SELECT DISTINCT spc.plan_key, catalog.module_key
FROM commercial_standard_plan_capabilities spc
JOIN commercial_standard_capability_catalog catalog
  ON catalog.capability_key = spc.capability_key;

DO $$
DECLARE
  missing_plans text;
  underexposed text;
  overexposed text;
  grc_missing text;
BEGIN
  SELECT string_agg(plan_key, ', ' ORDER BY plan_key)
  INTO missing_plans
  FROM (
    SELECT DISTINCT plan_key
    FROM commercial_standard_plan_capabilities expected
    WHERE NOT EXISTS (
      SELECT 1
      FROM commercial_plan_versions cpv
      WHERE cpv.plan_key = expected.plan_key
        AND cpv.status = 'published'
    )
  ) plans;

  IF missing_plans IS NOT NULL THEN
    RAISE EXCEPTION 'Commercial standard plan matrix missing published plan versions: %', missing_plans;
  END IF;

  SELECT string_agg(expected.plan_key || ':' || expected.capability_key, ', ' ORDER BY expected.plan_key, expected.capability_key)
  INTO underexposed
  FROM commercial_standard_plan_capabilities expected
  WHERE NOT EXISTS (
    SELECT 1
    FROM commercial_standard_capability_catalog catalog
    JOIN commercial_modules cm
      ON cm.module_key = catalog.module_key
     AND cm.status = 'active'
    JOIN commercial_features cf
      ON cf.feature_key = catalog.feature_key
     AND cf.status = 'active'
    JOIN module_features mf
      ON mf.module_key = cm.module_key
     AND mf.feature_key = cf.feature_key
    JOIN feature_capabilities fc
      ON fc.feature_key = cf.feature_key
     AND fc.capability_key = catalog.capability_key
    JOIN commercial_technical_capabilities ctc
      ON ctc.capability_key = catalog.capability_key
     AND ctc.status = 'active'
    WHERE catalog.capability_key = expected.capability_key
  );

  IF underexposed IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL_PLAN_UNDEREXPOSURE: expected capabilities are not active/linked: %', underexposed;
  END IF;

  WITH desired_module_capabilities AS (
    SELECT DISTINCT
      dpm.plan_key,
      ctc.capability_key
    FROM commercial_standard_plan_modules dpm
    JOIN commercial_modules cm
      ON cm.module_key = dpm.module_key
     AND cm.status = 'active'
    JOIN module_features mf
      ON mf.module_key = cm.module_key
    JOIN commercial_features cf
      ON cf.feature_key = mf.feature_key
     AND cf.status = 'active'
    JOIN feature_capabilities fc
      ON fc.feature_key = cf.feature_key
    JOIN commercial_technical_capabilities ctc
      ON ctc.capability_key = fc.capability_key
     AND ctc.status = 'active'
  )
  SELECT string_agg(dmc.plan_key || ':' || dmc.capability_key, ', ' ORDER BY dmc.plan_key, dmc.capability_key)
  INTO overexposed
  FROM desired_module_capabilities dmc
  WHERE NOT EXISTS (
    SELECT 1
    FROM commercial_standard_plan_capabilities expected
    WHERE expected.plan_key = dmc.plan_key
      AND expected.capability_key = dmc.capability_key
  );

  IF overexposed IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL_PLAN_OVEREXPOSURE: desired modules expose non-plan capabilities: %', overexposed;
  END IF;

  SELECT string_agg(ctc.capability_key, ', ' ORDER BY ctc.capability_key)
  INTO grc_missing
  FROM commercial_technical_capabilities ctc
  WHERE ctc.status = 'active'
    AND COALESCE(ctc.metadata->>'commercial_classification', '') IN ('ISO_ONLY','OPERATIONAL_RISK_EXTENSION','GRC_ADVANCED')
    AND NOT EXISTS (
      SELECT 1
      FROM commercial_standard_plan_capabilities expected
      WHERE expected.plan_key = 'enterprise'
        AND expected.capability_key = ctc.capability_key
    );

  IF grc_missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL_PLAN_UNDEREXPOSURE: GRC does not cover all classified tenant commercial capabilities: %', grc_missing;
  END IF;
END $$;

WITH published_versions AS (
  SELECT id, plan_key
  FROM commercial_plan_versions
  WHERE status = 'published'
    AND plan_key IN ('pyme', 'empresa', 'enterprise')
), available_desired_modules AS (
  SELECT
    pv.id AS plan_version_id,
    dpm.plan_key,
    dpm.module_key
  FROM commercial_standard_plan_modules dpm
  JOIN published_versions pv ON pv.plan_key = dpm.plan_key
  JOIN commercial_modules cm ON cm.module_key = dpm.module_key AND cm.status = 'active'
)
INSERT INTO plan_version_modules (plan_version_id, module_key, included)
SELECT plan_version_id, module_key, true
FROM available_desired_modules
ON CONFLICT (plan_version_id, module_key)
DO UPDATE SET
  included = true,
  updated_at = now();

WITH published_versions AS (
  SELECT id, plan_key
  FROM commercial_plan_versions
  WHERE status = 'published'
    AND plan_key IN ('pyme', 'empresa', 'enterprise')
)
UPDATE plan_version_modules pvm
SET
  included = false,
  updated_at = now()
FROM published_versions pv
WHERE pvm.plan_version_id = pv.id
  AND pvm.included = true
  AND NOT EXISTS (
    SELECT 1
    FROM commercial_standard_plan_modules dpm
    WHERE dpm.plan_key = pv.plan_key
      AND dpm.module_key = pvm.module_key
  );

COMMIT;
