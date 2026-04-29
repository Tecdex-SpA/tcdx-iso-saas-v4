const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

function normalizeRole(role) {
  return String(role || '').toLowerCase().trim();
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

function isPlatformRole(role) {
  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
  ].includes(normalizeRole(role));
}

const ensureTenantAccess = (req, tenantId) => {
  if (
    isPlatformRole(req.user?.role || req.user?.user_role || req.user?.userRole)
  ) {
    return true;
  }

  return String(getUserTenantId(req.user)) === String(tenantId);
};

// =============================
// 🔢 CÁLCULO AUTOMÁTICO DE NIVEL
// =============================
const calcLevel = (impact, probability) => {
  const map = {
    bajo: 1,
    medio: 2,
    alto: 3,
    baja: 1,
    media: 2,
    alta: 3,
  };

  const score = (map[impact] || 1) * (map[probability] || 1);

  if (score >= 6) return 'alto';
  if (score >= 3) return 'medio';
  return 'bajo';
};

// =============================
// 🧠 NORMALIZAR TEXTO
// =============================
const normalizeText = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// =============================
// 🧠 KEYWORDS POR NORMA
// =============================
const STANDARD_RULES = {
  ISO9001: [
    'proceso',
    'procedimiento',
    'documento',
    'registro',
    'servicio',
    'cliente',
    'proveedor',
    'calidad',
    'formulario',
    'instructivo',
  ],
  ISO27001: [
    'servidor',
    'server',
    'infraestructura ti',
    'equipo ti',
    'computador',
    'notebook',
    'laptop',
    'endpoint',
    'sistema',
    'software',
    'aplicacion',
    'app',
    'base de datos',
    'dato',
    'informacion',
    'backup',
    'red',
    'firewall',
    'router',
    'switch',
    'correo',
    'mail',
    'storage',
    'repositorio',
  ],
  'ISO/IEC27701': [
    'dato personal',
    'datos personales',
    'privacidad',
    'rrhh',
    'cliente',
    'crm',
    'usuario',
    'identidad',
    'identidades',
    'base de datos',
  ],
  'ISO/IEC27017': [
    'cloud',
    'nube',
    'saas',
    'iaas',
    'paas',
    'aws',
    'azure',
    'gcp',
    'contenedor',
    'kubernetes',
    'virtual',
    'servidor virtual',
  ],
  'ISO/IEC27018': [
    'cloud',
    'nube',
    'dato personal',
    'datos personales',
    'privacidad',
    'cliente',
    'saas',
  ],
  'ISO/IEC20000-1': [
    'servicio ti',
    'mesa de ayuda',
    'helpdesk',
    'incidente',
    'cambio',
    'cmdb',
    'infraestructura ti',
    'servidor',
    'software',
    'app',
    'sistema',
  ],
  ISO22301: [
    'proceso critico',
    'proceso crítico',
    'servidor',
    'backup',
    'datacenter',
    'sitio alterno',
    'proveedor critico',
    'proveedor crítico',
    'generador',
  ],
  ISO14001: [
    'residuo',
    'combustible',
    'energia',
    'energía',
    'planta',
    'maquinaria',
    'vehiculo',
    'vehículo',
    'agua',
    'emision',
    'emisión',
    'producto',
    'envase',
  ],
  ISO50001: [
    'energia',
    'energía',
    'generador',
    'compresor',
    'motor',
    'climatizacion',
    'climatización',
    'iluminacion',
    'iluminación',
  ],
  ISO45001: [
    'maquinaria',
    'equipo',
    'planta',
    'vehiculo',
    'vehículo',
    'herramienta',
    'puesto de trabajo',
    'bodega',
    'personal',
  ],
  ISO39001: [
    'vehiculo',
    'vehículo',
    'camion',
    'camión',
    'auto',
    'camioneta',
    'flota',
    'transporte',
    'conductor',
  ],
  ISO55001: [
    'maquinaria',
    'equipo',
    'infraestructura',
    'activo fisico',
    'activo físico',
    'motor',
    'bomba',
    'compresor',
    'transformador',
    'vehiculo',
    'vehículo',
  ],
  ISO55002: [
    'maquinaria',
    'equipo',
    'infraestructura',
    'activo fisico',
    'activo físico',
    'motor',
    'bomba',
    'compresor',
    'transformador',
    'vehiculo',
    'vehículo',
  ],
  ISO14224: [
    'maquinaria',
    'equipo',
    'infraestructura',
    'motor',
    'bomba',
    'compresor',
    'transformador',
    'vehiculo',
    'vehículo',
  ],
  ISO20400: [
    'proveedor',
    'contratista',
    'compra',
    'adquisicion',
    'adquisición',
    'insumo',
    'materia prima',
  ],
  ISO44001: [
    'socio',
    'partner',
    'alianza',
    'convenio',
    'proveedor estrategico',
    'proveedor estratégico',
    'tercero critico',
    'tercero crítico',
  ],
  ISO22000: [
    'alimento',
    'materia prima',
    'cocina',
    'cadena de frio',
    'cadena de frío',
    'linea de produccion',
    'línea de producción',
    'planta alimentaria',
  ],
  'ISO/TS22002': [
    'alimento',
    'materia prima',
    'cocina',
    'cadena de frio',
    'cadena de frío',
    'linea de produccion',
    'línea de producción',
    'planta alimentaria',
  ],
  ISO13485: [
    'equipo medico',
    'equipo médico',
    'dispositivo medico',
    'dispositivo médico',
    'reactivo',
    'muestra',
    'laboratorio',
  ],
  ISO15189: [
    'muestra',
    'laboratorio',
    'reactivo',
    'analizador',
    'equipo medico',
    'equipo médico',
  ],
  'ISO/IEC17025': [
    'laboratorio',
    'ensayo',
    'calibracion',
    'calibración',
    'reactivo',
    'muestra',
  ],
  'ISO/IEC17020': [
    'inspeccion',
    'inspección',
    'equipo de inspeccion',
    'equipo de inspección',
    'muestra',
  ],
  ISO14064: [
    'combustible',
    'energia',
    'energía',
    'emision',
    'emisión',
    'vehiculo',
    'vehículo',
    'producto',
    'proceso',
  ],
  ISO14067: [
    'producto',
    'envase',
    'materia prima',
    'combustible',
    'energia',
    'energía',
    'emision',
    'emisión',
    'ciclo de vida',
  ],
  ISO14040: [
    'producto',
    'envase',
    'materia prima',
    'ciclo de vida',
    'proceso',
    'emision',
    'emisión',
  ],
  ISO14025: [
    'producto',
    'envase',
    'materia prima',
    'declaracion ambiental',
    'declaración ambiental',
  ],
};

