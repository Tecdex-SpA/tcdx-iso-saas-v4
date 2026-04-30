const express = require('express');
const jwt = require('jsonwebtoken');
const http = require('http');

const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

function authenticateExternalLookup(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        error: 'Token requerido',
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    const secret =
      process.env.JWT_SECRET ||
      process.env.JWT_SECRET_KEY ||
      process.env.SECRET_KEY ||
      process.env.TOKEN_SECRET;

    if (!secret) {
      return res.status(500).json({
        ok: false,
        error: 'JWT_SECRET no configurado en backend',
      });
    }

    req.user = jwt.verify(token, secret);
    next();
  } catch (error) {
    console.error('Error autenticando búsqueda externa IA:', error.message);

    return res.status(401).json({
      ok: false,
      error: 'Token inválido o expirado',
    });
  }
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

function isSuperAdmin(user) {
  return [
    'superadmin',
    'super_admin',
    'admin_global',
    'global_admin',
    'platform_admin',
    'owner',
  ].includes(getUserRole(user));
}

function getTenantId(user) {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    null
  );
}

function postJsonToAI(path, payload) {
  return new Promise((resolve, reject) => {
    const aiHost =
      process.env.AI_HOST ||
      process.env.AI_ENGINE_HOST ||
      '192.168.100.140';

    const aiPort =
      process.env.AI_PORT ||
      process.env.AI_ENGINE_PORT ||
      '8001';

    const aiToken = process.env.AI_INTERNAL_TOKEN || process.env.AI_TOKEN || '';

    if (!aiToken) {
      return reject(new Error('AI_INTERNAL_TOKEN no configurado'));
    }

    const body = JSON.stringify(payload || {});

    const options = {
      hostname: aiHost,
      port: Number(aiPort),
      path,
      method: 'POST',
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-ai-token': aiToken,
      },
    };

    const request = http.request(options, (response) => {
      let raw = '';

      response.on('data', (chunk) => {
        raw += chunk;
      });

      response.on('end', () => {
        let parsed = null;

        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch (error) {
          return reject(
            new Error(
              `Respuesta inválida desde IA. HTTP ${response.statusCode}. Body: ${raw.slice(0, 500)}`
            )
          );
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(
            new Error(
              parsed?.detail ||
                parsed?.error ||
                `Error IA HTTP ${response.statusCode}`
            )
          );
        }

        return resolve(parsed);
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Timeout consultando motor IA'));
    });

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

router.use(authenticateExternalLookup);

// =====================================================
// POST /ai-external-lookup/search
// Ejecuta búsqueda externa controlada desde backend.
// =====================================================

// =====================================================
// EXTERNAL_LOOKUP_EXTRA_CHARGE_MIDDLEWARE
// Si no quedan consultas contratadas, exige aceptación explícita
// de consulta adicional $100 antes de ejecutar búsqueda externa.
// =====================================================
function getExternalLookupUserId(req) {
  return req.user?.id || req.user?.user_id || req.user?.userId || null;
}

function getExternalLookupTenantId(req) {
  return (
    req.user?.tenant_id ||
    req.user?.tenantId ||
    req.body?.tenant_id ||
    req.body?.tenantId ||
    null
  );
}

function getBillingMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

router.post('/search', auth, async (req, res, next) => {
  try {
    const tenantId = getExternalLookupTenantId(req);
    const userId = getExternalLookupUserId(req);

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error: 'tenant_id requerido para búsqueda externa',
      });
    }

    const billingMonth = getBillingMonth();

    const quotaResult = await pool.query(
      `
      WITH default_quota AS (
        SELECT 100::int AS monthly_limit
      ),
      usage_month AS (
        SELECT
          COUNT(*)::int AS used_count
        FROM ai_core.external_lookup_logs
        WHERE tenant_id = $1::uuid
          AND COALESCE(response_used, FALSE) = TRUE
          AND created_at >= date_trunc('month', now())
          AND created_at < date_trunc('month', now()) + interval '1 month'
      )
      SELECT
        COALESCE(q.monthly_limit, (SELECT monthly_limit FROM default_quota), 100)::int AS monthly_limit,
        COALESCE(q.is_active, TRUE) AS quota_active,
        COALESCE((SELECT used_count FROM usage_month), 0)::int AS used_count,
        GREATEST(
          COALESCE(q.monthly_limit, (SELECT monthly_limit FROM default_quota), 100)
          - COALESCE((SELECT used_count FROM usage_month), 0),
          0
        )::int AS remaining
      FROM (SELECT 1) seed
      LEFT JOIN ai_core.external_lookup_quotas q
        ON q.tenant_id = $1::uuid
      LIMIT 1
      `,
      [tenantId]
    );

    const quota = quotaResult.rows[0] || {
      monthly_limit: 100,
      quota_active: true,
      used_count: 0,
      remaining: 100,
    };

    const remaining = Number(quota.remaining || 0);
    const acceptExtraCharge =
      req.body?.accept_extra_charge === true ||
      req.body?.accept_extra_charge === 'true';

    if (remaining <= 0 && !acceptExtraCharge) {
      return res.status(409).json({
        ok: false,
        code: 'EXTERNAL_LOOKUP_EXTRA_CHARGE_REQUIRED',
        requires_extra_charge: true,
        extra_query_price: 100,
        currency: 'CLP',
        error: 'Se terminaron las consultas contratadas. Consulta adicional $100. ¿Acepta continuar?',
        detail: {
          monthly_limit: Number(quota.monthly_limit || 0),
          used_count: Number(quota.used_count || 0),
          remaining,
          billing_month: billingMonth,
        },
      });
    }

    if (remaining <= 0 && acceptExtraCharge) {
      await pool.query(
        `
        INSERT INTO ai_core.external_lookup_extra_charges (
          tenant_id,
          user_id,
          billing_month,
          quantity,
          unit_price,
          total_amount,
          accepted,
          accepted_at,
          reason,
          metadata
        )
        VALUES (
          $1::uuid,
          NULLIF($2::text, '')::uuid,
          $3::text,
          1,
          100,
          100,
          TRUE,
          now(),
          'Consulta adicional respaldo externo IA aceptada por usuario',
          $4::jsonb
        )
        `,
        [
          tenantId,
          userId || '',
          billingMonth,
          JSON.stringify({
            source: 'ai_external_lookup_route',
            accepted_from: 'frontend',
            monthly_limit: Number(quota.monthly_limit || 0),
            used_count: Number(quota.used_count || 0),
          }),
        ]
      );

      req.body.extra_charge_accepted = true;
      req.body.extra_query_price = 100;
    }

    return next();
  } catch (error) {
    console.error('ERROR EXTERNAL LOOKUP EXTRA CHARGE CHECK:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error validando cuota de búsqueda externa',
      detail: error.message,
    });
  }
});



