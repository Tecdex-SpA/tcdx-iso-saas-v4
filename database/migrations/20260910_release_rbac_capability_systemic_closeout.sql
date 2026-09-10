-- TCDX release RBAC/capability systemic closeout.
-- Forward-only/idempotent authorization catalog alignment.
-- No tenant/user/customer data is inserted or rewritten.

BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026091005) THEN
    RAISE EXCEPTION 'release RBAC capability systemic closeout lock unavailable';
  END IF;
END $$;

INSERT INTO app_roles (role_key, display_name, description, role_level, is_system, is_active)
VALUES
  ('platform_admin', 'Platform admin', 'Platform administration with controlled cross-tenant scope.', 10, true, true),
  ('tenant_admin', 'Tenant admin', 'Administration inside the authenticated tenant and entitled capabilities.', 20, true, true),
  ('auditor', 'Auditor', 'Audit, evidence, findings and workpaper execution inside tenant/scope.', 40, true, true),
  ('area_owner', 'Area owner', 'Operational execution inside assigned tenant area/scope.', 60, true, true),
  ('executive', 'Executive', 'Executive read-only access for entitled tenant modules.', 80, true, true),
  ('dealer', 'Dealer', 'Commercial portal role constrained by explicit dealer assignment.', 90, true, true),
  ('viewer', 'Viewer', 'Minimal tenant read-only role.', 100, true, true)
