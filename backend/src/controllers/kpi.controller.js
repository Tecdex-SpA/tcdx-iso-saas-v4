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

const tableColumnsCache = new Map();

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

async function getTableColumns(client, tableName) {
  if (tableColumnsCache.has(tableName)) {
    return tableColumnsCache.get(tableName);
  }

  const { rows } = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  );

  const columns = new Set(rows.map((r) => r.column_name));
  tableColumnsCache.set(tableName, columns);
  return columns;
}

async function findFirstExistingColumn(client, tableName, candidates = []) {
  const columns = await getTableColumns(client, tableName);
  return candidates.find((c) => columns.has(c)) || null;
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

function kpiStatusHasNumber(v) {
  if (v === null || v === undefined || v === '') return false;
  return Number.isFinite(Number(v));
}

function kpiStatusNumberOrNull(v) {
  return kpiStatusHasNumber(v) ? Number(v) : null;
}

function kpiValueInRange(value, min, max) {
  const val = kpiStatusNumberOrNull(value);
  const nMin = kpiStatusNumberOrNull(min);
  const nMax = kpiStatusNumberOrNull(max);

  if (val === null || nMin === null || nMax === null) return false;

  return val >= nMin && val <= nMax;
}

function getStatusColor(direction, value, thresholdRow = {}, targetValue = null) {
  if (!kpiStatusHasNumber(value)) return 'gray';

  const val = Number(value);
  const dir = String(direction || '').trim();

  if (dir === 'higher_is_better') {
    if (kpiValueInRange(val, thresholdRow?.green_min, thresholdRow?.green_max)) return 'green';
    if (kpiValueInRange(val, thresholdRow?.yellow_min, thresholdRow?.yellow_max)) return 'yellow';
    if (kpiValueInRange(val, thresholdRow?.red_min, thresholdRow?.red_max)) return 'red';

    const target = kpiStatusNumberOrNull(targetValue);
    if (target !== null) {
      if (val >= target) return 'green';
      if (val >= target * 0.7) return 'yellow';
      return 'red';
    }

    if (val >= 85) return 'green';
    if (val >= 60) return 'yellow';
    return 'red';
  }

  if (dir === 'lower_is_better') {
    if (kpiValueInRange(val, thresholdRow?.green_min, thresholdRow?.green_max)) return 'green';
    if (kpiValueInRange(val, thresholdRow?.yellow_min, thresholdRow?.yellow_max)) return 'yellow';
    if (kpiValueInRange(val, thresholdRow?.red_min, thresholdRow?.red_max)) return 'red';

    const target = kpiStatusNumberOrNull(targetValue);
    if (target !== null) {
      if (val <= target) return 'green';
      if (val <= target * 1.5) return 'yellow';
      return 'red';
    }

    if (val <= 10) return 'green';
    if (val <= 30) return 'yellow';
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
      COALESCE(tks.is_enabled, true) AS is_enabled,
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
          PARTITION BY ks.kpi_id, COALESCE(NULLIF(ks.standard_code, ''), 'GLOBAL')
          ORDER BY ks.calculated_at DESC NULLS LAST, ks.period_start DESC NULLS LAST
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
      NULLIF(standard_code, '') AS standard_code,
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
      calculated_at,
      breakdown_json,
      source_trace_json
    FROM ranked
    WHERE rn = 1
    ORDER BY kpi_code, standard_code NULLS FIRST, calculated_at DESC NULLS LAST
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

    if (
      !existing.latest ||
      new Date(row.calculated_at || 0).getTime() >
        new Date(existing.latest.calculated_at || 0).getTime()
    ) {
      existing.latest = row;
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

async function computeAutomaticLikeValue(client, tenantId, kpiCode, periodStart, periodEnd, standardCode = null) {
  switch (kpiCode) {

    case KPI_CODES.OBJECTIVES: {
      /*
        KPI-01 - Cumplimiento de Objetivos

        Fórmula:
        (objetivos_cumplidos / objetivos_totales) * 100

        Reglas:
        - Solo considera objetivos activos.
        - Si no hay objetivos para el tenant/periodo/norma: Sin dato.
        - Los objetivos cancelados no cuentan.
        - Un objetivo se considera cumplido si:
          a) status está en cumplido/completado/cerrado/achieved, o
          b) progress_percent >= 100, o
          c) actual_value >= target_value cuando target_value > 0.
      */

      const tableExistsRes = await client.query(
        `SELECT to_regclass('public.management_objectives') AS table_name`
      );

      if (!tableExistsRes.rows[0]?.table_name) {
        return {
          value: null,
          numerator: null,
          denominator: null,
          breakdown: {
            reason:
              'No existe tabla management_objectives para calcular KPI-01',
          },
        };
      }

      const res = await client.query(
        `
        SELECT
          COUNT(*) FILTER (
            WHERE is_active = true
              AND LOWER(COALESCE(status, '')) NOT IN (
                'cancelado',
                'cancelada',
                'cancelled'
              )
          )::int AS total,

          COUNT(*) FILTER (
            WHERE is_active = true
              AND LOWER(COALESCE(status, '')) NOT IN (
                'cancelado',
                'cancelada',
                'cancelled'
              )
              AND (
                LOWER(COALESCE(status, '')) IN (
                  'cumplido',
                  'cumplida',
                  'completado',
                  'completada',
                  'cerrado',
                  'cerrada',
                  'completed',
                  'achieved',
                  'done'
                )
                OR COALESCE(progress_percent, 0) >= 100
                OR (
                  target_value IS NOT NULL
                  AND target_value > 0
                  AND actual_value IS NOT NULL
                  AND actual_value >= target_value
                )
              )
          )::int AS completed,

          AVG(
            COALESCE(
              progress_percent,
              CASE
                WHEN target_value IS NOT NULL
                 AND target_value > 0
                 AND actual_value IS NOT NULL
                THEN LEAST(100, GREATEST(0, (actual_value / target_value) * 100))
                ELSE NULL
              END
            )
          ) FILTER (
            WHERE is_active = true
              AND LOWER(COALESCE(status, '')) NOT IN (
                'cancelado',
                'cancelada',
                'cancelled'
              )
          ) AS avg_progress
        FROM management_objectives
        WHERE tenant_id = $1
          AND (
            $4::text IS NULL
            OR standard_code IS NULL
            OR standard_code = $4::text
          )
          AND (
            period_start IS NULL
            OR period_end IS NULL
            OR (
              period_start <= $3::date
              AND period_end >= $2::date
            )
          )
        `,
        [tenantId, periodStart, periodEnd, standardCode]
      );

      const total = Number(res.rows[0]?.total || 0);
      const completed = Number(res.rows[0]?.completed || 0);
      const avgProgress =
        res.rows[0]?.avg_progress === null ||
        res.rows[0]?.avg_progress === undefined
          ? null
          : Number(res.rows[0].avg_progress);

      if (total <= 0) {
        return {
          value: null,
          numerator: null,
          denominator: 0,
          breakdown: {
            objetivos_totales: 0,
            objetivos_cumplidos: 0,
            avance_promedio: null,
            standard_code: standardCode,
            reason:
              'No existen objetivos activos para este tenant/periodo/norma. KPI-01 queda sin dato porque no hay universo evaluable.',
          },
        };
      }

      return {
        value: (completed / total) * 100,
        numerator: completed,
        denominator: total,
        breakdown: {
          objetivos_totales: total,
          objetivos_cumplidos: completed,
          objetivos_pendientes: Math.max(total - completed, 0),
          avance_promedio:
            avgProgress === null ? null : Math.round(avgProgress * 100) / 100,
          standard_code: standardCode,
          criterio:
            'Cumplimiento de objetivos activos del sistema de gestión',
        },
      };
    }

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
      /*
        KPI-07 - Cobertura de Tratamiento de Riesgos

        Concepto correcto:
        - No mide solo riesgos creados en el periodo.
        - Mide la foto actual del tenant:
          riesgos existentes vs riesgos con plan de tratamiento activo asociado.

        Reglas:
        - Si no hay riesgos registrados: Sin dato, porque no hay universo evaluable.
        - Si hay riesgos y ningún plan asociado: 0%, estado rojo.
        - Si hay riesgos tratados: porcentaje real de cobertura.
        - Planes cancelados no cuentan como tratamiento activo.
      */

      const actionPlanColumns = await getTableColumns(client, 'action_plans');

      const linkConditions = [];

      if (actionPlanColumns.has('asset_id')) {
        linkConditions.push('ap.asset_id = a.id');
      }

      if (actionPlanColumns.has('risk_id')) {
        linkConditions.push('ap.risk_id = ar.id');
      }

      if (
        actionPlanColumns.has('source_type') &&
        actionPlanColumns.has('source_id')
      ) {
        linkConditions.push(`
          (
            LOWER(COALESCE(ap.source_type, '')) = 'risk'
            AND (
              ap.source_id::text = ar.id::text
              OR ap.source_id::text = a.id::text
            )
          )
        `);
      }

      if (linkConditions.length === 0) {
        return {
          value: null,
          numerator: null,
          denominator: null,
          breakdown: {
            reason:
              'No existen columnas de vínculo entre action_plans y riesgos/activos para calcular cobertura de tratamiento',
            checked_columns: Array.from(actionPlanColumns),
          },
        };
      }

      const totalRisksRes = await client.query(
        `
        SELECT COUNT(DISTINCT ar.id)::int AS total
        FROM asset_risks ar
        JOIN assets a
          ON a.id = ar.asset_id
        WHERE a.tenant_id = $1
        `,
        [tenantId]
      );

      const treatedRisksRes = await client.query(
        `
        SELECT COUNT(DISTINCT ar.id)::int AS total
        FROM asset_risks ar
        JOIN assets a
          ON a.id = ar.asset_id
        WHERE a.tenant_id = $1
          AND EXISTS (
            SELECT 1
            FROM action_plans ap
            WHERE ap.tenant_id = $1
              AND LOWER(COALESCE(ap.status, '')) NOT IN (
                'cancelado',
                'cancelada',
                'cancelled'
              )
              AND (
                ${linkConditions.join('\n                OR ')}
              )
          )
        `,
        [tenantId]
      );

      const denominator = Number(totalRisksRes.rows[0]?.total || 0);
      const numerator = Number(treatedRisksRes.rows[0]?.total || 0);

      if (denominator <= 0) {
        return {
          value: null,
          numerator: null,
          denominator: 0,
          breakdown: {
            riesgos_identificados: 0,
            riesgos_tratados: 0,
            reason:
              'No existen riesgos registrados para este tenant. KPI-07 queda sin dato porque no hay universo evaluable.',
          },
        };
      }

      return {
        value: (numerator / denominator) * 100,
        numerator,
        denominator,
        breakdown: {
          riesgos_identificados: denominator,
          riesgos_tratados: numerator,
          riesgos_sin_tratamiento: Math.max(denominator - numerator, 0),
          criterio:
            'Cobertura actual de riesgos con al menos un plan de acción activo asociado',
          excluded_plan_statuses: ['cancelado', 'cancelada', 'cancelled'],
          link_conditions_used: linkConditions,
        },
      };
    }

        case KPI_CODES.CONFORMING_AUDITS: {
      const resultColumn = await findFirstExistingColumn(client, 'audits', [
        'result',
        'audit_result',
        'final_result',
        'outcome',
        'conclusion'
      ]);

      if (!resultColumn) {
        return {
          value: null,
          numerator: null,
          denominator: null,
          breakdown: {
            reason:
              'La tabla audits no tiene columna de resultado/conclusión para medir auditorías conformes',
          }
        };
      }

      const finalizedStatuses = [
        'finalizada',
        'finalizado',
        'cerrada',
        'cerrado',
        'completed',
        'complete',
        'closed',
        'done',
        'finished'
      ];

      const excludedStatuses = [
        'en ejecucion',
        'en ejecución',
        'ejecucion',
        'ejecución',
        'in_progress',
        'in progress',
        'en progreso',
        'planificada',
        'planificado',
        'scheduled',
        'programada',
        'programado',
        'pendiente',
        'pending',
        'cancelada',
        'cancelado',
        'cancelled'
      ];

      const conformingValues = [
        'conforme',
        'conformidad',
        'compliant',
        'passed',
        'pass',
        'ok',
        'aprobada',
        'aprobado',
        'sin hallazgos críticos',
        'sin hallazgos criticos'
      ];

      const nonConformingValues = [
        'no conforme',
        'no_conforme',
        'non_compliant',
        'failed',
        'fail',
        'rechazada',
        'rechazado',
        'con hallazgos',
        'con no conformidades'
      ];

      const totalEligibleRes = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM audits
        WHERE tenant_id = $1
          AND start_date BETWEEN $2 AND $3
          AND (
            LOWER(COALESCE(status, '')) = ANY($4::text[])
            OR (
              end_date IS NOT NULL
              AND LOWER(COALESCE(status, '')) <> ALL($5::text[])
            )
          )
        `,
        [tenantId, periodStart, periodEnd, finalizedStatuses, excludedStatuses]
      );

      const conformingRes = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM audits
        WHERE tenant_id = $1
          AND start_date BETWEEN $2 AND $3
          AND (
            LOWER(COALESCE(status, '')) = ANY($4::text[])
            OR (
              end_date IS NOT NULL
              AND LOWER(COALESCE(status, '')) <> ALL($5::text[])
            )
          )
          AND LOWER(COALESCE(${resultColumn}::text, '')) = ANY($6::text[])
        `,
        [
          tenantId,
          periodStart,
          periodEnd,
          finalizedStatuses,
          excludedStatuses,
          conformingValues
        ]
      );

      const classifiedRes = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM audits
        WHERE tenant_id = $1
          AND start_date BETWEEN $2 AND $3
          AND (
            LOWER(COALESCE(status, '')) = ANY($4::text[])
            OR (
              end_date IS NOT NULL
              AND LOWER(COALESCE(status, '')) <> ALL($5::text[])
            )
          )
          AND (
            LOWER(COALESCE(${resultColumn}::text, '')) = ANY($6::text[])
            OR LOWER(COALESCE(${resultColumn}::text, '')) = ANY($7::text[])
          )
        `,
        [
          tenantId,
          periodStart,
          periodEnd,
          finalizedStatuses,
          excludedStatuses,
          conformingValues,
          nonConformingValues
        ]
      );

      const denominator = Number(totalEligibleRes.rows[0]?.total || 0);
      const numerator = Number(conformingRes.rows[0]?.total || 0);
      const classified = Number(classifiedRes.rows[0]?.total || 0);
      const pendingClassification = Math.max(denominator - classified, 0);

      if (denominator <= 0) {
        return {
          value: null,
          numerator: null,
          denominator: 0,
          breakdown: {
            conformes: 0,
            total_finalizadas: 0,
            pendientes_clasificacion: 0,
            excluded_reason:
              'No existen auditorías finalizadas/cerradas en el periodo. Auditorías en ejecución o planificadas no afectan este KPI.',
            result_column_used: resultColumn
          }
        };
      }

      if (pendingClassification > 0 && classified === 0) {
        return {
          value: null,
          numerator: null,
          denominator,
          breakdown: {
            conformes: numerator,
            total_finalizadas: denominator,
            pendientes_clasificacion: pendingClassification,
            reason:
              'Existen auditorías finalizadas sin resultado de conformidad cargado',
            result_column_used: resultColumn
          }
        };
      }

      return {
        value: (numerator / denominator) * 100,
        numerator,
        denominator,
        breakdown: {
          conformes: numerator,
          total_finalizadas: denominator,
          pendientes_clasificacion: pendingClassification,
          result_column_used: resultColumn,
          excluded_statuses: excludedStatuses
        }
      };
    }

    case KPI_CODES.FINDINGS_PER_AUDIT: {
      const findingsRes = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM findings
        WHERE tenant_id = $1
          AND created_at::date BETWEEN $2 AND $3
          AND audit_id IS NOT NULL
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

      const numerator = Number(findingsRes.rows[0]?.total || 0);
      const denominator = Number(auditsRes.rows[0]?.total || 0);

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

async function computeValueForDefinition(client, tenantId, kpiDef, standardCode = null) {
  const periodType = kpiDef.override_frequency || kpiDef.frequency || 'mensual';
  const { start, end } = parsePeriod(periodType);
  const periodStart = toDateOnly(start);
  const periodEnd = toDateOnly(end);

  const kpiCode = kpiDef.code;

  if (kpiDef.kpi_type === 'manual') {
    const orderColumn = await findFirstExistingColumn(client, 'kpi_manual_values', [
      'entered_at',
      'created_at',
      'updated_at',
      'period_end',
      'period_start',
      'id'
    ]);

    const orderClause = orderColumn ? `ORDER BY ${orderColumn} DESC` : '';

    const { rows } = await client.query(
      `
      SELECT *
      FROM kpi_manual_values
      WHERE tenant_id = $1
        AND kpi_id = $2
        AND period_type = $3
        AND period_start = $4
        AND period_end = $5
      ${orderClause}
      LIMIT 1
      `,
      [tenantId, kpiDef.id, periodType, periodStart, periodEnd]
    );

    const manual = rows[0];

    return {
      value: manual ? Number(manual.value) : null,
      numerator: manual ? numericOrNull(manual.numerator_value) : null,
      denominator: manual ? numericOrNull(manual.denominator_value) : null,
      periodType,
      periodStart,
      periodEnd,
      breakdown: manual?.dimension_data || manual?.dimension_json || {},
      source: manual ? 'manual' : 'manual_missing'
    };
  }

   const automatic = await computeAutomaticLikeValue(
    client,
    tenantId,
    kpiCode,
    periodStart,
    periodEnd,
    standardCode
  );

  return {
    ...automatic,
    periodType,
    periodStart,
    periodEnd,
    source: kpiDef.kpi_type === 'hibrido' ? 'hybrid' : 'automatic'
  };
}

async function recalculateTenantKpis(req, res) {
  const tenantId = req.params.tenantId || req.body?.tenant_id;

  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId es requerido' });
  }

  if (!canAccessTenant(req, tenantId)) {
    return denyTenantAccess(res);
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const refreshHealthRes = await client.query(
      `
      SELECT *
      FROM refresh_control_health_scores_v2_1($1::uuid)
      `,
      [tenantId]
    );

    const refreshKpiHealthRes = await client.query(
      `
      SELECT *
      FROM refresh_kpi_health_snapshots($1::uuid)
      `,
      [tenantId]
    );

    await client.query(
      `
      DELETE FROM kpi_snapshots ks
      USING kpi_definitions kd
      WHERE ks.tenant_id = $1
        AND ks.kpi_id = kd.id
        AND kd.code LIKE 'KPI-HLT-%'
        AND COALESCE(ks.standard_code, 'GLOBAL') NOT IN (
          SELECT ts.standard_code
          FROM tenant_standards ts
          WHERE ts.tenant_id = $1
            AND ts.is_active = true
        )
      `,
      [tenantId]
    );

    const defs = (await getKpiDefinitionsForTenant(tenantId))
      .filter((def) => def.is_enabled !== false);
    const snapshotsCreated = [];

    for (const def of defs) {
      if (isHealthKpiCode(def.code)) {
        continue;
      }

            const thresholdRow = {
        green_min: def.green_min,
        green_max: def.green_max,
        yellow_min: def.yellow_min,
        yellow_max: def.yellow_max,
        red_min: def.red_min,
        red_max: def.red_max
      };

      const direction = def.override_direction || def.direction;
      const targetValue =
        def.override_target_value !== null && def.override_target_value !== undefined
          ? Number(def.override_target_value)
          : numericOrNull(def.target_value);

      const applicableStandards = Array.isArray(def.applicable_standards)
        ? def.applicable_standards.filter(Boolean)
        : [];

      const standardsToUse = applicableStandards.length ? applicableStandards : [null];

      for (const standardCode of standardsToUse) {
        const calc = await computeValueForDefinition(client, tenantId, def, standardCode);
        const statusColor = getStatusColor(direction, calc.value, thresholdRow, targetValue);
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
            breakdown_json,
            source_trace_json,
            calculated_at
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW()
          )
          RETURNING *
          `,
          [
            tenantId,
            def.id,
            standardCode,
            calc.periodType,
            calc.periodStart,
            calc.periodEnd,
            calc.value,
            calc.numerator,
            calc.denominator,
            statusColor,
            direction,
            targetValue,
            JSON.stringify(calc.breakdown || {}),
            JSON.stringify({
              source: calc.source,
              standard_code: standardCode,
              formula_expression: def.formula_expression || null,
              base_formula: def.base_formula || null
            })
          ]
        );

        snapshotsCreated.push(insertRes.rows[0]);
      }
    }

    await client.query('COMMIT');

    return res.json({
      ok: true,
      tenant_id: tenantId,
      health_recalculated: Number(refreshHealthRes.rows[0]?.refreshed_rows || 0),
      health_refresh: refreshHealthRes.rows[0] || null,
      health_kpi_refresh: refreshKpiHealthRes.rows || [],
      snapshots_created: snapshotsCreated.length,
      snapshots: snapshotsCreated
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('RECALCULATE KPI ERROR:', err);
    return res.status(500).json({
      error: 'Error recalculando KPIs',
      detail: err.message
    });
  } finally {
    client.release();
  }
}

async function getCatalogByTenant(req, res) {
  try {
    const tenantId = req.params.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId es requerido' });
    }

    if (!canAccessTenant(req, tenantId)) {
      return denyTenantAccess(res);
    }

    const defs = await getKpiDefinitionsForTenant(tenantId);

    return res.json(defs);
  } catch (err) {
    console.error('GET KPI CATALOG ERROR:', err);
    return res.status(500).json({ error: 'Error obteniendo catálogo de KPIs' });
  }
}

async function getDashboardByTenant(req, res) {
  try {
    const tenantId = req.params.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId es requerido' });
    }

    if (!canAccessTenant(req, tenantId)) {
      return denyTenantAccess(res);
    }

    const defs = (await getKpiDefinitionsForTenant(tenantId))
      .filter((def) => def.is_enabled !== false);
    const latestMap = await getLatestSnapshotsMap(tenantId);

    const result = [];

    for (const def of defs) {
      const latestInfo = latestMap.get(def.id) || { latest: null, snapshots: [] };
      const latest = latestInfo.latest;

      let trend = 'flat';
      if (latest) {
        const prev = await getPreviousSnapshot(tenantId, def.id, latest.calculated_at);
        if (prev && prev.value !== null && latest.value !== null) {
          if (Number(latest.value) > Number(prev.value)) trend = 'up';
          else if (Number(latest.value) < Number(prev.value)) trend = 'down';
        }
      }

      result.push({
        id: def.id,
        code: def.code,
        name: def.custom_label || def.name,
        description: def.custom_description || def.description,
        category: def.category,
        unit: def.unit,
        frequency: def.override_frequency || def.frequency,
        direction: def.override_direction || def.direction,
        target_value:
          def.override_target_value !== null && def.override_target_value !== undefined
            ? Number(def.override_target_value)
            : numericOrNull(def.target_value),
        thresholds: def.override_thresholds_json || {
          green_min: numericOrNull(def.green_min),
          green_max: numericOrNull(def.green_max),
          yellow_min: numericOrNull(def.yellow_min),
          yellow_max: numericOrNull(def.yellow_max),
          red_min: numericOrNull(def.red_min),
          red_max: numericOrNull(def.red_max)
        },
        latest_snapshot: latest,
        standard_snapshots: latestInfo.snapshots,
        trend,
        applicable_standards: def.applicable_standards || [],
        enabled: def.is_enabled !== false
      });
    }

    return res.json(result);
  } catch (err) {
    console.error('GET KPI DASHBOARD ERROR:', err);
    return res.status(500).json({ error: 'Error obteniendo dashboard KPI' });
  }
}


