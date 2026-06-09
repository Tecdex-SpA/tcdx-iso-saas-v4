-- ============================================================
-- TCDX Compliance SaaS - Sprint 7.1 Demo Comercial
-- Base esperada: tecdex_saas
-- Tenant objetivo: Empresa Demo TCDX Compliance
-- Fecha: 2026-06-09
--
-- ADVERTENCIA:
-- - Ejecutar solo si se desea poblar datos demo comerciales.
-- - Script idempotente y tenant-scoped.
-- - No ejecuta DROP TABLE, TRUNCATE ni DELETE masivo.
-- - No modifica estructura de tablas.
-- - No toca tenants reales.
-- - No crea archivos fisicos ni credenciales de conectores.
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_tenant_id uuid;
  v_tenant_name text := 'Empresa Demo TCDX Compliance';
  v_demo_hash text := '$2b$10$b/akgg7GX3RhMeI.MYFi3.ZG5g3pTSdBYTFZ72LMI7XeeP3zxJAou';
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Tabla public.tenants no existe. Seed demo abortado.';
  END IF;

  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Tabla public.users no existe. Seed demo abortado.';
  END IF;

  SELECT id
    INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower(v_tenant_name)
  ORDER BY created_at NULLS LAST, id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    v_tenant_id := '70000000-0000-0000-0000-000000000701'::uuid;

    INSERT INTO public.tenants (
      id,
      name,
      rut,
      address,
      business,
      branches,
      logo,
      created_at
    )
    VALUES (
      v_tenant_id,
      v_tenant_name,
      'DEMO-TCDX-0001',
      'Av. Demo 1234, Santiago',
      'Servicios tecnologicos / SaaS B2B',
      'Casa matriz demo',
      NULL,
      now()
    );
  ELSE
    UPDATE public.tenants
    SET
      rut = COALESCE(NULLIF(rut, ''), 'DEMO-TCDX-0001'),
      address = COALESCE(NULLIF(address, ''), 'Av. Demo 1234, Santiago'),
      business = 'Servicios tecnologicos / SaaS B2B',
      branches = COALESCE(NULLIF(branches, ''), 'Casa matriz demo')
    WHERE id = v_tenant_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'is_demo'
  ) THEN
    EXECUTE 'UPDATE public.tenants SET is_demo = TRUE WHERE id = $1'
    USING v_tenant_id;
  END IF;

  INSERT INTO public.users (
    id,
    tenant_id,
    name,
    full_name,
    email,
    password_hash,
    role
  )
  SELECT *
  FROM (
    VALUES
      (
        '70000000-0000-0000-0000-000000000711'::uuid,
        v_tenant_id,
        'Ejecutivo Cliente',
        'Ejecutivo Cliente',
        'ejecutivo.demo@tcdx.local',
        v_demo_hash,
        'viewer'
      ),
      (
        '70000000-0000-0000-0000-000000000712'::uuid,
        v_tenant_id,
        'Admin Cumplimiento',
        'Admin Cumplimiento',
        'admin.demo@tcdx.local',
        v_demo_hash,
        'admin'
      ),
      (
        '70000000-0000-0000-0000-000000000713'::uuid,
        v_tenant_id,
        'Auditor',
        'Auditor',
        'auditor.demo@tcdx.local',
        v_demo_hash,
        'auditor'
      ),
      (
        '70000000-0000-0000-0000-000000000714'::uuid,
        v_tenant_id,
        'Responsable Calidad',
        'Responsable Calidad',
        'responsable.calidad.demo@tcdx.local',
        v_demo_hash,
        'operativo'
      ),
      (
        '70000000-0000-0000-0000-000000000715'::uuid,
        v_tenant_id,
        'Responsable TI',
        'Responsable TI',
        'responsable.ti.demo@tcdx.local',
        v_demo_hash,
        'operativo'
      )
  ) AS demo_users(id, tenant_id, name, full_name, email, password_hash, role)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE lower(u.email) = lower(demo_users.email)
  );

  UPDATE public.users u
  SET
    tenant_id = v_tenant_id,
    name = d.name,
    full_name = d.full_name,
    password_hash = v_demo_hash,
    role = d.role
  FROM (
    VALUES
      ('ejecutivo.demo@tcdx.local', 'Ejecutivo Cliente', 'Ejecutivo Cliente', 'viewer'),
      ('admin.demo@tcdx.local', 'Admin Cumplimiento', 'Admin Cumplimiento', 'admin'),
      ('auditor.demo@tcdx.local', 'Auditor', 'Auditor', 'auditor'),
      ('responsable.calidad.demo@tcdx.local', 'Responsable Calidad', 'Responsable Calidad', 'operativo'),
      ('responsable.ti.demo@tcdx.local', 'Responsable TI', 'Responsable TI', 'operativo')
  ) AS d(email, name, full_name, role)
  WHERE lower(u.email) = lower(d.email);

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'is_demo'
  ) THEN
    EXECUTE $sql$
      UPDATE public.users
      SET is_demo = TRUE
      WHERE tenant_id = $1
        AND email IN (
          'ejecutivo.demo@tcdx.local',
          'admin.demo@tcdx.local',
          'auditor.demo@tcdx.local',
          'responsable.calidad.demo@tcdx.local',
          'responsable.ti.demo@tcdx.local'
        )
    $sql$
    USING v_tenant_id;
  END IF;
END $$;

DO $$
DECLARE
  v_tenant_id uuid;
  v_admin_id uuid;
  v_quality_owner_id uuid;
  v_it_owner_id uuid;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
  LIMIT 1;

  SELECT id INTO v_admin_id
  FROM public.users
  WHERE lower(email) = 'admin.demo@tcdx.local'
  LIMIT 1;

  SELECT id INTO v_quality_owner_id
  FROM public.users
  WHERE lower(email) = 'responsable.calidad.demo@tcdx.local'
  LIMIT 1;

  SELECT id INTO v_it_owner_id
  FROM public.users
  WHERE lower(email) = 'responsable.ti.demo@tcdx.local'
  LIMIT 1;

  IF to_regclass('public.iso_standards') IS NOT NULL THEN
    INSERT INTO public.iso_standards (
      standard_code,
      display_name,
      family,
      description,
      is_active
    )
    VALUES
      (
        'ISO9001',
        'ISO 9001 Quality management',
        'quality_management',
        'Sistema de gestion de calidad para procesos, cliente, proveedores, no conformidades y mejora.',
        true
      ),
      (
        'ISO27001',
        'ISO/IEC 27001 Information security management',
        'information_security',
        'Sistema de gestion de seguridad de la informacion basado en riesgos, activos, controles y tratamiento.',
        true
      )
    ON CONFLICT (standard_code)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      family = EXCLUDED.family,
      description = EXCLUDED.description,
      is_active = true,
      updated_at = now();
  END IF;

  IF to_regclass('public.standards') IS NOT NULL THEN
    INSERT INTO public.standards (code, name)
    SELECT code, name
    FROM (
      VALUES
        ('ISO9001', 'ISO 9001'),
        ('ISO27001', 'ISO 27001')
    ) AS s(code, name)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.standards existing
      WHERE existing.code = s.code
    );

    UPDATE public.standards s
    SET name = d.name
    FROM (
      VALUES
        ('ISO9001', 'ISO 9001'),
        ('ISO27001', 'ISO 27001')
    ) AS d(code, name)
    WHERE s.code = d.code;
  END IF;

  IF to_regclass('public.tenant_company_profiles') IS NOT NULL THEN
    INSERT INTO public.tenant_company_profiles (
      tenant_id,
      created_by_user_id,
      updated_by_user_id,
      profile_json,
      industry,
      subindustry,
      company_size,
      maturity_level,
      risk_appetite,
      allow_web_research,
      allow_document_context,
      allow_ai_recommendations,
      ai_profile_summary_json,
      created_at,
      updated_at
    )
    VALUES (
      v_tenant_id,
      v_admin_id,
      v_admin_id,
      jsonb_build_object(
        'demo_seed', 'sprint-7.1',
        'tenant_name', 'Empresa Demo TCDX Compliance',
        'business_model', 'SaaS B2B para cumplimiento ISO',
        'target_standards', jsonb_build_array('ISO9001', 'ISO27001'),
        'critical_services', jsonb_build_array('plataforma SaaS', 'soporte tecnico', 'gestion documental', 'analitica de cumplimiento')
      ),
      'Servicios tecnologicos / SaaS B2B',
      'Compliance software',
      '51-200',
      'intermedio',
      'moderado',
      false,
      true,
      true,
      jsonb_build_object(
        'summary', 'Tenant demo comercial con alcance ISO 9001 e ISO 27001 para demostrar dashboard, health, evidencias, riesgos, acciones, auditoria y reportes.',
        'recommendation_context', 'Priorizar ISO 9001 por procesos cliente/proveedor y ISO 27001 por datos, accesos, backups, activos y proveedores cloud.'
      ),
      now(),
      now()
    )
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      updated_by_user_id = EXCLUDED.updated_by_user_id,
      profile_json = EXCLUDED.profile_json,
      industry = EXCLUDED.industry,
      subindustry = EXCLUDED.subindustry,
      company_size = EXCLUDED.company_size,
      maturity_level = EXCLUDED.maturity_level,
      risk_appetite = EXCLUDED.risk_appetite,
      allow_web_research = EXCLUDED.allow_web_research,
      allow_document_context = EXCLUDED.allow_document_context,
      allow_ai_recommendations = EXCLUDED.allow_ai_recommendations,
      ai_profile_summary_json = EXCLUDED.ai_profile_summary_json,
      updated_at = now();
  END IF;

  IF to_regclass('public.tenant_applicability_profiles') IS NOT NULL THEN
    INSERT INTO public.tenant_applicability_profiles (
      tenant_id,
      profile_source,
      profile_hash,
      industry,
      subindustry,
      company_size,
      maturity_level,
      risk_appetite,
      active_standards,
      declared_scope,
      critical_processes,
      generated_by,
      ai_used,
      web_used,
      created_at,
      updated_at
    )
    SELECT
      v_tenant_id,
      'demo_seed',
      'sprint-7.1-demo-comercial',
      'Servicios tecnologicos / SaaS B2B',
      'Compliance software',
      '51-200',
      'intermedio',
      'moderado',
      '["ISO9001","ISO27001"]'::jsonb,
      jsonb_build_object(
        'scope_statement', 'Prestacion, soporte y mejora de una plataforma SaaS B2B de cumplimiento ISO, incluyendo gestion de clientes, proveedores tecnologicos, activos de informacion y continuidad operacional.',
        'locations', jsonb_build_array('Santiago - operacion remota'),
        'exclusions', jsonb_build_array('Fabricacion fisica', 'operacion industrial')
      ),
      '["Prestacion del Servicio","Soporte Tecnico","Gestion de Accesos","Infraestructura TI","Desarrollo de Software","Gestion de Proveedores"]'::jsonb,
      'sprint-7.1-demo-seed',
      false,
      false,
      now(),
      now()
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.tenant_applicability_profiles p
      WHERE p.tenant_id = v_tenant_id
        AND p.profile_hash = 'sprint-7.1-demo-comercial'
    );
  END IF;
