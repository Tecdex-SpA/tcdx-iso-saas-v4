-- ============================================================
-- TCDX Compliance SaaS - Sprint 7.1B Demo Maturity Patch
-- Base esperada: tecdex_saas
-- Tenant objetivo: Empresa Demo TCDX Compliance
-- Fecha: 2026-06-09
--
-- ADVERTENCIA:
-- - Ejecutar solo si se desea madurar el tenant demo comercial.
-- - Complementa database/demo/demo_comercial_tcdx.sql.
-- - No crea un segundo tenant.
-- - Aborta si el tenant demo no existe.
-- - No ejecuta operaciones destructivas ni borrados.
-- - No modifica estructura, constraints ni migraciones.
-- - Opera solo con tenant_id del tenant demo.
-- - Inserta metadata documental; no crea archivos fisicos.
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  v_tenant_id uuid;
  v_has_asset_risk_cols boolean := false;
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Tabla public.tenants no existe. Patch demo abortado.';
  END IF;

  SELECT id
    INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
  ORDER BY created_at NULLS LAST, id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant demo Empresa Demo TCDX Compliance no existe. Ejecutar primero el seed base.';
  END IF;
END $$;

DO $$
DECLARE
  v_tenant_id uuid;
  v_has_controls_cols boolean := false;
  v_has_evidence_cols boolean := false;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
  LIMIT 1;

  IF to_regclass('public.tenant_controls') IS NULL
     OR to_regclass('public.controls_catalog') IS NULL
     OR to_regclass('public.tenant_standard_operations') IS NULL
     OR to_regclass('public.tenant_operations') IS NULL THEN
    RAISE NOTICE 'Se omite madurez de controles: faltan tablas operativas.';
    RETURN;
  END IF;

  SELECT COUNT(*) = 10 INTO v_has_controls_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'tenant_controls'
    AND column_name = ANY (ARRAY[
      'id',
      'tenant_id',
      'control_id',
      'operation_id',
      'status',
      'score',
      'health_status',
      'applicability',
      'priority',
      'updated_at'
    ]);

  IF NOT v_has_controls_cols THEN
    RAISE NOTICE 'Se omite UPDATE de tenant_controls: columnas requeridas no confirmadas.';
    RETURN;
  END IF;

  WITH scoped_controls AS (
    SELECT
      tc.id,
      cc.iso,
      row_number() OVER (
        PARTITION BY cc.iso
        ORDER BY
          op.sort_order NULLS LAST,
          cc.clause NULLS LAST,
          cc.category NULLS LAST,
          cc.description NULLS LAST,
          tc.id
      ) AS rn,
      count(*) OVER (PARTITION BY cc.iso) AS total
    FROM public.tenant_controls tc
    JOIN public.controls_catalog cc
      ON cc.id = tc.control_id
    JOIN public.tenant_standard_operations tso
      ON tso.tenant_id = tc.tenant_id
     AND tso.operation_id = tc.operation_id
     AND tso.standard_code = cc.iso
     AND tso.is_active = true
    JOIN public.tenant_operations op
      ON op.id = tc.operation_id
     AND op.tenant_id = tc.tenant_id
     AND op.is_active = true
    WHERE tc.tenant_id = v_tenant_id
      AND cc.iso IN ('ISO9001', 'ISO27001')
  ),
  scored_controls AS (
    SELECT
      id,
      iso,
      rn,
      total,
      CASE
        WHEN iso = 'ISO9001' AND rn <= ceil(total * 0.70) THEN 'cumple'
        WHEN iso = 'ISO9001' AND rn <= ceil(total * 0.88) THEN 'parcial'
        WHEN iso = 'ISO9001' AND rn <= ceil(total * 0.94) THEN 'no cumple'
        WHEN iso = 'ISO27001' AND rn <= ceil(total * 0.58) THEN 'cumple'
        WHEN iso = 'ISO27001' AND rn <= ceil(total * 0.80) THEN 'parcial'
        WHEN iso = 'ISO27001' AND rn <= ceil(total * 0.90) THEN 'no cumple'
        ELSE 'pendiente'
      END AS next_status,
      CASE
        WHEN iso = 'ISO9001' AND rn <= ceil(total * 0.70) THEN 88
        WHEN iso = 'ISO9001' AND rn <= ceil(total * 0.88) THEN 66
        WHEN iso = 'ISO9001' AND rn <= ceil(total * 0.94) THEN 38
        WHEN iso = 'ISO27001' AND rn <= ceil(total * 0.58) THEN 82
        WHEN iso = 'ISO27001' AND rn <= ceil(total * 0.80) THEN 62
        WHEN iso = 'ISO27001' AND rn <= ceil(total * 0.90) THEN 35
        ELSE 8
      END AS next_score,
      CASE
        WHEN iso = 'ISO9001' AND rn <= ceil(total * 0.70) THEN 'saludable'
        WHEN iso = 'ISO9001' AND rn <= ceil(total * 0.88) THEN 'atencion'
        WHEN iso = 'ISO27001' AND rn <= ceil(total * 0.58) THEN 'saludable'
        WHEN iso = 'ISO27001' AND rn <= ceil(total * 0.80) THEN 'atencion'
        ELSE 'deteriorado'
      END AS next_health,
      CASE
        WHEN iso = 'ISO9001' AND rn <= ceil(total * 0.70) THEN 'media'
        WHEN iso = 'ISO27001' AND rn <= ceil(total * 0.58) THEN 'media'
        ELSE 'alta'
      END AS next_priority
    FROM scoped_controls
  )
  UPDATE public.tenant_controls tc
  SET
    status = sc.next_status,
    score = sc.next_score,
    health_status = sc.next_health,
    applicability = 'aplicable',
    priority = sc.next_priority,
    updated_at = now()
  FROM scored_controls sc
  WHERE tc.id = sc.id
    AND tc.tenant_id = v_tenant_id;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_controls'
      AND column_name = 'metadata'
  ) THEN
    UPDATE public.tenant_controls tc
    SET metadata = COALESCE(tc.metadata, '{}'::jsonb)
      || jsonb_build_object('demo_maturity_patch', 'sprint-7.1B')
    WHERE tc.tenant_id = v_tenant_id;
  END IF;

  IF to_regclass('public.evidences') IS NULL THEN
    RAISE NOTICE 'Se omite creacion de evidencias de madurez: evidences no existe.';
    RETURN;
  END IF;

  SELECT COUNT(*) = 13 INTO v_has_evidence_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'evidences'
    AND column_name = ANY (ARRAY[
      'id',
      'tenant_id',
      'control_id',
      'tenant_control_id',
      'description',
      'file_name',
      'file_path',
      'file_mime_type',
      'file_size_bytes',
      'status',
      'validated',
      'evidence_type',
      'metadata'
    ]);

  IF NOT v_has_evidence_cols THEN
    RAISE NOTICE 'Se omite INSERT de evidencias: columnas requeridas no confirmadas.';
    RETURN;
  END IF;

  WITH scoped_controls AS (
    SELECT
      tc.id AS tenant_control_id,
      tc.control_id,
      tc.status,
      cc.iso,
      cc.clause,
      cc.category,
      cc.description AS control_description,
      row_number() OVER (
        PARTITION BY cc.iso
        ORDER BY
          CASE
            WHEN tc.status = 'cumple' THEN 1
            WHEN tc.status = 'parcial' THEN 2
            WHEN tc.status = 'no cumple' THEN 3
            ELSE 4
          END,
          tc.score DESC NULLS LAST,
          tc.id
      ) AS rn,
      count(*) OVER (PARTITION BY cc.iso) AS total
    FROM public.tenant_controls tc
    JOIN public.controls_catalog cc
      ON cc.id = tc.control_id
    JOIN public.tenant_standard_operations tso
      ON tso.tenant_id = tc.tenant_id
     AND tso.operation_id = tc.operation_id
     AND tso.standard_code = cc.iso
     AND tso.is_active = true
    JOIN public.tenant_operations op
      ON op.id = tc.operation_id
     AND op.tenant_id = tc.tenant_id
     AND op.is_active = true
    WHERE tc.tenant_id = v_tenant_id
      AND cc.iso IN ('ISO9001', 'ISO27001')
  ),
  target_evidence AS (
    SELECT
      *,
      CASE
        WHEN status IN ('cumple', 'parcial') THEN 'aprobada'
        WHEN rn <= ceil(total * 0.92) THEN 'pendiente'
        ELSE NULL
      END AS evidence_status
    FROM scoped_controls
    WHERE status IN ('cumple', 'parcial', 'no cumple')
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
    te.control_id,
    te.tenant_control_id,
    concat(
      'Evidencia madurez demo ',
      te.iso,
      ' #',
      te.rn,
      ' - ',
      left(COALESCE(te.category, te.clause, te.control_description, 'control'), 120)
    ),
    concat('madurez-demo-', lower(te.iso), '-', lpad(te.rn::text, 3, '0'), '.pdf'),
    NULL,
    'application/pdf',
    NULL,
    te.evidence_status,
    te.evidence_status = 'aprobada',
    'documento_demo',
    jsonb_build_object(
      'demo_seed', 'sprint-7.1',
      'demo_maturity_patch', 'sprint-7.1B',
      'standard_code', te.iso,
      'tenant_control_id', te.tenant_control_id,
      'official_evidence', te.evidence_status = 'aprobada',
      'storage_note', 'Metadata demo sin archivo fisico'
    )
  FROM target_evidence te
  WHERE te.evidence_status IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.evidences e
      WHERE e.tenant_id = v_tenant_id
        AND e.tenant_control_id = te.tenant_control_id
        AND COALESCE(e.metadata->>'demo_maturity_patch', '') = 'sprint-7.1B'
    );