function normalizeExternalText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function detectExternalStandardCode(value) {
  const compact = String(value || '')
    .toUpperCase()
    .replace(/ISO\/IEC/g, 'ISO')
    .replace(/[^A-Z0-9]/g, '');

  if (compact.includes('27001')) return 'ISO27001';
  if (compact.includes('9001')) return 'ISO9001';
  if (compact.includes('14001')) return 'ISO14001';
  if (compact.includes('14224')) return 'ISO14224';
  if (compact.includes('27017')) return 'ISO27017';
  if (compact.includes('27018')) return 'ISO27018';
  if (compact.includes('27701')) return 'ISO27701';
  if (compact.includes('20000')) return 'ISO20000';
  if (compact.includes('22301')) return 'ISO22301';
  if (compact.includes('31000')) return 'ISO31000';
  if (compact.includes('37301')) return 'ISO37301';

  return null;
}

function inferExternalDomainCode(value) {
  const q = normalizeExternalText(value);

  if (/\b(continuidad|continuity|business continuity|recuperacion|recovery|drp|bcp|rto|rpo|resiliencia|resilience)\b/.test(q)) {
    return 'business_continuity';
  }

  if (/\b(incidente|incident|incident response|respuesta a incidentes|gestion de incidentes)\b/.test(q)) {
    return 'incident_management';
  }

  if (/\b(acceso|access|password|authentication|privileged|credencial|rbac|mfa)\b/.test(q)) {
    return 'access_management';
  }

  if (/\b(cloud|aws|azure|oci|misconfiguration)\b/.test(q)) {
    return 'cloud_security';
  }

  if (/\b(riesgo|risk|amenaza|threat|vulnerabilidad|vulnerability)\b/.test(q)) {
    return 'risk_management';
  }

  return 'information_security';
}

function inferExternalProblemTypeCode(value) {
  const q = normalizeExternalText(value);

  if (/\b(evidencia|evidence|respaldo|registro|record|validation|test)\b/.test(q)) {
    return 'missing_or_insufficient_evidence';
  }

  if (/\b(no conformidad|nonconformity|corrective|correctiva|capa|remediation)\b/.test(q)) {
    return 'action_without_evidence';
  }

  if (/\b(incidente|incident|continuidad|continuity|recovery|recuperacion)\b/.test(q)) {
    return 'control_not_executed';
  }

  return 'risk_without_treatment';
}

function inferExternalScenarioCode(value) {
  const q = normalizeExternalText(value);

  if (/\b(continuidad|continuity|business continuity|recovery|recuperacion|rto|rpo|drp|bcp|incident response)\b/.test(q)) {
    return 'business_continuity_or_incident_response_reference';
  }

  if (/\b(acceso|access|password|authentication|privileged|rbac|mfa)\b/.test(q)) {
    return 'password_authentication_weakness';
  }

  if (/\b(no conformidad|corrective|correctiva|capa|remediation)\b/.test(q)) {
    return 'corrective_action_closed_without_evidence';
  }

  return 'external_reference_search';
}

