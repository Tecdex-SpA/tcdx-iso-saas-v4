'use strict';

const pool = require('../config/db');

const TRACE_SYSTEM = 'tcdx-iso';
const UNKNOWN_PROCESS_ACTOR = 'unknown-system-process@tecdex.net';

const PROCESS_ACTORS = Object.freeze({
  company_profile: 'company-profile-worker@tecdex.net',
  semantic_evidence: 'evidence-analysis-worker@tecdex.net',
  evidence_analysis: 'evidence-analysis-worker@tecdex.net',
  senior_auditor: 'ai-auditor-worker@tecdex.net',
  auditor: 'ai-auditor-worker@tecdex.net',
  report_enrichment: 'compliance-batch@tecdex.net',
  intelligence: 'compliance-batch@tecdex.net',
  operational_risk: 'compliance-batch@tecdex.net',
  soa_assessment: 'compliance-batch@tecdex.net',
});

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function safeText(value, max = 240) {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function safeEmail(value) {
  const text = safeText(value, 254).toLowerCase();
  if (!text || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) return '';
  return text;
}

function getPayloadTenantId(payload = {}) {
  return payload.tenant_id ||
    payload.tenantId ||
    payload.context?.tenant?.tenant_id ||
    payload.context?.tenant?.id ||
    payload.context?.tenant_id ||
    payload.context?.tenant_summary?.tenant_id ||
    null;
}

function getPayloadUserId(payload = {}) {
  return payload.user_id || payload.userId || payload.context?.user_id || payload.request_metadata?.user_id || null;
}

function inferProcessKey(path = '', payload = {}) {
  const haystack = [
    path,
    payload.module_origin,
    payload.source_module,
    payload.task_type,
    payload.job_type,
    payload.request_metadata?.module,
    payload.request_metadata?.module_origin,
    payload.request_metadata?.task_type,
  ].filter(Boolean).join(' ').toLowerCase();

  if (haystack.includes('semantic-evidence') || haystack.includes('semantic_evidence')) return 'semantic_evidence';
  if (haystack.includes('company-profile') || haystack.includes('company_profile')) return 'company_profile';
  if (haystack.includes('senior-auditor') || haystack.includes('senior_auditor')) return 'senior_auditor';
  if (haystack.includes('report')) return 'report_enrichment';
  if (haystack.includes('intelligence')) return 'intelligence';
  if (haystack.includes('operational-risk') || haystack.includes('operational_risk')) return 'operational_risk';
  if (haystack.includes('soa')) return 'soa_assessment';
  if (haystack.includes('evidence')) return 'evidence_analysis';
  return '';
}

async function resolveUserEmail({ userId, tenantId }) {
  if (!isUuid(userId)) return '';
  try {
    const result = await pool.query(
      `
      SELECT email
      FROM users
      WHERE id = $1::uuid
        AND ($2::uuid IS NULL OR tenant_id = $2::uuid)
      LIMIT 1
      `,
      [userId, isUuid(tenantId) ? tenantId : null]
    );
    return safeEmail(result.rows[0]?.email);
  } catch (error) {
    if (['42P01', '42703'].includes(error?.code)) return '';
    throw error;
  }
}

async function resolveTenantCompany({ tenantId }) {
  if (!isUuid(tenantId)) return 'platform';
  try {
    const result = await pool.query(
      `
      SELECT
        t.name AS tenant_name,
        p.profile_json->>'company_name' AS profile_company_name,
        p.profile_json->>'legal_name' AS profile_legal_name
      FROM tenants t
      LEFT JOIN tenant_company_profiles p ON p.tenant_id = t.id
      WHERE t.id = $1::uuid
      LIMIT 1
      `,
      [tenantId]
    );
    const row = result.rows[0] || {};
    return safeText(row.tenant_name || row.profile_company_name || row.profile_legal_name || `tenant:${tenantId}`, 180);
  } catch (error) {
    if (['42P01', '42703'].includes(error?.code)) return `tenant:${tenantId}`;
    throw error;
  }
}

async function buildLlmTraceContext({ path = '', payload = {}, processActor = '' } = {}) {
  const tenantId = getPayloadTenantId(payload);
  const userId = getPayloadUserId(payload);
  const processKey = inferProcessKey(path, payload);
  const userEmail = await resolveUserEmail({ userId, tenantId });
  const technicalActor = safeEmail(processActor) || PROCESS_ACTORS[processKey] || UNKNOWN_PROCESS_ACTOR;
  const actor = userEmail || technicalActor;
  const actorType = userEmail ? 'authenticated_user' : 'process';
  const company = await resolveTenantCompany({ tenantId });

  return {
    actor,
    actor_type: actorType,
    process_actor: actorType === 'process' ? actor : null,
    system: TRACE_SYSTEM,
    company,
    tenant_id: isUuid(tenantId) ? tenantId : null,
    user_id: isUuid(userId) ? userId : null,
    source: 'backend_authenticated_context',
  };
}

function mergeTraceIntoPayload(payload = {}, trace = {}) {
  const requestMetadata = payload.request_metadata && typeof payload.request_metadata === 'object'
    ? { ...payload.request_metadata }
    : {};
  delete requestMetadata.actor;
  delete requestMetadata.company;
  delete requestMetadata.system;
  delete requestMetadata.email;

  return {
    ...payload,
    llm_trace: trace,
    request_metadata: {
      ...requestMetadata,
      llm_trace: trace,
    },
  };
}

module.exports = {
  TRACE_SYSTEM,
  UNKNOWN_PROCESS_ACTOR,
  PROCESS_ACTORS,
  buildLlmTraceContext,
  mergeTraceIntoPayload,
  safeEmail,
};
