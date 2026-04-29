const pool = require('../config/db');

function numericOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getStatusColor(direction, value, thresholdRow) {
  if (value === null || value === undefined) return 'gray';
  if (!thresholdRow) return 'gray';

  const val = Number(value);

  if (thresholdRow.green_min !== null && thresholdRow.green_max !== null) {
    if (val >= Number(thresholdRow.green_min) && val <= Number(thresholdRow.green_max)) {
      return 'green';
    }
  }

  if (thresholdRow.yellow_min !== null && thresholdRow.yellow_max !== null) {
    if (val >= Number(thresholdRow.yellow_min) && val <= Number(thresholdRow.yellow_max)) {
      return 'yellow';
    }
  }

  if (thresholdRow.red_min !== null && thresholdRow.red_max !== null) {
    if (val >= Number(thresholdRow.red_min) && val <= Number(thresholdRow.red_max)) {
      return 'red';
    }
  }

  if (direction === 'higher_is_better') {
    if (thresholdRow.green_min !== null && val >= Number(thresholdRow.green_min)) return 'green';
    if (thresholdRow.yellow_min !== null && val >= Number(thresholdRow.yellow_min)) return 'yellow';
    return 'red';
  }

  if (direction === 'lower_is_better') {
    if (thresholdRow.green_max !== null && val <= Number(thresholdRow.green_max)) return 'green';
    if (thresholdRow.yellow_max !== null && val <= Number(thresholdRow.yellow_max)) return 'yellow';
    return 'red';
  }

  return 'gray';
}

async function calculateAllKPIs(tenantId) {
  const client = await pool.connect();

  try {
    const kpis = await client.query(
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
      FROM tenant_kpi_settings tks
      JOIN kpi_definitions kd ON kd.id = tks.kpi_id
      LEFT JOIN kpi_thresholds kt ON kt.kpi_id = kd.id
      WHERE tks.tenant_id = $1
        AND tks.is_enabled = true
        AND kd.is_active = true
      ORDER BY kd.display_order, kd.code
      `,
      [tenantId]
    );

    let recalculated = 0;
    const results = [];

    for (const kpi of kpis.rows) {
      const value = await calculateKPI(kpi.code, tenantId, client);

      const thresholdRow = {
        green_min: numericOrNull(kpi.green_min),
        green_max: numericOrNull(kpi.green_max),
        yellow_min: numericOrNull(kpi.yellow_min),
        yellow_max: numericOrNull(kpi.yellow_max),
        red_min: numericOrNull(kpi.red_min),
        red_max: numericOrNull(kpi.red_max)
      };

      const statusColor = getStatusColor(kpi.direction, value, thresholdRow);

      await saveSnapshot(client, {
        tenantId,
        kpiId: kpi.id,
        value,
        statusColor,
        direction: kpi.direction,
        targetValue: numericOrNull(kpi.target_value)
      });

      recalculated += 1;

      results.push({
        code: kpi.code,
        name: kpi.name,
        value,
        status_color: statusColor
      });
    }

    return {
      recalculated,
      results
    };
  } finally {
    client.release();
  }
}

async function calculateKPI(code, tenantId, client) {
  switch (code) {
    case 'KPI-01': {
      return null;
    }

    case 'KPI-02': {
      const nc = await client.query(
        `
        SELECT COUNT(*)::numeric AS total
        FROM findings
        WHERE tenant_id = $1
        `,
        [tenantId]
      );

      return nc.rows[0]?.total !== null ? Number(nc.rows[0].total) : 0;
    }

    case 'KPI-03': {
      const actions = await client.query(
        `
        SELECT COALESCE(
          COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'completado') * 100.0 / NULLIF(COUNT(*), 0),
          0
        ) AS value
        FROM action_plans
        WHERE tenant_id = $1
        `,
        [tenantId]
      );

      return Number(actions.rows[0]?.value || 0);
    }

    case 'KPI-04': {
      const incidents = await client.query(
        `
        SELECT COUNT(*)::numeric AS total
        FROM findings
        WHERE tenant_id = $1
        `,
        [tenantId]
      );

      return Number(incidents.rows[0]?.total || 0);
    }

    case 'KPI-06': {
      const risk = await client.query(
        `
        SELECT AVG(
          CASE level
            WHEN 'alto' THEN 3
            WHEN 'medio' THEN 2
            WHEN 'bajo' THEN 1
            ELSE NULL
          END
        ) AS value
        FROM asset_risks ar
        JOIN assets a ON a.id = ar.asset_id
        WHERE a.tenant_id = $1
        `,
        [tenantId]
      );

      return risk.rows[0]?.value !== null ? Number(risk.rows[0].value) : null;
    }

    case 'KPI-07': {
      return null;
    }

    case 'KPI-09': {
      const audits = await client.query(
        `
        SELECT COALESCE(
          COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'completada') * 100.0 / NULLIF(COUNT(*), 0),
          0
        ) AS value
        FROM audits
        WHERE tenant_id = $1
        `,
        [tenantId]
      );

      return Number(audits.rows[0]?.value || 0);
    }

    case 'KPI-10': {
      const findingsPerAudit = await client.query(
        `
        SELECT COALESCE(
          COUNT(f.id)::numeric / NULLIF(COUNT(DISTINCT a.id), 0),
          0
        ) AS value
        FROM audits a
        LEFT JOIN findings f ON f.audit_id = a.id
        WHERE a.tenant_id = $1
        `,
        [tenantId]
      );

      return Number(findingsPerAudit.rows[0]?.value || 0);
    }

    case 'KPI-11': {
      return null;
    }

    case 'KPI-14': {
      return null;
    }

    case 'KPI-15': {
      return null;
    }

    case 'KPI-20': {
      return null;
    }

    default: {
      return null;
    }
  }
}

async function saveSnapshot(client, { tenantId, kpiId, value, statusColor, direction, targetValue }) {
  const normalizedValue =
    value === null || value === undefined || Number.isNaN(Number(value))
      ? null
      : Number(value);

  await client.query(
    `
    INSERT INTO kpi_snapshots (
      tenant_id,
      kpi_id,
      period_type,
      period_start,
      period_end,
      value,
      status_color,
      direction,
      target_value,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      'mensual',
      DATE_TRUNC('month', CURRENT_DATE)::date,
      CURRENT_DATE,
      $3::numeric,
      $4::kpi_status_color_enum,
      $5::kpi_direction_enum,
      $6::numeric,
      NOW(),
      NOW()
    )
    `,
    [
      tenantId,
      kpiId,
      normalizedValue,
      statusColor,
      direction,
      targetValue
    ]
  );
}

module.exports = {
  calculateAllKPIs
};