const operationalScopeExistsSql = `
  EXISTS (
    SELECT 1
    FROM tenant_standards ts
    WHERE ts.tenant_id = $1
      AND ts.standard_code = $2
      AND ts.is_active = TRUE
      AND EXISTS (
        SELECT 1
        FROM tenant_standard_operations tso
        JOIN tenant_operations op
          ON op.id = tso.operation_id
         AND op.tenant_id = tso.tenant_id
         AND op.is_active = TRUE
        WHERE tso.tenant_id = ts.tenant_id
          AND tso.standard_code = ts.standard_code
          AND tso.is_active = TRUE
      )
  )
`;

// =============================
// 🧠 DETERMINAR NORMAS RELACIONADAS
// =============================
const detectRelevantStandards = (activeStandardCodes, asset) => {
  const text = normalizeText(`${asset.name} ${asset.type} ${asset.owner}`);
  const criticality = normalizeText(asset.criticality || '');
  const related = new Set();

  if (asset.iso && activeStandardCodes.includes(asset.iso)) {
    related.add(asset.iso);
  }

  for (const code of activeStandardCodes) {
    const keywords = STANDARD_RULES[code] || [];

    if (keywords.some((k) => text.includes(normalizeText(k)))) {
      related.add(code);
    }

    if (code === 'ISO31000' && (criticality === 'alta' || criticality === 'media')) {
      related.add(code);
    }

    if (code === 'ISO22301' && criticality === 'alta') {
      related.add(code);
    }

    if (
      code === 'ISO9001' &&
      (
        text.includes('proceso') ||
        text.includes('servicio') ||
        text.includes('documento') ||
        text.includes('proveedor') ||
        criticality === 'alta'
      )
    ) {
      related.add(code);
    }
  }

  return Array.from(related).filter((code) => activeStandardCodes.includes(code));
};

const getAssetById = async (db, assetId) => {
  return db.query(
    `
    SELECT *
    FROM assets
    WHERE id = $1
    LIMIT 1
    `,
    [assetId]
  );
};

