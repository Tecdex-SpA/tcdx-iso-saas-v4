const pool = require('../config/db');

const PLATFORM_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

const ALLOWED_DOCUMENT_TYPES = new Set([
  'policy',
  'procedure',
  'transition_guidance',
  'ai_governance_document',
  'security_document',
  'quality_document',
]);

const ISO9001_2026_DISCLAIMER =
  'ISO9001 2026_FDIS se usa solo como preparacion de transicion. No es version final certificable, no reemplaza ISO9001:2015 y no habilita certificacion final.';

function publicError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeRole(role) {
  return String(role || '').toLowerCase().trim();
}

function isPlatformRole(role) {
  return PLATFORM_ROLES.has(normalizeRole(role));
}

function getUserTenantId(user) {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    null
  );
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function normalizeStandardCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace('ISO/IEC', 'ISO')
    .replace('ISO-', 'ISO');
}

function normalizeVersionCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeDocumentType(value) {
  const type = String(value || '').trim().toLowerCase();

  if (!ALLOWED_DOCUMENT_TYPES.has(type)) {
    throw publicError(400, 'INVALID_DOCUMENT_TYPE', 'Tipo documental invalido');
  }

  return type;
}

function assertTenantAccess(user, tenantId) {
  const role = normalizeRole(user?.role || user?.user_role || user?.userRole);

  if (isPlatformRole(role)) return;

  if (String(getUserTenantId(user) || '') !== String(tenantId || '')) {
    throw publicError(403, 'TENANT_ACCESS_DENIED', 'No autorizado para este tenant');
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function section(key, title, content, sourceReference = {}) {
  return {
    section_key: key,
    section_title: title,
    section_content: String(content || '').trim(),
    source_reference: sourceReference,
  };
}

function bulletList(items) {
  return safeArray(items)
    .filter(Boolean)
    .map((item) => `- ${String(item).trim()}`)
    .join('\n');
}

function standardDomain(standardCode, versionCode) {
  if (standardCode === 'ISO27001') {
    return {
      noun: 'seguridad de la informacion',
      system: 'Sistema de Gestion de Seguridad de la Informacion',
      principles: [
        'Confidencialidad, integridad y disponibilidad de la informacion.',
        'Gestion de riesgos de seguridad con propietarios y tratamiento.',
        'Control de activos, accesos, proveedores, incidentes y continuidad.',
        'Declaracion de aplicabilidad coherente con riesgos y controles.',
      ],
      disclaimer: 'Documento base de apoyo al SGSI; debe revisarse contra contexto, riesgos y requisitos contractuales vigentes.',
    };
  }

  if (standardCode === 'ISO42001') {
    return {
      noun: 'gobernanza de inteligencia artificial',
      system: 'Sistema de Gestion de Inteligencia Artificial',
      principles: [
        'Inventario y clasificacion de sistemas de IA.',
        'Evaluacion de impacto, riesgos, datos, proveedores y supervision humana.',
        'Transparencia, trazabilidad, monitoreo de desempeno y sesgo.',
        'Uso responsable de IA generativa y control de cambios.',
      ],
      disclaimer: 'Documento base de gobernanza IA; debe ajustarse a sistemas IA reales, datos usados, riesgos e impactos sobre personas.',
    };
  }

  if (standardCode === 'ISO9001' && versionCode === '2026_FDIS') {
    return {
      noun: 'preparacion de transicion ISO9001',
      system: 'Sistema de Gestion de Calidad',
      principles: [
        'Mantener ISO9001:2015 como version certificable vigente.',
        'Documentar fuentes, supuestos, caveats y decisiones reversibles.',
        'Evaluar impactos preliminares sin activar certificacion final.',
        'Evitar crear controles operativos o compromisos finales sobre FDIS.',
      ],
      disclaimer: ISO9001_2026_DISCLAIMER,
    };
  }

  return {
    noun: 'gestion de calidad',
    system: 'Sistema de Gestion de Calidad',
    principles: [
      'Enfoque al cliente, procesos y mejora continua.',
      'Gestion de riesgos y oportunidades de calidad.',
      'Competencia, informacion documentada y control operacional.',
      'Evaluacion de desempeno, auditoria interna y revision por la direccion.',
    ],
    disclaimer: 'Documento base de apoyo al sistema de gestion; debe revisarse y aprobarse internamente antes de uso formal.',
  };
}

function templateAliases(standardCode, versionCode) {
  const aliases = new Map();

  if (standardCode === 'ISO9001' && versionCode === '2015') {
    aliases.set('quality_policy', 'POL-QMS-01');
    aliases.set('document_control_policy', 'POL-QMS-02');
    aliases.set('supplier_policy', 'POL-QMS-03');
    aliases.set('quality_risk_policy', 'POL-QMS-04');
    aliases.set('document_control_procedure', 'PRO-QMS-01');
    aliases.set('internal_audit_procedure', 'PRO-QMS-02');
    aliases.set('corrective_action_procedure', 'PRO-QMS-03');
    aliases.set('management_review_procedure', 'PRO-QMS-04');
  }

  aliases.set('iso9001_2026_transition_guidance', 'iso9001_2026_transition_guidance');
  aliases.set('iso42001_ai_governance', 'iso42001_ai_governance');
  aliases.set('iso27001_security_policy', 'iso27001_security_policy');
  aliases.set('iso27001_security_procedure', 'iso27001_security_procedure');

  return aliases;
}

function virtualTemplate({ standardCode, versionCode, documentType, templateCode }) {
  const domain = standardDomain(standardCode, versionCode);
  const code = String(templateCode || '').trim();

  if (standardCode === 'ISO9001' && versionCode === '2026_FDIS') {
    return {
      id: null,
      template_code: code || 'iso9001_2026_transition_guidance',
      title: 'Guia de preparacion de transicion ISO9001 2026_FDIS',
      objective: 'Gobernar la preparacion preliminar sin tratar FDIS como certificable.',
      scope_guidance: 'Aplicar a decisiones, documentos y procesos potencialmente afectados por cambios futuros.',
      related_control_codes: [],
      template_kind: 'virtual',
      document_type: 'transition_guidance',
    };
  }

  if (standardCode === 'ISO42001') {
    return {
      id: null,
      template_code: code || 'iso42001_ai_governance',
      title: 'Documento de gobernanza de IA',
      objective: 'Definir reglas base para inventario, riesgo, supervision y monitoreo de sistemas IA.',
      scope_guidance: 'Aplicar a sistemas IA internos, externos, modelos, datos, proveedores y usuarios relevantes.',
      related_control_codes: [],
      template_kind: 'virtual',
      document_type: documentType || 'ai_governance_document',
    };
  }

  if (standardCode === 'ISO27001') {
    const isProcedure = documentType === 'procedure' || code.includes('procedure');
    return {
      id: null,
      template_code: code || (isProcedure ? 'iso27001_security_procedure' : 'iso27001_security_policy'),
      title: isProcedure ? 'Procedimiento de seguridad de la informacion' : 'Politica de seguridad de la informacion',
      objective: isProcedure
        ? 'Gestionar actividades clave del SGSI, evidencias, responsables y controles.'
        : 'Definir compromisos de seguridad de la informacion y gestion de riesgos.',
      scope_guidance: 'Aplicar a activos, procesos, sistemas, personas, proveedores e informacion dentro del SGSI.',
      related_control_codes: [],
      template_kind: 'virtual',
      document_type: isProcedure ? 'procedure' : 'security_document',
    };
  }

  return {
    id: null,
    template_code: code || (documentType === 'procedure' ? 'default_procedure' : 'default_policy'),
    title: documentType === 'procedure' ? 'Procedimiento del sistema de gestion' : 'Politica del sistema de gestion',
    objective: `Definir lineamientos para ${domain.noun}.`,
    scope_guidance: `Aplicar al alcance definido para ${domain.system}.`,
    related_control_codes: [],
    template_kind: 'virtual',
    document_type: documentType,
  };
}

async function getTenant(tenantId) {
  const result = await pool.query(
    `
    SELECT id, name
    FROM tenants
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [tenantId]
  );

  if (!result.rowCount) {
    throw publicError(404, 'TENANT_NOT_FOUND', 'Tenant no encontrado');
  }

  return result.rows[0];
}

async function getStandardVersion(standardCode, versionCode) {
  const result = await pool.query(
    `
    SELECT
      id,
      standard_code,
      version_code,
      display_name,
      publication_status,
      certifiable,
      notes
    FROM iso_standard_versions
    WHERE standard_code = $1
      AND version_code = $2
      AND is_active = true
    LIMIT 1
    `,
    [standardCode, versionCode]
  );

  if (!result.rowCount) {
    throw publicError(404, 'ISO_VERSION_NOT_FOUND', 'Version ISO no encontrada');
  }

  return result.rows[0];
}

async function tenantHasStandard(tenantId, standardCode) {
  const result = await pool.query(
    `
    SELECT 1
    FROM tenant_standards
    WHERE tenant_id = $1::uuid
      AND standard_code = $2
      AND is_active IS DISTINCT FROM false
    LIMIT 1
    `,
    [tenantId, standardCode]
  );

  return result.rowCount > 0;
}

async function assertStandardAllowedForTenant({ tenantId, user, standardCode, versionCode, documentType }) {
  const platform = isPlatformRole(user?.role || user?.user_role || user?.userRole);

  if (standardCode === 'ISO9001' && versionCode === '2026_FDIS') {
    if (documentType !== 'transition_guidance') {
      throw publicError(
        400,
        'ISO9001_2026_TRANSITION_DOCUMENT_ONLY',
        'ISO9001 2026_FDIS solo permite documentos de preparacion/transicion'
      );
    }

    const has9001 = await tenantHasStandard(tenantId, 'ISO9001');
    if (!has9001) {
      throw publicError(400, 'ISO9001_REQUIRED_FOR_TRANSITION', 'El tenant debe tener ISO9001 activa para documentos de transicion');
    }
    return;
  }

  const active = await tenantHasStandard(tenantId, standardCode);
  if (!active && !(platform && standardCode === 'ISO42001')) {
    throw publicError(400, 'TENANT_STANDARD_NOT_ACTIVE', 'La norma no esta activa para este tenant');
  }
}

async function latestAssessment(tenantId, standardCode, versionCode) {
  const result = await pool.query(
    `
    SELECT id, readiness_score, readiness_level, summary_json, created_at
    FROM iso_express_assessments
    WHERE tenant_id = $1::uuid
      AND standard_code = $2
      AND version_code = $3
      AND assessment_status IS DISTINCT FROM 'archived'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [tenantId, standardCode, versionCode]
  );

  return result.rows[0] || null;
}

async function listOptions(tenantId, user, filters = {}) {
  assertTenantAccess(user, tenantId);

  const standardFilter = filters.standard_code ? normalizeStandardCode(filters.standard_code) : null;
  const versionFilter = filters.version_code ? normalizeVersionCode(filters.version_code) : null;
  const documentType = filters.document_type ? normalizeDocumentType(filters.document_type) : null;

  const result = await pool.query(
    `
    SELECT
      ts.tenant_id,
      ts.standard_code,
      v.version_code,
      v.display_name,
      v.publication_status,
      v.certifiable,
      COALESCE(c.coverage_pct, 0)::numeric AS catalog_coverage_pct,
      COALESCE(s.sync_status, 'not_started') AS sync_status,
      (
        SELECT COUNT(*)::integer
        FROM iso_policy_templates p
        WHERE p.standard_code = v.standard_code
          AND p.version_code = v.version_code
          AND p.is_active IS DISTINCT FROM false
      ) AS policy_templates_count,
      (
        SELECT COUNT(*)::integer
        FROM iso_procedure_templates p
        WHERE p.standard_code = v.standard_code
          AND p.version_code = v.version_code
          AND p.is_active IS DISTINCT FROM false
      ) AS procedure_templates_count
    FROM tenant_standards ts
    JOIN iso_standard_versions v
      ON v.standard_code = ts.standard_code
     AND v.is_active = true
    LEFT JOIN v_iso_control_catalog_coverage c
      ON c.standard_code = v.standard_code
     AND c.version_code = v.version_code
    LEFT JOIN iso_catalog_sync_status s
      ON s.standard_code = v.standard_code
     AND s.version_code = v.version_code
     AND s.sync_target = 'controls_catalog'
    WHERE ts.tenant_id = $1::uuid
      AND ts.is_active IS DISTINCT FROM false
      AND ($2::text IS NULL OR v.standard_code = $2)
      AND ($3::text IS NULL OR v.version_code = $3)
    ORDER BY
      CASE
        WHEN v.standard_code = 'ISO9001' AND v.version_code = '2015' THEN 1
        WHEN v.standard_code = 'ISO27001' THEN 2
        WHEN v.standard_code = 'ISO42001' THEN 3
        WHEN v.version_code = '2026_FDIS' THEN 4
        ELSE 9
      END,
      v.standard_code,
      v.version_code
    `,
    [tenantId, standardFilter, versionFilter]
  );

  let rows = result.rows;

  const hasIso9001 = await tenantHasStandard(tenantId, 'ISO9001');
  if (
    hasIso9001 &&
    (!standardFilter || standardFilter === 'ISO9001') &&
    (!versionFilter || versionFilter === '2026_FDIS') &&
    !rows.some((row) => row.standard_code === 'ISO9001' && row.version_code === '2026_FDIS')
  ) {
    const fdis = await pool.query(
      `
      SELECT
        $1::uuid AS tenant_id,
        v.standard_code,
        v.version_code,
        v.display_name,
        v.publication_status,
        v.certifiable,
        COALESCE(c.coverage_pct, 0)::numeric AS catalog_coverage_pct,
        COALESCE(s.sync_status, 'not_started') AS sync_status,
        0::integer AS policy_templates_count,
        0::integer AS procedure_templates_count
      FROM iso_standard_versions v
      LEFT JOIN v_iso_control_catalog_coverage c
        ON c.standard_code = v.standard_code
       AND c.version_code = v.version_code
      LEFT JOIN iso_catalog_sync_status s
        ON s.standard_code = v.standard_code
       AND s.version_code = v.version_code
       AND s.sync_target = 'controls_catalog'
      WHERE v.standard_code = 'ISO9001'
        AND v.version_code = '2026_FDIS'
        AND v.is_active = true
      `,
      [tenantId]
    );
    rows = rows.concat(fdis.rows);
  }

  const enriched = [];
  for (const row of rows) {
    const assessment = await latestAssessment(tenantId, row.standard_code, row.version_code);
    enriched.push({
      tenant_id: row.tenant_id,
      standard_code: row.standard_code,
      version_code: row.version_code,
      display_name: row.display_name,
      publication_status: row.publication_status,
      certifiable: row.certifiable,
      catalog_coverage_pct: Number(row.catalog_coverage_pct || 0),
      sync_status: row.sync_status,
      policy_templates_count: Number(row.policy_templates_count || 0),
      procedure_templates_count: Number(row.procedure_templates_count || 0),
      latest_assessment: assessment,
      warnings: documentWarnings({
        standardCode: row.standard_code,
        versionCode: row.version_code,
        certifiable: row.certifiable,
        coveragePct: Number(row.catalog_coverage_pct || 0),
      }),
    });
  }

  return documentType
    ? enriched.map((row) => ({ ...row, requested_document_type: documentType }))
    : enriched;
}

function documentWarnings({ standardCode, versionCode, certifiable, coveragePct }) {
  const warnings = [];

  if (standardCode === 'ISO9001' && versionCode === '2026_FDIS') {
    warnings.push(ISO9001_2026_DISCLAIMER);
  }

  if (standardCode === 'ISO42001' && coveragePct <= 0) {
    warnings.push('ISO42001 puede generar documentos base de gobierno IA, pero requiere revision humana por baja cobertura operativa.');
  }

  if (coveragePct < 30) {
    warnings.push('Cobertura operativa baja: usar el documento como borrador preliminar.');
  } else if (coveragePct < 80) {
    warnings.push('Cobertura operativa parcial: revisar brechas antes de aprobacion formal.');
  }

  if (!certifiable) {
    warnings.push('Version no certificable: no usar como evidencia de certificacion final.');
  }

  return Array.from(new Set(warnings));
}

async function listTemplates(tenantId, user, filters = {}) {
  assertTenantAccess(user, tenantId);

  const standardCode = normalizeStandardCode(filters.standard_code);
  const versionCode = normalizeVersionCode(filters.version_code);
  const documentType = filters.document_type ? normalizeDocumentType(filters.document_type) : null;

  if (!standardCode || !versionCode) {
    throw publicError(400, 'STANDARD_VERSION_REQUIRED', 'standard_code y version_code son requeridos');
  }

  const policyPromise = documentType && documentType !== 'policy'
    ? Promise.resolve({ rows: [] })
    : pool.query(
      `
      SELECT
        id,
        'policy' AS document_type,
        template_code,
        title,
        objective,
        scope_guidance,
        sections_json,
        variables_json,
        related_control_codes,
        'database' AS template_kind
      FROM iso_policy_templates
      WHERE standard_code = $1
        AND version_code = $2
        AND is_active IS DISTINCT FROM false
      ORDER BY template_code
      `,
      [standardCode, versionCode]
    );

  const procedurePromise = documentType && documentType !== 'procedure'
    ? Promise.resolve({ rows: [] })
    : pool.query(
      `
      SELECT
        id,
        'procedure' AS document_type,
        template_code,
        title,
        objective,
        scope_guidance,
        steps_json,
        roles_json,
        records_json,
        related_control_codes,
        'database' AS template_kind
      FROM iso_procedure_templates
      WHERE standard_code = $1
        AND version_code = $2
        AND is_active IS DISTINCT FROM false
      ORDER BY template_code
      `,
      [standardCode, versionCode]
    );

  const [policies, procedures] = await Promise.all([policyPromise, procedurePromise]);
  const rows = policies.rows.concat(procedures.rows);

  const virtuals = [];
  if (standardCode === 'ISO9001' && versionCode === '2026_FDIS' && (!documentType || documentType === 'transition_guidance')) {
    virtuals.push(virtualTemplate({ standardCode, versionCode, documentType: 'transition_guidance', templateCode: 'iso9001_2026_transition_guidance' }));
  }
  if (standardCode === 'ISO42001' && (!documentType || documentType === 'ai_governance_document')) {
    virtuals.push(virtualTemplate({ standardCode, versionCode, documentType: 'ai_governance_document', templateCode: 'iso42001_ai_governance' }));
  }
  if (standardCode === 'ISO27001' && rows.length === 0) {
    if (!documentType || documentType === 'security_document' || documentType === 'policy') {
      virtuals.push(virtualTemplate({ standardCode, versionCode, documentType: 'security_document', templateCode: 'iso27001_security_policy' }));
    }
    if (!documentType || documentType === 'procedure') {
      virtuals.push(virtualTemplate({ standardCode, versionCode, documentType: 'procedure', templateCode: 'iso27001_security_procedure' }));
    }
  }
  if (standardCode === 'ISO9001' && versionCode === '2015' && documentType === 'quality_document' && rows.length === 0) {
    virtuals.push(virtualTemplate({ standardCode, versionCode, documentType: 'quality_document', templateCode: 'iso9001_quality_document' }));
  }

  return rows.concat(virtuals);
}

async function resolveTemplate({ standardCode, versionCode, documentType, templateCode }) {
  const requested = String(templateCode || '').trim();
  const aliases = templateAliases(standardCode, versionCode);
  const effectiveCode = aliases.get(requested) || requested;

  const policyTypes = new Set(['policy', 'quality_document', 'security_document', 'ai_governance_document']);
  if (policyTypes.has(documentType)) {
    const policy = await pool.query(
      `
      SELECT
        id,
        'policy' AS document_type,
        template_code,
        title,
        objective,
        scope_guidance,
        sections_json,
        variables_json,
        related_control_codes,
        'database' AS template_kind
      FROM iso_policy_templates
      WHERE standard_code = $1
        AND version_code = $2
        AND template_code = $3
        AND is_active IS DISTINCT FROM false
      LIMIT 1
      `,
      [standardCode, versionCode, effectiveCode]
    );
    if (policy.rowCount) return policy.rows[0];
  }

  if (documentType === 'procedure') {
    const procedure = await pool.query(
      `
      SELECT
        id,
        'procedure' AS document_type,
        template_code,
        title,
        objective,
        scope_guidance,
        steps_json,
        roles_json,
        records_json,
        related_control_codes,
        'database' AS template_kind
      FROM iso_procedure_templates
      WHERE standard_code = $1
        AND version_code = $2
        AND template_code = $3
        AND is_active IS DISTINCT FROM false
      LIMIT 1
      `,
      [standardCode, versionCode, effectiveCode]
    );
    if (procedure.rowCount) return procedure.rows[0];
  }

  return virtualTemplate({
    standardCode,
    versionCode,
    documentType,
    templateCode: effectiveCode || requested,
  });
}

async function fetchDocumentContext({ tenantId, standardCode, versionCode, assessmentId }) {
  const [controls, evidence, gaps, assessment] = await Promise.all([
    pool.query(
      `
      SELECT control_code, title, domain, default_priority, owner_role_suggested
      FROM iso_controls
      WHERE standard_code = $1
        AND version_code = $2
        AND is_active IS DISTINCT FROM false
      ORDER BY control_code
      LIMIT 40
      `,
      [standardCode, versionCode]
    ),
    pool.query(
      `
      SELECT control_code, evidence_name, evidence_type, required_level
      FROM iso_evidence_expectations
      WHERE standard_code = $1
        AND version_code = $2
      ORDER BY control_code, evidence_name
      LIMIT 40
      `,
      [standardCode, versionCode]
    ),
    assessmentId
      ? pool.query(
        `
        SELECT gap_type, severity, title, recommendation, control_code
        FROM iso_express_assessment_gaps
        WHERE assessment_id = $1::uuid
          AND tenant_id = $2::uuid
        ORDER BY
          CASE severity
            WHEN 'critica' THEN 1
            WHEN 'alta' THEN 2
            WHEN 'media' THEN 3
            ELSE 4
          END,
          created_at
        LIMIT 12
        `,
        [assessmentId, tenantId]
      )
      : Promise.resolve({ rows: [] }),
    assessmentId
      ? pool.query(
        `
        SELECT id, readiness_score, readiness_level, summary_json, standard_code, version_code
        FROM iso_express_assessments
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
        LIMIT 1
        `,
        [assessmentId, tenantId]
      )
      : latestAssessment(tenantId, standardCode, versionCode).then((row) => ({ rows: row ? [row] : [] })),
  ]);

  return {
    controls: controls.rows,
    evidence_expectations: evidence.rows,
    assessment_gaps: gaps.rows,
    assessment: assessment.rows[0] || null,
  };
}

function buildPolicySections({ tenant, version, template, variables, context, documentType }) {
  const domain = standardDomain(version.standard_code, version.version_code);
  const scope = String(variables.scope || template.scope_guidance || `Alcance definido para ${domain.system}`).trim();
  const controls = context.controls.slice(0, 10);
  const evidence = context.evidence_expectations.slice(0, 10);
  const gaps = context.assessment_gaps.slice(0, 8);
  const responsibilities = safeArray(variables.responsible_roles);

  return [
    section('objective', '1. Objetivo', template.objective || `Establecer lineamientos para ${domain.noun}.`),
    section('scope', '2. Alcance', `Esta politica aplica a ${scope} de ${tenant.name}.`),
    section('internal_references', '3. Referencias internas', [
      `${version.display_name} como referencia normativa del documento.`,
      context.assessment ? `Diagnostico express ${context.assessment.id} con nivel ${context.assessment.readiness_level || 'sin nivel'}.` : 'Base de conocimiento ISO versionada y plantillas gobernadas.',
    ].join('\n')),
    section('responsibilities', '4. Roles y responsabilidades', responsibilities.length
      ? bulletList(responsibilities)
      : bulletList(['Direccion', 'Responsable de cumplimiento', 'Duenos de proceso', 'Auditor interno'])),
    section('principles', '5. Principios de cumplimiento', bulletList(domain.principles)),
    section('rules', '6. Reglas principales', bulletList(
      controls.length
        ? controls.map((control) => `${control.control_code}: ${control.title}`)
        : ['Mantener controles, responsables, evidencias y revision periodica del sistema.']
    )),
    section('evidence', '7. Evidencias requeridas', bulletList(
      evidence.length
        ? evidence.map((item) => `${item.control_code}: ${item.evidence_name} (${item.required_level})`)
        : ['Politica aprobada', 'Registros de comunicacion', 'Revision periodica']
    )),
    section('monitoring', '8. Seguimiento y revision', context.assessment
      ? `El documento debe revisarse considerando readiness ${context.assessment.readiness_score || 0} y brechas abiertas del diagnostico express.`
      : 'El documento debe revisarse al menos anualmente o ante cambios relevantes.'),
    section('improvement', '9. Mejora continua', gaps.length
      ? bulletList(gaps.map((gap) => `${gap.severity}: ${gap.title}. ${gap.recommendation || ''}`))
      : 'Las oportunidades de mejora deben registrarse, priorizarse y revisarse por la direccion.'),
    section('document_control', '10. Control documental', 'Este documento debe tener propietario, version, fecha de revision, registro de aprobacion y control de cambios.'),
    section('disclaimer', 'Disclaimer', documentType === 'transition_guidance' ? ISO9001_2026_DISCLAIMER : domain.disclaimer),
  ];
}

function buildProcedureSections({ tenant, version, template, variables, context }) {
  const domain = standardDomain(version.standard_code, version.version_code);
  const scope = String(variables.scope || template.scope_guidance || `Alcance definido para ${domain.system}`).trim();
  const controls = context.controls.slice(0, 10);
  const evidence = context.evidence_expectations.slice(0, 10);
  const gaps = context.assessment_gaps.slice(0, 8);
  const steps = safeArray(template.steps_json).length
    ? safeArray(template.steps_json)
    : ['Planificar actividad', 'Ejecutar control', 'Registrar evidencia', 'Revisar resultado', 'Cerrar acciones'];
  const roles = safeArray(template.roles_json).length
    ? safeArray(template.roles_json)
    : safeArray(variables.responsible_roles);

  return [
    section('objective', '1. Objetivo', template.objective || `Definir actividades para operar ${domain.noun}.`),
    section('scope', '2. Alcance', `Este procedimiento aplica a ${scope} de ${tenant.name}.`),
    section('inputs', '3. Entradas', bulletList([
      version.display_name,
      'Alcance del sistema de gestion',
      context.assessment ? `Diagnostico express ${context.assessment.id}` : 'Plantilla ISO gobernada',
      ...controls.slice(0, 4).map((control) => `${control.control_code}: ${control.title}`),
    ])),
    section('responsibles', '4. Responsables', roles.length
      ? bulletList(roles)
      : bulletList(['Responsable de cumplimiento', 'Dueno de proceso', 'Ejecutor del control', 'Auditor interno'])),
    section('steps', '5. Actividades paso a paso', steps.map((step, index) => `${index + 1}. ${step}`).join('\n')),
    section('records', '6. Registros/evidencias', bulletList(
      evidence.length
        ? evidence.map((item) => `${item.control_code}: ${item.evidence_name}`)
        : safeArray(template.records_json).length
          ? safeArray(template.records_json)
          : ['Registro de ejecucion', 'Evidencia revisada', 'Informe de resultado']
    )),
    section('indicators', '7. Indicadores sugeridos', bulletList([
      'Porcentaje de controles con evidencia vigente.',
      'Brechas abiertas por severidad.',
      'Tiempo promedio de cierre de acciones.',
      'Cumplimiento de frecuencia de revision.',
    ])),
    section('risks_controls', '8. Riesgos y controles asociados', gaps.length
      ? bulletList(gaps.map((gap) => `${gap.title}: ${gap.recommendation || 'Revisar y tratar.'}`))
      : bulletList(controls.slice(0, 8).map((control) => `${control.control_code}: ${control.title}`))),
    section('review_frequency', '9. Frecuencia de revision', 'Revisar al menos anualmente, ante incidentes, cambios de alcance o cambios regulatorios relevantes.'),
    section('change_control', '10. Control de cambios', 'Todo cambio debe registrar version, fecha, responsable, motivo, aprobacion y comunicacion a usuarios afectados.'),
    section('disclaimer', 'Disclaimer', domain.disclaimer),
  ];
}

function sectionsToMarkdown(title, sections) {
  const body = sections
    .map((item) => `## ${item.section_title}\n${item.section_content}`)
    .join('\n\n');

  return `# ${title}\n\n${body}\n`;
}

function buildDocument({ tenant, version, template, variables, context, documentType, language }) {
  const domain = standardDomain(version.standard_code, version.version_code);
  const title = template.title || (documentType === 'procedure' ? `Procedimiento ${version.display_name}` : `Politica ${version.display_name}`);
  const effectiveTitle = `${title} - ${tenant.name}`;
  const sections = documentType === 'procedure'
    ? buildProcedureSections({ tenant, version, template, variables, context })
    : buildPolicySections({ tenant, version, template, variables, context, documentType });
  const contentMarkdown = sectionsToMarkdown(effectiveTitle, sections);

  return {
    title: effectiveTitle,
    sections,
    content_markdown: contentMarkdown,
    content_json: {
      language,
      standard: version.display_name,
      template_code: template.template_code,
      sections: sections.map((item) => ({
        key: item.section_key,
        title: item.section_title,
      })),
    },
    disclaimer: documentType === 'transition_guidance' ? ISO9001_2026_DISCLAIMER : domain.disclaimer,
  };
}

async function nextDocumentVersion({ tenantId, standardCode, versionCode, documentType, templateCode }) {
  const result = await pool.query(
    `
    SELECT COALESCE(MAX(version), 0)::integer + 1 AS next_version
    FROM iso_generated_documents
    WHERE tenant_id = $1::uuid
      AND standard_code = $2
      AND version_code = $3
      AND document_type = $4
      AND COALESCE(template_code, '') = COALESCE($5::text, '')
    `,
    [tenantId, standardCode, versionCode, documentType, templateCode || null]
  );

  return Number(result.rows[0]?.next_version || 1);
}

async function generateDocument({ tenantId, user, payload = {}, regenerateFromDocumentId = null }) {
  assertTenantAccess(user, tenantId);

  const standardCode = normalizeStandardCode(payload.standard_code);
  const versionCode = normalizeVersionCode(payload.version_code);
  const documentType = normalizeDocumentType(payload.document_type || 'policy');
  const templateCode = String(payload.template_code || '').trim();
  const language = String(payload.language || 'es').trim().slice(0, 8) || 'es';
  const variables = payload.variables && typeof payload.variables === 'object' ? payload.variables : {};
  const sourceAssessmentId = payload.source_assessment_id || null;

  const [tenant, version] = await Promise.all([
    getTenant(tenantId),
    getStandardVersion(standardCode, versionCode),
  ]);

  await assertStandardAllowedForTenant({ tenantId, user, standardCode, versionCode, documentType });

  const template = await resolveTemplate({
    standardCode,
    versionCode,
    documentType,
    templateCode,
  });
  const context = await fetchDocumentContext({
    tenantId,
    standardCode,
    versionCode,
    assessmentId: sourceAssessmentId,
  });

  if (sourceAssessmentId && !context.assessment) {
    throw publicError(404, 'ASSESSMENT_NOT_FOUND', 'Diagnostico express no encontrado para este tenant');
  }

  const generated = buildDocument({
    tenant,
    version,
    template,
    variables,
    context,
    documentType,
    language,
  });
  const docVersion = await nextDocumentVersion({
    tenantId,
    standardCode,
    versionCode,
    documentType,
    templateCode: template.template_code,
  });
  const sourceTrace = {
    standard_code: standardCode,
    version_code: versionCode,
    publication_status: version.publication_status,
    certifiable: version.certifiable === true,
    template_kind: template.template_kind || 'database',
    template_code: template.template_code,
    source_assessment_id: sourceAssessmentId,
    use_ai_requested: payload.use_ai === true,
    ai_used: false,
    fdis_transition_only: standardCode === 'ISO9001' && versionCode === '2026_FDIS',
    warnings: documentWarnings({
      standardCode,
      versionCode,
      certifiable: version.certifiable,
      coveragePct: Number(context.assessment?.summary_json?.coverage_pct || 0),
    }),
  };
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const run = await client.query(
      `
      INSERT INTO iso_document_generation_runs (
        tenant_id, standard_code, version_code, document_type, template_code,
        source_assessment_id, requested_by, status, ai_used, request_payload, result_summary
      )
      VALUES ($1::uuid,$2,$3,$4,$5,$6::uuid,$7::uuid,'success',false,$8::jsonb,$9::jsonb)
      RETURNING *
      `,
      [
        tenantId,
        standardCode,
        versionCode,
        documentType,
        template.template_code,
        sourceAssessmentId,
        getUserId(user),
        JSON.stringify({
          standard_code: standardCode,
          version_code: versionCode,
          document_type: documentType,
          template_code: templateCode,
          source_assessment_id: sourceAssessmentId,
          regenerate_from_document_id: regenerateFromDocumentId,
          use_ai: payload.use_ai === true,
        }),
        JSON.stringify({
          title: generated.title,
          sections_count: generated.sections.length,
          version: docVersion,
          ai_used: false,
        }),
      ]
    );

    const documentInsert = await client.query(
      `
      INSERT INTO iso_generated_documents (
        tenant_id, standard_code, version_code, document_type, template_code, template_id,
        source_assessment_id, title, document_status, version, language, generated_by,
        content_markdown, content_json, variables_json, source_trace_json, ai_used, disclaimer
      )
      VALUES (
        $1::uuid,$2,$3,$4,$5,$6::uuid,$7::uuid,$8,'generated',$9,$10,$11::uuid,
        $12,$13::jsonb,$14::jsonb,$15::jsonb,false,$16
      )
      RETURNING *
      `,
      [
        tenantId,
        standardCode,
        versionCode,
        documentType,
        template.template_code,
        template.id,
        sourceAssessmentId,
        generated.title,
        docVersion,
        language,
        getUserId(user),
        generated.content_markdown,
        JSON.stringify(generated.content_json),
        JSON.stringify(variables),
        JSON.stringify({ ...sourceTrace, generation_run_id: run.rows[0].id }),
        generated.disclaimer,
      ]
    );
    const document = documentInsert.rows[0];

    for (let index = 0; index < generated.sections.length; index += 1) {
      const item = generated.sections[index];
      await client.query(
        `
        INSERT INTO iso_generated_document_sections (
          document_id, tenant_id, section_order, section_key, section_title,
          section_content, source_type, source_reference
        )
        VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,'template',$7::jsonb)
        `,
        [
          document.id,
          tenantId,
          index + 1,
          item.section_key,
          item.section_title,
          item.section_content,
          JSON.stringify(item.source_reference || {}),
        ]
      );
    }

    await client.query(
      `
      INSERT INTO iso_document_audit_log (
        document_id, tenant_id, action, actor_user_id, new_data, metadata
      )
      VALUES ($1::uuid,$2::uuid,'generate',$3::uuid,$4::jsonb,$5::jsonb)
      `,
      [
        document.id,
        tenantId,
        getUserId(user),
        JSON.stringify({
          title: document.title,
          version: document.version,
          document_type: document.document_type,
        }),
        JSON.stringify({
          generation_run_id: run.rows[0].id,
          regenerate_from_document_id: regenerateFromDocumentId,
        }),
      ]
    );

    await client.query('COMMIT');

    return {
      document,
      sections: generated.sections,
      generation_run: run.rows[0],
      markdown_preview: generated.content_markdown,
      source_trace: { ...sourceTrace, generation_run_id: run.rows[0].id },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listDocuments(tenantId, user, filters = {}) {
  assertTenantAccess(user, tenantId);

  const where = ['tenant_id = $1::uuid'];
  const values = [tenantId];

  if (filters.standard_code) {
    values.push(normalizeStandardCode(filters.standard_code));
    where.push(`standard_code = $${values.length}`);
  }
  if (filters.version_code) {
    values.push(normalizeVersionCode(filters.version_code));
    where.push(`version_code = $${values.length}`);
  }
  if (filters.document_type) {
    values.push(normalizeDocumentType(filters.document_type));
    where.push(`document_type = $${values.length}`);
  }
  if (filters.status) {
    values.push(String(filters.status).trim());
    where.push(`document_status = $${values.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      id,
      tenant_id,
      standard_code,
      version_code,
      document_type,
      template_code,
      source_assessment_id,
      title,
      document_status,
      version,
      language,
      ai_used,
      disclaimer,
      created_at,
      updated_at,
      archived_at
    FROM iso_generated_documents
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT 100
    `,
    values
  );

  return result.rows;
}

async function getDocumentDetail(tenantId, documentId, user) {
  assertTenantAccess(user, tenantId);

  const documentResult = await pool.query(
    `
    SELECT *
    FROM iso_generated_documents
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
    LIMIT 1
    `,
    [documentId, tenantId]
  );

  if (!documentResult.rowCount) {
    throw publicError(404, 'DOCUMENT_NOT_FOUND', 'Documento no encontrado');
  }

  const sections = await pool.query(
    `
    SELECT *
    FROM iso_generated_document_sections
    WHERE document_id = $1::uuid
      AND tenant_id = $2::uuid
    ORDER BY section_order
    `,
    [documentId, tenantId]
  );

  return {
    document: documentResult.rows[0],
    sections: sections.rows,
    source_trace: documentResult.rows[0].source_trace_json || {},
  };
}

async function archiveDocument(tenantId, documentId, user) {
  assertTenantAccess(user, tenantId);

  const result = await pool.query(
    `
    UPDATE iso_generated_documents
    SET document_status = 'archived',
        archived_at = now(),
        archived_by = $3::uuid,
        updated_at = now()
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
      AND document_status IS DISTINCT FROM 'archived'
    RETURNING *
    `,
    [documentId, tenantId, getUserId(user)]
  );

  if (!result.rowCount) {
    throw publicError(404, 'DOCUMENT_NOT_FOUND', 'Documento no encontrado o ya archivado');
  }

  await pool.query(
    `
    INSERT INTO iso_document_audit_log (
      document_id, tenant_id, action, actor_user_id, new_data
    )
    VALUES ($1::uuid,$2::uuid,'archive',$3::uuid,$4::jsonb)
    `,
    [
      documentId,
      tenantId,
      getUserId(user),
      JSON.stringify({ document_status: 'archived' }),
    ]
  );

  return result.rows[0];
}

async function regenerateDocument(tenantId, documentId, user, body = {}) {
  const detail = await getDocumentDetail(tenantId, documentId, user);
  const document = detail.document;

  return generateDocument({
    tenantId,
    user,
    payload: {
      standard_code: document.standard_code,
      version_code: document.version_code,
      document_type: document.document_type,
      template_code: document.template_code,
      source_assessment_id: body.source_assessment_id || document.source_assessment_id,
      language: body.language || document.language,
      variables: body.variables || document.variables_json || {},
      use_ai: false,
    },
    regenerateFromDocumentId: documentId,
  });
}

async function getSummary(tenantId, user) {
  assertTenantAccess(user, tenantId);

  const result = await pool.query(
    `
    SELECT *
    FROM v_iso_document_summary_by_tenant
    WHERE tenant_id = $1::uuid
    ORDER BY standard_code, version_code
    `,
    [tenantId]
  );

  return result.rows;
}

module.exports = {
  listOptions,
  listTemplates,
  generateDocument,
  regenerateDocument,
  listDocuments,
  getDocumentDetail,
  archiveDocument,
  getSummary,
};