END $$;

DO $$
DECLARE
  v_tenant_id uuid;
  v_admin_id uuid;
  v_quality_owner_id uuid;
  v_it_owner_id uuid;
  r record;
  v_process_id uuid;
  v_operation_id uuid;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
  LIMIT 1;

  SELECT id INTO v_admin_id FROM public.users WHERE lower(email) = 'admin.demo@tcdx.local' LIMIT 1;
  SELECT id INTO v_quality_owner_id FROM public.users WHERE lower(email) = 'responsable.calidad.demo@tcdx.local' LIMIT 1;
  SELECT id INTO v_it_owner_id FROM public.users WHERE lower(email) = 'responsable.ti.demo@tcdx.local' LIMIT 1;

  IF to_regclass('public.tenant_processes') IS NULL OR to_regclass('public.tenant_operations') IS NULL THEN
    RAISE NOTICE 'Se omite seed de procesos/operaciones: tenant_processes o tenant_operations no existe.';
    RETURN;
  END IF;

  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('ISO9001', 'QMS-01', 'Dirección Estratégica', 'Gobierno y objetivos del sistema de gestion.', 'Direccion', 'alta', v_quality_owner_id, 10),
        ('ISO9001', 'QMS-02', 'Atención de Clientes', 'Gestion de solicitudes, soporte funcional y satisfaccion.', 'Clientes', 'alta', v_quality_owner_id, 20),
        ('ISO9001', 'QMS-03', 'Gestión Comercial', 'Cotizaciones, contratos SaaS y seguimiento comercial.', 'Comercial', 'media', v_quality_owner_id, 30),
        ('ISO9001', 'QMS-04', 'Prestación del Servicio', 'Operacion recurrente del servicio SaaS y compromisos con clientes.', 'Operacion', 'alta', v_quality_owner_id, 40),
        ('ISO9001', 'QMS-05', 'Soporte Técnico', 'Atencion de incidentes y requerimientos tecnicos de clientes.', 'Soporte', 'alta', v_it_owner_id, 50),
        ('ISO9001', 'QMS-06', 'Gestión de Proveedores', 'Evaluacion y seguimiento de proveedores criticos.', 'Proveedores', 'media', v_quality_owner_id, 60),
        ('ISO9001', 'QMS-07', 'Gestión de Reclamos', 'Recepcion, analisis y cierre de reclamos de clientes.', 'Calidad', 'media', v_quality_owner_id, 70),
        ('ISO9001', 'QMS-08', 'Mejora Continua', 'Analisis de datos, acciones correctivas y oportunidades.', 'Calidad', 'media', v_quality_owner_id, 80),
        ('ISO9001', 'QMS-09', 'Control Documental', 'Control de documentos y registros del sistema de gestion.', 'Calidad', 'media', v_quality_owner_id, 90),
        ('ISO9001', 'QMS-10', 'Competencia y Capacitación', 'Gestion de competencias, induccion y capacitacion.', 'Personas', 'media', v_quality_owner_id, 100),
        ('ISO27001', 'ISMS-01', 'Gobierno de Seguridad de la Información', 'Direccion, politicas y responsabilidades del SGSI.', 'Seguridad', 'alta', v_it_owner_id, 110),
        ('ISO27001', 'ISMS-02', 'Gestión de Activos de Información', 'Inventario, clasificacion y propietarios de activos.', 'Seguridad', 'alta', v_it_owner_id, 120),
        ('ISO27001', 'ISMS-03', 'Gestión de Accesos', 'Altas, bajas, permisos y revisiones periodicas.', 'Seguridad', 'alta', v_it_owner_id, 130),
        ('ISO27001', 'ISMS-04', 'Infraestructura TI', 'Operacion de infraestructura, ambientes y monitoreo.', 'TI', 'alta', v_it_owner_id, 140),
        ('ISO27001', 'ISMS-05', 'Desarrollo de Software', 'Ciclo de desarrollo seguro y cambios.', 'Producto', 'alta', v_it_owner_id, 150),
        ('ISO27001', 'ISMS-06', 'Gestión de Incidentes de Seguridad', 'Registro, clasificacion, respuesta y lecciones aprendidas.', 'Seguridad', 'alta', v_it_owner_id, 160),
        ('ISO27001', 'ISMS-07', 'Respaldo y Restauración', 'Backups, restauracion y retencion.', 'Continuidad', 'alta', v_it_owner_id, 170),
        ('ISO27001', 'ISMS-08', 'Continuidad Operacional', 'Planes de continuidad y pruebas.', 'Continuidad', 'alta', v_it_owner_id, 180),
        ('ISO27001', 'ISMS-09', 'Proveedores Tecnológicos', 'Evaluacion de seguridad de proveedores cloud y SaaS.', 'Proveedores', 'alta', v_it_owner_id, 190),
        ('ISO27001', 'ISMS-10', 'Gestión de Vulnerabilidades', 'Identificacion, priorizacion y tratamiento de vulnerabilidades.', 'Seguridad', 'alta', v_it_owner_id, 200)
    ) AS rows(standard_code, code, name, description, area, criticality, owner_user_id, sort_order)
  LOOP
    SELECT id INTO v_process_id
    FROM public.tenant_processes
    WHERE tenant_id = v_tenant_id
      AND lower(name) = lower(r.name)
    LIMIT 1;

    IF v_process_id IS NULL THEN
      INSERT INTO public.tenant_processes (
        tenant_id,
        code,
        name,
        description,
        area,
        owner_user_id,
        criticality,
        is_active,
        sort_order,
        metadata,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      )
      VALUES (
        v_tenant_id,
        r.code,
        r.name,
        r.description,
        r.area,
        r.owner_user_id,
        r.criticality,
        true,
        r.sort_order,
        jsonb_build_object('demo_seed', 'sprint-7.1', 'standard_code', r.standard_code),
        v_admin_id,
        v_admin_id,
        now(),
        now()
      )
      RETURNING id INTO v_process_id;
    ELSE
      UPDATE public.tenant_processes
      SET
        code = r.code,
        description = r.description,
        area = r.area,
        owner_user_id = r.owner_user_id,
        criticality = r.criticality,
        is_active = true,
        sort_order = r.sort_order,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('demo_seed', 'sprint-7.1', 'standard_code', r.standard_code),
        updated_by_user_id = v_admin_id,
        updated_at = now()
      WHERE id = v_process_id;
    END IF;

    SELECT id INTO v_operation_id
    FROM public.tenant_operations
    WHERE tenant_id = v_tenant_id
      AND process_id = v_process_id
      AND lower(name) = lower(r.name)
    LIMIT 1;

    IF v_operation_id IS NULL THEN
      INSERT INTO public.tenant_operations (
        tenant_id,
        process_id,
        code,
        name,
        description,
        operation_type,
        frequency,
        owner_user_id,
        is_active,
        is_default,
        sort_order,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        v_tenant_id,
        v_process_id,
        r.code || '-OP',
        r.name,
        r.description,
        'proceso',
        'mensual',
        r.owner_user_id,
        true,
        false,
        r.sort_order,
        jsonb_build_object('demo_seed', 'sprint-7.1', 'standard_code', r.standard_code),
        now(),
        now()
      )
      RETURNING id INTO v_operation_id;
    ELSE
      UPDATE public.tenant_operations
      SET
        code = r.code || '-OP',
        description = r.description,
        operation_type = 'proceso',
        frequency = 'mensual',
        owner_user_id = r.owner_user_id,
        is_active = true,
        sort_order = r.sort_order,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('demo_seed', 'sprint-7.1', 'standard_code', r.standard_code),
        updated_at = now()
      WHERE id = v_operation_id;
    END IF;
  END LOOP;

  IF to_regclass('public.tenant_standards') IS NOT NULL THEN
    INSERT INTO public.tenant_standards (tenant_id, standard_code, is_active)
    SELECT v_tenant_id, s.standard_code, true
    FROM (VALUES ('ISO9001'), ('ISO27001')) AS s(standard_code)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.tenant_standards ts
      WHERE ts.tenant_id = v_tenant_id
        AND ts.standard_code = s.standard_code
    );

    UPDATE public.tenant_standards
    SET is_active = true
    WHERE tenant_id = v_tenant_id
      AND standard_code IN ('ISO9001', 'ISO27001');

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenant_standards' AND column_name = 'initialized_at'
    ) THEN
      EXECUTE $sql$
        UPDATE public.tenant_standards
        SET initialized_at = COALESCE(initialized_at, now())
        WHERE tenant_id = $1
          AND standard_code IN ('ISO9001', 'ISO27001')
      $sql$
      USING v_tenant_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenant_standards' AND column_name = 'catalog_mode'
    ) THEN
      EXECUTE $sql$
        UPDATE public.tenant_standards
        SET catalog_mode = COALESCE(catalog_mode, 'generic')
        WHERE tenant_id = $1
          AND standard_code IN ('ISO9001', 'ISO27001')
      $sql$
      USING v_tenant_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenant_standards' AND column_name = 'lifecycle_status'
    ) THEN
      EXECUTE $sql$
        UPDATE public.tenant_standards
        SET lifecycle_status = 'active'
        WHERE tenant_id = $1
          AND standard_code IN ('ISO9001', 'ISO27001')
      $sql$
      USING v_tenant_id;
    END IF;
  END IF;

  IF to_regclass('public.tenant_standard_operations') IS NOT NULL THEN
    INSERT INTO public.tenant_standard_operations (
      tenant_id,
      standard_code,
      operation_id,
      is_active,
      notes
    )
    SELECT
      op.tenant_id,
      op.metadata->>'standard_code',
      op.id,
      true,
      'Asignado desde seed demo comercial Sprint 7.1'
    FROM public.tenant_operations op
    WHERE op.tenant_id = v_tenant_id
      AND op.metadata->>'demo_seed' = 'sprint-7.1'
      AND op.metadata->>'standard_code' IN ('ISO9001', 'ISO27001')
      AND NOT EXISTS (
        SELECT 1
        FROM public.tenant_standard_operations tso
        WHERE tso.tenant_id = op.tenant_id
          AND tso.standard_code = op.metadata->>'standard_code'
          AND tso.operation_id = op.id
      );

    UPDATE public.tenant_standard_operations tso
    SET
      is_active = true,
      notes = COALESCE(NULLIF(tso.notes, ''), 'Asignado desde seed demo comercial Sprint 7.1')
    FROM public.tenant_operations op
    WHERE tso.tenant_id = v_tenant_id
      AND tso.operation_id = op.id
      AND op.metadata->>'demo_seed' = 'sprint-7.1'
      AND tso.standard_code = op.metadata->>'standard_code';
  END IF;