ON CONFLICT (role_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  role_level = EXCLUDED.role_level,
  is_system = EXCLUDED.is_system,
  is_active = EXCLUDED.is_active,
  updated_at = now();

WITH active_permissions(permission_key, permission_group, display_name, description) AS (
  VALUES
    ('actions.approve','actions','Approve actions','Approve tenant action plans.'),
    ('actions.delete','actions','Delete actions','Delete tenant action plans.'),
    ('actions.manage','actions','Manage actions','Manage tenant action plans.'),
    ('actions.view','actions','Read actions','Read tenant action plans.'),
    ('admin_saas.manage','admin_saas','Manage Admin SaaS','Manage platform Admin SaaS.'),
    ('admin_saas.view','admin_saas','Read Admin SaaS','Read platform Admin SaaS.'),
    ('ai.view','ai','Read AI','Read entitled AI experiences.'),
    ('assets.manage','assets','Manage assets','Manage tenant assets.'),
    ('assets.view','assets','Read assets','Read tenant assets.'),
    ('assurance_tests.read','assurance','Read assurance tests','Read assurance tests.'),
    ('audit.plan.manage','audit','Manage audit plans','Manage tenant audit plans.'),
    ('audit.plan.read','audit','Read audit plans','Read tenant audit plans.'),
    ('audit.report.generate','audit','Generate audit reports','Generate audit reports.'),
    ('audit.review','audit','Review audits','Review audit work and AI auditor surfaces.'),
    ('audit.workpaper.manage','audit','Manage workpapers','Manage audit workpapers.'),
    ('audits.manage','audit','Manage audits','Manage tenant audits.'),
    ('audits.view','audit','Read audits','Read tenant audits.'),
    ('bia.approve','continuity','Approve BIA','Approve BIA records.'),
    ('bia.manage','continuity','Manage BIA','Manage BIA records.'),
    ('bia.read','continuity','Read BIA','Read BIA records.'),
    ('commercial.catalog.manage','commercial','Manage commercial catalog','Manage platform commercial catalog.'),
    ('commercial.catalog.read','commercial','Read commercial catalog','Read platform commercial catalog.'),
    ('commercial.entitlement.manage','commercial','Manage entitlements','Manage commercial entitlements.'),
    ('commercial.entitlement.override','commercial','Override entitlements','Override commercial entitlements.'),
    ('commercial.entitlement.read','commercial','Read entitlements','Read commercial entitlements.'),
    ('commercial.health.read','commercial','Read commercial health','Read commercial health.'),
    ('commercial.methodology.manage','commercial','Manage methodologies','Manage commercial methodologies.'),
    ('commercial.methodology.read','commercial','Read methodologies','Read commercial methodologies.'),
    ('commercial.pack.install','commercial','Install packs','Install commercial packs.'),
    ('commercial.pack.manage','commercial','Manage packs','Manage commercial packs.'),
    ('commercial.pack.read','commercial','Read packs','Read commercial packs.'),
    ('commercial.plan.manage','commercial','Manage plans','Manage commercial plans.'),
    ('commercial.plan.read','commercial','Read plans','Read commercial plans.'),
    ('commercial.subscription.manage','commercial','Manage subscriptions','Manage tenant subscriptions.'),
    ('commercial.subscription.read','commercial','Read subscriptions','Read tenant subscriptions.'),
    ('commercial.trial.manage','commercial','Manage trials','Manage commercial trials.'),
    ('commercial.usage.read','commercial','Read usage','Read commercial usage.'),
    ('commercial.workpaper.manage','commercial','Manage workpaper templates','Manage commercial workpaper templates.'),
    ('commercial.workpaper.read','commercial','Read workpaper templates','Read commercial workpaper templates.'),
    ('connectors.credentials.manage','connectors','Manage connector credentials','Manage connector credentials.'),
    ('connectors.logs.read','connectors','Read connector logs','Read connector logs.'),
    ('connectors.manage','connectors','Manage connectors','Manage connectors.'),
    ('connectors.read','connectors','Read connectors','Read connectors.'),
    ('connectors.sync.run','connectors','Run connector sync','Run connector synchronization.'),
    ('continuity.activate','continuity','Activate continuity','Activate continuity plans.'),
    ('continuity.approve','continuity','Approve continuity','Approve continuity plans.'),
    ('continuity.manage','continuity','Manage continuity','Manage continuity plans.'),
    ('continuity.read','continuity','Read continuity','Read continuity plans.'),
    ('continuity.tests.manage','continuity','Manage continuity tests','Manage continuity tests.'),
    ('controls.manage','controls','Manage controls','Manage tenant controls.'),
    ('controls.view','controls','Read controls','Read tenant controls.'),
    ('crisis.manage','crisis','Manage crisis','Manage crisis records.'),
    ('crisis.read','crisis','Read crisis','Read crisis records.'),
    ('dashboards.read','dashboard','Read dashboards','Read dashboards.'),
    ('data.catalog.read','data','Read data catalog','Read data catalog.'),
    ('data.lineage.read','data','Read data lineage','Read data lineage.'),
    ('data.quality.read','data','Read data quality','Read data quality.'),
    ('dealer.billing.read','dealer','Read dealer billing','Read dealer billing/prebilling.'),
    ('dealer.clients.view','dealer','Read dealer clients','Read assigned dealer clients.'),
    ('dealer.quotes.manage','dealer','Manage quotes','Manage dealer quotes.'),
    ('evidence.request.manage','evidence','Manage evidence requests','Manage evidence requests.'),
    ('evidence.request.read','evidence','Read evidence requests','Read evidence requests.'),
    ('evidence.review','evidence','Review evidence','Review tenant evidence.'),
    ('evidences.upload','evidence','Upload evidences','Upload tenant evidences.'),
    ('evidences.view','evidence','Read evidences','Read tenant evidences.'),
    ('findings.manage','audit','Manage findings','Manage tenant findings.'),
    ('findings.view','audit','Read findings','Read tenant findings.'),
    ('framework.manage','framework','Manage framework','Manage framework runtime.'),
    ('framework.read','framework','Read framework','Read framework runtime.'),
    ('gap.evaluate','grc','Evaluate gaps','Evaluate deterministic GRC gaps.'),
    ('gap.link','grc','Link gaps','Link GRC gaps.'),
    ('gap.manage','grc','Manage gaps','Manage GRC gaps.'),
    ('gap.read','grc','Read gaps','Read GRC gaps.'),
    ('gap.transition','grc','Transition gaps','Transition GRC gaps.'),
    ('grc.connectors.manage','grc','Manage GRC connectors','Manage GRC connectors.'),
    ('grc.escalation.manage','grc','Manage GRC escalation','Manage GRC escalation.'),
    ('grc.escalations.manage','grc','Manage GRC escalations','Manage GRC escalations.'),
    ('grc.export.generate','grc','Generate GRC exports','Generate GRC exports.'),
    ('grc.phase2.export','grc','Export GRC Phase 2','Export GRC Phase 2.'),
    ('grc.runtime.adapter.read','grc','Read runtime adapters','Read GRC runtime adapters.'),
    ('grc.scheduler.run','grc','Run GRC scheduler','Run GRC scheduler.'),
    ('health.view','health','Read health','Read health.'),
    ('imports.catalog.download','imports','Download import catalogs','Download import catalogs.'),
    ('imports.confirm','imports','Confirm imports','Confirm imports.'),
    ('imports.errors.download','imports','Download import errors','Download import errors.'),
    ('imports.history.read','imports','Read import history','Read import history.'),
    ('imports.preview','imports','Preview imports','Preview imports.'),
    ('imports.read','imports','Read imports','Read imports.'),
    ('imports.rollback','imports','Rollback imports','Rollback imports.'),
    ('imports.template.download','imports','Download import templates','Download import templates.'),
    ('incidents.close','incidents','Close incidents','Close incidents.'),
    ('incidents.command','incidents','Command incidents','Operate incident command.'),
    ('incidents.manage','incidents','Manage incidents','Manage incidents.'),
    ('incidents.notifications.manage','incidents','Manage incident notifications','Manage incident notifications.'),
    ('incidents.read','incidents','Read incidents','Read incidents.'),
    ('knowledge.ingest','knowledge','Ingest knowledge','Ingest tenant knowledge.'),
    ('knowledge.rag.answer','knowledge','Use RAG answer','Use grounded RAG answer.'),
    ('knowledge.read','knowledge','Read knowledge','Read knowledge base.'),
    ('knowledge.retrieval.read','knowledge','Use knowledge retrieval','Use knowledge retrieval.'),
    ('loss_events.read','risk','Read loss events','Read loss events.'),
    ('metrics.actions.propose','metrics','Propose metric actions','Propose metric actions.'),
    ('metrics.actions.review','metrics','Review metric actions','Review metric actions.'),
    ('metrics.catalog.read','metrics','Read metric catalog','Read metric catalog.'),
    ('metrics.manage','metrics','Manage metrics','Manage metrics.'),
    ('metrics.measure','metrics','Measure metrics','Measure metrics.'),
    ('metrics.publish','metrics','Publish metrics','Publish metrics.'),
    ('metrics.read','metrics','Read metrics','Read metrics.'),
    ('metrics.recalculate','metrics','Recalculate metrics','Recalculate metrics.'),
    ('metrics.record','metrics','Record metrics','Record metrics.'),
    ('metrics.validate','metrics','Validate metrics','Validate metrics.'),
    ('modules.view','modules','Read modules','Read modules.'),
    ('nonconformities.view','audit','Read nonconformities','Read tenant nonconformities.'),
    ('observation.link','grc','Link observations','Link GRC observations.'),
    ('observation.manage','grc','Manage observations','Manage GRC observations.'),
    ('observation.read','grc','Read observations','Read GRC observations.'),
    ('observation.transition','grc','Transition observations','Transition GRC observations.'),
    ('operations.360.read','operations','Read operations 360','Read operational 360 view.'),
    ('operations.dashboard.read','operations','Read operations dashboard','Read operations dashboard.'),
    ('operations.import','operations','Import operations','Import operational data.'),
    ('organizations.manage','operations','Manage organizations','Manage organizations.'),
    ('organizations.read','operations','Read organizations','Read organizations.'),
    ('pack.install','commercial','Install packs','Install packs.'),
    ('plan.publish','commercial','Publish plans','Publish commercial plans.'),
    ('privacy.approve','privacy','Approve privacy','Approve privacy records.'),
    ('privacy.breaches.manage','privacy','Manage breaches','Manage privacy breaches.'),
    ('privacy.dpia.manage','privacy','Manage DPIA','Manage DPIA records.'),
    ('privacy.manage','privacy','Manage privacy','Manage privacy records.'),
    ('privacy.read','privacy','Read privacy','Read privacy records.'),
    ('privacy.requests.manage','privacy','Manage privacy requests','Manage privacy requests.'),
    ('processes.approve','operations','Approve processes','Approve processes.'),
    ('processes.manage','operations','Manage processes','Manage processes.'),
    ('processes.read','operations','Read processes','Read processes.'),
    ('profile.read','profile','Read profile','Read own profile.'),
    ('quantitative_risk.approve','risk','Approve quantitative risk','Approve quantitative risk.'),
    ('quantitative_risk.manage','risk','Manage quantitative risk','Manage quantitative risk.'),
    ('quantitative_risk.read','risk','Read quantitative risk','Read quantitative risk.'),
    ('readiness.generate','readiness','Generate readiness','Generate readiness output.'),
    ('readiness.read','readiness','Read readiness','Read readiness output.'),
    ('regulatory.manage','regulatory','Manage regulatory','Manage regulatory objects.'),
    ('regulatory.read','regulatory','Read regulatory','Read regulatory objects.'),
    ('reports.download','reports','Download reports','Download reports.'),
    ('reports.generate','reports','Generate reports','Generate reports.'),
    ('reports.read','reports','Read reports','Read reports.'),
    ('reports.schedule','reports','Schedule reports','Schedule reports.'),
    ('reports.view','reports','View reports','View reports.'),
    ('risk_matrix.manage','risk','Manage risk matrix','Manage risk matrix.'),
    ('risk_matrix.view','risk','Read risk matrix','Read risk matrix.'),
    ('semantic.contracts.manage','semantic','Manage semantic contracts','Manage semantic contracts.'),
    ('semantic.contracts.publish','semantic','Publish semantic contracts','Publish semantic contracts.'),
    ('semantic.contracts.read','semantic','Read semantic contracts','Read semantic contracts.'),
    ('semantic.contracts.review','semantic','Review semantic contracts','Review semantic contracts.'),
    ('semantic.lineage.read','semantic','Read semantic lineage','Read semantic lineage.'),
    ('semantic.mappings.manage','semantic','Manage semantic mappings','Manage semantic mappings.'),
    ('semantic.mappings.read','semantic','Read semantic mappings','Read semantic mappings.'),
    ('semantic.mappings.validate','semantic','Validate semantic mappings','Validate semantic mappings.'),
    ('semantic.observations.ingest','semantic','Ingest semantic observations','Ingest semantic observations.'),
    ('semantic.observations.read','semantic','Read semantic observations','Read semantic observations.'),
    ('semantic.sufficiency.manage','semantic','Manage sufficiency','Manage semantic sufficiency.'),
    ('semantic.sufficiency.publish','semantic','Publish sufficiency','Publish semantic sufficiency.'),
    ('semantic.sufficiency.read','semantic','Read sufficiency','Read semantic sufficiency.'),
    ('semantic_source.validate','semantic','Validate semantic source','Validate semantic source.'),
    ('services.manage','operations','Manage services','Manage services.'),
    ('services.read','operations','Read services','Read services.'),
    ('standards.manage','standards','Manage standards','Manage tenant standards.'),
    ('standards.view','standards','Read standards','Read tenant standards.'),
    ('suppliers.approve','suppliers','Approve suppliers','Approve suppliers.'),
    ('suppliers.assess','suppliers','Assess suppliers','Assess suppliers.'),
    ('suppliers.manage','suppliers','Manage suppliers','Manage suppliers.'),
    ('suppliers.portal.manage','suppliers','Manage supplier portal','Manage supplier portal.'),
    ('suppliers.read','suppliers','Read suppliers','Read suppliers.'),
    ('surveys.read','surveys','Read surveys','Read surveys.'),
    ('users.manage','users','Manage users','Manage tenant users.'),
    ('workflow.manage','workflow','Manage workflow','Manage workflow.'),
    ('workflow.read','workflow','Read workflow','Read workflow.'),
    ('workflow.transition','workflow','Transition workflow','Transition workflow.')
)
INSERT INTO permissions (permission_key, permission_group, display_name, description, is_active)
SELECT permission_key, permission_group, display_name, description, true
FROM active_permissions
ON CONFLICT (permission_key) DO UPDATE SET
  permission_group = EXCLUDED.permission_group,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();

CREATE OR REPLACE FUNCTION get_user_effective_permissions(requested_user_id uuid)
RETURNS TABLE(permission_key text, permission_group text, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH user_role AS (
    SELECT CASE lower(COALESCE(NULLIF(effective_role, ''), role))
      WHEN 'superadmin' THEN 'platform_admin'
      WHEN 'super_admin' THEN 'platform_admin'
      WHEN 'global_admin' THEN 'platform_admin'
      WHEN 'admin_global' THEN 'platform_admin'
      WHEN 'owner' THEN 'platform_admin'
      WHEN 'admin' THEN 'tenant_admin'
      WHEN 'admin_cumplimiento' THEN 'tenant_admin'
      WHEN 'compliance_admin' THEN 'tenant_admin'
      WHEN 'compliance_manager' THEN 'tenant_admin'
      WHEN 'operativo' THEN 'area_owner'
      WHEN 'responsable_area' THEN 'area_owner'
      WHEN 'control_owner' THEN 'area_owner'
      WHEN 'ejecutivo' THEN 'executive'
      WHEN 'cliente' THEN 'viewer'
      WHEN 'client' THEN 'viewer'
      WHEN 'read_only' THEN 'viewer'
      WHEN 'readonly' THEN 'viewer'
      WHEN 'solo_lectura' THEN 'viewer'
      ELSE lower(COALESCE(NULLIF(effective_role, ''), role))
    END AS role_key
    FROM users
    WHERE id = requested_user_id
      AND status = 'active'
    LIMIT 1
  )
  SELECT p.permission_key, p.permission_group, p.display_name
  FROM user_role ur
  JOIN role_permissions rp
    ON rp.role_key = ur.role_key
   AND rp.is_allowed = true
  JOIN permissions p
    ON p.permission_key = rp.permission_key
   AND p.is_active IS DISTINCT FROM false
  JOIN app_roles ar
    ON ar.role_key = ur.role_key
   AND ar.is_active IS DISTINCT FROM false
  ORDER BY p.permission_group, p.permission_key
$$;

CREATE OR REPLACE FUNCTION user_has_permission(requested_user_id uuid, requested_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM get_user_effective_permissions(requested_user_id) p
    WHERE p.permission_key = requested_permission
  ), false)
$$;

WITH role_matrix(role_key, permission_key, is_allowed) AS (
  SELECT
    r.role_key,
    p.permission_key,
    CASE
      WHEN r.role_key = 'platform_admin' THEN true
      WHEN r.role_key = 'tenant_admin' THEN
        p.permission_key !~ '^(admin_saas|dealer)\.'
        AND p.permission_key !~ '^commercial\.(catalog|plan)\.'
        AND p.permission_key NOT IN (
          'commercial.entitlement.override',
          'commercial.pack.manage',
          'commercial.methodology.manage',
          'commercial.workpaper.manage'
        )
      WHEN r.role_key = 'auditor' THEN p.permission_key = ANY (ARRAY[
        'actions.view','assurance_tests.read','audit.plan.read','audit.review','audit.workpaper.manage',
        'audits.manage','audits.view','controls.view','dashboards.read','data.catalog.read','data.lineage.read',
        'data.quality.read','evidence.request.manage','evidence.request.read','evidence.review','evidences.upload',
        'evidences.view','findings.manage','findings.view','framework.read','gap.evaluate','gap.manage','gap.read',
        'gap.transition','health.view','imports.history.read','imports.read','knowledge.rag.answer','knowledge.read',
        'knowledge.retrieval.read','metrics.read','modules.view','nonconformities.view','observation.link',
        'observation.manage','observation.read','observation.transition','readiness.read','reports.download',
        'reports.generate','reports.read','reports.view','risk_matrix.view','semantic.lineage.read',
        'semantic.observations.read','standards.view','workflow.read','workflow.transition'
      ]::text[])
      WHEN r.role_key = 'area_owner' THEN p.permission_key = ANY (ARRAY[
        'actions.manage','actions.view','assets.manage','assets.view','controls.view','dashboards.read',
        'evidence.request.manage','evidence.request.read','evidences.upload','evidences.view','findings.view',
        'framework.read','gap.read','health.view','knowledge.read','metrics.read','modules.view','observation.read',
        'operations.360.read','operations.dashboard.read','processes.manage','processes.read','reports.read',
        'reports.view','risk_matrix.manage','risk_matrix.view','services.manage','services.read','standards.view',
        'workflow.read','workflow.transition'
      ]::text[])
      WHEN r.role_key = 'executive' THEN p.permission_key = ANY (ARRAY[
        'actions.view','assets.view','audits.view','controls.view','dashboards.read','data.catalog.read',
        'data.lineage.read','data.quality.read','evidences.view','findings.view','framework.read','gap.read',
        'health.view','metrics.read','modules.view','observation.read','operations.360.read',
        'operations.dashboard.read','reports.download','reports.read','reports.view','risk_matrix.view',
        'standards.view','workflow.read'
      ]::text[])
      WHEN r.role_key = 'viewer' THEN p.permission_key = ANY (ARRAY[
        'actions.view','audits.view','controls.view','dashboards.read','evidences.view','findings.view',
        'health.view','metrics.read','modules.view','reports.read','standards.view'
      ]::text[])
      WHEN r.role_key = 'dealer' THEN p.permission_key = ANY (ARRAY[
        'commercial.subscription.read','dealer.billing.read','dealer.clients.view','dealer.quotes.manage'
      ]::text[])
      ELSE false
    END
  FROM app_roles r
  CROSS JOIN permissions p
  WHERE r.role_key IN ('platform_admin','tenant_admin','auditor','area_owner','executive','dealer','viewer')
    AND p.permission_key IN (
      SELECT permission_key FROM permissions WHERE is_active IS DISTINCT FROM false
    )
)
INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT role_key, permission_key, is_allowed
FROM role_matrix
ON CONFLICT (role_key, permission_key) DO UPDATE SET
  is_allowed = EXCLUDED.is_allowed,
  updated_at = now();

COMMIT;