async function getEffectiveHealthSummaryByTenant(req, res) {
  try {
    const tenantId = req.params.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId es requerido' });
    }

    if (!canAccessTenant(req, tenantId)) {
      return denyTenantAccess(res);
    }

    const { rows } = await db.query(
      `
      SELECT
        tenant_id,
        iso,
        operation_id,
        operation_name,
        operation_code,
        operation_type,
        total_controls,
        active_scope_controls,
        out_of_scope_controls,
        complies_controls,
        partial_controls,
        non_compliant_or_no_data_controls,
        healthy_controls,
        attention_controls,
        deteriorated_controls,
        controls_with_official_evidence,
        controls_with_approved_non_official_evidence,
        controls_without_evidence,
        approved_evidence_count,
        official_evidence_count,
        open_findings_count,
        open_nonconformities_count,
        open_action_plans_count,
        overdue_action_plans_count,
        avg_effective_health_score,
        compliance_percentage,
        official_evidence_percentage,
        kpi_health_status,
        kpi_trace_json
      FROM public.v_iso_effective_kpi_summary
      WHERE tenant_id = $1
      ORDER BY
        CASE WHEN active_scope_controls > 0 THEN 0 ELSE 1 END,
        iso,
        operation_name
      `,
      [tenantId]
    );

    const summary = rows.map((row) => ({
      tenant_id: row.tenant_id,
      iso: row.iso,
      operation_id: row.operation_id,
      operation_name: row.operation_name,
      operation_code: row.operation_code,
      operation_type: row.operation_type,

      total_controls: Number(row.total_controls || 0),
      active_scope_controls: Number(row.active_scope_controls || 0),
      out_of_scope_controls: Number(row.out_of_scope_controls || 0),

      complies_controls: Number(row.complies_controls || 0),
      partial_controls: Number(row.partial_controls || 0),
      non_compliant_or_no_data_controls: Number(row.non_compliant_or_no_data_controls || 0),

      healthy_controls: Number(row.healthy_controls || 0),
      attention_controls: Number(row.attention_controls || 0),
      deteriorated_controls: Number(row.deteriorated_controls || 0),

      controls_with_official_evidence: Number(row.controls_with_official_evidence || 0),
      controls_with_approved_non_official_evidence: Number(row.controls_with_approved_non_official_evidence || 0),
      controls_without_evidence: Number(row.controls_without_evidence || 0),

      approved_evidence_count: Number(row.approved_evidence_count || 0),
      official_evidence_count: Number(row.official_evidence_count || 0),

      open_findings_count: Number(row.open_findings_count || 0),
      open_nonconformities_count: Number(row.open_nonconformities_count || 0),
      open_action_plans_count: Number(row.open_action_plans_count || 0),
      overdue_action_plans_count: Number(row.overdue_action_plans_count || 0),

      avg_effective_health_score:
        row.avg_effective_health_score === null || row.avg_effective_health_score === undefined
          ? null
          : Number(row.avg_effective_health_score),

      compliance_percentage:
        row.compliance_percentage === null || row.compliance_percentage === undefined
          ? null
          : Number(row.compliance_percentage),

      official_evidence_percentage:
        row.official_evidence_percentage === null || row.official_evidence_percentage === undefined
          ? null
          : Number(row.official_evidence_percentage),

      kpi_health_status: row.kpi_health_status || 'sin_datos',
      kpi_trace_json: row.kpi_trace_json || null
    }));

    const activeSummary = summary.filter((row) => row.active_scope_controls > 0);

    return res.json({
      ok: true,
      tenant_id: tenantId,
      source: 'public.v_iso_effective_kpi_summary',
      total_rows: summary.length,
      active_rows: activeSummary.length,
      summary,
      active_summary: activeSummary
    });
  } catch (err) {
    console.error('GET KPI EFFECTIVE HEALTH SUMMARY ERROR:', err);

    if (err && err.code === '42P01') {
      return res.status(503).json({
        error: 'Vista de salud efectiva ISO no disponible',
        detail: 'Falta public.v_iso_effective_kpi_summary en la base de datos.'
      });
    }

    return res.status(500).json({
      error: 'Error obteniendo resumen efectivo de salud ISO',
      detail: err.message
    });
  }
}