END $$;

DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
  LIMIT 1;

  IF to_regclass('public.tenant_controls') IS NULL
     OR to_regclass('public.controls_catalog') IS NULL
     OR to_regclass('public.tenant_standard_operations') IS NULL THEN
    RAISE NOTICE 'Se omite seed de tenant_controls: falta tenant_controls, controls_catalog o tenant_standard_operations.';
    RETURN;
  END IF;

  INSERT INTO public.tenant_controls (
    tenant_id,
    control_id,
    operation_id,
    status,
    score,
    health_status,
    applicability,
    priority,
    notes,
    metadata,
    created_at,
    updated_at
  )
  SELECT
    v_tenant_id,
    cc.id,
    tso.operation_id,
    'pendiente',
    0,
    'deteriorado',
    'aplicable',
    'media',
    'Control inicializado por seed demo comercial Sprint 7.1',
    jsonb_build_object('demo_seed', 'sprint-7.1', 'standard_code', cc.iso),
    now(),
    now()
  FROM public.controls_catalog cc
  JOIN public.tenant_standard_operations tso
    ON tso.tenant_id = v_tenant_id
   AND tso.standard_code = cc.iso
   AND tso.is_active = true
  JOIN public.tenant_operations op
    ON op.id = tso.operation_id
   AND op.tenant_id = tso.tenant_id
   AND op.is_active = true
  WHERE cc.iso IN ('ISO9001', 'ISO27001')
    AND COALESCE(cc.is_active, true) = true
    AND cc.tenant_id IS NULL
    AND COALESCE(cc.source_type, 'generic') = 'generic'
    AND NOT EXISTS (
      SELECT 1
      FROM public.tenant_controls existing
      WHERE existing.tenant_id = v_tenant_id
        AND existing.control_id = cc.id
        AND existing.operation_id = tso.operation_id
    );

  WITH ranked AS (
    SELECT
      tc.id,
      cc.iso,
      row_number() OVER (PARTITION BY cc.iso ORDER BY op.sort_order, cc.clause NULLS LAST, cc.description) AS rn
    FROM public.tenant_controls tc
    JOIN public.controls_catalog cc
      ON cc.id = tc.control_id
    LEFT JOIN public.tenant_operations op
      ON op.id = tc.operation_id
    WHERE tc.tenant_id = v_tenant_id
      AND cc.iso IN ('ISO9001', 'ISO27001')
  )
  UPDATE public.tenant_controls tc
  SET
    status = CASE
      WHEN ranked.rn <= 5 THEN 'cumple'
      WHEN ranked.rn <= 10 THEN 'parcial'
      WHEN ranked.rn <= 14 THEN 'no cumple'
      ELSE 'pendiente'
    END,
    score = CASE
      WHEN ranked.rn <= 5 THEN 88
      WHEN ranked.rn <= 10 THEN 62
      WHEN ranked.rn <= 14 THEN 28
      ELSE 15
    END,
    health_status = CASE
      WHEN ranked.rn <= 5 THEN 'saludable'
      WHEN ranked.rn <= 10 THEN 'atencion'
      ELSE 'deteriorado'
    END,
    priority = CASE
      WHEN ranked.rn <= 5 THEN 'media'
      WHEN ranked.rn <= 10 THEN 'media'
      ELSE 'alta'
    END,
    metadata = COALESCE(tc.metadata, '{}'::jsonb) || jsonb_build_object(
      'demo_seed', 'sprint-7.1',
      'demo_health_profile', CASE
        WHEN ranked.rn <= 5 THEN 'cubierto'
        WHEN ranked.rn <= 10 THEN 'parcial'
        ELSE 'brecha'
      END
    ),
    updated_at = now()
  FROM ranked
  WHERE tc.id = ranked.id;
END $$;