END $$;

DO $$
DECLARE
  v_tenant_id uuid;
  v_admin_id uuid;
  v_integration_id uuid;
  v_source_id uuid;
  v_has_doc_cols boolean := false;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
  LIMIT 1;

  SELECT id INTO v_admin_id
  FROM public.users
  WHERE lower(email) = 'admin.demo@tcdx.local'
  LIMIT 1;

  IF to_regclass('public.tenant_integrations') IS NULL
     OR to_regclass('public.tenant_document_sources') IS NULL
     OR to_regclass('public.document_index') IS NULL
     OR to_regclass('public.evidences') IS NULL THEN
    RAISE NOTICE 'Se omite biblioteca documental de madurez: faltan tablas.';
    RETURN;
  END IF;

  SELECT COUNT(*) = 19 INTO v_has_doc_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'document_index'
    AND column_name = ANY (ARRAY[
      'id',
      'tenant_id',
      'source_id',
      'integration_id',
      'provider',
      'provider_file_id',
      'provider_version_id',
      'file_name',
      'mime_type',
      'file_extension',
      'file_url',
      'web_view_url',
      'size_bytes',
      'checksum',
      'modified_at',
      'indexed_at',
      'last_seen_at',
      'status',
      'metadata_json'
    ]);

  IF NOT v_has_doc_cols THEN
    RAISE NOTICE 'Se omite document_index: columnas requeridas no confirmadas.';
    RETURN;
  END IF;

  SELECT id INTO v_integration_id
  FROM public.tenant_integrations
  WHERE tenant_id = v_tenant_id
    AND provider = 'sharepoint'
    AND display_name = 'Repositorio documental demo TCDX - madurez'
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
      'Repositorio documental demo TCDX - madurez',
      v_admin_id,
      jsonb_build_object('demo_maturity_patch', 'sprint-7.1B', 'note', 'Fuente demo sin credenciales'),
      now(),
      now()
    )
    RETURNING id INTO v_integration_id;
  END IF;

  SELECT id INTO v_source_id
  FROM public.tenant_document_sources
  WHERE tenant_id = v_tenant_id
    AND provider = 'sharepoint'
    AND source_name = 'Biblioteca documental demo madurez'
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
      'Biblioteca documental demo madurez',
      'demo-sprint-7-1b',
      '/Demo Comercial TCDX/Madurez',
      false,
      'manual',
      v_admin_id,
      jsonb_build_object('demo_maturity_patch', 'sprint-7.1B', 'storage_note', 'Metadata demo sin archivos fisicos'),
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
    'demo-maturity-7-1b:' || md5(e.id::text),
    'v1',
    COALESCE(e.file_name, 'evidencia-madurez-' || left(e.id::text, 8) || '.pdf'),
    COALESCE(e.file_mime_type, 'application/pdf'),
    CASE WHEN COALESCE(e.file_name, '') LIKE '%.xlsx' THEN 'xlsx' ELSE 'pdf' END,
    NULL,
    NULL,
    e.file_size_bytes,
    md5(e.tenant_id::text || ':' || e.id::text),
    now(),
    now(),
    now(),
    CASE
      WHEN row_number() OVER (ORDER BY e.created_at NULLS LAST, e.id) % 5 = 0 THEN 'indexed'
      ELSE 'analyzed'
    END,
    jsonb_build_object(
      'demo_seed', 'sprint-7.1',
      'demo_maturity_patch', 'sprint-7.1B',
      'source', 'metadata_only',
      'evidence_id', e.id,
      'standard_code', e.metadata->>'standard_code',
      'storage_note', 'No existe archivo fisico asociado al patch'
    )
  FROM public.evidences e
  WHERE e.tenant_id = v_tenant_id
    AND COALESCE(e.metadata->>'demo_maturity_patch', '') = 'sprint-7.1B'
    AND NOT EXISTS (
      SELECT 1
      FROM public.document_index di
      WHERE di.tenant_id = v_tenant_id
        AND di.provider = 'sharepoint'
        AND di.provider_file_id = 'demo-maturity-7-1b:' || md5(e.id::text)
    );

  IF to_regclass('public.tenant_evidence_semantic_profiles') IS NOT NULL THEN
    INSERT INTO public.tenant_evidence_semantic_profiles (
      tenant_id,
      source_type,
      source_id,
      document_key,
      document_type,
      semantic_status,
      usefulness_score,
      classification_confidence,
      classification_method,
      classification_reason,
      scoring_json,
      metadata,
      processed_by_user_id,
      processed_at,
      created_at,
      updated_at
    )
    SELECT
      di.tenant_id,
      'document_index',
      di.id,
      di.provider || ':' || di.provider_file_id,
      COALESCE(di.metadata_json->>'standard_code', 'unknown'),
      CASE WHEN di.status = 'analyzed' THEN 'processed' ELSE 'not_processed' END,
      CASE WHEN di.status = 'analyzed' THEN 0.84 ELSE 0.42 END,
      CASE WHEN di.status = 'analyzed' THEN 0.82 ELSE 0.35 END,
      'demo_rule_based',
      'Perfil semantico demo para biblioteca comercial madura.',
      jsonb_build_object('demo_maturity_patch', 'sprint-7.1B'),
      jsonb_build_object('demo_maturity_patch', 'sprint-7.1B'),
      CASE WHEN di.status = 'analyzed' THEN v_admin_id ELSE NULL END,
      CASE WHEN di.status = 'analyzed' THEN now() ELSE NULL END,
      now(),
      now()
    FROM public.document_index di
    WHERE di.tenant_id = v_tenant_id
      AND COALESCE(di.metadata_json->>'demo_maturity_patch', '') = 'sprint-7.1B'
    ON CONFLICT (tenant_id, source_type, source_id)
    DO UPDATE SET
      semantic_status = EXCLUDED.semantic_status,
      usefulness_score = EXCLUDED.usefulness_score,
      classification_confidence = EXCLUDED.classification_confidence,
      classification_method = EXCLUDED.classification_method,
      classification_reason = EXCLUDED.classification_reason,
      scoring_json = EXCLUDED.scoring_json,
      metadata = EXCLUDED.metadata,
      processed_by_user_id = EXCLUDED.processed_by_user_id,
      processed_at = EXCLUDED.processed_at,
      updated_at = now();
  END IF;

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
     AND di.provider_file_id = 'demo-maturity-7-1b:' || md5(e.id::text)
    WHERE e.tenant_id = v_tenant_id
      AND COALESCE(e.metadata->>'demo_maturity_patch', '') = 'sprint-7.1B'
      AND NOT EXISTS (
        SELECT 1
        FROM public.evidence_document_links l
        WHERE l.evidence_id = e.id
          AND l.document_id = di.id
      );
  END IF;
