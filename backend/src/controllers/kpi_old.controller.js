const db = require('../config/db');

const KPI_CODES = {
  OBJECTIVES: 'KPI-01',
  NCR_INDEX: 'KPI-02',
  ACTION_EFFECTIVENESS: 'KPI-03',
  INCIDENTS_TOTAL: 'KPI-04',
  MTTR: 'KPI-05',
  RESIDUAL_RISK: 'KPI-06',
  RISK_TREATMENT: 'KPI-07',
  LEGAL_COMPLIANCE: 'KPI-08',
  CONFORMING_AUDITS: 'KPI-09',
  FINDINGS_PER_AUDIT: 'KPI-10',
  PROCESS_PERFORMANCE: 'KPI-11',
  OP_EFFICIENCY: 'KPI-12',
  AVAILABILITY: 'KPI-13',
  CUSTOMER_SAT: 'KPI-14',
  CLAIMS: 'KPI-15',
  ACCIDENT_RATE: 'KPI-16',
  ENERGY: 'KPI-17',
  WASTE: 'KPI-18',
  MTBF: 'KPI-19',
  PRIVACY: 'KPI-20'
};

function parsePeriod(periodType, refDate = new Date()) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();

  if (periodType === 'mensual') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return { start, end };
  }

  if (periodType === 'trimestral') {
    const qStart = Math.floor(month / 3) * 3;
    const start = new Date(year, qStart, 1);
    const end = new Date(year, qStart + 3, 0);
    return { start, end };
  }

  if (periodType === 'semestral') {
    const sStart = month < 6 ? 0 : 6;
    const start = new Date(year, sStart, 1);
    const end = new Date(year, sStart + 6, 0);
    return { start, end };
  }

  const start = new Date(year, 0, 1);
  const end = new Date(year, 12, 0);
  return { start, end };
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function numericOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function numericOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}


function isHealthKpiCode(code) {
  return String(code || '').startsWith('KPI-HLT-');
}