DO $$
DECLARE
  v_tenant_id uuid;
  v_admin_id uuid;
  v_source_id uuid;
  v_integration_id uuid;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
  LIMIT 1;

  SELECT id INTO v_admin_id FROM public.users WHERE lower(email) = 'admin.demo@tcdx.local' LIMIT 1;

  IF to_regclass('public.evidences') IS NOT NULL
     AND to_regclass('public.tenant_controls') IS NOT NULL
     AND to_regclass('public.controls_catalog') IS NOT NULL THEN
    WITH evidence_seed AS (
      SELECT *
      FROM (
        VALUES
          ('ISO9001', 1, 'Política de Calidad', 'aprobada', true, 'politica-calidad.pdf'),
          ('ISO9001', 2, 'Alcance del Sistema de Gestión de Calidad', 'aprobada', true, 'alcance-sgc.pdf'),
          ('ISO9001', 3, 'Mapa de Procesos', 'aprobada', true, 'mapa-procesos.pdf'),
          ('ISO9001', 4, 'Matriz de Riesgos y Oportunidades de Calidad', 'aprobada', true, 'matriz-riesgos-calidad.xlsx'),
          ('ISO9001', 5, 'Objetivos de Calidad', 'aprobada', true, 'objetivos-calidad.pdf'),
          ('ISO9001', 6, 'Registro de Reclamos de Clientes', 'pendiente', false, 'registro-reclamos-clientes.xlsx'),
          ('ISO9001', 7, 'Registro de Satisfacción de Clientes', 'pendiente', false, 'satisfaccion-clientes.xlsx'),
          ('ISO9001', 8, 'Evaluación de Proveedores', 'aprobada', true, 'evaluacion-proveedores.xlsx'),
          ('ISO9001', 9, 'Registro de No Conformidades', 'pendiente', false, 'registro-no-conformidades.xlsx'),
          ('ISO9001', 10, 'Registro de Acciones Correctivas', 'pendiente', false, 'acciones-correctivas.xlsx'),
          ('ISO9001', 11, 'Acta de Revisión por la Dirección', 'aprobada', true, 'revision-direccion.pdf'),
          ('ISO9001', 12, 'Plan de Auditoría Interna', 'pendiente', false, 'plan-auditoria-interna.pdf'),
          ('ISO27001', 1, 'Política de Seguridad de la Información', 'aprobada', true, 'politica-seguridad-informacion.pdf'),
          ('ISO27001', 2, 'Alcance del SGSI', 'aprobada', true, 'alcance-sgsi.pdf'),
          ('ISO27001', 3, 'Inventario de Activos de Información', 'pendiente', false, 'inventario-activos.xlsx'),
          ('ISO27001', 4, 'Matriz de Riesgos de Seguridad de la Información', 'aprobada', true, 'matriz-riesgos-seguridad.xlsx'),
          ('ISO27001', 5, 'Plan de Tratamiento de Riesgos', 'pendiente', false, 'plan-tratamiento-riesgos.pdf'),
          ('ISO27001', 6, 'Declaración de Aplicabilidad / SoA', 'aprobada', true, 'soa.pdf'),
          ('ISO27001', 7, 'Registro de Incidentes de Seguridad', 'pendiente', false, 'registro-incidentes.xlsx'),
          ('ISO27001', 8, 'Registro de Accesos', 'aprobada', true, 'registro-accesos.xlsx'),
          ('ISO27001', 9, 'Revisión de Permisos', 'pendiente', false, 'revision-permisos.xlsx'),
          ('ISO27001', 10, 'Registro de Backups', 'aprobada', true, 'registro-backups.xlsx'),
          ('ISO27001', 11, 'Prueba de Restauración', 'pendiente', false, 'prueba-restauracion.pdf'),
          ('ISO27001', 12, 'Evaluación de Proveedores Cloud', 'pendiente', false, 'evaluacion-proveedores-cloud.xlsx'),
          ('ISO27001', 13, 'Evidencia de Concientización en Seguridad', 'aprobada', true, 'concientizacion-seguridad.pdf')
      ) AS rows(standard_code, desired_rn, title, status, validated, file_name)
    ),
    control_pick AS (
      SELECT
        tc.id AS tenant_control_id,
        tc.control_id,
        cc.iso AS standard_code,
        row_number() OVER (PARTITION BY cc.iso ORDER BY tc.score DESC, tc.created_at, tc.id) AS rn
      FROM public.tenant_controls tc
      JOIN public.controls_catalog cc
        ON cc.id = tc.control_id
      WHERE tc.tenant_id = v_tenant_id
        AND cc.iso IN ('ISO9001', 'ISO27001')
    )
    INSERT INTO public.evidences (
      tenant_id,
      control_id,
      tenant_control_id,
      description,
      file_name,
      file_path,
      file_mime_type,
      file_size_bytes,
      status,
      validated,
      evidence_type,
      metadata
    )
    SELECT
      v_tenant_id,
      cp.control_id,
      cp.tenant_control_id,
      es.title,
      es.file_name,
      NULL,
      CASE
        WHEN es.file_name LIKE '%.xlsx' THEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ELSE 'application/pdf'
      END,
      NULL,
      es.status,
      es.validated,
      'documento_demo',
      jsonb_build_object(
        'demo_seed', 'sprint-7.1',
        'standard_code', es.standard_code,
        'storage_note', 'Metadata demo sin archivo fisico',
        'official_evidence', CASE WHEN es.validated THEN 'true' ELSE 'false' END
      )
    FROM evidence_seed es
    JOIN control_pick cp
      ON cp.standard_code = es.standard_code
     AND cp.rn = es.desired_rn
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.evidences e
      WHERE e.tenant_id = v_tenant_id
        AND lower(e.description) = lower(es.title)
        AND COALESCE(e.metadata->>'demo_seed', '') = 'sprint-7.1'
    );

    UPDATE public.evidences e
    SET
      status = es.status,
      validated = es.validated,
      metadata = COALESCE(e.metadata, '{}'::jsonb) || jsonb_build_object(
        'demo_seed', 'sprint-7.1',
        'standard_code', es.standard_code,
        'storage_note', 'Metadata demo sin archivo fisico',
        'official_evidence', CASE WHEN es.validated THEN 'true' ELSE 'false' END
      )
    FROM (
      VALUES
        ('ISO9001', 'Política de Calidad', 'aprobada', true),
        ('ISO9001', 'Alcance del Sistema de Gestión de Calidad', 'aprobada', true),
        ('ISO9001', 'Mapa de Procesos', 'aprobada', true),
        ('ISO9001', 'Matriz de Riesgos y Oportunidades de Calidad', 'aprobada', true),
        ('ISO9001', 'Objetivos de Calidad', 'aprobada', true),
        ('ISO9001', 'Registro de Reclamos de Clientes', 'pendiente', false),
        ('ISO9001', 'Registro de Satisfacción de Clientes', 'pendiente', false),
        ('ISO9001', 'Evaluación de Proveedores', 'aprobada', true),
        ('ISO9001', 'Registro de No Conformidades', 'pendiente', false),
        ('ISO9001', 'Registro de Acciones Correctivas', 'pendiente', false),
        ('ISO9001', 'Acta de Revisión por la Dirección', 'aprobada', true),
        ('ISO9001', 'Plan de Auditoría Interna', 'pendiente', false),
        ('ISO27001', 'Política de Seguridad de la Información', 'aprobada', true),
        ('ISO27001', 'Alcance del SGSI', 'aprobada', true),
        ('ISO27001', 'Inventario de Activos de Información', 'pendiente', false),
        ('ISO27001', 'Matriz de Riesgos de Seguridad de la Información', 'aprobada', true),
        ('ISO27001', 'Plan de Tratamiento de Riesgos', 'pendiente', false),
        ('ISO27001', 'Declaración de Aplicabilidad / SoA', 'aprobada', true),
        ('ISO27001', 'Registro de Incidentes de Seguridad', 'pendiente', false),
        ('ISO27001', 'Registro de Accesos', 'aprobada', true),
        ('ISO27001', 'Revisión de Permisos', 'pendiente', false),
        ('ISO27001', 'Registro de Backups', 'aprobada', true),
        ('ISO27001', 'Prueba de Restauración', 'pendiente', false),
        ('ISO27001', 'Evaluación de Proveedores Cloud', 'pendiente', false),
        ('ISO27001', 'Evidencia de Concientización en Seguridad', 'aprobada', true)
    ) AS es(standard_code, title, status, validated)
    WHERE e.tenant_id = v_tenant_id
      AND lower(e.description) = lower(es.title)
      AND COALESCE(e.metadata->>'demo_seed', '') = 'sprint-7.1';
  ELSE
    RAISE NOTICE 'Se omite seed de evidences: falta evidences, tenant_controls o controls_catalog.';
  END IF;

  IF to_regclass('public.tenant_integrations') IS NOT NULL
     AND to_regclass('public.tenant_document_sources') IS NOT NULL
     AND to_regclass('public.document_index') IS NOT NULL THEN
    SELECT id INTO v_integration_id
    FROM public.tenant_integrations
    WHERE tenant_id = v_tenant_id
      AND provider = 'sharepoint'
      AND display_name = 'Repositorio documental demo TCDX'
    LIMIT 1;

    IF v_integration_id IS NULL THEN
      INSERT INTO public.tenant_integrations (
        tenant_id,
        provider,
        status,
        display_name,
        connected_by_user_id,
        metadata_json,
        created_at,
        updated_at
      )
      VALUES (
        v_tenant_id,
        'sharepoint',
        'prepared',
        'Repositorio documental demo TCDX',
        v_admin_id,
        jsonb_build_object('demo_seed', 'sprint-7.1', 'note', 'Fuente demo sin credenciales ni sincronizacion real'),
        now(),
        now()
      )
      RETURNING id INTO v_integration_id;
    END IF;

    SELECT id INTO v_source_id
    FROM public.tenant_document_sources
    WHERE tenant_id = v_tenant_id
      AND provider = 'sharepoint'
      AND source_name = 'Biblioteca documental demo comercial'
    LIMIT 1;

    IF v_source_id IS NULL THEN
      INSERT INTO public.tenant_document_sources (
        tenant_id,
        integration_id,
        provider,
        source_name,
        folder_id,
        folder_path,
        sync_enabled,
        scan_frequency,
        created_by_user_id,
        metadata_json,
        created_at,
        updated_at
      )
      VALUES (
        v_tenant_id,
        v_integration_id,
        'sharepoint',
        'Biblioteca documental demo comercial',
        'demo-sprint-7-1',
        '/Demo Comercial TCDX',
        false,
        'manual',
        v_admin_id,
        jsonb_build_object('demo_seed', 'sprint-7.1', 'storage_note', 'Metadata demo sin archivos fisicos'),
        now(),
        now()
      )
      RETURNING id INTO v_source_id;
    END IF;

    INSERT INTO public.document_index (
      tenant_id,
      source_id,
      integration_id,
      provider,
      provider_file_id,
      provider_version_id,
      file_name,
      mime_type,
      file_extension,
      file_url,
      web_view_url,
      size_bytes,
      checksum,
      modified_at,
      indexed_at,
      last_seen_at,
      status,
      metadata_json
    )
    SELECT
      v_tenant_id,
      v_source_id,
      v_integration_id,
      'sharepoint',
      'demo-sprint-7-1:' || md5(e.description),
      'v1',
      COALESCE(e.file_name, regexp_replace(lower(e.description), '[^a-z0-9]+', '-', 'g') || '.pdf'),
      COALESCE(e.file_mime_type, 'application/pdf'),
      CASE
        WHEN COALESCE(e.file_name, '') LIKE '%.xlsx' THEN 'xlsx'
        ELSE 'pdf'
      END,
      NULL,
      NULL,
      e.file_size_bytes,
      md5(e.tenant_id::text || ':' || e.description),
      now(),
      now(),
      now(),
      'indexed',
      jsonb_build_object(
        'demo_seed', 'sprint-7.1',
        'source', 'metadata_only',
        'evidence_id', e.id,
        'standard_code', e.metadata->>'standard_code',
        'storage_note', 'No existe archivo fisico asociado al seed'
      )
    FROM public.evidences e
    WHERE e.tenant_id = v_tenant_id
      AND COALESCE(e.metadata->>'demo_seed', '') = 'sprint-7.1'
      AND NOT EXISTS (
        SELECT 1
        FROM public.document_index di
        WHERE di.tenant_id = v_tenant_id
          AND di.provider = 'sharepoint'
          AND di.provider_file_id = 'demo-sprint-7-1:' || md5(e.description)
      );

    IF to_regclass('public.evidence_document_links') IS NOT NULL THEN
      INSERT INTO public.evidence_document_links (
        tenant_id,
        evidence_id,
        document_id,
        relation_type,
        created_by_user_id,
        created_at
      )
      SELECT
        v_tenant_id,
        e.id,
        di.id,
        'source_document',
        v_admin_id,
        now()
      FROM public.evidences e
      JOIN public.document_index di
        ON di.tenant_id = e.tenant_id
       AND di.provider = 'sharepoint'
       AND di.provider_file_id = 'demo-sprint-7-1:' || md5(e.description)
      WHERE e.tenant_id = v_tenant_id
        AND COALESCE(e.metadata->>'demo_seed', '') = 'sprint-7.1'
        AND NOT EXISTS (
          SELECT 1
          FROM public.evidence_document_links l
          WHERE l.evidence_id = e.id
            AND l.document_id = di.id
        );
    END IF;
  ELSE
    RAISE NOTICE 'Se omite seed de document_index/fuentes: faltan tablas documentales.';
  END IF;