END $$;

DO $$
DECLARE
  v_tenant_id uuid;
  v_has_action_cols boolean := false;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
  LIMIT 1;

  IF to_regclass('public.action_plans') IS NULL THEN
    RAISE NOTICE 'Se omite madurez de action_plans: tabla no existe.';
    RETURN;
  END IF;

  SELECT COUNT(*) = 13 INTO v_has_action_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'action_plans'
    AND column_name = ANY (ARRAY[
      'tenant_id',
      'iso_code',
      'title',
      'description',
      'source_type',
      'source_id',
      'priority',
      'status',
      'owner',
      'due_date',
      'created_by',
      'tenant_control_id',
      'approval_status'
    ]);

  IF NOT v_has_action_cols THEN
    RAISE NOTICE 'Se omite action_plans: columnas requeridas no confirmadas.';
    RETURN;
  END IF;

  WITH action_seed AS (
    SELECT *
    FROM (
      VALUES
        ('ISO27001', 'Ejecutar revisión trimestral de accesos.', 'Recertificacion ejecutada parcialmente; falta evidencia de dos perfiles privilegiados.', 'alta', 'Responsable TI', 'en progreso', CURRENT_DATE + 10, 'risk', 'pendiente_aprobacion'),
        ('ISO9001', 'Cargar evidencia de satisfacción de clientes.', 'Resultados consolidados cargados; queda pendiente analisis de tendencia trimestral.', 'media', 'Responsable Calidad', 'en progreso', CURRENT_DATE + 18, 'manual', 'no_requerida'),
        ('ISO9001', 'Formalizar evaluación de proveedores críticos.', 'Evaluacion anual completada para proveedores principales.', 'media', 'Responsable Calidad', 'completado', CURRENT_DATE - 2, 'risk', 'aprobada'),
        ('ISO27001', 'Actualizar inventario de activos de información.', 'Inventario actualizado en 80%; falta propietario para activos de integraciones.', 'alta', 'Responsable TI', 'en progreso', CURRENT_DATE + 24, 'risk', 'no_requerida'),
        ('ISO27001', 'Ejecutar prueba de restauración.', 'Prueba vencida; se mantiene como brecha prioritaria del SGSI.', 'alta', 'Responsable TI', 'abierto', CURRENT_DATE - 5, 'risk', 'no_requerida'),
        ('ISO9001', 'Cerrar acciones correctivas pendientes.', 'Acciones antiguas cerradas; una verificacion de eficacia queda vencida.', 'alta', 'Responsable Calidad', 'abierto', CURRENT_DATE - 3, 'manual', 'no_requerida'),
        ('ISO9001', 'Actualizar matriz de riesgos ISO 9001.', 'Matriz de riesgos de calidad actualizada y aprobada.', 'media', 'Responsable Calidad', 'completado', CURRENT_DATE - 8, 'manual', 'aprobada'),
        ('ISO27001', 'Actualizar matriz de riesgos ISO 27001.', 'Matriz actualizada con tratamiento de accesos, backups y proveedor cloud.', 'alta', 'Responsable TI', 'completado', CURRENT_DATE - 6, 'risk', 'aprobada'),
        ('ISO9001', 'Publicar tablero mensual de objetivos de calidad.', 'Tablero ejecutivo con objetivos, reclamos y satisfaccion.', 'media', 'Responsable Calidad', 'completado', CURRENT_DATE - 1, 'manual', 'aprobada'),
        ('ISO27001', 'Completar evaluación de proveedor cloud crítico.', 'Evaluacion de seguridad en curso; pendiente revision contractual.', 'alta', 'Responsable TI', 'en progreso', CURRENT_DATE + 12, 'risk', 'no_requerida')
    ) AS rows(iso_code, title, description, priority, owner, status, due_date, source_type, approval_status)
  ),
  resolved_seed AS (
    SELECT
      s.*,
      cp_any.tenant_control_id AS tenant_control_id
    FROM action_seed s
    LEFT JOIN LATERAL (
      SELECT tc.id AS tenant_control_id
      FROM public.tenant_controls tc
      JOIN public.controls_catalog cc
        ON cc.id = tc.control_id
      WHERE tc.tenant_id = v_tenant_id
        AND cc.iso = s.iso_code
      ORDER BY tc.score ASC NULLS LAST, tc.id
      LIMIT 1
    ) cp_any ON true
  ),
  updated AS (
    UPDATE public.action_plans ap
    SET
      iso_code = rs.iso_code,
      description = rs.description,
      priority = rs.priority,
      owner = rs.owner,
      status = rs.status,
      due_date = rs.due_date,
      source_type = rs.source_type,
      tenant_control_id = rs.tenant_control_id,
      approval_status = rs.approval_status
    FROM resolved_seed rs
    WHERE ap.tenant_id = v_tenant_id
      AND lower(ap.title) = lower(rs.title)
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
    rs.iso_code,
    rs.title,
    rs.description,
    rs.source_type,
    NULL,
    rs.priority,
    rs.status,
    rs.owner,
    rs.due_date,
    (SELECT id FROM public.users WHERE lower(email) = 'admin.demo@tcdx.local' LIMIT 1),
    rs.tenant_control_id,
    rs.approval_status
  FROM resolved_seed rs
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.action_plans ap
    WHERE ap.tenant_id = v_tenant_id
      AND lower(ap.title) = lower(rs.title)
  );