async function getAdminListByTenant(req, res) {
  try {
    const tenantId = req.params.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId es requerido' });
    }

    if (!canAccessTenant(req, tenantId)) {
      return denyTenantAccess(res);
    }

    const { rows } = await db.query(
      `
      SELECT
        kd.*,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT ksm.standard_code), NULL) AS applicable_standards,
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
        COUNT(ks.id)::int AS snapshots_count,
        MAX(ks.calculated_at) AS last_calculated_at
      FROM kpi_definitions kd
      LEFT JOIN kpi_standard_mappings ksm
        ON ksm.kpi_id = kd.id
       AND ksm.is_active = true
      LEFT JOIN tenant_kpi_settings tks
        ON tks.kpi_id = kd.id
       AND tks.tenant_id = $1
      LEFT JOIN kpi_thresholds kt
        ON kt.kpi_id = kd.id
      LEFT JOIN kpi_snapshots ks
        ON ks.kpi_id = kd.id
       AND ks.tenant_id = $1
      WHERE kd.is_standard = true
         OR kd.tenant_id = $1
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
      ORDER BY kd.is_standard DESC, kd.display_order, kd.code
      `,
      [tenantId]
    );

    const latestMap = await getLatestSnapshotsMap(tenantId);

    const enrichedRows = rows.map((row) => {
      const latestInfo = latestMap.get(row.id) || { latest: null, snapshots: [] };
      const latest = latestInfo.latest;

      return {
        ...row,
        is_health_kpi: isHealthKpiCode(row.code),
        latest_value: latest?.value ?? null,
        latest_status_color: latest?.status_color ?? null,
        latest_standard_code: latest?.standard_code ?? null,
        latest_period_start: latest?.period_start ?? null,
        latest_period_end: latest?.period_end ?? null,
        latest_calculated_at: latest?.calculated_at ?? row.last_calculated_at ?? null,
        latest_calculated_from: latest?.calculated_from ?? null,
        latest_snapshot: latest,
        latest_snapshots: latestInfo.snapshots || [],
        has_multiple_snapshots: (latestInfo.snapshots || []).length > 1
      };
    });

    return res.json(enrichedRows);
  } catch (err) {
    console.error('GET KPI ADMIN LIST ERROR:', err);
    return res.status(500).json({ error: 'Error obteniendo administración KPI' });
  }
}