const ensureStandardIsOperational = async (db, tenantId, standardCode) => {
  return db.query(
    `
    SELECT 1
    WHERE ${operationalScopeExistsSql}
    LIMIT 1
    `,
    [tenantId, standardCode]
  );
};

const getOperationalStandards = async (db, tenantId) => {
  const result = await db.query(
    `
    SELECT ts.standard_code
    FROM tenant_standards ts
    WHERE ts.tenant_id = $1
      AND ts.is_active = TRUE
      AND EXISTS (
        SELECT 1
        FROM tenant_standard_operations tso
        JOIN tenant_operations op
          ON op.id = tso.operation_id
         AND op.tenant_id = tso.tenant_id
         AND op.is_active = TRUE
        WHERE tso.tenant_id = ts.tenant_id
          AND tso.standard_code = ts.standard_code
          AND tso.is_active = TRUE
      )
    ORDER BY ts.standard_code
    `,
    [tenantId]
  );

  return result.rows.map((r) => r.standard_code);
};

// =============================
// 📥 CREAR ACTIVO + RELACIONAR NORMAS
// =============================
router.post('/', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, name, type, iso, criticality, owner } = req.body;

    if (!tenant_id || !name || !iso) {
      return res.status(400).json({ error: 'tenant_id, name e iso son obligatorios' });
    }

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const activePrimaryStandard = await ensureStandardIsOperational(
      client,
      tenant_id,
      iso
    );

    if (activePrimaryStandard.rowCount === 0) {
      return res.status(400).json({
        error:
          'La norma principal del activo no está dentro del alcance operativo activo de esta empresa',
      });
    }

    await client.query('BEGIN');

    const assetResult = await client.query(
      `
      INSERT INTO assets (tenant_id, name, type, iso, criticality, owner)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [tenant_id, name, type || null, iso, criticality || null, owner || null]
    );

    const asset = assetResult.rows[0];
    const operationalStandards = await getOperationalStandards(client, tenant_id);
    const relatedStandards = detectRelevantStandards(operationalStandards, asset);

    if (relatedStandards.length > 0) {
      await client.query(
        `
        INSERT INTO asset_standards (asset_id, standard_code, source)
        SELECT $1, UNNEST($2::text[]), 'auto'
        ON CONFLICT (asset_id, standard_code) DO NOTHING
        `,
        [asset.id, relatedStandards]
      );
    }

    await client.query('COMMIT');

    return res.json({
      ...asset,
      related_standards: Array.from(
        new Set([asset.iso, ...relatedStandards].filter(Boolean))
      ),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR CREATE ASSET:', err);
    return res.status(500).json({
      error: 'Error creando activo',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

// =============================
// 📋 LISTAR ACTIVOS
// solo alcance operativo real
// =============================
router.get('/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const result = await pool.query(
      `
      SELECT
        a.*,
        COALESCE(rel.related_standards, ARRAY[a.iso]) AS related_standards
      FROM assets a
      LEFT JOIN LATERAL (
        SELECT ARRAY(
          SELECT DISTINCT code
          FROM (
            SELECT a.iso AS code
            UNION
            SELECT ast.standard_code AS code
            FROM asset_standards ast
            JOIN tenant_standards ts
              ON ts.tenant_id = a.tenant_id
             AND ts.standard_code = ast.standard_code
             AND ts.is_active = TRUE
            WHERE ast.asset_id = a.id
              AND EXISTS (
                SELECT 1
                FROM tenant_standard_operations tso
                JOIN tenant_operations op
                  ON op.id = tso.operation_id
                 AND op.tenant_id = tso.tenant_id
                 AND op.is_active = TRUE
                WHERE tso.tenant_id = ts.tenant_id
                  AND tso.standard_code = ts.standard_code
                  AND tso.is_active = TRUE
              )
          ) related_codes
          WHERE code IS NOT NULL
          ORDER BY code
        ) AS related_standards
      ) rel ON TRUE
      WHERE a.tenant_id = $1
        AND EXISTS (
          SELECT 1
          FROM tenant_standards ts_main
          WHERE ts_main.tenant_id = a.tenant_id
            AND ts_main.standard_code = a.iso
            AND ts_main.is_active = TRUE
            AND EXISTS (
              SELECT 1
              FROM tenant_standard_operations tso_main
              JOIN tenant_operations op_main
                ON op_main.id = tso_main.operation_id
               AND op_main.tenant_id = tso_main.tenant_id
               AND op_main.is_active = TRUE
              WHERE tso_main.tenant_id = ts_main.tenant_id
                AND tso_main.standard_code = ts_main.standard_code
                AND tso_main.is_active = TRUE
            )
        )
      ORDER BY a.created_at DESC
      `,
      [tenant_id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('ERROR GET ASSETS:', err);
    return res.status(500).json({
      error: 'Error activos',
      detail: err.message,
    });
  }
});

// =============================
// ⚠️ CREAR RIESGO AUTOMÁTICO
// =============================
router.post('/risk', auth, async (req, res) => {
  try {
    const { asset_id, risk, impact, probability } = req.body;

    if (!asset_id || !risk) {
      return res.status(400).json({ error: 'asset_id y risk son obligatorios' });
    }

    const assetResult = await getAssetById(pool, asset_id);

    if (assetResult.rowCount === 0) {
      return res.status(404).json({ error: 'Activo no encontrado' });
    }

    const asset = assetResult.rows[0];

    if (!ensureTenantAccess(req, asset.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const activeStandard = await ensureStandardIsOperational(
      pool,
      asset.tenant_id,
      asset.iso
    );

    if (activeStandard.rowCount === 0) {
      return res.status(400).json({
        error:
          'La norma principal de este activo ya no está dentro del alcance operativo activo',
      });
    }

    const level = calcLevel(impact, probability);

    const result = await pool.query(
      `
      INSERT INTO asset_risks (asset_id, risk, impact, probability, level)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [asset_id, risk, impact || null, probability || null, level]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('ERROR CREATE ASSET RISK:', err);
    return res.status(500).json({
      error: 'Error riesgo activo',
      detail: err.message,
    });
  }
});