END $$;

DO $$
DECLARE
  v_tenant_id uuid;
  r record;
  v_asset_id uuid;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
  LIMIT 1;

  IF to_regclass('public.assets') IS NULL OR to_regclass('public.asset_risks') IS NULL THEN
    RAISE NOTICE 'Se omite seed de assets/asset_risks: faltan tablas.';
  ELSE
    FOR r IN
      SELECT *
      FROM (
        VALUES
          ('ISO9001', 'Proceso de reclamos de clientes', 'proceso', 'alta', 'Responsable Calidad', 'Reclamos no gestionados oportunamente.', 'Retrasos de respuesta afectan satisfaccion y SLA de clientes.', 'alta', 'alto'),
          ('ISO9001', 'Evaluacion de proveedores criticos', 'proceso', 'media', 'Responsable Calidad', 'Proveedores sin evaluación vigente.', 'Servicios externos sin evaluacion documentada vigente.', 'media', 'medio'),
          ('ISO9001', 'Tablero de indicadores de procesos', 'proceso', 'media', 'Admin Cumplimiento', 'Indicadores de proceso incompletos.', 'Falta visibilidad de desempeno para revision por la direccion.', 'media', 'medio'),
          ('ISO9001', 'Encuesta de satisfacción de clientes', 'registro', 'media', 'Responsable Calidad', 'Falta de evidencia de satisfacción del cliente.', 'No existe consolidacion suficiente para demostrar seguimiento.', 'media', 'medio'),
          ('ISO9001', 'Flujo de acciones correctivas', 'proceso', 'alta', 'Responsable Calidad', 'Acciones correctivas sin cierre oportuno.', 'Acciones abiertas impactan eficacia del SGC.', 'alta', 'alto'),
          ('ISO27001', 'Sistema de identidades y accesos', 'sistema', 'alta', 'Responsable TI', 'Accesos sin revisión periódica.', 'Permisos activos sin recertificacion formal.', 'alta', 'alto'),
          ('ISO27001', 'Plataforma de backups', 'sistema', 'alta', 'Responsable TI', 'Backups sin prueba de restauración.', 'No existe evidencia reciente de restauracion exitosa.', 'alta', 'critico'),
          ('ISO27001', 'Inventario CMDB SaaS', 'registro', 'alta', 'Responsable TI', 'Activos sin propietario asignado.', 'Activos criticos sin responsable afectan trazabilidad y tratamiento.', 'media', 'alto'),
          ('ISO27001', 'Mesa de incidentes de seguridad', 'proceso', 'alta', 'Responsable TI', 'Incidentes sin clasificación formal.', 'Eventos no clasificados dificultan respuesta y lecciones aprendidas.', 'media', 'medio'),
          ('ISO27001', 'Proveedor cloud principal', 'proveedor', 'alta', 'Responsable TI', 'Proveedor cloud sin evaluación de seguridad.', 'Proveedor critico requiere due diligence y seguimiento anual.', 'alta', 'alto'),
          ('ISO27001', 'Backlog de vulnerabilidades', 'registro', 'alta', 'Responsable TI', 'Vulnerabilidades sin tratamiento documentado.', 'Vulnerabilidades abiertas sin plan formal ni evidencia de mitigacion.', 'alta', 'alto')
      ) AS rows(iso, asset_name, asset_type, criticality, owner, risk, impact, probability, level)
    LOOP
      SELECT id INTO v_asset_id
      FROM public.assets
      WHERE tenant_id = v_tenant_id
        AND lower(name) = lower(r.asset_name)
      LIMIT 1;

      IF v_asset_id IS NULL THEN
        INSERT INTO public.assets (
          tenant_id,
          name,
          type,
          iso,
          criticality,
          owner
        )
        VALUES (
          v_tenant_id,
          r.asset_name,
          r.asset_type,
          r.iso,
          r.criticality,
          r.owner
        )
        RETURNING id INTO v_asset_id;
      END IF;

      INSERT INTO public.asset_risks (
        asset_id,
        risk,
        impact,
        probability,
        level
      )
      SELECT
        v_asset_id,
        r.risk,
        r.impact,
        r.probability,
        r.level
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.asset_risks ar
        WHERE ar.asset_id = v_asset_id
          AND lower(ar.risk) = lower(r.risk)
      );

      IF to_regclass('public.asset_standards') IS NOT NULL THEN
        INSERT INTO public.asset_standards (
          asset_id,
          standard_code,
          source
        )
        SELECT
          v_asset_id,
          r.iso,
          'demo_seed'
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.asset_standards ast
          WHERE ast.asset_id = v_asset_id
            AND ast.standard_code = r.iso
        );
      END IF;
    END LOOP;
  END IF;

  IF to_regclass('public.iso_risk_matrix_runs') IS NOT NULL
     AND to_regclass('public.iso_risk_matrix_items') IS NOT NULL
     AND to_regclass('public.iso_risk_matrix_actions') IS NOT NULL THEN
    WITH run_seed AS (
      SELECT *
      FROM (
        VALUES
          ('ISO9001', '2015', 5, 1, 2, 2, 'atencion', 67.5),
          ('ISO27001', '2022', 6, 1, 4, 1, 'alto', 72.0)
      ) AS rows(standard_code, version_code, suggested_count, critical_count, high_count, medium_count, posture, residual_avg)
    ),
    inserted_runs AS (
      INSERT INTO public.iso_risk_matrix_runs (
        tenant_id,
        standard_code,
        version_code,
        run_type,
        run_status,
        requested_by,
        certifiable_version,
        total_assets,
        suggested_risks_count,
        accepted_risks_count,
        critical_risks_count,
        high_risks_count,
        medium_risks_count,
        low_risks_count,
        inherent_risk_avg,
        residual_risk_avg,
        risk_posture,
        summary_json,
        input_json,
        result_json,
        created_at,
        updated_at,
        completed_at
      )
      SELECT
        v_tenant_id,
        rs.standard_code,
        rs.version_code,
        'asset_based',
        'completed',
        (SELECT id FROM public.users WHERE lower(email) = 'admin.demo@tcdx.local' LIMIT 1),
        true,
        (SELECT COUNT(*) FROM public.assets WHERE tenant_id = v_tenant_id),
        rs.suggested_count,
        rs.suggested_count,
        rs.critical_count,
        rs.high_count,
        rs.medium_count,
        GREATEST(rs.suggested_count - rs.critical_count - rs.high_count - rs.medium_count, 0),
        12.5,
        rs.residual_avg,
        rs.posture,
        jsonb_build_object('demo_seed', 'sprint-7.1', 'summary', 'Matriz de riesgos demo comercial'),
        jsonb_build_object('source', 'demo_seed'),
        jsonb_build_object('standards', jsonb_build_array(rs.standard_code)),
        now(),
        now(),
        now()
      FROM run_seed rs
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.iso_risk_matrix_runs existing
        WHERE existing.tenant_id = v_tenant_id
          AND existing.standard_code = rs.standard_code
          AND COALESCE(existing.summary_json->>'demo_seed', '') = 'sprint-7.1'
      )
      RETURNING id, standard_code, version_code
    ),
    all_runs AS (
      SELECT id, standard_code, version_code
      FROM inserted_runs
      UNION
      SELECT id, standard_code, version_code
      FROM public.iso_risk_matrix_runs
      WHERE tenant_id = v_tenant_id
        AND standard_code IN ('ISO9001', 'ISO27001')
        AND COALESCE(summary_json->>'demo_seed', '') = 'sprint-7.1'
    ),
    risk_seed AS (
      SELECT *
      FROM (
        VALUES
          ('ISO9001', 'Reclamos no gestionados oportunamente.', 'Riesgo de incumplir tiempos de respuesta y perder satisfaccion del cliente.', 'cliente', 4, 4, 'alto', 'mitigar'),
          ('ISO9001', 'Proveedores sin evaluación vigente.', 'Riesgo de baja calidad o incumplimiento de proveedores criticos.', 'proveedores', 3, 3, 'medio', 'mitigar'),
          ('ISO9001', 'Indicadores de proceso incompletos.', 'Riesgo de revision por la direccion con datos insuficientes.', 'procesos', 3, 3, 'medio', 'monitorear'),
          ('ISO9001', 'Falta de evidencia de satisfacción del cliente.', 'Riesgo de no demostrar seguimiento de percepcion del cliente.', 'cliente', 3, 3, 'medio', 'mitigar'),
          ('ISO9001', 'Acciones correctivas sin cierre oportuno.', 'Riesgo de reincidencia y no conformidades abiertas.', 'mejora', 4, 4, 'alto', 'mitigar'),
          ('ISO27001', 'Accesos sin revisión periódica.', 'Riesgo de permisos excesivos o cuentas no revocadas.', 'accesos', 4, 4, 'alto', 'mitigar'),
          ('ISO27001', 'Backups sin prueba de restauración.', 'Riesgo critico de indisponibilidad o perdida de datos no recuperable.', 'continuidad', 5, 4, 'critico', 'mitigar'),
          ('ISO27001', 'Activos sin propietario asignado.', 'Riesgo de falta de accountability sobre activos criticos.', 'activos', 4, 3, 'alto', 'mitigar'),
          ('ISO27001', 'Incidentes sin clasificación formal.', 'Riesgo de respuesta inconsistente y reporte incompleto.', 'incidentes', 3, 3, 'medio', 'monitorear'),
          ('ISO27001', 'Proveedor cloud sin evaluación de seguridad.', 'Riesgo de terceros sin controles verificados.', 'proveedores', 4, 4, 'alto', 'transferir'),
          ('ISO27001', 'Vulnerabilidades sin tratamiento documentado.', 'Riesgo de explotacion por falta de priorizacion y cierre.', 'vulnerabilidades', 4, 4, 'alto', 'mitigar')
      ) AS rows(standard_code, title, description, category, likelihood, impact, level, treatment)
    )
    INSERT INTO public.iso_risk_matrix_items (
      run_id,
      tenant_id,
      standard_code,
      version_code,
      risk_title,
      risk_description,
      risk_category,
      likelihood,
      impact,
      inherent_risk_score,
      inherent_risk_level,
      residual_likelihood,
      residual_impact,
      residual_risk_score,
      residual_risk_level,
      treatment_strategy,
      suggested_controls,
      suggested_actions,
      evidence_expectations,
      status,
      confidence,
      source_type,
      source_trace_json,
      created_at,
      updated_at
    )
    SELECT
      ar.id,
      v_tenant_id,
      rs.standard_code,
      ar.version_code,
      rs.title,
      rs.description,
      rs.category,
      rs.likelihood,
      rs.impact,
      rs.likelihood * rs.impact,
      CASE WHEN rs.likelihood * rs.impact >= 16 THEN 'alto' WHEN rs.likelihood * rs.impact >= 9 THEN 'medio' ELSE 'bajo' END,
      GREATEST(rs.likelihood - 1, 1),
      rs.impact,
      GREATEST(rs.likelihood - 1, 1) * rs.impact,
      rs.level,
      rs.treatment,
      ARRAY[]::text[],
      jsonb_build_array(jsonb_build_object('action', 'Revisar y documentar tratamiento', 'owner', 'Admin Cumplimiento')),
      jsonb_build_array(jsonb_build_object('evidence', 'Registro o procedimiento asociado', 'required', true)),
      'accepted',
      0.86,
      'demo_seed',
      jsonb_build_object('demo_seed', 'sprint-7.1'),
      now(),
      now()
    FROM risk_seed rs
    JOIN all_runs ar
      ON ar.standard_code = rs.standard_code
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.iso_risk_matrix_items existing
      WHERE existing.tenant_id = v_tenant_id
        AND existing.standard_code = rs.standard_code
        AND lower(existing.risk_title) = lower(rs.title)
        AND existing.run_id = ar.id
    );

    INSERT INTO public.iso_risk_matrix_actions (
      run_id,
      risk_item_id,
      tenant_id,
      action_title,
      action_description,
      suggested_owner_role,
      suggested_due_days,
      priority,
      action_type,
      creates_action_plan_candidate,
      status,
      metadata,
      created_at,
      updated_at
    )
    SELECT
      i.run_id,
      i.id,
      v_tenant_id,
      'Tratamiento demo: ' || i.risk_title,
      'Accion sugerida para reducir riesgo residual y generar evidencia de tratamiento.',
      CASE WHEN i.standard_code = 'ISO27001' THEN 'Responsable TI' ELSE 'Responsable Calidad' END,
      30,
      CASE WHEN i.residual_risk_level IN ('critico', 'alto') THEN 'alta' ELSE 'media' END,
      'risk_treatment',
      true,
      'suggested',
      jsonb_build_object('demo_seed', 'sprint-7.1'),
      now(),
      now()
    FROM public.iso_risk_matrix_items i
    WHERE i.tenant_id = v_tenant_id
      AND i.source_type = 'demo_seed'
      AND NOT EXISTS (
        SELECT 1
        FROM public.iso_risk_matrix_actions a
        WHERE a.risk_item_id = i.id
          AND a.action_title = 'Tratamiento demo: ' || i.risk_title
      );
  ELSE
    RAISE NOTICE 'Se omite seed de iso_risk_matrix_*: faltan tablas.';
  END IF;