function getUserRole(user) {
  return String(
    user?.role ||
      user?.user_role ||
      user?.userRole ||
      user?.profile ||
      ''
  ).toLowerCase();
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

function isSuperAdmin(user) {
  const role = getUserRole(user);

  return [
    'superadmin',
    'super_admin',
    'admin_global',
    'global_admin',
    'platform_admin',
    'owner'
  ].includes(role);
}

function canAccessTenant(req, tenantId) {
  if (isSuperAdmin(req.user)) return true;

  const userTenantId = getUserTenantId(req.user);
  return Boolean(userTenantId && tenantId && String(userTenantId) === String(tenantId));
}

function denyTenantAccess(res) {
  return res.status(403).json({
    error: 'No autorizado para acceder a este tenant'
  });
}

function riskLevelToNumber(level) {
  if (!level) return null;
  const v = String(level).toLowerCase();
  if (v === 'alto') return 3;
  if (v === 'medio') return 2;
  if (v === 'bajo') return 1;
  return null;
}

function getStatusColor(direction, value, thresholdRow) {
  if (value === null || value === undefined) return 'gray';
  if (!thresholdRow) return 'gray';

  const val = Number(value);

  if (direction === 'higher_is_better') {
    if (
      thresholdRow.green_min !== null &&
      thresholdRow.green_max !== null &&
      val >= Number(thresholdRow.green_min) &&
      val <= Number(thresholdRow.green_max)
    ) return 'green';

    if (
      thresholdRow.yellow_min !== null &&
      thresholdRow.yellow_max !== null &&
      val >= Number(thresholdRow.yellow_min) &&
      val <= Number(thresholdRow.yellow_max)
    ) return 'yellow';

    return 'red';
  }

  if (direction === 'lower_is_better') {
    if (
      thresholdRow.green_min !== null &&
      thresholdRow.green_max !== null &&
      val >= Number(thresholdRow.green_min) &&
      val <= Number(thresholdRow.green_max)
    ) return 'green';

    if (
      thresholdRow.yellow_min !== null &&
      thresholdRow.yellow_max !== null &&
      val >= Number(thresholdRow.yellow_min) &&
      val <= Number(thresholdRow.yellow_max)
    ) return 'yellow';

    return 'red';
  }

  return 'gray';
}

async function getTenantStandards(tenantId) {
  const { rows } = await db.query(
    `
    SELECT standard_code
    FROM tenant_standards
    WHERE tenant_id = $1
      AND is_active = true
    ORDER BY standard_code
    `,
    [tenantId]
  );

  return rows.map((r) => r.standard_code);
}

async function getKpiDefinitionsForTenant(tenantId) {
  const tenantStandards = await getTenantStandards(tenantId);

  const { rows } = await db.query(
    `
    SELECT
      kd.*,
      tks.is_enabled,
      tks.override_frequency,
      tks.override_target_value,
      tks.override_direction,
      tks.override_thresholds_json,
      tks.custom_label,
      tks.custom_description,
      kt.green_min,
      kt.green_max,
      kt.yellow_min,
      kt.yellow_max,
      kt.red_min,
      kt.red_max,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT ksm.standard_code), NULL) AS applicable_standards
    FROM kpi_definitions kd
    LEFT JOIN tenant_kpi_settings tks
      ON tks.kpi_id = kd.id
     AND tks.tenant_id = $1
    LEFT JOIN kpi_thresholds kt
      ON kt.kpi_id = kd.id
    LEFT JOIN kpi_standard_mappings ksm
      ON ksm.kpi_id = kd.id
     AND ksm.is_active = true
    WHERE kd.is_active = true
      AND (
        kd.code LIKE 'KPI-HLT-%'
        OR
        (
          kd.is_standard = true
          AND EXISTS (
            SELECT 1
            FROM tenant_standards ts
            WHERE ts.tenant_id = $1
              AND ts.is_active = true
              AND ts.standard_code = ksm.standard_code
          )
        )
        OR
        (kd.is_standard = false AND kd.tenant_id = $1)
      )
    GROUP BY
      kd.id,
      tks.is_enabled,
      tks.override_frequency,
      tks.override_target_value,
      tks.override_direction,
      tks.override_thresholds_json,
      tks.custom_label,
      tks.custom_description,
      kt.green_min,
      kt.green_max,
      kt.yellow_min,
      kt.yellow_max,
      kt.red_min,
      kt.red_max
    ORDER BY kd.display_order, kd.code
    `,
    [tenantId]
  );

  return rows.map((row) => {
    if (isHealthKpiCode(row.code)) {
      return {
        ...row,
        applicable_standards: tenantStandards
      };
    }

    return row;
  });
}

async function getLatestSnapshotsMap(tenantId) {
  const { rows } = await db.query(
    `
    WITH ranked AS (
      SELECT
        ks.*,
        kd.code AS kpi_code,
        kd.name AS kpi_name,
        ROW_NUMBER() OVER (
          PARTITION BY ks.kpi_id, COALESCE(ks.standard_code, 'GLOBAL')
          ORDER BY ks.period_start DESC, ks.calculated_at DESC
        ) AS rn
      FROM kpi_snapshots ks
      JOIN kpi_definitions kd ON kd.id = ks.kpi_id
      WHERE ks.tenant_id = $1
    )
    SELECT
      id,
      tenant_id,
      kpi_id,
      kpi_code,
      kpi_name,
      standard_code,
      period_type,
      period_start,
      period_end,
      value,
      numerator_value,
      denominator_value,
      status_color,
      direction,
      target_value,
      calculated_at,
      breakdown_json
    FROM ranked
    WHERE rn = 1
    ORDER BY kpi_code, standard_code NULLS FIRST
    `,
    [tenantId]
  );

  const map = new Map();

  for (const row of rows) {
    const existing = map.get(row.kpi_id) || {
      latest: null,
      snapshots: []
    };

    existing.snapshots.push(row);

    if (!existing.latest) {
      existing.latest = row;
    } else {
      const currentIsGlobal = !row.standard_code;
      const existingIsGlobal = !existing.latest.standard_code;

      if (currentIsGlobal && !existingIsGlobal) {
        existing.latest = row;
      } else if (
        currentIsGlobal === existingIsGlobal &&
        new Date(row.calculated_at).getTime() >
          new Date(existing.latest.calculated_at).getTime()
      ) {
        existing.latest = row;
      }
    }

    map.set(row.kpi_id, existing);
  }

  return map;
}

async function getPreviousSnapshot(tenantId, kpiId, currentCalculatedAt) {
  const { rows } = await db.query(
    `
    SELECT value, calculated_at
    FROM kpi_snapshots
    WHERE tenant_id = $1
      AND kpi_id = $2
      AND calculated_at < $3
    ORDER BY calculated_at DESC
    LIMIT 1
    `,
    [tenantId, kpiId, currentCalculatedAt]
  );

  return rows[0] || null;
}

async function computeAutomaticLikeValue(client, tenantId, kpiCode, periodStart, periodEnd) {
  switch (kpiCode) {
    case KPI_CODES.NCR_INDEX: {
      const ncRes = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM findings
        WHERE tenant_id = $1
          AND created_at::date BETWEEN $2 AND $3
          AND LOWER(COALESCE(finding_type, '')) IN ('no conformidad', 'no_conformidad')
        `,
        [tenantId, periodStart, periodEnd]
      );

      const auditsRes = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM audits
        WHERE tenant_id = $1
          AND start_date BETWEEN $2 AND $3
        `,
        [tenantId, periodStart, periodEnd]
      );

      const numerator = Number(ncRes.rows[0]?.total || 0);
      const denominator = Number(auditsRes.rows[0]?.total || 0);

      return {
        value: denominator > 0 ? numerator / denominator : numerator,
        numerator,
        denominator,
        breakdown: { no_conformidades: numerator, auditorias: denominator }
      };
    }

    case KPI_CODES.ACTION_EFFECTIVENESS: {
      const res = await client.query(
        `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'completado')::int AS efectivas
        FROM action_plans
        WHERE tenant_id = $1
          AND created_at::date BETWEEN $2 AND $3
        `,
        [tenantId, periodStart, periodEnd]
      );

      const numerator = Number(res.rows[0]?.efectivas || 0);
      const denominator = Number(res.rows[0]?.total || 0);

      return {
        value: denominator > 0 ? (numerator / denominator) * 100 : null,
        numerator,
        denominator,
        breakdown: { efectivas: numerator, total: denominator }
      };
    }

    case KPI_CODES.INCIDENTS_TOTAL: {
      const res = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM findings
        WHERE tenant_id = $1
          AND created_at::date BETWEEN $2 AND $3
          AND LOWER(COALESCE(source_type, '')) IN ('audit', 'risk', 'ia', 'evidence')
        `,
        [tenantId, periodStart, periodEnd]
      );

      const numerator = Number(res.rows[0]?.total || 0);
      return {
        value: numerator,
        numerator,
        denominator: null,
        breakdown: { incidentes: numerator }
      };
    }

    case KPI_CODES.RESIDUAL_RISK: {
      const res = await client.query(
        `
        SELECT level
        FROM asset_risks ar
        JOIN assets a ON a.id = ar.asset_id
        WHERE a.tenant_id = $1
          AND ar.created_at::date BETWEEN $2 AND $3
        `,
        [tenantId, periodStart, periodEnd]
      );

      const nums = res.rows
        .map((r) => riskLevelToNumber(r.level))
        .filter((v) => v !== null);

      if (!nums.length) {
        return { value: null, numerator: null, denominator: null, breakdown: {} };
      }

      const sum = nums.reduce((a, b) => a + b, 0);
      return {
        value: sum / nums.length,
        numerator: sum,
        denominator: nums.length,
        breakdown: { niveles: nums.length, suma: sum }
      };
    }

    case KPI_CODES.RISK_TREATMENT: {
      const totalRisksRes = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM asset_risks ar
        JOIN assets a ON a.id = ar.asset_id
        WHERE a.tenant_id = $1
          AND ar.created_at::date BETWEEN $2 AND $3
        `,
        [tenantId, periodStart, periodEnd]
      );

      const treatedRisksRes = await client.query(
        `
        SELECT COUNT(DISTINCT ar.id)::int AS total
        FROM asset_risks ar
        JOIN assets a ON a.id = ar.asset_id
        JOIN action_plans ap ON ap.asset_id = a.id
        WHERE a.tenant_id = $1
          AND ar.created_at::date BETWEEN $2 AND $3
          AND ap.created_at::date BETWEEN $2 AND $3
        `,
        [tenantId, periodStart, periodEnd]
      );

      const numerator = Number(treatedRisksRes.rows[0]?.total || 0);
      const denominator = Number(totalRisksRes.rows[0]?.total || 0);

      return {
        value: denominator > 0 ? (numerator / denominator) * 100 : null,
        numerator,
        denominator,
        breakdown: { tratados: numerator, identificados: denominator }
      };
    }

    case KPI_CODES.CONFORMING_AUDITS: {
      const auditsRes = await client.query(
        `
        SELECT id
        FROM audits
        WHERE tenant_id = $1
          AND start_date BETWEEN $2 AND $3
        `,
        [tenantId, periodStart, periodEnd]
      );

      const auditIds = auditsRes.rows.map((r) => r.id);
      const denominator = auditIds.length;

      if (!denominator) {
        return { value: null, numerator: 0, denominator: 0, breakdown: {} };
      }

      const findingsRes = await client.query(
        `
        SELECT audit_id,
               COUNT(*) FILTER (
                 WHERE LOWER(COALESCE(severity, '')) = 'alta'
                    OR LOWER(COALESCE(finding_type, '')) IN ('no conformidad', 'no_conformidad')
               )::int AS major_count
        FROM findings
        WHERE tenant_id = $1
          AND audit_id = ANY($2::uuid[])
        GROUP BY audit_id
        `,
        [tenantId, auditIds]
      );

      const majorMap = new Map(findingsRes.rows.map((r) => [r.audit_id, Number(r.major_count)]));
      let conformes = 0;
      for (const id of auditIds) {
        if (!majorMap.get(id)) conformes++;
      }

      return {
        value: (conformes / denominator) * 100,
        numerator: conformes,
        denominator,
        breakdown: { conformes, total: denominator }
      };
    }

    case KPI_CODES.FINDINGS_PER_AUDIT: {
      const auditsRes = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM audits
        WHERE tenant_id = $1
          AND start_date BETWEEN $2 AND $3
        `,
        [tenantId, periodStart, periodEnd]
      );

      const findingsRes = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM findings
        WHERE tenant_id = $1
          AND audit_id IS NOT NULL
          AND created_at::date BETWEEN $2 AND $3
        `,
        [tenantId, periodStart, periodEnd]
      );

      const denominator = Number(auditsRes.rows[0]?.total || 0);
      const numerator = Number(findingsRes.rows[0]?.total || 0);

      return {
        value: denominator > 0 ? numerator / denominator : null,
        numerator,
        denominator,
        breakdown: { hallazgos: numerator, auditorias: denominator }
      };
    }

    default:
      return { value: null, numerator: null, denominator: null, breakdown: {} };
  }
}