// =============================
// 📊 RIESGOS POR ACTIVO
// =============================
router.get('/risk/:asset_id', auth, async (req, res) => {
  try {
    const assetResult = await getAssetById(pool, req.params.asset_id);

    if (assetResult.rowCount === 0) {
      return res.status(404).json({ error: 'Activo no encontrado' });
    }

    const asset = assetResult.rows[0];

    if (!ensureTenantAccess(req, asset.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const activeStandard = await ensureStandardIsOperational(
      pool,
      asset.tenant_id,
      asset.iso
    );

    if (activeStandard.rowCount === 0) {
      return res.json([]);
    }

    const result = await pool.query(
      `
      SELECT *
      FROM asset_risks
      WHERE asset_id = $1
      ORDER BY
        CASE level
          WHEN 'alto' THEN 1
          WHEN 'medio' THEN 2
          ELSE 3
        END,
        id DESC
      `,
      [req.params.asset_id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('ERROR GET ASSET RISKS:', err);
    return res.status(500).json({
      error: 'Error riesgos',
      detail: err.message,
    });
  }
});

// =============================
// 📊 KPI RIESGOS
// solo activos cuya norma principal siga operativa
// =============================
router.get('/risk-summary/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const result = await pool.query(
      `
      SELECT ar.level, COUNT(*) AS total
      FROM asset_risks ar
      JOIN assets a
        ON ar.asset_id = a.id
      WHERE a.tenant_id = $1
        AND EXISTS (
          SELECT 1
          FROM tenant_standards ts
          WHERE ts.tenant_id = a.tenant_id
            AND ts.standard_code = a.iso
            AND ts.is_active = TRUE
            AND EXISTS (
              SELECT 1
              FROM tenant_standard_operations tso
              JOIN tenant_operations op
                ON op.id = tso.operation_id
               AND op.tenant_id = tso.tenant_id
               AND op.is_active = TRUE
              WHERE tso.tenant_id = ts.tenant_id
                AND tso.standard_code = ts.standard_code
                AND tso.is_active = TRUE
            )
        )
      GROUP BY ar.level
      ORDER BY
        CASE ar.level
          WHEN 'alto' THEN 1
          WHEN 'medio' THEN 2
          ELSE 3
        END
      `,
      [tenant_id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('ERROR RISK SUMMARY:', err);
    return res.status(500).json({
      error: 'Error resumen riesgos',
      detail: err.message,
    });
  }
});

module.exports = router;