async function createCustomKpi(req, res) {
  try {
    const {
      tenant_id,
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

    if (!tenant_id || !name || !category || !kpi_type || !frequency || !direction) {
      return res.status(400).json({
        error: 'tenant_id, name, category, kpi_type, frequency y direction son requeridos'
      });
    }

    if (!canAccessTenant(req, tenant_id)) {
      return denyTenantAccess(res);
    }

    const existingRes = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM kpi_definitions
      WHERE tenant_id = $1
        AND is_standard = false
      `,
      [tenant_id]
    );

    const nextNum = Number(existingRes.rows[0]?.total || 0) + 1;
    const customCode = `KPI-CUS-${String(nextNum).padStart(3, '0')}`;

    const insertRes = await db.query(
      `
      INSERT INTO kpi_definitions (
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


function manualSnapshotNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function manualSnapshotJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return {};
    }
  }

  return {};
}

async function createSnapshotFromManualKpiValue(req, manualRow) {
  if (!manualRow || !manualRow.kpi_id || !manualRow.tenant_id) return null;

  const kpiRes = await db.query(
    `
    SELECT
      kd.id,
      kd.code,
      kd.name,
      kd.direction,
      kd.target_value,
      kt.green_min,
      kt.green_max,
      kt.yellow_min,
      kt.yellow_max,
      kt.red_min,
      kt.red_max
    FROM kpi_definitions kd
    LEFT JOIN LATERAL (
      SELECT
        ktx.green_min,
        ktx.green_max,
        ktx.yellow_min,
        ktx.yellow_max,
        ktx.red_min,
        ktx.red_max
      FROM kpi_thresholds ktx
      WHERE ktx.kpi_id = kd.id
        AND (
          ktx.direction::text = kd.direction::text
          OR ktx.direction IS NULL
        )
      ORDER BY ktx.updated_at DESC NULLS LAST, ktx.created_at DESC NULLS LAST
      LIMIT 1
    ) kt ON TRUE
    WHERE kd.id = $1
    LIMIT 1
    `,
    [manualRow.kpi_id]
  );

  if (!kpiRes.rows.length) return null;

  const kpi = kpiRes.rows[0];

  const thresholdRow = {
    green_min: kpi.green_min,
    green_max: kpi.green_max,
    yellow_min: kpi.yellow_min,
    yellow_max: kpi.yellow_max,
    red_min: kpi.red_min,
    red_max: kpi.red_max
  };

  const direction = String(kpi.direction || '').trim();
  const targetValue = manualSnapshotNumberOrNull(kpi.target_value);
  const manualValue = manualSnapshotNumberOrNull(manualRow.value);

  const statusColor = getStatusColor(
    direction,
    manualValue,
    thresholdRow,
    targetValue
  );

  const sourceTrace = {
    source: 'manual_input',
    manual_value_id: manualRow.id || null,
    kpi_code: kpi.code || null,
    standard_code: manualRow.standard_code || null,
    period_type: manualRow.period_type || null,
    notes: manualRow.notes || null,
    entered_by:
      req?.user?.id ||
      req?.user?.user_id ||
      req?.user?.userId ||
      req?.user?.sub ||
      null,
    entered_at: new Date().toISOString()
  };

  const snapshotRes = await db.query(
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
      $1,
      $2,
      NULLIF($3, ''),
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      'manual_input',
      $13::jsonb,
      $14::jsonb,
      NOW()
    )
    RETURNING *
    `,
    [
      manualRow.tenant_id,
      manualRow.kpi_id,
      manualRow.standard_code || null,
      manualRow.period_type,
      manualRow.period_start,
      manualRow.period_end,
      manualValue,
      manualSnapshotNumberOrNull(manualRow.numerator_value),
      manualSnapshotNumberOrNull(manualRow.denominator_value),
      statusColor,
      direction,
      targetValue,
      JSON.stringify(manualSnapshotJsonObject(manualRow.dimension_data)),
      JSON.stringify(sourceTrace)
    ]
  );

  return snapshotRes.rows[0] || null;
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

    if (!canAccessTenant(req, tenant_id)) {
      return denyTenantAccess(res);
    }

    const manualCols = await getTableColumns(db, 'kpi_manual_values');

    const columns = [];
    const placeholders = [];
    const values = [];

    const pushIfExists = (columnName, valueToPush) => {
      if (!manualCols.has(columnName)) return;
      columns.push(columnName);
      placeholders.push(`$${values.length + 1}`);
      values.push(valueToPush);
    };

    pushIfExists('tenant_id', tenant_id);
    pushIfExists('kpi_id', kpi_id);
    pushIfExists('standard_code', standard_code || null);
    pushIfExists('period_type', period_type);
    pushIfExists('period_start', period_start);
    pushIfExists('period_end', period_end);
    pushIfExists('value', numericOrNull(value));
    pushIfExists('numerator_value', numericOrNull(numerator_value));
    pushIfExists('denominator_value', numericOrNull(denominator_value));
    pushIfExists('dimension_data', JSON.stringify(dimension_data || {}));
    pushIfExists('dimension_json', JSON.stringify(dimension_data || {}));
    pushIfExists('notes', notes || null);
    pushIfExists('entered_by', req.user?.userId || null);
    pushIfExists('created_by', req.user?.userId || null);

    if (columns.length === 0) {
      return res.status(500).json({
        error: 'La tabla kpi_manual_values no tiene columnas compatibles para insertar valores manuales'
      });
    }

    const query = `
      INSERT INTO kpi_manual_values (
        ${columns.join(', ')}
      )
      VALUES (
        ${placeholders.join(', ')}
      )
      RETURNING *
    `;

    const { rows } = await db.query(query, values);

    const manualRow = rows[0];

    let snapshotRow = null;
    let snapshotError = null;

    try {
      snapshotRow = await createSnapshotFromManualKpiValue(req, manualRow);
    } catch (snapshotErr) {
      snapshotError = snapshotErr?.message || 'No se pudo crear snapshot manual';
      console.error('ERROR CREATE MANUAL KPI SNAPSHOT:', snapshotErr);
    }

    return res.json({
      ...manualRow,
      ok: true,
      snapshot: snapshotRow,
      snapshot_error: snapshotError
    });
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
  getEffectiveHealthSummaryByTenant,
  getAdminListByTenant,
  createCustomKpi,
  deleteCustomKpi,
  updateCustomKpi,
  upsertTenantKpiSetting,
  saveManualValue,
  recalculateTenantKpis
};
