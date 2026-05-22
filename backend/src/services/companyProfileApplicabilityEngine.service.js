'use strict';

const crypto = require('crypto');
const pool = require('../config/db');
const aiContextBuilder = require('./aiContextBuilder.service');

const MODULE_SOURCE = 'profile_engine';

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function lower(value) {
  return String(value || '').toLowerCase();
}

function normalizeText(value) {
  return lower(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.:\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniq(items = [], limit = 50) {
  const seen = new Set();
  const out = [];
  for (const item of asArray(items).flat()) {
    const value = typeof item === 'string' ? item.trim() : item;
    const key = typeof value === 'string' ? normalizeText(value) : JSON.stringify(value || {});
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function containsAny(value, terms = []) {
  const text = normalizeText(value);
  return terms.some((term) => text.includes(normalizeText(term)));
}

function jsonHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex');
}

function profileJson(profile = {}) {
  return safeObject(profile.profile_json || {});
}

function normalizeProfile(row = {}) {
  const json = profileJson(row);
  return {
    tenant_id: row.tenant_id || null,
    industry: row.industry || json.industry || '',
    subindustry: row.subindustry || json.subindustry || '',
    company_size: row.company_size || json.company_size || json.employee_count_range || '',
    maturity_level: row.maturity_level || json.current_maturity_level || json.maturity_level || '',
    risk_appetite: row.risk_appetite || json.risk_appetite || '',
    active_standards: uniq(json.active_standards || json.target_standards || []),
    declared_scope: {
      audit_scope: json.audit_scope || '',
      excluded_scope: json.excluded_scope || '',
      business_model: json.business_model || '',
      main_products_services: json.main_products_services || [],
      locations: json.countries || json.locations || [],
    },
    critical_processes: uniq(json.critical_processes || json.key_processes || []),
    excluded_operations: uniq([
      ...(asArray(json.excluded_scope)),
      ...(asArray(json.excluded_operations)),
      ...(asArray(json.out_of_scope_operations)),
    ], 20),
    services: uniq([
      ...(asArray(json.main_products_services)),
      ...(asArray(json.services)),
      json.business_model,
    ], 20),
    known_weaknesses: uniq([
      ...(asArray(json.known_weaknesses)),
      ...(asArray(json.pain_points)),
      ...(asArray(json.improvement_priorities)),
    ], 20),
  };
}

function isTechProfile(profile) {
  return containsAny(`${profile.industry} ${profile.subindustry} ${profile.services.join(' ')}`, [
    'tecnolog',
    'software',
    'servicios ti',
    'it services',
    'cloud',
    'saas',
    'datacenter',
    'ciber',
    'infraestructura',
  ]);
}

function isFoodProfile(profile) {
  return containsAny(`${profile.industry} ${profile.subindustry} ${profile.services.join(' ')}`, [
    'alimento',
    'food',
    'agro',
    'inocuidad',
    'restaurante',
    'produccion aliment',
  ]);
}

function isManufacturingProfile(profile) {
  return containsAny(`${profile.industry} ${profile.subindustry} ${profile.services.join(' ')}`, [
    'manufact',
    'fabrica',
    'produccion fisica',
    'industrial',
    'planta',
    'logistica',
  ]);
}

function hasStandard(profile, code) {
  const standards = asArray(profile.active_standards).join(' ');
  return containsAny(standards, [code]);
}

function controlHaystack(row = {}) {
  return [
    row.control_code,
    row.control_name,
    row.description,
    row.category,
    row.clause,
    row.standard_code,
    row.primary_standard_code,
    row.valid_for_standards,
  ].join(' ');
}

function kpiHaystack(row = {}) {
  return [
    row.kpi_code,
    row.kpi_name,
    row.name,
    row.description,
    row.category,
    row.applicable_standards,
  ].join(' ');
}

function standardMatches(activeStandards, rowStandards = []) {
  const active = new Set(asArray(activeStandards).map((item) => lower(item)));
  const rowCodes = asArray(rowStandards).map((item) => lower(item)).filter(Boolean);
  if (!rowCodes.length) return true;
  return rowCodes.some((code) => active.has(code));
}

function explicitExclusionReason(profile, text) {
  const exclusions = asArray(profile.excluded_operations);
  const matched = exclusions.find((item) => item && containsAny(text, [item]));
  if (matched) return `Excluido por alcance declarado: ${matched}`;

  if (isTechProfile(profile) && containsAny(text, [
    'inocuidad',
    'alimento',
    'agricola',
    'produccion fisica',
    'calibracion metrologica',
    'laboratorio fisico',
    'trazabilidad de producto fisico',
  ])) {
    return 'No aplicable al perfil tecnológico/servicios TI declarado.';
  }

  if (!isFoodProfile(profile) && containsAny(text, ['inocuidad', 'haccp', 'alimento', 'produccion alimentaria'])) {
    return 'No aplicable: industria alimentaria/inocuidad fuera del perfil declarado.';
  }

  if (!isManufacturingProfile(profile) && containsAny(text, ['calibracion', 'metrolog', 'linea de produccion', 'maquinaria industrial'])) {
    return 'No aplicable: manufactura/calibración física fuera del perfil declarado.';
  }

  return null;
}

function classifyControl(row, profile, activeStandards) {
  const text = controlHaystack(row);
  const rowStandards = uniq([
    row.standard_code,
    row.primary_standard_code,
    ...(asArray(row.valid_for_standards)),
  ], 10);

  if (!standardMatches(activeStandards, rowStandards)) {
    return {
      applicable: false,
      score: 0.05,
      priority: 'baja',
      reason: 'Norma no activa para el tenant.',
      drivers: { active_standards: activeStandards, row_standards: rowStandards },
    };
  }

  const explicitReason = explicitExclusionReason(profile, text);
  if (explicitReason) {
    return {
      applicable: false,
      score: 0.15,
      priority: 'baja',
      reason: explicitReason,
      drivers: { profile_industry: profile.industry, excluded_operations: profile.excluded_operations },
    };
  }

  let score = row.tenant_control_id ? 0.62 : 0.45;
  const reasons = [];
  const drivers = {
    active_standards: activeStandards,
    profile_industry: profile.industry,
    maturity_level: profile.maturity_level,
    risk_appetite: profile.risk_appetite,
  };

  if (containsAny(text, ['document', 'registro', 'informacion documentada', 'alcance', 'objetivo', 'revision por la direccion'])) {
    score += 0.16;
    reasons.push('Control base de gobierno ISO y trazabilidad.');
  }
  if (containsAny(text, ['accion correctiva', 'no conform', 'hallazgo', 'auditoria interna'])) {
    score += 0.16;
    reasons.push('Relevante para cierre de brechas, auditoría y mejora continua.');
  }
  if (isTechProfile(profile) || hasStandard(profile, '27001')) {
    if (containsAny(text, ['acceso', 'seguridad', 'incidente', 'continuidad', 'backup', 'respaldo', 'cambio', 'proveedor', 'activo', 'vulnerabilidad'])) {
      score += 0.25;
      reasons.push('Perfil tecnológico/ISO 27001 prioriza seguridad, continuidad, accesos, cambios y proveedores.');
    }
  }
  if (containsAny(profile.maturity_level, ['inicial', 'baja', 'initial'])) {
    if (containsAny(text, ['alcance', 'responsab', 'proceso', 'evidencia', 'document'])) {
      score += 0.13;
      reasons.push('Madurez inicial exige evidencia base, responsables y control documental.');
    }
  }
  if (containsAny(profile.risk_appetite, ['bajo', 'low', 'conservador'])) {
    score += 0.04;
    reasons.push('Apetito de riesgo bajo eleva exigencia de evidencia.');
  }
  if (Number(row.evidence_count || row.official_evidence_count || 0) > 0) {
    score += 0.07;
    reasons.push('Existe evidencia interna asociada.');
  }
  if (Number(row.open_findings_count || row.open_nonconformities_count || row.overdue_action_plans_count || 0) > 0) {
    score += 0.08;
    reasons.push('Existen hallazgos/NC/acciones internas relacionadas.');
  }

  const applicable = score >= 0.5 || Boolean(row.tenant_control_id);
  const priority = score >= 0.78 ? 'alta' : score >= 0.58 ? 'media' : 'baja';
  return {
    applicable,
    score: Math.min(1, Math.round(score * 100) / 100),
    priority,
    reason: reasons.length ? reasons.join(' ') : 'Aplicable por norma activa y alcance operativo del tenant.',
    drivers,
  };
}

function classifyKpi(row, profile, activeStandards) {
  const text = kpiHaystack(row);
  const rowStandards = uniq([...(asArray(row.applicable_standards)), row.standard_code], 10);

  if (!standardMatches(activeStandards, rowStandards) && !String(row.kpi_code || '').startsWith('KPI-HLT-')) {
    return {
      applicable: false,
      score: 0.05,
      priority: 'baja',
      reason: 'KPI asociado a norma no activa para el tenant.',
      drivers: { active_standards: activeStandards, row_standards: rowStandards },
    };
  }

  const explicitReason = explicitExclusionReason(profile, text);
  if (explicitReason) {
    return {
      applicable: false,
      score: 0.15,
      priority: 'baja',
      reason: explicitReason,
      drivers: { profile_industry: profile.industry },
    };
  }

  let score = row.kpi_definition_id ? 0.55 : 0.45;
  const reasons = [];
  if (containsAny(text, ['accion correctiva', 'eficacia', 'hallazgo', 'no conform', 'evidencia', 'auditoria', 'document'])) {
    score += 0.18;
    reasons.push('KPI relevante para auditoría, evidencia y mejora continua.');
  }
  if (isTechProfile(profile) || hasStandard(profile, '27001')) {
    if (containsAny(text, ['acceso', 'seguridad', 'incidente', 'mttr', 'disponibilidad', 'continuidad', 'riesgo', 'privacidad'])) {
      score += 0.22;
      reasons.push('Perfil tecnológico/ISO 27001 requiere seguimiento reforzado de seguridad, continuidad e incidentes.');
    }
  }
  if (containsAny(text, ['satisfaccion', 'cliente', 'reclamo', 'objetivo'])) {
    score += 0.12;
    reasons.push('Relevante para desempeño y objetivos de gestión.');
  }
  if (containsAny(profile.maturity_level, ['inicial', 'baja', 'initial'])) {
    score += 0.05;
    reasons.push('Madurez inicial requiere KPIs simples y accionables.');
  }

  const applicable = score >= 0.52;
  const priority = score >= 0.76 ? 'alta' : score >= 0.58 ? 'media' : 'baja';
  return {
    applicable,
    score: Math.min(1, Math.round(score * 100) / 100),
    priority,
    reason: reasons.length ? reasons.join(' ') : 'KPI aplicable por norma activa y operación declarada.',
    drivers: {
      active_standards: activeStandards,
      profile_industry: profile.industry,
      maturity_level: profile.maturity_level,
    },
  };
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = $1
    LIMIT 1
    `,
    [tableName]
  );
  return result.rowCount > 0;
}

async function loadCompanyProfile(client, tenantId) {
  const result = await client.query(
    `
    SELECT *
    FROM tenant_company_profiles
    WHERE tenant_id = $1::uuid
    LIMIT 1
    `,
    [tenantId]
  );
  return result.rows[0] || null;
}

async function loadActiveStandards(client, tenantId, profile) {
  const result = await client.query(
    `
    SELECT standard_code
    FROM tenant_standards
    WHERE tenant_id = $1::uuid
      AND COALESCE(is_active, true) = true
    ORDER BY standard_code
    `,
    [tenantId]
  );
  return uniq([...result.rows.map((row) => row.standard_code), ...asArray(profile.active_standards)], 20);
}

async function loadControls(client, tenantId, activeStandards) {
  const hasHealthView = await tableExists(client, 'v_iso_control_effective_health');
  const rows = await client.query(
    `
    WITH active_standards AS (
      SELECT unnest($2::text[]) AS standard_code
    ),
    tenant_control_rows AS (
      SELECT
        tc.id AS tenant_control_id,
        tc.control_id AS control_catalog_id,
        tc.tenant_id,
        cc.iso AS primary_standard_code,
        COALESCE(rel.display_clause, cc.clause) AS clause,
        cc.category,
        cc.description AS control_name,
        cc.description,
        cc.source_type,
        COALESCE(rel.valid_for_standards, ARRAY_REMOVE(ARRAY[cc.iso], NULL)) AS valid_for_standards,
        tc.status,
        tc.priority,
        ${hasHealthView ? 'veh.evidence_count' : '0::int'} AS evidence_count,
        ${hasHealthView ? 'veh.official_evidence_count' : '0::int'} AS official_evidence_count,
        ${hasHealthView ? 'veh.open_findings_count' : '0::int'} AS open_findings_count,
        ${hasHealthView ? 'veh.open_nonconformities_count' : '0::int'} AS open_nonconformities_count,
        ${hasHealthView ? 'veh.overdue_action_plans_count' : '0::int'} AS overdue_action_plans_count
      FROM tenant_controls tc
      JOIN controls_catalog cc ON cc.id = tc.control_id
      LEFT JOIN LATERAL (
        SELECT
          array_agg(DISTINCT ccs.standard_code ORDER BY ccs.standard_code) AS valid_for_standards,
          MAX(ccs.clause) FILTER (WHERE ccs.standard_code = ANY($2::text[])) AS display_clause
        FROM controls_catalog_standards ccs
        WHERE ccs.control_id = cc.id
      ) rel ON TRUE
      ${hasHealthView ? 'LEFT JOIN public.v_iso_control_effective_health veh ON veh.tenant_control_id = tc.id AND veh.tenant_id = tc.tenant_id' : ''}
      WHERE tc.tenant_id = $1::uuid
        AND cc.is_active = true
    ),
    catalog_rows AS (
      SELECT
        NULL::uuid AS tenant_control_id,
        cc.id AS control_catalog_id,
        $1::uuid AS tenant_id,
        cc.iso AS primary_standard_code,
        COALESCE(rel.display_clause, cc.clause) AS clause,
        cc.category,
        cc.description AS control_name,
        cc.description,
        cc.source_type,
        COALESCE(rel.valid_for_standards, ARRAY_REMOVE(ARRAY[cc.iso], NULL)) AS valid_for_standards,
        NULL::text AS status,
        NULL::text AS priority,
        0::int AS evidence_count,
        0::int AS official_evidence_count,
        0::int AS open_findings_count,
        0::int AS open_nonconformities_count,
        0::int AS overdue_action_plans_count
      FROM controls_catalog cc
      LEFT JOIN LATERAL (
        SELECT
          array_agg(DISTINCT ccs.standard_code ORDER BY ccs.standard_code) AS valid_for_standards,
          MAX(ccs.clause) FILTER (WHERE ccs.standard_code = ANY($2::text[])) AS display_clause
        FROM controls_catalog_standards ccs
        WHERE ccs.control_id = cc.id
      ) rel ON TRUE
      WHERE cc.is_active = true
        AND (cc.tenant_id IS NULL OR cc.tenant_id = $1::uuid)
        AND (
          cc.iso = ANY($2::text[])
          OR EXISTS (
            SELECT 1
            FROM controls_catalog_standards ccs
            WHERE ccs.control_id = cc.id
              AND ccs.standard_code = ANY($2::text[])
          )
        )
    )
    SELECT DISTINCT ON (control_catalog_id)
      *,
      COALESCE(primary_standard_code, valid_for_standards[1]) AS standard_code
    FROM (
      SELECT * FROM tenant_control_rows
      UNION ALL
      SELECT * FROM catalog_rows
    ) all_controls
    ORDER BY control_catalog_id, tenant_control_id NULLS LAST
    LIMIT 500
    `,
    [tenantId, activeStandards]
  );
  return rows.rows;
}

async function loadKpis(client, tenantId, activeStandards) {
  const hasSettings = await tableExists(client, 'tenant_kpi_settings');
  const result = await client.query(
    `
    SELECT
      kd.id AS kpi_definition_id,
      kd.code AS kpi_code,
      kd.name AS kpi_name,
      kd.description,
      kd.category,
      ${hasSettings ? 'COALESCE(tks.is_enabled, true)' : 'true'} AS is_enabled,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT ksm.standard_code), NULL) AS applicable_standards
    FROM kpi_definitions kd
    ${hasSettings ? 'LEFT JOIN tenant_kpi_settings tks ON tks.kpi_id = kd.id AND tks.tenant_id = $1::uuid' : ''}
    LEFT JOIN kpi_standard_mappings ksm
      ON ksm.kpi_id = kd.id
     AND COALESCE(ksm.is_active, true) = true
    WHERE COALESCE(kd.is_active, true) = true
      AND (
        kd.code LIKE 'KPI-HLT-%'
        OR kd.is_standard = false
        OR EXISTS (
          SELECT 1
          FROM kpi_standard_mappings ksm2
          WHERE ksm2.kpi_id = kd.id
            AND COALESCE(ksm2.is_active, true) = true
            AND ksm2.standard_code = ANY($2::text[])
        )
      )
      AND (kd.tenant_id IS NULL OR kd.tenant_id = $1::uuid)
    GROUP BY kd.id ${hasSettings ? ', tks.is_enabled' : ''}
    ORDER BY kd.display_order NULLS LAST, kd.code
    LIMIT 200
    `,
    [tenantId, activeStandards]
  );
  return result.rows.filter((row) => row.is_enabled !== false);
}

function evidenceFromControls(applicableControls) {
  const base = [
    {
      evidence_name: 'Alcance ISO aprobado y exclusiones justificadas',
      evidence_type: 'documento',
      requirement_reason: 'Base para delimitar universo operativo aplicable y evitar penalizaciones por elementos fuera de alcance.',
      priority: 'alta',
    },
    {
      evidence_name: 'Mapa de procesos críticos y responsables',
      evidence_type: 'registro',
      requirement_reason: 'Necesario para conectar Perfil Empresa, controles, KPIs y auditoría.',
      priority: 'alta',
    },
  ];
  const controlEvidence = applicableControls
    .filter((item) => item.priority === 'alta')
    .slice(0, 10)
    .map((item) => ({
      related_control_id: item.tenant_control_id || null,
      evidence_name: `Evidencia vigente para ${item.control_name}`,
      evidence_type: 'control',
      requirement_reason: item.applicability_reason,
      priority: item.priority,
    }));
  return [...base, ...controlEvidence];
}

async function insertRun(client, tenantId, userId, status = 'running') {
  const result = await client.query(
    `
    INSERT INTO tenant_applicability_runs (tenant_id, status, started_at, created_by)
    VALUES ($1::uuid, $2, now(), $3::uuid)
    RETURNING *
    `,
    [tenantId, status, userId]
  );
  return result.rows[0];
}

async function completeRun(client, runId, status, summary, trace, error = null) {
  await client.query(
    `
    UPDATE tenant_applicability_runs
    SET status = $2,
        completed_at = now(),
        summary_json = $3::jsonb,
        trace_json = $4::jsonb,
        error_json = $5::jsonb
    WHERE id = $1::uuid
    `,
    [runId, status, JSON.stringify(summary || {}), JSON.stringify(trace || {}), error ? JSON.stringify(error) : null]
  );
}

async function buildTenantApplicabilityUniverse({ tenantId, userId = null, forceRebuild = false } = {}) {
  if (!tenantId) {
    const error = new Error('tenantId es obligatorio para calcular aplicabilidad');
    error.code = 'TENANT_REQUIRED';
    throw error;
  }

  const client = await pool.connect();
  const startedAt = Date.now();
  let run = null;
  try {
    await client.query('BEGIN');
    run = await insertRun(client, tenantId, userId, 'running');
    const profileRow = await loadCompanyProfile(client, tenantId);
    const profile = normalizeProfile(profileRow || { tenant_id: tenantId, profile_json: {} });
    const activeStandards = await loadActiveStandards(client, tenantId, profile);
    profile.active_standards = activeStandards;
    const profileHash = jsonHash({ profile, activeStandards, forceRebuild });

    const context = await aiContextBuilder.buildCompanyProfileAiContext({
      tenantId,
      standardCodes: activeStandards,
    });

    const [controlCandidates, kpiCandidates] = await Promise.all([
      loadControls(client, tenantId, activeStandards),
      loadKpis(client, tenantId, activeStandards),
    ]);

    const applicableControls = [];
    const excludedObjects = [];
    for (const control of controlCandidates) {
      const decision = classifyControl(control, profile, activeStandards);
      const row = {
        ...control,
        control_name: control.control_name || control.description || 'Control sin nombre',
        control_code: control.clause || control.control_code || null,
        applicability_status: decision.applicable ? 'applicable' : 'excluded',
        applicability_reason: decision.reason,
        applicability_score: decision.score,
        priority: decision.priority,
        profile_drivers: decision.drivers,
        calculation_weight: decision.applicable ? Math.max(0.3, decision.score) : 0,
      };
      if (decision.applicable) applicableControls.push(row);
      else {
        excludedObjects.push({
          object_type: 'control',
          object_id: control.control_catalog_id || control.tenant_control_id || null,
          object_code: row.control_code,
          object_name: row.control_name,
          exclusion_reason: decision.reason,
          profile_drivers: decision.drivers,
        });
      }
    }

    const applicableKpis = [];
    for (const kpi of kpiCandidates) {
      const decision = classifyKpi(kpi, profile, activeStandards);
      const row = {
        ...kpi,
        kpi_name: kpi.kpi_name || kpi.name || kpi.kpi_code || 'KPI sin nombre',
        applicability_status: decision.applicable ? 'applicable' : 'excluded',
        applicability_reason: decision.reason,
        applicability_score: decision.score,
        priority: decision.priority,
        calculation_weight: decision.applicable ? Math.max(0.3, decision.score) : 0,
        profile_drivers: decision.drivers,
      };
      if (decision.applicable) applicableKpis.push(row);
      else {
        excludedObjects.push({
          object_type: 'kpi',
          object_id: kpi.kpi_definition_id || null,
          object_code: kpi.kpi_code,
          object_name: row.kpi_name,
          exclusion_reason: decision.reason,
          profile_drivers: decision.drivers,
        });
      }
    }

    const evidenceRequirements = evidenceFromControls(applicableControls);

    await client.query('UPDATE tenant_applicable_controls SET active = false, visible_to_tenant = false, updated_at = now() WHERE tenant_id = $1::uuid', [tenantId]);
    await client.query('UPDATE tenant_applicable_kpis SET active = false, visible_to_tenant = false, updated_at = now() WHERE tenant_id = $1::uuid', [tenantId]);
    await client.query('UPDATE tenant_applicable_evidence_requirements SET active = false, visible_to_tenant = false, updated_at = now() WHERE tenant_id = $1::uuid', [tenantId]);
    await client.query('UPDATE tenant_applicability_exclusions SET active = false, updated_at = now() WHERE tenant_id = $1::uuid', [tenantId]);

    await client.query(
      `
      INSERT INTO tenant_applicability_profiles (
        tenant_id, profile_source, profile_hash, industry, subindustry, company_size,
        maturity_level, risk_appetite, active_standards, declared_scope,
        critical_processes, excluded_operations, generated_by, ai_used, web_used, created_at, updated_at
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14, $15, now(), now())
      `,
      [
        tenantId,
        'tenant_company_profiles',
        profileHash,
        profile.industry || null,
        profile.subindustry || null,
        profile.company_size || null,
        profile.maturity_level || null,
        profile.risk_appetite || null,
        JSON.stringify(activeStandards),
        JSON.stringify(profile.declared_scope || {}),
        JSON.stringify(profile.critical_processes || []),
        JSON.stringify(profile.excluded_operations || []),
        MODULE_SOURCE,
        profileRow?.ai_research_trace_json?.fallback_used !== true && Boolean(profileRow?.ai_profile_summary_json),
        profileRow?.ai_research_trace_json?.used_web === true,
      ]
    );

    for (const item of applicableControls) {
      await client.query(
        `
        INSERT INTO tenant_applicable_controls (
          tenant_id, tenant_control_id, control_catalog_id, standard_code, control_code,
          control_name, applicability_status, applicability_reason, applicability_score,
          priority, profile_drivers, calculation_weight, must_exist, visible_to_tenant,
          active, source, created_at, updated_at
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, 'applicable', $7, $8, $9, $10::jsonb, $11, true, true, true, $12, now(), now())
        `,
        [
          tenantId,
          item.tenant_control_id || null,
          item.control_catalog_id || null,
          item.standard_code || item.primary_standard_code || null,
          item.control_code || null,
          String(item.control_name || 'Control aplicable').slice(0, 500),
          item.applicability_reason,
          item.applicability_score,
          item.priority,
          JSON.stringify(item.profile_drivers || {}),
          item.calculation_weight,
          MODULE_SOURCE,
        ]
      );
    }

    for (const item of applicableKpis) {
      await client.query(
        `
        INSERT INTO tenant_applicable_kpis (
          tenant_id, kpi_definition_id, kpi_code, kpi_name, applicability_status,
          applicability_reason, applicability_score, priority, calculation_weight,
          visible_to_tenant, active, source, created_at, updated_at
        )
        VALUES ($1::uuid, $2::uuid, $3, $4, 'applicable', $5, $6, $7, $8, true, true, $9, now(), now())
        `,
        [
          tenantId,
          item.kpi_definition_id || null,
          item.kpi_code || null,
          String(item.kpi_name || 'KPI aplicable').slice(0, 500),
          item.applicability_reason,
          item.applicability_score,
          item.priority,
          item.calculation_weight,
          MODULE_SOURCE,
        ]
      );
    }

    for (const item of evidenceRequirements) {
      await client.query(
        `
        INSERT INTO tenant_applicable_evidence_requirements (
          tenant_id, related_control_id, related_kpi_id, evidence_type, evidence_name,
          requirement_reason, priority, active, visible_to_tenant, source, created_at, updated_at
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, true, true, $8, now(), now())
        `,
        [
          tenantId,
          item.related_control_id || null,
          item.related_kpi_id || null,
          item.evidence_type || 'registro',
          String(item.evidence_name || 'Evidencia aplicable').slice(0, 500),
          item.requirement_reason || null,
          item.priority || 'media',
          MODULE_SOURCE,
        ]
      );
    }

    for (const item of excludedObjects.slice(0, 300)) {
      await client.query(
        `
        INSERT INTO tenant_applicability_exclusions (
          tenant_id, object_type, object_id, object_code, object_name,
          exclusion_reason, excluded_by, profile_drivers, active, created_at, updated_at
        )
        VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8::jsonb, true, now(), now())
        `,
        [
          tenantId,
          item.object_type,
          item.object_id || null,
          item.object_code || null,
          String(item.object_name || '').slice(0, 500),
          item.exclusion_reason,
          MODULE_SOURCE,
          JSON.stringify(item.profile_drivers || {}),
        ]
      );
    }

    const summary = {
      tenant_id: tenantId,
      active_universe: true,
      applicable_controls_count: applicableControls.length,
      applicable_kpis_count: applicableKpis.length,
      applicable_evidence_requirements_count: evidenceRequirements.length,
      exclusions_count: excludedObjects.length,
      controls_candidates_count: controlCandidates.length,
      kpis_candidates_count: kpiCandidates.length,
      active_standards: activeStandards,
      tenant_filter_enforced: true,
      filtered_by_tenant_id: true,
      profile_used: Boolean(profileRow),
      deterministic_rules_used: true,
      ai_used: profileRow?.ai_research_trace_json?.fallback_used !== true && Boolean(profileRow?.ai_profile_summary_json),
      web_used: profileRow?.ai_research_trace_json?.used_web === true,
    };
    const trace = {
      source: 'companyProfileApplicabilityEngine',
      profile_hash: profileHash,
      tenant_filter_enforced: true,
      filtered_by_tenant_id: true,
      force_rebuild: forceRebuild === true,
      source_trace: context.source_trace || [],
      limitations: context.limitations || [],
      duration_ms: Date.now() - startedAt,
    };

    await completeRun(client, run.id, 'completed', summary, trace);
    await client.query('COMMIT');
    return { ok: true, run_id: run.id, summary, trace };
  } catch (error) {
    try {
      if (run?.id) {
        await completeRun(client, run.id, 'failed', {}, { duration_ms: Date.now() - startedAt }, {
          error_type: error?.code || error?.name || 'APPLICABILITY_ENGINE_ERROR',
          error_message: String(error?.message || 'Error calculando aplicabilidad').slice(0, 500),
        });
      }
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('APPLICABILITY ENGINE ROLLBACK ERROR:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function getTenantApplicabilitySummary({ tenantId } = {}) {
  if (!tenantId) {
    const error = new Error('tenantId es obligatorio');
    error.code = 'TENANT_REQUIRED';
    throw error;
  }
  const result = await pool.query(
    `
    WITH profile AS (
      SELECT *
      FROM tenant_applicability_profiles
      WHERE tenant_id = $1::uuid
      ORDER BY updated_at DESC
      LIMIT 1
    ),
    controls AS (
      SELECT COUNT(*)::int AS count
      FROM tenant_applicable_controls
      WHERE tenant_id = $1::uuid AND active = true AND visible_to_tenant = true
    ),
    kpis AS (
      SELECT COUNT(*)::int AS count
      FROM tenant_applicable_kpis
      WHERE tenant_id = $1::uuid AND active = true AND visible_to_tenant = true
    ),
    evidence AS (
      SELECT COUNT(*)::int AS count
      FROM tenant_applicable_evidence_requirements
      WHERE tenant_id = $1::uuid AND active = true AND visible_to_tenant = true
    ),
    exclusions AS (
      SELECT COUNT(*)::int AS count
      FROM tenant_applicability_exclusions
      WHERE tenant_id = $1::uuid AND active = true
    ),
    last_run AS (
      SELECT *
      FROM tenant_applicability_runs
      WHERE tenant_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 1
    )
    SELECT
      p.*,
      COALESCE(c.count, 0) AS applicable_controls_count,
      COALESCE(k.count, 0) AS applicable_kpis_count,
      COALESCE(e.count, 0) AS applicable_evidence_requirements_count,
      COALESCE(x.count, 0) AS exclusions_count,
      lr.id AS last_run_id,
      lr.status AS last_run_status,
      lr.completed_at AS last_run_completed_at,
      lr.summary_json AS last_run_summary,
      lr.trace_json AS last_run_trace
    FROM profile p
    FULL JOIN controls c ON true
    FULL JOIN kpis k ON true
    FULL JOIN evidence e ON true
    FULL JOIN exclusions x ON true
    FULL JOIN last_run lr ON true
    LIMIT 1
    `,
    [tenantId]
  );
  const row = result.rows[0] || {};
  return {
    tenant_id: tenantId,
    tenant_filter_enforced: true,
    filtered_by_tenant_id: true,
    profile_used: Boolean(row.id),
    active_universe: Number(row.applicable_controls_count || 0) > 0 || Number(row.applicable_kpis_count || 0) > 0,
    industry: row.industry || null,
    subindustry: row.subindustry || null,
    company_size: row.company_size || null,
    maturity_level: row.maturity_level || null,
    risk_appetite: row.risk_appetite || null,
    active_standards: row.active_standards || [],
    applicable_controls_count: Number(row.applicable_controls_count || 0),
    applicable_kpis_count: Number(row.applicable_kpis_count || 0),
    applicable_evidence_requirements_count: Number(row.applicable_evidence_requirements_count || 0),
    exclusions_count: Number(row.exclusions_count || 0),
    last_run: {
      id: row.last_run_id || null,
      status: row.last_run_status || null,
      completed_at: row.last_run_completed_at || null,
      summary: row.last_run_summary || null,
      trace: row.last_run_trace || null,
    },
  };
}

async function assertTenantApplicabilityReady({ tenantId } = {}) {
  const summary = await getTenantApplicabilitySummary({ tenantId });
  if (summary.active_universe) return summary;
  await buildTenantApplicabilityUniverse({ tenantId, forceRebuild: false });
  return getTenantApplicabilitySummary({ tenantId });
}

async function getTenantApplicableControls({ tenantId, filters = {} } = {}) {
  await assertTenantApplicabilityReady({ tenantId });
  const params = [tenantId];
  const clauses = ['tenant_id = $1::uuid', 'active = true', 'visible_to_tenant = true'];
  if (filters.standard_code) {
    params.push(filters.standard_code);
    clauses.push(`standard_code = $${params.length}`);
  }
  const result = await pool.query(
    `
    SELECT *
    FROM tenant_applicable_controls
    WHERE ${clauses.join(' AND ')}
    ORDER BY
      CASE priority WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
      applicability_score DESC NULLS LAST,
      control_code NULLS LAST,
      control_name
    LIMIT $${params.length + 1}
    `,
    [...params, Number(filters.limit || 200)]
  );
  return result.rows;
}

async function getTenantApplicableKpis({ tenantId, filters = {} } = {}) {
  await assertTenantApplicabilityReady({ tenantId });
  const params = [tenantId];
  const result = await pool.query(
    `
    SELECT *
    FROM tenant_applicable_kpis
    WHERE tenant_id = $1::uuid
      AND active = true
      AND visible_to_tenant = true
    ORDER BY
      CASE priority WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
      applicability_score DESC NULLS LAST,
      kpi_code NULLS LAST,
      kpi_name
    LIMIT $2
    `,
    [tenantId, Number(filters.limit || 200)]
  );
  return result.rows;
}

async function getTenantApplicableEvidenceRequirements({ tenantId, filters = {} } = {}) {
  await assertTenantApplicabilityReady({ tenantId });
  const result = await pool.query(
    `
    SELECT *
    FROM tenant_applicable_evidence_requirements
    WHERE tenant_id = $1::uuid
      AND active = true
      AND visible_to_tenant = true
    ORDER BY
      CASE priority WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
      evidence_name
    LIMIT $2
    `,
    [tenantId, Number(filters.limit || 200)]
  );
  return result.rows;
}

async function getTenantApplicabilityExclusions({ tenantId, filters = {} } = {}) {
  await assertTenantApplicabilityReady({ tenantId });
  const params = [tenantId];
  const clauses = ['tenant_id = $1::uuid', 'active = true'];
  if (filters.object_type) {
    params.push(filters.object_type);
    clauses.push(`object_type = $${params.length}`);
  }
  const result = await pool.query(
    `
    SELECT *
    FROM tenant_applicability_exclusions
    WHERE ${clauses.join(' AND ')}
    ORDER BY object_type, object_code NULLS LAST, object_name
    LIMIT $${params.length + 1}
    `,
    [...params, Number(filters.limit || 200)]
  );
  return result.rows;
}

async function explainApplicabilityDecision({ tenantId, objectType, objectCode } = {}) {
  if (!tenantId || !objectType || !objectCode) return null;
  const table = objectType === 'kpi' ? 'tenant_applicable_kpis' : 'tenant_applicable_controls';
  const codeColumn = objectType === 'kpi' ? 'kpi_code' : 'control_code';
  const nameColumn = objectType === 'kpi' ? 'kpi_name' : 'control_name';
  const result = await pool.query(
    `
    SELECT
      '${objectType}'::text AS object_type,
      ${codeColumn} AS object_code,
      ${nameColumn} AS object_name,
      applicability_status,
      applicability_reason,
      applicability_score,
      priority,
      profile_drivers,
      active,
      visible_to_tenant
    FROM ${table}
    WHERE tenant_id = $1::uuid
      AND ${codeColumn} = $2
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [tenantId, objectCode]
  );
  if (result.rows[0]) return result.rows[0];
  const excluded = await pool.query(
    `
    SELECT object_type, object_code, object_name, exclusion_reason, profile_drivers
    FROM tenant_applicability_exclusions
    WHERE tenant_id = $1::uuid
      AND object_type = $2
      AND object_code = $3
      AND active = true
    LIMIT 1
    `,
    [tenantId, objectType, objectCode]
  );
  return excluded.rows[0] || null;
}

module.exports = {
  buildTenantApplicabilityUniverse,
  getTenantApplicableControls,
  getTenantApplicableKpis,
  getTenantApplicableEvidenceRequirements,
  getTenantApplicabilitySummary,
  getTenantApplicabilityExclusions,
  assertTenantApplicabilityReady,
  explainApplicabilityDecision,
};