END $$;

DO $$
DECLARE
  v_tenant_id uuid;
  v_admin_id uuid;
  v_assessment_id uuid;
  r record;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
  LIMIT 1;

  SELECT id INTO v_admin_id FROM public.users WHERE lower(email) = 'admin.demo@tcdx.local' LIMIT 1;

  IF to_regclass('public.iso_express_assessments') IS NULL
     OR to_regclass('public.iso_express_assessment_gaps') IS NULL THEN
    RAISE NOTICE 'Se omite seed de brechas diagnosticas: faltan tablas iso_express.';
    RETURN;
  END IF;

  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('ISO9001', '2015', 64, 3, 2, 0, 'Falta evidencia consolidada de satisfacción del cliente.', 'alta', 'evidence_gap', 'Consolidar encuesta, resultados y acciones derivadas de satisfaccion.'),
        ('ISO9001', '2015', 64, 3, 2, 0, 'Falta trazabilidad completa de acciones correctivas.', 'alta', 'traceability_gap', 'Cerrar acciones correctivas con responsable, fecha y evidencia aprobada.'),
        ('ISO27001', '2022', 58, 4, 2, 1, 'Falta prueba documentada de restauración.', 'critica', 'evidence_gap', 'Ejecutar prueba de restauracion y guardar resultado validado.'),
        ('ISO27001', '2022', 58, 4, 2, 1, 'Falta revisión periódica de permisos.', 'alta', 'control_gap', 'Ejecutar recertificacion trimestral de accesos.'),
        ('ISO27001', '2022', 58, 4, 2, 1, 'Falta evaluación de proveedor cloud crítico.', 'alta', 'supplier_gap', 'Formalizar evaluacion de seguridad y plan de mitigacion del proveedor.'),
        ('ISO27001', '2022', 58, 4, 2, 1, 'Falta consolidar inventario de activos.', 'media', 'asset_gap', 'Completar inventario con propietarios, criticidad y clasificacion.')
    ) AS rows(standard_code, version_code, readiness_score, high_gaps, medium_gaps, critical_gaps, title, severity, gap_type, recommendation)
  LOOP
    SELECT id INTO v_assessment_id
    FROM public.iso_express_assessments
    WHERE tenant_id = v_tenant_id
      AND standard_code = r.standard_code
      AND version_code = r.version_code
      AND COALESCE(summary_json->>'demo_seed', '') = 'sprint-7.1'
    LIMIT 1;

    IF v_assessment_id IS NULL THEN
      INSERT INTO public.iso_express_assessments (
        tenant_id,
        standard_code,
        version_code,
        assessment_type,
        assessment_status,
        requested_by,
        source,
        certifiable_version,
        readiness_score,
        readiness_level,
        evaluated_controls_count,
        controls_with_evidence_count,
        controls_without_evidence_count,
        gaps_count,
        critical_gaps_count,
        high_gaps_count,
        medium_gaps_count,
        low_gaps_count,
        risk_score,
        maturity_score,
        summary_json,
        input_json,
        result_json,
        created_at,
        updated_at,
        completed_at
      )
      VALUES (
        v_tenant_id,
        r.standard_code,
        r.version_code,
        'express',
        'calculated',
        v_admin_id,
        'demo_seed',
        true,
        r.readiness_score,
        CASE WHEN r.readiness_score >= 70 THEN 'medio' ELSE 'bajo' END,
        18,
        8,
        10,
        0,
        r.critical_gaps,
        r.high_gaps,
        r.medium_gaps,
        0,
        68,
        r.readiness_score,
        jsonb_build_object('demo_seed', 'sprint-7.1', 'summary', 'Diagnostico demo comercial con brechas abiertas.'),
        jsonb_build_object('source', 'demo_seed'),
        jsonb_build_object('standard_code', r.standard_code),
        now(),
        now(),
        now()
      )
      RETURNING id INTO v_assessment_id;
    END IF;

    INSERT INTO public.iso_express_assessment_gaps (
      assessment_id,
      tenant_id,
      standard_code,
      version_code,
      gap_type,
      severity,
      title,
      description,
      recommendation,
      suggested_action_type,
      suggested_owner_role,
      suggested_due_days,
      source,
      metadata,
      created_at
    )
    SELECT
      v_assessment_id,
      v_tenant_id,
      r.standard_code,
      r.version_code,
      r.gap_type,
      r.severity,
      r.title,
      'Brecha demo comercial para demostrar reportes, health y recomendador de alcance.',
      r.recommendation,
      'action_plan',
      CASE WHEN r.standard_code = 'ISO27001' THEN 'Responsable TI' ELSE 'Responsable Calidad' END,
      30,
      'demo_seed',
      jsonb_build_object('demo_seed', 'sprint-7.1'),
      now()
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.iso_express_assessment_gaps g
      WHERE g.tenant_id = v_tenant_id
        AND lower(g.title) = lower(r.title)
        AND COALESCE(g.metadata->>'demo_seed', '') = 'sprint-7.1'
    );
  END LOOP;

  UPDATE public.iso_express_assessments a
  SET
    gaps_count = counts.total_gaps,
    critical_gaps_count = counts.critical_gaps,
    high_gaps_count = counts.high_gaps,
    medium_gaps_count = counts.medium_gaps,
    low_gaps_count = counts.low_gaps,
    updated_at = now()
  FROM (
    SELECT
      assessment_id,
      COUNT(*)::int AS total_gaps,
      COUNT(*) FILTER (WHERE severity = 'critica')::int AS critical_gaps,
      COUNT(*) FILTER (WHERE severity = 'alta')::int AS high_gaps,
      COUNT(*) FILTER (WHERE severity = 'media')::int AS medium_gaps,
      COUNT(*) FILTER (WHERE severity = 'baja')::int AS low_gaps
    FROM public.iso_express_assessment_gaps
    WHERE tenant_id = v_tenant_id
      AND COALESCE(metadata->>'demo_seed', '') = 'sprint-7.1'
    GROUP BY assessment_id
  ) counts
  WHERE a.id = counts.assessment_id;