END $$;

DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
  LIMIT 1;

  SELECT COUNT(*) = 5 INTO v_has_asset_risk_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'asset_risks'
    AND column_name = ANY (ARRAY['asset_id', 'risk', 'impact', 'probability', 'level']);

  IF to_regclass('public.assets') IS NOT NULL
     AND to_regclass('public.asset_risks') IS NOT NULL
     AND v_has_asset_risk_cols THEN
    UPDATE public.asset_risks ar
    SET
      impact = CASE
        WHEN a.iso = 'ISO9001' THEN
          CASE
            WHEN ar.risk ILIKE '%acciones correctivas%' THEN 'Impacto moderado controlado por seguimiento mensual.'
            ELSE 'Impacto acotado por evidencia y controles de gestion disponibles.'
          END
        WHEN ar.risk ILIKE '%Backups sin prueba%' THEN 'Impacto critico por continuidad hasta ejecutar prueba documentada.'
        WHEN ar.risk ILIKE '%Proveedor cloud%' THEN 'Impacto alto por dependencia de tercero critico.'
        ELSE 'Impacto medio-alto gestionado mediante plan de tratamiento.'
      END,
      probability = CASE
        WHEN a.iso = 'ISO9001' THEN 'media'
        WHEN ar.risk ILIKE '%Backups sin prueba%' THEN 'alta'
        WHEN ar.risk ILIKE '%Proveedor cloud%' THEN 'alta'
        ELSE 'media'
      END,
      level = CASE
        WHEN a.iso = 'ISO9001' AND ar.risk ILIKE '%acciones correctivas%' THEN 'medio'
        WHEN a.iso = 'ISO9001' THEN 'bajo'
        WHEN ar.risk ILIKE '%Backups sin prueba%' THEN 'critico'
        WHEN ar.risk ILIKE '%Proveedor cloud%' THEN 'alto'
        WHEN ar.risk ILIKE '%Accesos sin revisión%' THEN 'alto'
        ELSE 'medio'
      END
    FROM public.assets a
    WHERE ar.asset_id = a.id
      AND a.tenant_id = v_tenant_id;
  ELSE
    RAISE NOTICE 'Se omite balance de asset_risks: faltan tablas o columnas.';
  END IF;

  IF to_regclass('public.iso_risk_matrix_items') IS NOT NULL THEN
    UPDATE public.iso_risk_matrix_items i
    SET
      residual_risk_level = CASE
        WHEN i.standard_code = 'ISO9001' AND i.risk_title ILIKE '%acciones correctivas%' THEN 'medio'
        WHEN i.standard_code = 'ISO9001' THEN 'bajo'
        WHEN i.risk_title ILIKE '%Backups sin prueba%' THEN 'critico'
        WHEN i.risk_title ILIKE '%Proveedor cloud%' THEN 'alto'
        WHEN i.risk_title ILIKE '%Accesos sin revisión%' THEN 'alto'
        ELSE 'medio'
      END,
      residual_risk_score = CASE
        WHEN i.standard_code = 'ISO9001' AND i.risk_title ILIKE '%acciones correctivas%' THEN 8
        WHEN i.standard_code = 'ISO9001' THEN 4
        WHEN i.risk_title ILIKE '%Backups sin prueba%' THEN 18
        WHEN i.risk_title ILIKE '%Proveedor cloud%' THEN 14
        WHEN i.risk_title ILIKE '%Accesos sin revisión%' THEN 12
        ELSE 8
      END,
      status = 'accepted',
      updated_at = now()
    WHERE i.tenant_id = v_tenant_id
      AND i.standard_code IN ('ISO9001', 'ISO27001')
      AND COALESCE(i.source_trace_json->>'demo_seed', '') = 'sprint-7.1';
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

  IF to_regclass('public.iso_express_assessment_gaps') IS NOT NULL THEN
    UPDATE public.iso_express_assessment_gaps g
    SET
      severity = CASE
        WHEN g.title ILIKE '%restauración%' THEN 'critica'
        WHEN g.title ILIKE '%permisos%' THEN 'alta'
        WHEN g.title ILIKE '%proveedor cloud%' THEN 'alta'
        WHEN g.title ILIKE '%inventario%' THEN 'media'
        ELSE 'media'
      END,
      metadata = COALESCE(g.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'demo_maturity_patch', 'sprint-7.1B',
          'commercial_state',
          CASE
            WHEN g.title ILIKE '%satisfacción%' THEN 'en_tratamiento'
            WHEN g.title ILIKE '%acciones correctivas%' THEN 'cerrada_comercialmente'
            ELSE 'abierta'
          END
        )
    WHERE g.tenant_id = v_tenant_id
      AND COALESCE(g.metadata->>'demo_seed', '') = 'sprint-7.1';

    IF to_regclass('public.iso_express_assessments') IS NOT NULL THEN
      UPDATE public.iso_express_assessments a
      SET
        readiness_score = CASE WHEN a.standard_code = 'ISO9001' THEN 74 ELSE 63 END,
        readiness_level = CASE WHEN a.standard_code = 'ISO9001' THEN 'medio_alto' ELSE 'medio' END,
        maturity_score = CASE WHEN a.standard_code = 'ISO9001' THEN 74 ELSE 63 END,
        risk_score = CASE WHEN a.standard_code = 'ISO9001' THEN 42 ELSE 61 END,
        updated_at = now()
      WHERE a.tenant_id = v_tenant_id
        AND a.standard_code IN ('ISO9001', 'ISO27001')
        AND COALESCE(a.summary_json->>'demo_seed', '') = 'sprint-7.1';
    END IF;
  ELSE
    RAISE NOTICE 'Se omite madurez de brechas: iso_express_assessment_gaps no existe.';
  END IF;