async function getManualValueForPeriod(client, tenantId, kpiId, standardCode, periodType, periodStart, periodEnd) {
  const { rows } = await client.query(
    `
    SELECT value, numerator_value, denominator_value, dimension_data, notes
    FROM kpi_manual_values
    WHERE tenant_id = $1
      AND kpi_id = $2
      AND COALESCE(standard_code, '') = COALESCE($3, '')
      AND period_type = $4
      AND period_start = $5
      AND period_end = $6
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [tenantId, kpiId, standardCode || null, periodType, periodStart, periodEnd]
  );

  return rows[0] || null;
}

async function regenerateHealthKpiSnapshotsForTenant(client, tenantId) {
  await client.query('SELECT refresh_control_health_scores();');

  const periodStart = `date_trunc('month', current_date)::date`;
  const periodEnd = `(date_trunc('month', current_date) + interval '1 month - 1 day')::date`;

  await client.query(
    `
    DELETE FROM kpi_snapshots ks
    USING kpi_definitions kd
    WHERE ks.kpi_id = kd.id
      AND kd.code IN ('KPI-HLT-001', 'KPI-HLT-002', 'KPI-HLT-003', 'KPI-HLT-004')
      AND ks.tenant_id = $1
      AND ks.period_type = 'mensual'
      AND ks.period_start = date_trunc('month', current_date)::date
      AND ks.period_end = (date_trunc('month', current_date) + interval '1 month - 1 day')::date
    `,
    [tenantId]
  );

  await client.query(
    `
    INSERT INTO kpi_snapshots (
      tenant_id,
      kpi_id,
      standard_code,
      period_type,
      period_start,
      period_end,
      value,
      numerator_value,
      denominator_value,
      status_color,
      direction,
      target_value,
      calculated_from,
      breakdown_json,
      source_trace_json,
      calculated_at
    )
    SELECT
      v.tenant_id,
      kd.id,
      NULL,
      'mensual'::kpi_period_type_enum,
      ${periodStart},
      ${periodEnd},
      v.avg_health_score,
      v.avg_health_score,
      100,
      CASE
        WHEN v.avg_health_score >= 85 THEN 'green'
        WHEN v.avg_health_score >= 60 THEN 'yellow'
        ELSE 'red'
      END::kpi_status_color_enum,
      kd.direction,
      kd.target_value,
      'control_health_engine',
      jsonb_build_object(
        'total_controls', v.total_controls,
        'healthy_controls', v.healthy_controls,
        'attention_controls', v.attention_controls,
        'deteriorated_controls', v.deteriorated_controls,
        'critical_controls', v.critical_controls,
        'controls_with_evidence_percentage', v.controls_with_evidence_percentage
      ),
      jsonb_build_object(
        'kpi_code', kd.code,
        'source_view', 'v_tenant_health_summary',
        'formula_version', 'control_health_v1'
      ),
      now()
    FROM v_tenant_health_summary v
    JOIN kpi_definitions kd ON kd.code = 'KPI-HLT-001'
    WHERE v.tenant_id = $1
    `,
    [tenantId]
  );

  await client.query(
    `
    INSERT INTO kpi_snapshots (
      tenant_id,
      kpi_id,
      standard_code,
      period_type,
      period_start,
      period_end,
      value,
      numerator_value,
      denominator_value,
      status_color,
      direction,
      target_value,
      calculated_from,
      breakdown_json,
      source_trace_json,
      calculated_at
    )
    SELECT
      v.tenant_id,
      kd.id,
      v.standard_code,
      'mensual'::kpi_period_type_enum,
      ${periodStart},
      ${periodEnd},
      v.avg_health_score,
      v.avg_health_score,
      100,
      CASE
        WHEN v.avg_health_score >= 85 THEN 'green'
        WHEN v.avg_health_score >= 60 THEN 'yellow'
        ELSE 'red'
      END::kpi_status_color_enum,
      kd.direction,
      kd.target_value,
      'control_health_engine',
      jsonb_build_object(
        'standard_name', v.standard_name,
        'total_controls', v.total_controls,
        'healthy_controls', v.healthy_controls,
        'attention_controls', v.attention_controls,
        'deteriorated_controls', v.deteriorated_controls,
        'critical_controls', v.critical_controls,
        'controls_with_evidence_percentage', v.controls_with_evidence_percentage
      ),
      jsonb_build_object(
        'kpi_code', kd.code,
        'source_view', 'v_standard_health_summary',
        'formula_version', 'control_health_v1'
      ),
      now()
    FROM v_standard_health_summary v
    JOIN kpi_definitions kd ON kd.code = 'KPI-HLT-002'
    WHERE v.tenant_id = $1
    `,
    [tenantId]
  );

  await client.query(
    `
    INSERT INTO kpi_snapshots (
      tenant_id,
      kpi_id,
      standard_code,
      period_type,
      period_start,
      period_end,
      value,
      numerator_value,
      denominator_value,
      status_color,
      direction,
      target_value,
      calculated_from,
      breakdown_json,
      source_trace_json,
      calculated_at
    )
    SELECT
      chs.tenant_id,
      kd.id,
      NULL,
      'mensual'::kpi_period_type_enum,
      ${periodStart},
      ${periodEnd},
      ROUND(COUNT(*) FILTER (WHERE chs.evidence_count > 0)::numeric / NULLIF(COUNT(*), 0) * 100, 6),
      COUNT(*) FILTER (WHERE chs.evidence_count > 0)::numeric,
      COUNT(*)::numeric,
      CASE
        WHEN ROUND(COUNT(*) FILTER (WHERE chs.evidence_count > 0)::numeric / NULLIF(COUNT(*), 0) * 100, 6) >= 85 THEN 'green'
        WHEN ROUND(COUNT(*) FILTER (WHERE chs.evidence_count > 0)::numeric / NULLIF(COUNT(*), 0) * 100, 6) >= 60 THEN 'yellow'
        ELSE 'red'
      END::kpi_status_color_enum,
      kd.direction,
      kd.target_value,
      'control_health_engine',
      jsonb_build_object(
        'total_controls', COUNT(*),
        'controls_with_evidence', COUNT(*) FILTER (WHERE chs.evidence_count > 0),
        'total_evidences', SUM(chs.evidence_count),
        'approved_evidences', SUM(chs.approved_evidence_count),
        'pending_evidences', SUM(chs.pending_evidence_count),
        'rejected_evidences', SUM(chs.rejected_evidence_count)
      ),
      jsonb_build_object(
        'kpi_code', kd.code,
        'source_table', 'control_health_scores',
        'scope', 'tenant_global',
        'formula_version', 'control_health_v1'
      ),
      now()
    FROM control_health_scores chs
    JOIN kpi_definitions kd ON kd.code = 'KPI-HLT-003'
    WHERE chs.tenant_id = $1
    GROUP BY chs.tenant_id, kd.id, kd.direction, kd.target_value
    `,
    [tenantId]
  );

  await client.query(
    `
    INSERT INTO kpi_snapshots (
      tenant_id,
      kpi_id,
      standard_code,
      period_type,
      period_start,
      period_end,
      value,
      numerator_value,
      denominator_value,
      status_color,
      direction,
      target_value,
      calculated_from,
      breakdown_json,
      source_trace_json,
      calculated_at
    )
    SELECT
      chs.tenant_id,
      kd.id,
      chs.standard_code,
      'mensual'::kpi_period_type_enum,
      ${periodStart},
      ${periodEnd},
      ROUND(COUNT(*) FILTER (WHERE chs.evidence_count > 0)::numeric / NULLIF(COUNT(*), 0) * 100, 6),
      COUNT(*) FILTER (WHERE chs.evidence_count > 0)::numeric,
      COUNT(*)::numeric,
      CASE
        WHEN ROUND(COUNT(*) FILTER (WHERE chs.evidence_count > 0)::numeric / NULLIF(COUNT(*), 0) * 100, 6) >= 85 THEN 'green'
        WHEN ROUND(COUNT(*) FILTER (WHERE chs.evidence_count > 0)::numeric / NULLIF(COUNT(*), 0) * 100, 6) >= 60 THEN 'yellow'
        ELSE 'red'
      END::kpi_status_color_enum,
      kd.direction,
      kd.target_value,
      'control_health_engine',
      jsonb_build_object(
        'total_controls', COUNT(*),
        'controls_with_evidence', COUNT(*) FILTER (WHERE chs.evidence_count > 0),
        'total_evidences', SUM(chs.evidence_count),
        'approved_evidences', SUM(chs.approved_evidence_count),
        'pending_evidences', SUM(chs.pending_evidence_count),
        'rejected_evidences', SUM(chs.rejected_evidence_count)
      ),
      jsonb_build_object(
        'kpi_code', kd.code,
        'source_table', 'control_health_scores',
        'scope', 'tenant_standard',
        'formula_version', 'control_health_v1'
      ),
      now()
    FROM control_health_scores chs
    JOIN kpi_definitions kd ON kd.code = 'KPI-HLT-003'
    WHERE chs.tenant_id = $1
    GROUP BY chs.tenant_id, chs.standard_code, kd.id, kd.direction, kd.target_value
    `,
    [tenantId]
  );

  await client.query(
    `
    INSERT INTO kpi_snapshots (
      tenant_id,
      kpi_id,
      standard_code,
      period_type,
      period_start,
      period_end,
      value,
      numerator_value,
      denominator_value,
      status_color,
      direction,
      target_value,
      calculated_from,
      breakdown_json,
      source_trace_json,
      calculated_at
    )
    SELECT
      chs.tenant_id,
      kd.id,
      NULL,
      'mensual'::kpi_period_type_enum,
      ${periodStart},
      ${periodEnd},
      ROUND(COUNT(*) FILTER (WHERE chs.health_status IN ('deteriorado', 'critico'))::numeric / NULLIF(COUNT(*), 0) * 100, 6),
      COUNT(*) FILTER (WHERE chs.health_status IN ('deteriorado', 'critico'))::numeric,
      COUNT(*)::numeric,
      CASE
        WHEN ROUND(COUNT(*) FILTER (WHERE chs.health_status IN ('deteriorado', 'critico'))::numeric / NULLIF(COUNT(*), 0) * 100, 6) <= 10 THEN 'green'
        WHEN ROUND(COUNT(*) FILTER (WHERE chs.health_status IN ('deteriorado', 'critico'))::numeric / NULLIF(COUNT(*), 0) * 100, 6) <= 30 THEN 'yellow'
        ELSE 'red'
      END::kpi_status_color_enum,
      kd.direction,
      kd.target_value,
      'control_health_engine',
      jsonb_build_object(
        'total_controls', COUNT(*),
        'deteriorated_or_critical_controls', COUNT(*) FILTER (WHERE chs.health_status IN ('deteriorado', 'critico'))
      ),
      jsonb_build_object(
        'kpi_code', kd.code,
        'source_table', 'control_health_scores',
        'scope', 'tenant_global',
        'formula_version', 'control_health_v1'
      ),
      now()
    FROM control_health_scores chs
    JOIN kpi_definitions kd ON kd.code = 'KPI-HLT-004'
    WHERE chs.tenant_id = $1
    GROUP BY chs.tenant_id, kd.id, kd.direction, kd.target_value
    `,
    [tenantId]
  );

  await client.query(
    `
    INSERT INTO kpi_snapshots (
      tenant_id,
      kpi_id,
      standard_code,
      period_type,
      period_start,
      period_end,
      value,
      numerator_value,
      denominator_value,
      status_color,
      direction,
      target_value,
      calculated_from,
      breakdown_json,
      source_trace_json,
      calculated_at
    )
    SELECT
      chs.tenant_id,
      kd.id,
      chs.standard_code,
      'mensual'::kpi_period_type_enum,
      ${periodStart},
      ${periodEnd},
      ROUND(COUNT(*) FILTER (WHERE chs.health_status IN ('deteriorado', 'critico'))::numeric / NULLIF(COUNT(*), 0) * 100, 6),
      COUNT(*) FILTER (WHERE chs.health_status IN ('deteriorado', 'critico'))::numeric,
      COUNT(*)::numeric,
      CASE
        WHEN ROUND(COUNT(*) FILTER (WHERE chs.health_status IN ('deteriorado', 'critico'))::numeric / NULLIF(COUNT(*), 0) * 100, 6) <= 10 THEN 'green'
        WHEN ROUND(COUNT(*) FILTER (WHERE chs.health_status IN ('deteriorado', 'critico'))::numeric / NULLIF(COUNT(*), 0) * 100, 6) <= 30 THEN 'yellow'
        ELSE 'red'
      END::kpi_status_color_enum,
      kd.direction,
      kd.target_value,
      'control_health_engine',
      jsonb_build_object(
        'total_controls', COUNT(*),
        'deteriorated_or_critical_controls', COUNT(*) FILTER (WHERE chs.health_status IN ('deteriorado', 'critico'))
      ),
      jsonb_build_object(
        'kpi_code', kd.code,
        'source_table', 'control_health_scores',
        'scope', 'tenant_standard',
        'formula_version', 'control_health_v1'
      ),
      now()
    FROM control_health_scores chs
    JOIN kpi_definitions kd ON kd.code = 'KPI-HLT-004'
    WHERE chs.tenant_id = $1
    GROUP BY chs.tenant_id, chs.standard_code, kd.id, kd.direction, kd.target_value
    `,
    [tenantId]
  );

  const { rows } = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM kpi_snapshots ks
    JOIN kpi_definitions kd ON kd.id = ks.kpi_id
    WHERE ks.tenant_id = $1
      AND kd.code LIKE 'KPI-HLT-%'
      AND ks.period_start = date_trunc('month', current_date)::date
    `,
    [tenantId]
  );

  return Number(rows[0]?.total || 0);
}