END $$;

DO $$
DECLARE
  v_tenant_id uuid;
  v_admin_id uuid;
  v_auditor_id uuid;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
  LIMIT 1;

  SELECT id INTO v_admin_id FROM public.users WHERE lower(email) = 'admin.demo@tcdx.local' LIMIT 1;
  SELECT id INTO v_auditor_id FROM public.users WHERE lower(email) = 'auditor.demo@tcdx.local' LIMIT 1;

  IF to_regclass('public.action_plans') IS NOT NULL THEN
    WITH action_seed AS (
      SELECT *
      FROM (
        VALUES
          ('ISO27001', 'Ejecutar revisión trimestral de accesos.', 'Recertificar permisos de usuarios privilegiados y documentar evidencias.', 'alta', 'Responsable TI', 'en progreso', CURRENT_DATE + 14, 'risk'),
          ('ISO9001', 'Cargar evidencia de satisfacción de clientes.', 'Consolidar encuesta, analisis y acciones derivadas.', 'media', 'Responsable Calidad', 'abierto', CURRENT_DATE + 21, 'manual'),
          ('ISO9001', 'Formalizar evaluación de proveedores críticos.', 'Actualizar evaluacion anual de proveedores SaaS y soporte.', 'alta', 'Responsable Calidad', 'en progreso', CURRENT_DATE + 10, 'risk'),
          ('ISO27001', 'Actualizar inventario de activos de información.', 'Asignar propietario, criticidad y clasificacion a activos clave.', 'alta', 'Responsable TI', 'abierto', CURRENT_DATE + 30, 'risk'),
          ('ISO27001', 'Ejecutar prueba de restauración.', 'Ejecutar restauracion controlada y cargar resultado validado.', 'alta', 'Responsable TI', 'abierto', CURRENT_DATE - 7, 'risk'),
          ('ISO9001', 'Cerrar acciones correctivas pendientes.', 'Cerrar acciones vencidas y adjuntar evidencia de eficacia.', 'alta', 'Responsable Calidad', 'abierto', CURRENT_DATE - 12, 'manual'),
          ('ISO9001', 'Actualizar matriz de riesgos ISO 9001.', 'Revisar riesgos de calidad y oportunidades del periodo.', 'media', 'Responsable Calidad', 'completado', CURRENT_DATE - 3, 'manual'),
          ('ISO27001', 'Actualizar matriz de riesgos ISO 27001.', 'Actualizar riesgos residuales y tratamiento del SGSI.', 'alta', 'Responsable TI', 'completado', CURRENT_DATE - 1, 'risk')
      ) AS rows(iso_code, title, description, priority, owner, status, due_date, source_type)
    ),
    control_pick AS (
      SELECT DISTINCT ON (cc.iso)
        cc.iso,
        tc.id AS tenant_control_id
      FROM public.tenant_controls tc
      JOIN public.controls_catalog cc
        ON cc.id = tc.control_id
      WHERE tc.tenant_id = v_tenant_id
        AND cc.iso IN ('ISO9001', 'ISO27001')
      ORDER BY cc.iso, tc.score ASC, tc.created_at
    ),
    updated AS (
      UPDATE public.action_plans ap
      SET
        iso_code = s.iso_code,
        description = s.description,
        priority = s.priority,
        owner = s.owner,
        status = s.status,
        due_date = s.due_date,
        source_type = s.source_type,
        tenant_control_id = cp.tenant_control_id,
        created_by = COALESCE(ap.created_by, v_admin_id),
        approval_status = 'no_requerida'
      FROM action_seed s
      LEFT JOIN control_pick cp
        ON cp.iso = s.iso_code
      WHERE ap.tenant_id = v_tenant_id
        AND lower(ap.title) = lower(s.title)
      RETURNING ap.id
    )
    INSERT INTO public.action_plans (
      tenant_id,
      iso_code,
      title,
      description,
      source_type,
      source_id,
      priority,
      status,
      owner,
      due_date,
      created_by,
      tenant_control_id,
      approval_status
    )
    SELECT
      v_tenant_id,
      s.iso_code,
      s.title,
      s.description,
      s.source_type,
      NULL,
      s.priority,
      s.status,
      s.owner,
      s.due_date,
      v_admin_id,
      cp.tenant_control_id,
      'no_requerida'
    FROM action_seed s
    LEFT JOIN control_pick cp
      ON cp.iso = s.iso_code
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.action_plans ap
      WHERE ap.tenant_id = v_tenant_id
        AND lower(ap.title) = lower(s.title)
    );
  ELSE
    RAISE NOTICE 'Se omite seed de action_plans: tabla no existe.';
  END IF;

  IF to_regclass('public.audits') IS NOT NULL THEN
    INSERT INTO public.audits (
      tenant_id,
      iso,
      start_date,
      end_date,
      requester_name,
      auditor_type,
      auditor_name,
      status
    )
    SELECT *
    FROM (
      VALUES
        (v_tenant_id, 'ISO9001', CURRENT_DATE - 20, CURRENT_DATE + 10, 'Admin Cumplimiento', 'interno', 'Auditor Demo ISO 9001', 'en_ejecucion'),
        (v_tenant_id, 'ISO27001', CURRENT_DATE - 7, CURRENT_DATE + 21, 'Admin Cumplimiento', 'interno', 'Auditor Demo ISO 27001', 'pendiente')
    ) AS a(tenant_id, iso, start_date, end_date, requester_name, auditor_type, auditor_name, status)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.audits existing
      WHERE existing.tenant_id = v_tenant_id
        AND existing.iso = a.iso
        AND existing.auditor_name = a.auditor_name
        AND existing.requester_name = a.requester_name
    );
  END IF;

  IF to_regclass('public.findings') IS NOT NULL
     AND to_regclass('public.tenant_controls') IS NOT NULL
     AND to_regclass('public.controls_catalog') IS NOT NULL THEN
    WITH finding_seed AS (
      SELECT *
      FROM (
        VALUES
          ('ISO9001', 'Hallazgo menor ISO 9001 - trazabilidad de acciones correctivas', 'Falta evidencia de seguimiento de eficacia para acciones correctivas cerradas.', 'observacion', 'media', 'abierto'),
          ('ISO27001', 'Hallazgo mayor ISO 27001 - prueba de restauración no documentada', 'No existe prueba reciente documentada de restauracion para backups criticos.', 'no_conformidad', 'alta', 'abierto')
      ) AS rows(iso_code, title, description, finding_type, severity, status)
    ),
    control_pick AS (
      SELECT DISTINCT ON (cc.iso)
        cc.iso,
        tc.id AS tenant_control_id
      FROM public.tenant_controls tc
      JOIN public.controls_catalog cc
        ON cc.id = tc.control_id
      WHERE tc.tenant_id = v_tenant_id
        AND cc.iso IN ('ISO9001', 'ISO27001')
      ORDER BY cc.iso, tc.score ASC, tc.created_at
    )
    INSERT INTO public.findings (
      tenant_id,
      iso_code,
      title,
      description,
      finding_type,
      severity,
      status,
      source_type,
      tenant_control_id,
      created_by,
      created_at,
      updated_at
    )
    SELECT
      v_tenant_id,
      f.iso_code,
      f.title,
      f.description,
      f.finding_type,
      f.severity,
      f.status,
      'manual',
      cp.tenant_control_id,
      v_auditor_id,
      now(),
      now()
    FROM finding_seed f
    LEFT JOIN control_pick cp
      ON cp.iso = f.iso_code
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.findings existing
      WHERE existing.tenant_id = v_tenant_id
        AND lower(existing.title) = lower(f.title)
    );
  END IF;

  IF to_regclass('public.tenant_nonconformities') IS NOT NULL
     AND to_regclass('public.tenant_controls') IS NOT NULL
     AND to_regclass('public.controls_catalog') IS NOT NULL THEN
    WITH nc_seed AS (
      SELECT *
      FROM (
        VALUES
          ('ISO9001', 'No conformidad demo vinculada a evidencia faltante de satisfaccion del cliente', 'abierta'),
          ('ISO27001', 'No conformidad demo vinculada a evidencia faltante de prueba de restauracion', 'abierta')
      ) AS rows(iso_code, control_description, status)
    ),
    control_pick AS (
      SELECT DISTINCT ON (cc.iso)
        cc.iso,
        tc.control_id AS catalog_control_id
      FROM public.tenant_controls tc
      JOIN public.controls_catalog cc
        ON cc.id = tc.control_id
      WHERE tc.tenant_id = v_tenant_id
        AND cc.iso IN ('ISO9001', 'ISO27001')
      ORDER BY cc.iso, tc.score ASC, tc.created_at
    )
    INSERT INTO public.tenant_nonconformities (
      tenant_id,
      control_id,
      control_description,
      status,
      detected_at
    )
    SELECT
      v_tenant_id,
      cp.catalog_control_id,
      n.control_description,
      n.status,
      now()
    FROM nc_seed n
    JOIN control_pick cp
      ON cp.iso = n.iso_code
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.tenant_nonconformities existing
      WHERE existing.tenant_id = v_tenant_id
        AND existing.control_id = cp.catalog_control_id
        AND lower(COALESCE(existing.control_description, '')) = lower(n.control_description)
        AND lower(COALESCE(existing.status, '')) NOT IN ('resuelta', 'resuelto', 'cerrada', 'cerrado', 'cancelada', 'cancelado')
    );
  END IF;