END $$;

DO $$
DECLARE
  v_tenant_id uuid;
  v_auditor_id uuid;
  v_findings_nullable boolean := false;
  v_has_findings_cols boolean := false;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(name) = lower('Empresa Demo TCDX Compliance')
  LIMIT 1;

  SELECT id INTO v_auditor_id
  FROM public.users
  WHERE lower(email) = 'auditor.demo@tcdx.local'
  LIMIT 1;

  IF to_regclass('public.findings') IS NULL THEN
    RAISE NOTICE 'Se omite madurez de findings: tabla no existe.';
    RETURN;
  END IF;

  SELECT COUNT(*) = 12 INTO v_has_findings_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'findings'
    AND column_name = ANY (ARRAY[
      'tenant_id',
      'iso_code',
      'title',
      'description',
      'finding_type',
      'severity',
      'status',
      'source_type',
      'created_by',
      'created_at',
      'updated_at',
      'tenant_control_id'
    ]);

  SELECT is_nullable = 'YES' INTO v_findings_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'findings'
    AND column_name = 'tenant_control_id'
  LIMIT 1;

  IF NOT v_has_findings_cols THEN
    RAISE NOTICE 'Se omite findings: columnas requeridas no confirmadas.';
    RETURN;
  END IF;

  UPDATE public.findings f
  SET
    finding_type = 'observacion',
    updated_at = now()
  WHERE f.tenant_id = v_tenant_id
    AND lower(COALESCE(f.finding_type, '')) = replace('no conformidad', ' ', '_');

  IF v_findings_nullable THEN
    UPDATE public.findings f
    SET
      tenant_control_id = NULL,
      updated_at = now()
    WHERE f.tenant_id = v_tenant_id
      AND lower(COALESCE(f.title, '')) IN (
        lower('Hallazgo menor ISO 9001 - trazabilidad de acciones correctivas'),
        lower('Hallazgo mayor ISO 27001 - prueba de restauración no documentada'),
        lower('Observación ISO 27001 - revisión de permisos parcial'),
        lower('Oportunidad de mejora - automatizar evidencia de satisfacción')
      );
  ELSE
    RAISE NOTICE 'findings.tenant_control_id no permite NULL; se omite creacion de findings demo desde patch.';
    RETURN;
  END IF;

  WITH finding_seed AS (
    SELECT *
    FROM (
      VALUES
        ('ISO9001', 'Hallazgo menor ISO 9001 - trazabilidad de acciones correctivas', 'Seguimiento de eficacia pendiente en una accion correctiva vencida.', 'observacion', 'media', 'accion definida'),
        ('ISO27001', 'Observación ISO 27001 - revisión de permisos parcial', 'La recertificacion de accesos cubre usuarios generales, pero no todos los privilegios administrativos.', 'observacion', 'media', 'abierto'),
        ('ISO9001', 'Oportunidad de mejora - automatizar evidencia de satisfacción', 'Automatizar consolidacion mensual de encuestas y reclamos para revision por la direccion.', 'oportunidad de mejora', 'baja', 'abierto')
    ) AS rows(iso_code, title, description, finding_type, severity, status)
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
    created_by,
    created_at,
    updated_at
  )
  SELECT
    v_tenant_id,
    fs.iso_code,
    fs.title,
    fs.description,
    fs.finding_type,
    fs.severity,
    fs.status,
    'manual',
    v_auditor_id,
    now(),
    now()
  FROM finding_seed fs
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.findings f
    WHERE f.tenant_id = v_tenant_id
      AND lower(f.title) = lower(fs.title)
  );
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

  IF to_regclass('public.audits') IS NOT NULL THEN
    UPDATE public.audits a
    SET
      status = CASE
        WHEN a.iso = 'ISO9001' THEN 'en_ejecucion'
        WHEN a.iso = 'ISO27001' THEN 'pendiente'
        ELSE a.status
      END
    WHERE a.tenant_id = v_tenant_id
      AND a.iso IN ('ISO9001', 'ISO27001');
  END IF;

  IF to_regclass('public.standard_lifecycle_status') IS NULL
     OR to_regclass('public.tenant_standard_operations') IS NULL
     OR to_regclass('public.tenant_operations') IS NULL THEN
    RAISE NOTICE 'Se omite lifecycle: faltan tablas.';
    RETURN;
  END IF;

  WITH lifecycle_seed AS (
    SELECT DISTINCT ON (tso.standard_code)
      tso.standard_code,
      tso.operation_id,
      CASE WHEN tso.standard_code = 'ISO9001' THEN 'verificacion_auditoria' ELSE 'implementacion' END AS stage_code,
      CASE WHEN tso.standard_code = 'ISO9001' THEN 'saludable' ELSE 'atencion' END AS health_status,
      CASE WHEN tso.standard_code = 'ISO9001' THEN 78 ELSE 68 END AS maturity_score,
      CASE WHEN tso.standard_code = 'ISO9001' THEN 76 ELSE 64 END AS evidence_coverage_pct,
      CASE WHEN tso.standard_code = 'ISO9001' THEN 78 ELSE 68 END AS avg_health_score
    FROM public.tenant_standard_operations tso
    JOIN public.tenant_operations op
      ON op.id = tso.operation_id
     AND op.tenant_id = tso.tenant_id
     AND op.is_active = true
    WHERE tso.tenant_id = v_tenant_id
      AND tso.standard_code IN ('ISO9001', 'ISO27001')
      AND tso.is_active = true
    ORDER BY tso.standard_code, op.sort_order NULLS LAST, op.name
  )
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
  SELECT
    v_tenant_id,
    ls.standard_code,
    ls.operation_id,
    ls.stage_code,
    ls.stage_code,
    ls.stage_code,
    NULL,
    NULL,
    NULL,
    NULL,
    ls.health_status,
    ls.maturity_score,
    20,
    17,
    85,
    14,
    ls.evidence_coverage_pct,
    ls.avg_health_score,
    CASE WHEN ls.standard_code = 'ISO9001' THEN 0 ELSE 1 END,
    CASE WHEN ls.standard_code = 'ISO9001' THEN 1 ELSE 1 END,
    CASE WHEN ls.standard_code = 'ISO9001' THEN 2 ELSE 4 END,
    1,
    now(),
    now(),
    jsonb_build_object(
      'demo_maturity_patch', 'sprint-7.1B',
      'comment',
      CASE
        WHEN ls.standard_code = 'ISO9001' THEN 'ISO 9001 en Verificacion / Auditoria con implementacion avanzada.'
        ELSE 'ISO 27001 en Implementacion / Tratamiento de Riesgos con verificacion parcial.'
      END
    ),
    now()
  FROM lifecycle_seed ls
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

  IF to_regclass('public.standard_lifecycle_stage_requests') IS NOT NULL THEN
    WITH lifecycle_seed AS (
      SELECT DISTINCT ON (tso.standard_code)
        tso.standard_code,
        tso.operation_id,
        CASE WHEN tso.standard_code = 'ISO9001' THEN 'implementacion' ELSE 'diagnostico' END AS from_stage,
        CASE WHEN tso.standard_code = 'ISO9001' THEN 'verificacion_auditoria' ELSE 'implementacion' END AS to_stage
      FROM public.tenant_standard_operations tso
      JOIN public.tenant_operations op
        ON op.id = tso.operation_id
       AND op.tenant_id = tso.tenant_id
       AND op.is_active = true
      WHERE tso.tenant_id = v_tenant_id
        AND tso.standard_code IN ('ISO9001', 'ISO27001')
        AND tso.is_active = true
      ORDER BY tso.standard_code, op.sort_order NULLS LAST, op.name
    )
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
      ls.standard_code,
      ls.operation_id,
      ls.from_stage,
      ls.to_stage,
      'confirmado',
      'demo_maturity_patch',
      CASE
        WHEN ls.standard_code = 'ISO9001' THEN 'Avance demo hacia verificacion por cobertura documental madura.'
        ELSE 'Avance demo hacia implementacion por tratamiento de riesgos y evidencias parciales.'
      END,
      v_admin_id,
      now() - interval '1 day',
      v_auditor_id,
      now(),
      'Confirmado por patch de madurez comercial Sprint 7.1B.',
      now()
    FROM lifecycle_seed ls
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.standard_lifecycle_stage_requests sr
      WHERE sr.tenant_id = v_tenant_id
        AND sr.standard_code = ls.standard_code
        AND sr.operation_id = ls.operation_id
        AND sr.request_source = 'demo_maturity_patch'
    );
  END IF;
END $$;

COMMIT;

\echo 'Patch de madurez demo Sprint 7.1B completado.'
\echo 'Tenant: Empresa Demo TCDX Compliance'