async function recalculateTenantKpis(req, res) {
  const { tenantId } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId requerido' });
  }

  if (!canAccessTenant(req, tenantId)) {
    return denyTenantAccess(res);
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const kpis = await getKpiDefinitionsForTenant(tenantId);

    if (!kpis.length) {
      await client.query('COMMIT');
      return res.json({ ok: true, recalculated: 0, health_recalculated: 0, snapshots: [] });
    }

    const snapshotsCreated = [];

    for (const kpi of kpis) {
      if (isHealthKpiCode(kpi.code)) {
        continue;
      }

      const isEnabled = kpi.is_enabled !== false;
      if (!isEnabled) continue;

      const periodType = kpi.override_frequency || kpi.frequency;
      const direction = kpi.override_direction || kpi.direction;
      const targetValue = numericOrNull(kpi.override_target_value ?? kpi.target_value);

      const { start, end } = parsePeriod(periodType);
      const periodStart = toDateOnly(start);
      const periodEnd = toDateOnly(end);

      const standardCodes =
        Array.isArray(kpi.applicable_standards) && kpi.applicable_standards.length
          ? kpi.applicable_standards
          : [null];

      for (const standardCode of standardCodes) {
        let calc = {
          value: null,
          numerator: null,
          denominator: null,
          breakdown: {}
        };

        if (kpi.kpi_type === 'automatico' || kpi.kpi_type === 'hibrido') {
          calc = await computeAutomaticLikeValue(
            client,
            tenantId,
            kpi.code,
            periodStart,
            periodEnd
          );
        }

        const manual = await getManualValueForPeriod(
          client,
          tenantId,
          kpi.id,
          standardCode,
          periodType,
          periodStart,
          periodEnd
        );

        if (kpi.kpi_type === 'manual') {
          calc = {
            value: manual?.value ?? null,
            numerator: manual?.numerator_value ?? null,
            denominator: manual?.denominator_value ?? null,
            breakdown: manual?.dimension_data || {}
          };
        } else if (kpi.kpi_type === 'hibrido' && manual) {
          calc = {
            value: manual.value ?? calc.value,
            numerator: manual.numerator_value ?? calc.numerator,
            denominator: manual.denominator_value ?? calc.denominator,
            breakdown: {
              ...(calc.breakdown || {}),
              ...(manual.dimension_data || {}),
              manual_override: true
            }
          };
        }

        const statusColor = getStatusColor(direction, calc.value, {
          green_min: kpi.green_min,
          green_max: kpi.green_max,
          yellow_min: kpi.yellow_min,
          yellow_max: kpi.yellow_max,
          red_min: kpi.red_min,
          red_max: kpi.red_max
        });

        const insertRes = await client.query(
          `
          INSERT INTO kpi_snapshots (
            tenant_id,
            kpi_id,
            standard_code,
            period_type,
            period_start,
            period_end,
            value,
            numerator_value,
            denominator_value,
            status_color,
            direction,
            target_value,
            calculated_from,
            breakdown_json,
            source_trace_json,
            calculated_at
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now()
          )
          RETURNING *
          `,
          [
            tenantId,
            kpi.id,
            standardCode,
            periodType,
            periodStart,
            periodEnd,
            calc.value,
            calc.numerator,
            calc.denominator,
            statusColor,
            direction,
            targetValue,
            kpi.kpi_type === 'manual'
              ? 'manual'
              : manual && kpi.kpi_type === 'hibrido'
              ? 'hybrid'
              : 'engine',
            JSON.stringify(calc.breakdown || {}),
            JSON.stringify({
              kpi_code: kpi.code,
              kpi_type: kpi.kpi_type,
              standard_code: standardCode,
              period_type: periodType
            })
          ]
        );

        snapshotsCreated.push(insertRes.rows[0]);
      }
    }

    const healthRecalculated = await regenerateHealthKpiSnapshotsForTenant(client, tenantId);

    await client.query(
      `
      INSERT INTO kpi_calculation_jobs (
        tenant_id,
        job_type,
        trigger_source,
        status,
        requested_by,
        payload_json,
        result_json,
        started_at,
        finished_at
      )
      VALUES ($1, 'recalculate_all', 'manual', 'completed', $2, $3, $4, now(), now())
      `,
      [
        tenantId,
        req.user?.userId || req.user?.id || null,
        JSON.stringify({ tenantId }),
        JSON.stringify({
          snapshots: snapshotsCreated.length,
          health_snapshots: healthRecalculated
        })
      ]
    );

    await client.query('COMMIT');

    return res.json({
      ok: true,
      recalculated: snapshotsCreated.length,
      health_recalculated: healthRecalculated,
      snapshots: snapshotsCreated
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('RECALCULATE KPI ERROR:', err);
    return res.status(500).json({ error: 'Error recalculando KPIs' });
  } finally {
    client.release();
  }
}
async function getCatalogByTenant(req, res) {
  try {
    const { tenantId } = req.params;
    const kpis = await getKpiDefinitionsForTenant(tenantId);

    return res.json(
      kpis.map((k) => ({
        id: k.id,
        code: k.code,
        name: k.custom_label || k.name,
        description: k.custom_description || k.description,
        category: k.category,
        kpi_type: k.kpi_type,
        unit: k.unit,
        frequency: k.override_frequency || k.frequency,
        direction: k.override_direction || k.direction,
        target_value: numericOrNull(k.override_target_value ?? k.target_value),
        is_standard: k.is_standard,
        is_enabled: k.is_enabled !== false,
        applicable_standards: k.applicable_standards || [],
        metadata: k.metadata || {}
      }))
    );
  } catch (err) {
    console.error('GET KPI CATALOG ERROR:', err);
    return res.status(500).json({ error: 'Error obteniendo catálogo KPI' });
  }
}

async function getAdminListByTenant(req, res) {
  try {
    const { tenantId } = req.params;

    if (!canAccessTenant(req, tenantId)) {
      return denyTenantAccess(res);
    }

    const kpis = await getKpiDefinitionsForTenant(tenantId);
    const snapshotsMap = await getLatestSnapshotsMap(tenantId);

    return res.json(
      kpis.map((k) => {
        const snapshotGroup = snapshotsMap.get(k.id);
        const latest = snapshotGroup?.latest || null;
        const latestSnapshots = snapshotGroup?.snapshots || [];

        return {
          id: k.id,
          code: k.code,
          name: k.name,
          custom_label: k.custom_label,
          description: k.description,
          custom_description: k.custom_description,
          category: k.category,
          kpi_type: k.kpi_type,
          unit: k.unit,
          frequency: k.frequency,
          override_frequency: k.override_frequency,
          direction: k.direction,
          override_direction: k.override_direction,
          target_value: k.target_value,
          override_target_value: k.override_target_value,
          is_standard: k.is_standard,
          is_enabled: k.is_enabled !== false,
          tenant_id: k.tenant_id,
          applicable_standards: k.applicable_standards || [],
          is_health_kpi: isHealthKpiCode(k.code),
          latest_value: latest?.value ?? null,
          latest_status_color: latest?.status_color ?? null,
          latest_standard_code: latest?.standard_code ?? null,
          latest_period_start: latest?.period_start ?? null,
          latest_period_end: latest?.period_end ?? null,
          latest_calculated_at: latest?.calculated_at ?? null,
          has_multiple_snapshots: latestSnapshots.length > 1,
          latest_snapshots: latestSnapshots.map((s) => ({
            id: s.id,
            standard_code: s.standard_code,
            value: s.value,
            numerator_value: s.numerator_value,
            denominator_value: s.denominator_value,
            status_color: s.status_color,
            period_type: s.period_type,
            period_start: s.period_start,
            period_end: s.period_end,
            calculated_at: s.calculated_at,
            breakdown_json: s.breakdown_json || {}
          })),
          thresholds: {
            green_min: k.green_min,
            green_max: k.green_max,
            yellow_min: k.yellow_min,
            yellow_max: k.yellow_max,
            red_min: k.red_min,
            red_max: k.red_max,
            override: k.override_thresholds_json || {}
          }
        };
      })
    );
  } catch (err) {
    console.error('GET KPI ADMIN ERROR:', err);
    return res.status(500).json({ error: 'Error obteniendo administración KPI' });
  }
}

async function getDashboardByTenant(req, res) {
  try {
    const { tenantId } = req.params;

    if (!canAccessTenant(req, tenantId)) {
      return denyTenantAccess(res);
    }

    const kpis = await getKpiDefinitionsForTenant(tenantId);
    const snapshotsMap = await getLatestSnapshotsMap(tenantId);

    const items = [];

    for (const kpi of kpis) {
      const snapshotGroup = snapshotsMap.get(kpi.id);
      const snap = snapshotGroup?.latest || null;
      const allSnapshots = snapshotGroup?.snapshots || [];

      const previous = snap
        ? await getPreviousSnapshot(tenantId, kpi.id, snap.calculated_at)
        : null;

      const currentValue =
        snap?.value !== null && snap?.value !== undefined
          ? Number(snap.value)
          : null;

      const previousValue =
        previous?.value !== null && previous?.value !== undefined
          ? Number(previous.value)
          : null;

      let delta = null;

      if (currentValue !== null && previousValue !== null) {
        delta = currentValue - previousValue;
      }

      items.push({
        id: kpi.id,
        code: kpi.code,
        name: kpi.custom_label || kpi.name,
        description: kpi.custom_description || kpi.description,
        category: kpi.category,
        kpi_type: kpi.kpi_type,
        unit: kpi.unit,
        frequency: kpi.override_frequency || kpi.frequency,
        direction: kpi.override_direction || kpi.direction,
        target_value: numericOrNull(kpi.override_target_value ?? kpi.target_value),
        applicable_standards: kpi.applicable_standards || [],
        is_enabled: kpi.is_enabled !== false,
        is_health_kpi: isHealthKpiCode(kpi.code),
        latest_snapshot: snap
          ? {
              value: currentValue,
              numerator_value: numericOrNull(snap.numerator_value),
              denominator_value: numericOrNull(snap.denominator_value),
              status_color: snap.status_color,
              period_type: snap.period_type,
              period_start: snap.period_start,
              period_end: snap.period_end,
              standard_code: snap.standard_code,
              calculated_at: snap.calculated_at,
              breakdown_json: snap.breakdown_json || {}
            }
          : null,
        latest_snapshots: allSnapshots.map((s) => ({
          value: numericOrNull(s.value),
          numerator_value: numericOrNull(s.numerator_value),
          denominator_value: numericOrNull(s.denominator_value),
          status_color: s.status_color,
          period_type: s.period_type,
          period_start: s.period_start,
          period_end: s.period_end,
          standard_code: s.standard_code,
          calculated_at: s.calculated_at,
          breakdown_json: s.breakdown_json || {}
        })),
        has_multiple_snapshots: allSnapshots.length > 1,
        delta
      });
    }

    const summary = {
      total_kpis: items.length,
      green: items.filter((i) => i.latest_snapshot?.status_color === 'green').length,
      yellow: items.filter((i) => i.latest_snapshot?.status_color === 'yellow').length,
      red: items.filter((i) => i.latest_snapshot?.status_color === 'red').length,
      gray: items.filter(
        (i) => !i.latest_snapshot || i.latest_snapshot?.status_color === 'gray'
      ).length,
      health_kpis: items.filter((i) => i.is_health_kpi).length
    };

    return res.json({ summary, items });
  } catch (err) {
    console.error('GET KPI DASHBOARD ERROR:', err);
    return res.status(500).json({ error: 'Error obteniendo dashboard KPI' });
  }
}


async function createCustomKpi(req, res) {
  try {
    const {
      tenant_id,
      code,
      name,
      description,
      category,
      kpi_type,
      unit,
      base_formula,
      formula_expression,
      data_source_summary,
      frequency,
      direction,
      target_value,
      min_value,
      max_value,
      standard_codes = [],
      green_min,
      green_max,
      yellow_min,
      yellow_max,
      red_min,
      red_max
    } = req.body || {};

    if (!tenant_id || !name || !category || !kpi_type || !unit || !frequency || !direction) {
      return res.status(400).json({ error: 'Faltan campos requeridos para KPI personalizado' });
    }

    const customCode = code && String(code).trim()
      ? String(code).trim()
      : `KPI-CUSTOM-${Date.now()}`;

    const insertRes = await db.query(
      `
      INSERT INTO kpi_definitions (
        code,
        name,
        description,
        category,
        kpi_type,
        scope,
        unit,
        base_formula,
        formula_expression,
        data_source_summary,
        frequency,
        direction,
        target_value,
        min_value,
        max_value,
        display_order,
        is_standard,
        tenant_id,
        created_by,
        is_active,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,'tenant',$6,$7,$8,$9,$10,$11,$12,$13,$14,999,false,$15,$16,true,$17
      )
      RETURNING *
      `,
      [
        customCode,
        name,
        description || null,
        category,
        kpi_type,
        unit,
        base_formula || null,
        formula_expression || null,
        data_source_summary || null,
        frequency,
        direction,
        numericOrNull(target_value),
        numericOrNull(min_value),
        numericOrNull(max_value),
        tenant_id,
        req.user?.userId || null,
        JSON.stringify({ custom: true })
      ]
    );

    const kpi = insertRes.rows[0];

    await db.query(
      `
      INSERT INTO kpi_thresholds (
        kpi_id,
        green_min,
        green_max,
        yellow_min,
        yellow_max,
        red_min,
        red_max,
        direction,
        notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        kpi.id,
        numericOrNull(green_min),
        numericOrNull(green_max),
        numericOrNull(yellow_min),
        numericOrNull(yellow_max),
        numericOrNull(red_min),
        numericOrNull(red_max),
        direction,
        'Umbrales KPI personalizado'
      ]
    );

    for (const standardCode of standard_codes) {
      await db.query(
        `
        INSERT INTO kpi_standard_mappings (
          kpi_id,
          standard_code,
          variation_label,
          relevance_weight,
          is_active
        )
        VALUES ($1,$2,$3,100,true)
        ON CONFLICT (kpi_id, standard_code) DO NOTHING
        `,
        [kpi.id, standardCode, name]
      );
    }

    await db.query(
      `
      INSERT INTO tenant_kpi_settings (
        tenant_id,
        kpi_id,
        is_enabled
      )
      VALUES ($1,$2,true)
      ON CONFLICT (tenant_id, kpi_id) DO NOTHING
      `,
      [tenant_id, kpi.id]
    );

    return res.json(kpi);
  } catch (err) {
    console.error('CREATE CUSTOM KPI ERROR:', err);
    return res.status(500).json({ error: 'Error creando KPI personalizado' });
  }
}

async function updateCustomKpi(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      kpi_type,
      unit,
      base_formula,
      formula_expression,
      data_source_summary,
      frequency,
      direction,
      target_value,
      min_value,
      max_value,
      is_active,
      standard_codes = [],
      green_min,
      green_max,
      yellow_min,
      yellow_max,
      red_min,
      red_max
    } = req.body || {};

    const existingRes = await db.query(
      `SELECT * FROM kpi_definitions WHERE id = $1`,
      [id]
    );

    if (!existingRes.rows.length) {
      return res.status(404).json({ error: 'KPI no encontrado' });
    }

    const existing = existingRes.rows[0];

    if (existing.is_standard) {
      return res.status(400).json({ error: 'No se puede editar un KPI estándar desde este endpoint' });
    }

    const updatedRes = await db.query(
      `
      UPDATE kpi_definitions
      SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        category = COALESCE($4, category),
        kpi_type = COALESCE($5, kpi_type),
        unit = COALESCE($6, unit),
        base_formula = COALESCE($7, base_formula),
        formula_expression = COALESCE($8, formula_expression),
        data_source_summary = COALESCE($9, data_source_summary),
        frequency = COALESCE($10, frequency),
        direction = COALESCE($11, direction),
        target_value = COALESCE($12, target_value),
        min_value = COALESCE($13, min_value),
        max_value = COALESCE($14, max_value),
        is_active = COALESCE($15, is_active)
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        name || null,
        description || null,
        category || null,
        kpi_type || null,
        unit || null,
        base_formula || null,
        formula_expression || null,
        data_source_summary || null,
        frequency || null,
        direction || null,
        numericOrNull(target_value),
        numericOrNull(min_value),
        numericOrNull(max_value),
        typeof is_active === 'boolean' ? is_active : null
      ]
    );

    await db.query(
      `
      UPDATE kpi_thresholds
      SET
        green_min = COALESCE($2, green_min),
        green_max = COALESCE($3, green_max),
        yellow_min = COALESCE($4, yellow_min),
        yellow_max = COALESCE($5, yellow_max),
        red_min = COALESCE($6, red_min),
        red_max = COALESCE($7, red_max),
        direction = COALESCE($8, direction),
        notes = 'Umbrales KPI personalizado actualizados'
      WHERE kpi_id = $1
      `,
      [
        id,
        numericOrNull(green_min),
        numericOrNull(green_max),
        numericOrNull(yellow_min),
        numericOrNull(yellow_max),
        numericOrNull(red_min),
        numericOrNull(red_max),
        direction || null
      ]
    );

    if (Array.isArray(standard_codes)) {
      await db.query(`DELETE FROM kpi_standard_mappings WHERE kpi_id = $1`, [id]);

      for (const standardCode of standard_codes) {
        await db.query(
          `
          INSERT INTO kpi_standard_mappings (
            kpi_id,
            standard_code,
            variation_label,
            relevance_weight,
            is_active
          )
          VALUES ($1,$2,$3,100,true)
          `,
          [id, standardCode, updatedRes.rows[0].name]
        );
      }
    }

    return res.json(updatedRes.rows[0]);
  } catch (err) {
    console.error('UPDATE CUSTOM KPI ERROR:', err);
    return res.status(500).json({ error: 'Error actualizando KPI personalizado' });
  }
}