function enrichExternalLookupPayload(body, finalTenantId) {
  const freeQuery = String(
    body.query ||
      body.q ||
      body.question ||
      body.query_text ||
      body.description ||
      body.title ||
      ''
  ).trim();

  const standardCode =
    body.standard_code ||
    body.iso_code ||
    body.iso ||
    body.standard ||
    detectExternalStandardCode(freeQuery);

  const domainCode =
    body.domain_code ||
    body.domain ||
    inferExternalDomainCode(freeQuery);

  const problemTypeCode =
    body.problem_type_code ||
    body.problem_type ||
    inferExternalProblemTypeCode(freeQuery);

  const scenarioCode =
    body.scenario_code ||
    body.scenario ||
    inferExternalScenarioCode(freeQuery);

  const title =
    body.title ||
    freeQuery ||
    'Búsqueda externa de referencia confiable';

  const description =
    body.description ||
    body.lookup_reason ||
    freeQuery ||
    title;

  const forceWebSearch =
    body.force_external_lookup === true ||
    body.force_external === true ||
    body.force_refresh === true ||
    body.force_web_search === true ||
    body.execute_web_search === true;

  return {
    ...body,
    tenant_id: finalTenantId,
    query: freeQuery || title,
    query_text: body.query_text || freeQuery || title,
    standard_code: standardCode || null,
    domain_code: domainCode || null,
    problem_type_code: problemTypeCode || null,
    scenario_code: scenarioCode || null,
    scenario: scenarioCode || body.scenario || null,
    title,
    description,
    lookup_reason:
      body.lookup_reason ||
      'Búsqueda externa solicitada como última capa del motor IA TCDX.',
    requires_external_lookup: true,
    force_web_search: forceWebSearch,
    execute_web_search: forceWebSearch,
    external_lookup_ready: forceWebSearch,
    source_profile:
      body.source_profile ||
      'official_trusted_sources',
  };
}


router.post('/search', async (req, res) => {
  try {
    const user = req.user || {};
    const superAdmin = isSuperAdmin(user);
    const tokenTenantId = getTenantId(user);

    const body = req.body || {};
    const requestedTenantId = body.tenant_id || null;

    const finalTenantId = superAdmin
      ? requestedTenantId || tokenTenantId
      : tokenTenantId;

    if (!finalTenantId) {
      return res.status(400).json({
        ok: false,
        error: 'tenant_id requerido',
      });
    }

    if (
      !superAdmin &&
      requestedTenantId &&
      String(requestedTenantId) !== String(tokenTenantId)
    ) {
      return res.status(403).json({
        ok: false,
        error: 'No autorizado para consultar búsqueda externa de otro tenant',
      });
    }

    const payload = enrichExternalLookupPayload(body, finalTenantId);

    const aiResult = await postJsonToAI(
      '/api/ai/internal/external-lookup/search',
      payload
    );

    return res.json({
      ok: true,
      data: aiResult,
    });
  } catch (error) {
    console.error('Error en /ai-external-lookup/search:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error ejecutando búsqueda externa controlada',
      detail: error.message,
    });
  }
});



// =====================================================
// POST /ai-external-lookup/cache
// Consulta caché de respaldo externo sin consumir API.
// =====================================================
router.post('/cache', async (req, res) => {
  try {
    const user = req.user || {};
    const superAdmin = isSuperAdmin(user);
    const tokenTenantId = getTenantId(user);

    const body = req.body || {};
    const requestedTenantId = body.tenant_id || null;

    const finalTenantId = superAdmin
      ? requestedTenantId || tokenTenantId
      : tokenTenantId;

    if (!finalTenantId) {
      return res.status(400).json({
        ok: false,
        error: 'tenant_id requerido',
      });
    }

    if (
      !superAdmin &&
      requestedTenantId &&
      String(requestedTenantId) !== String(tokenTenantId)
    ) {
      return res.status(403).json({
        ok: false,
        error: 'No autorizado para consultar caché externa de otro tenant',
      });
    }

    const payload = {
      ...body,
      tenant_id: finalTenantId,
      standard_code:
        body.standard_code ||
        body.iso_code ||
        body.iso ||
        body.standard ||
        null,
      title: body.title || '',
      description: body.description || '',
    };

    const aiResult = await postJsonToAI(
      '/api/ai/internal/external-lookup/cache',
      payload
    );

    return res.json({
      ok: true,
      data: aiResult,
    });
  } catch (error) {
    console.error('Error en /ai-external-lookup/cache:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error consultando caché de respaldo externo',
      detail: error.message,
    });
  }
});


module.exports = router;