END $$;

DO $$
DECLARE
  v_tenant_id uuid;
  v_admin_id uuid;
  v_auditor_id uuid;
  r record;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
  LIMIT 1;

  SELECT id INTO v_admin_id FROM public.users WHERE lower(email) = 'admin.demo@tcdx.local' LIMIT 1;
  SELECT id INTO v_auditor_id FROM public.users WHERE lower(email) = 'auditor.demo@tcdx.local' LIMIT 1;

  IF to_regclass('public.standard_lifecycle_status') IS NULL THEN
    RAISE NOTICE 'Se omite seed de ciclo de vida: standard_lifecycle_status no existe.';
    RETURN;
  END IF;

  FOR r IN
    SELECT DISTINCT ON (tso.standard_code)
      tso.standard_code,
      tso.operation_id,
      CASE
        WHEN tso.standard_code = 'ISO9001' THEN 'implementacion'
        ELSE 'diagnostico'
      END AS calculated_stage_code,
      CASE
        WHEN tso.standard_code = 'ISO9001' THEN 'verificacion_auditoria'
        ELSE 'implementacion'
      END AS confirmed_stage_code,
      CASE
        WHEN tso.standard_code = 'ISO9001' THEN 'atencion'
        ELSE 'deteriorado'
      END AS health_status,
      CASE
        WHEN tso.standard_code = 'ISO9001' THEN 68
        ELSE 56
      END AS maturity_score,
      CASE
        WHEN tso.standard_code = 'ISO9001' THEN 62
        ELSE 48
      END AS evidence_coverage_pct,
      CASE
        WHEN tso.standard_code = 'ISO9001' THEN 66
        ELSE 52
      END AS avg_health_score
    FROM public.tenant_standard_operations tso
    JOIN public.tenant_operations op
      ON op.id = tso.operation_id
     AND op.tenant_id = tso.tenant_id
    WHERE tso.tenant_id = v_tenant_id
      AND tso.standard_code IN ('ISO9001', 'ISO27001')
      AND tso.is_active = true
      AND op.is_active = true
    ORDER BY tso.standard_code, op.sort_order
  LOOP
    INSERT INTO public.standard_lifecycle_status (
      tenant_id,
      standard_code,
      operation_id,
      calculated_stage_code,
      confirmed_stage_code,
      effective_stage_code,
      pending_stage_code,
      pending_request_id,
      pending_requested_by,
      pending_requested_at,
      health_status,
      maturity_score,
      catalog_controls_count,
      enabled_controls_count,
      controls_enabled_pct,
      controls_with_evidence_count,
      evidence_coverage_pct,
      avg_health_score,
      open_nonconformities_count,
      open_findings_count,
      open_action_plans_count,
      open_audits_count,
      last_activity_at,
      last_snapshot_at,
      metrics_json,
      updated_at
    )
    VALUES (
      v_tenant_id,
      r.standard_code,
      r.operation_id,
      r.calculated_stage_code,
      r.confirmed_stage_code,
      r.confirmed_stage_code,
      NULL,
      NULL,
      NULL,
      NULL,
      r.health_status,
      r.maturity_score,
      20,
      14,
      70,
      8,
      r.evidence_coverage_pct,
      r.avg_health_score,
      1,
      1,
      3,
      1,
      now(),
      now(),
      jsonb_build_object(
        'demo_seed', 'sprint-7.1',
        'comment', CASE
          WHEN r.standard_code = 'ISO9001' THEN 'ISO 9001 en etapa Implementacion / Verificacion.'
          ELSE 'ISO 27001 en etapa Diagnostico / Tratamiento de Riesgos.'
        END
      ),
      now()
    )
    ON CONFLICT (tenant_id, standard_code, operation_id)
    DO UPDATE SET
      calculated_stage_code = EXCLUDED.calculated_stage_code,
      confirmed_stage_code = EXCLUDED.confirmed_stage_code,
      effective_stage_code = EXCLUDED.effective_stage_code,
      health_status = EXCLUDED.health_status,
      maturity_score = EXCLUDED.maturity_score,
      catalog_controls_count = EXCLUDED.catalog_controls_count,
      enabled_controls_count = EXCLUDED.enabled_controls_count,
      controls_enabled_pct = EXCLUDED.controls_enabled_pct,
      controls_with_evidence_count = EXCLUDED.controls_with_evidence_count,
      evidence_coverage_pct = EXCLUDED.evidence_coverage_pct,
      avg_health_score = EXCLUDED.avg_health_score,
      open_nonconformities_count = EXCLUDED.open_nonconformities_count,
      open_findings_count = EXCLUDED.open_findings_count,
      open_action_plans_count = EXCLUDED.open_action_plans_count,
      open_audits_count = EXCLUDED.open_audits_count,
      last_activity_at = EXCLUDED.last_activity_at,
      last_snapshot_at = EXCLUDED.last_snapshot_at,
      metrics_json = EXCLUDED.metrics_json,
      updated_at = now();

    IF to_regclass('public.standard_lifecycle_snapshots') IS NOT NULL THEN
      INSERT INTO public.standard_lifecycle_snapshots (
        tenant_id,
        standard_code,
        operation_id,
        calculated_stage_code,
        confirmed_stage_code,
        effective_stage_code,
        health_status,
        maturity_score,
        catalog_controls_count,
        enabled_controls_count,
        controls_enabled_pct,
        controls_with_evidence_count,
        evidence_coverage_pct,
        avg_health_score,
        open_nonconformities_count,
        open_findings_count,
        open_action_plans_count,
        open_audits_count,
        last_activity_at,
        snapshot_date,
        metrics_json
      )
      SELECT
        v_tenant_id,
        r.standard_code,
        r.operation_id,
        r.calculated_stage_code,
        r.confirmed_stage_code,
        r.confirmed_stage_code,
        r.health_status,
        r.maturity_score,
        20,
        14,
        70,
        8,
        r.evidence_coverage_pct,
        r.avg_health_score,
        1,
        1,
        3,
        1,
        now(),
        now(),
        jsonb_build_object('demo_seed', 'sprint-7.1')
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.standard_lifecycle_snapshots s
        WHERE s.tenant_id = v_tenant_id
          AND s.standard_code = r.standard_code
          AND s.operation_id = r.operation_id
          AND COALESCE(s.metrics_json->>'demo_seed', '') = 'sprint-7.1'
      );
    END IF;

    IF to_regclass('public.standard_lifecycle_stage_requests') IS NOT NULL THEN
      INSERT INTO public.standard_lifecycle_stage_requests (
        tenant_id,
        standard_code,
        operation_id,
        from_stage_code,
        to_stage_code,
        request_status,
        request_source,
        request_reason,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        review_comment,
        updated_at
      )
      SELECT
        v_tenant_id,
        r.standard_code,
        r.operation_id,
        r.calculated_stage_code,
        r.confirmed_stage_code,
        'confirmado',
        'demo_seed',
        CASE
          WHEN r.standard_code = 'ISO9001' THEN 'Movimiento demo hacia verificacion/auditoria por evidencias y auditoria interna activa.'
          ELSE 'Movimiento demo hacia tratamiento de riesgos por brechas de accesos, backups y proveedores cloud.'
        END,
        v_admin_id,
        now() - interval '3 days',
        v_auditor_id,
        now() - interval '2 days',
        'Confirmado para demostracion comercial Sprint 7.1.',
        now()
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.standard_lifecycle_stage_requests sr
        WHERE sr.tenant_id = v_tenant_id
          AND sr.standard_code = r.standard_code
          AND sr.operation_id = r.operation_id
          AND sr.request_source = 'demo_seed'
      );
    END IF;
  END LOOP;
END $$;

COMMIT;

\echo 'Seed demo comercial Sprint 7.1 completado.'
\echo 'Tenant: Empresa Demo TCDX Compliance'
\echo 'Usuarios demo: ejecutivo/admin/auditor/responsable.calidad/responsable.ti @tcdx.local'