async function upsertTenantKpiSetting(req, res) {
  try {
    const {
      tenant_id,
      kpi_id,
      is_enabled,
      override_frequency,
      override_target_value,
      override_direction,
      override_thresholds_json,
      custom_label,
      custom_description
    } = req.body || {};

    if (!tenant_id || !kpi_id) {
      return res.status(400).json({ error: 'tenant_id y kpi_id son requeridos' });
    }

    const { rows } = await db.query(
      `
      INSERT INTO tenant_kpi_settings (
        tenant_id,
        kpi_id,
        is_enabled,
        override_frequency,
        override_target_value,
        override_direction,
        override_thresholds_json,
        custom_label,
        custom_description
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (tenant_id, kpi_id)
      DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        override_frequency = EXCLUDED.override_frequency,
        override_target_value = EXCLUDED.override_target_value,
        override_direction = EXCLUDED.override_direction,
        override_thresholds_json = EXCLUDED.override_thresholds_json,
        custom_label = EXCLUDED.custom_label,
        custom_description = EXCLUDED.custom_description,
        updated_at = now()
      RETURNING *
      `,
      [
        tenant_id,
        kpi_id,
        typeof is_enabled === 'boolean' ? is_enabled : true,
        override_frequency || null,
        numericOrNull(override_target_value),
        override_direction || null,
        JSON.stringify(override_thresholds_json || {}),
        custom_label || null,
        custom_description || null
      ]
    );

    return res.json(rows[0]);
  } catch (err) {
    console.error('UPSERT TENANT KPI SETTING ERROR:', err);
    return res.status(500).json({ error: 'Error guardando configuración KPI por tenant' });
  }
}

async function saveManualValue(req, res) {
  try {
    const {
      tenant_id,
      kpi_id,
      standard_code,
      period_type,
      period_start,
      period_end,
      value,
      numerator_value,
      denominator_value,
      dimension_data,
      notes
    } = req.body || {};

    if (!tenant_id || !kpi_id || !period_type || !period_start || !period_end) {
      return res.status(400).json({ error: 'Faltan campos requeridos para valor manual KPI' });
    }

    const { rows } = await db.query(
      `
      INSERT INTO kpi_manual_values (
        tenant_id,
        kpi_id,
        standard_code,
        period_type,
        period_start,
        period_end,
        value,
        numerator_value,
        denominator_value,
        dimension_data,
        notes,
        entered_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
      `,
      [
        tenant_id,
        kpi_id,
        standard_code || null,
        period_type,
        period_start,
        period_end,
        numericOrNull(value),
        numericOrNull(numerator_value),
        numericOrNull(denominator_value),
        JSON.stringify(dimension_data || {}),
        notes || null,
        req.user?.userId || null
      ]
    );

    return res.json(rows[0]);
  } catch (err) {
    console.error('SAVE KPI MANUAL VALUE ERROR:', err);
    return res.status(500).json({ error: 'Error guardando valor manual KPI' });
  }
}

async function deleteCustomKpi(req, res) {
  try {
    const { id } = req.params;

    const existingRes = await db.query(
      `SELECT * FROM kpi_definitions WHERE id = $1`,
      [id]
    );

    if (!existingRes.rows.length) {
      return res.status(404).json({ error: 'KPI no encontrado' });
    }

    const existing = existingRes.rows[0];

    if (existing.is_standard) {
      return res.status(400).json({ error: 'No se puede eliminar un KPI estándar' });
    }

    await db.query(`DELETE FROM kpi_definitions WHERE id = $1`, [id]);

    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE CUSTOM KPI ERROR:', err);
    return res.status(500).json({ error: 'Error eliminando KPI personalizado' });
  }
}




module.exports = {
  getCatalogByTenant,
  getDashboardByTenant,
  getAdminListByTenant,
  createCustomKpi,
  deleteCustomKpi,
  updateCustomKpi,
  upsertTenantKpiSetting,
  saveManualValue,
  recalculateTenantKpis
};
