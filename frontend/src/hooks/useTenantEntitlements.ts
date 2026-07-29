'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '@/utils/apiClient';

const API_URL = getApiBaseUrl();

type AiFeatures = {
  auditor: boolean;
  suggestions: boolean;
  web_research: boolean;
  report_enrichment: boolean;
  document_generation: boolean;
  company_profile_analysis: boolean;
  [key: string]: boolean;
};

type EntitlementDecision = {
  capability_key: string;
  enabled: boolean;
  decision: string;
  source: string;
  reason_code: string;
  effective_from: string | null;
  effective_until: string | null;
  limit: number | null;
  usage: number;
  remaining: number | null;
  dependencies: string[];
  read_only: boolean;
};

type LimitState = {
  resource_key: string;
  limit: number | null;
  usage: number;
  remaining: number | null;
  warning_threshold?: number;
  enforcement?: string;
  exhausted?: boolean;
};

type Entitlements = {
  tenant_id: string | null;
  subscription: Record<string, unknown>;
  modules: Array<Record<string, unknown>>;
  capabilities: Record<string, EntitlementDecision>;
  limits: Record<string, LimitState>;
  usage: Record<string, number>;
  health: Record<string, unknown>;
  ai: {
    enabled: boolean;
    plan: string;
    web_enabled: boolean;
    report_enabled: boolean;
    auditor_enabled: boolean;
    features: AiFeatures;
    quota: {
      monthly: number | null;
      used: number;
    };
  };
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const DISABLED_ENTITLEMENTS: Entitlements = {
  tenant_id: null,
  subscription: {},
  modules: [],
  capabilities: {},
  limits: {},
  usage: {},
  health: {},
  ai: {
    enabled: false,
    plan: 'none',
    web_enabled: false,
    report_enabled: false,
    auditor_enabled: false,
    features: {
      auditor: false,
      suggestions: false,
      web_research: false,
      report_enrichment: false,
      document_generation: false,
      company_profile_analysis: false,
    },
    quota: {
      monthly: null,
      used: 0,
    },
  },
};

const cache = new Map<string, Entitlements>();
const pending = new Map<string, Promise<Entitlements>>();

function cacheKey(token: string) {
  if (typeof window === 'undefined') return 'server';
  const tenantId = localStorage.getItem('activeTenantId') || localStorage.getItem('tenant_id') || 'default-tenant';
  const userId = localStorage.getItem('user_id') || localStorage.getItem('email') || token.slice(-16) || 'default-user';
  return `${tenantId}:${userId}`;
}

function normalizeDecision(key: string, value: unknown): EntitlementDecision {
  const row = isRecord(value) ? value : {};
  return {
    capability_key: String(row.capability_key || key),
    enabled: row.enabled === true,
    decision: typeof row.decision === 'string' ? row.decision : (row.enabled === true ? 'allowed' : 'denied'),
    source: typeof row.source === 'string' ? row.source : 'none',
    reason_code: typeof row.reason_code === 'string' ? row.reason_code : 'CAPABILITY_NOT_ENTITLED',
    effective_from: stringOrNull(row.effective_from),
    effective_until: stringOrNull(row.effective_until),
    limit: numberOrNull(row.limit),
    usage: Number(row.usage || 0),
    remaining: numberOrNull(row.remaining),
    dependencies: Array.isArray(row.dependencies) ? row.dependencies.map(String) : [],
    read_only: row.read_only === true,
  };
}

function normalizeEntitlements(payload: unknown): Entitlements {
  const root = isRecord(payload) ? payload : {};
  const ai = isRecord(root.ai) ? root.ai : {};
  const features = isRecord(ai.features) ? ai.features : {};
  const quota = isRecord(ai.quota) ? ai.quota : {};
  const planValue = typeof ai.plan === 'string' && ai.plan.trim() ? ai.plan : 'none';
  const enabled = ai.enabled === true && planValue.toLowerCase() !== 'none';
  const rawCapabilities = isRecord(root.capabilities) ? root.capabilities : {};
  const rawLimits = isRecord(root.limits) ? root.limits : {};

  return {
    tenant_id: stringOrNull(root.tenant_id),
    subscription: isRecord(root.subscription) ? root.subscription : {},
    modules: Array.isArray(root.modules) ? root.modules.filter(isRecord) : [],
    capabilities: Object.fromEntries(
      Object.entries(rawCapabilities).map(([key, value]) => [key, normalizeDecision(key, value)])
    ),
    limits: Object.fromEntries(
      Object.entries(rawLimits).map(([key, value]) => {
        const row = isRecord(value) ? value : {};
        return [key, {
          resource_key: String(row.resource_key || key),
          limit: numberOrNull(row.limit),
          usage: Number(row.usage || 0),
          remaining: numberOrNull(row.remaining),
          warning_threshold: numberOrNull(row.warning_threshold) || undefined,
          enforcement: typeof row.enforcement === 'string' ? row.enforcement : undefined,
          exhausted: row.exhausted === true,
        }];
      })
    ),
    usage: isRecord(root.usage) ? Object.fromEntries(Object.entries(root.usage).map(([key, value]) => [key, Number(value || 0)])) : {},
    health: isRecord(root.health) ? root.health : {},
    ai: {
      enabled,
      plan: enabled ? planValue : 'none',
      web_enabled: enabled && ai.web_enabled === true,
      report_enabled: enabled && ai.report_enabled === true,
      auditor_enabled: enabled && ai.auditor_enabled === true,
      features: {
        auditor: enabled && features.auditor === true,
        suggestions: enabled && features.suggestions === true,
        web_research: enabled && features.web_research === true,
        report_enrichment: enabled && features.report_enrichment === true,
        document_generation: enabled && features.document_generation === true,
        company_profile_analysis: enabled && features.company_profile_analysis === true,
        ...Object.fromEntries(
          Object.entries(features).map(([key, value]) => [key, enabled && value === true])
        ),
      },
      quota: {
        monthly: numberOrNull(quota.monthly),
        used: Number(quota.used || 0),
      },
    },
  };
}

async function fetchEntitlements(): Promise<Entitlements> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
  if (!token) return DISABLED_ENTITLEMENTS;
  const key = cacheKey(token);
  const current = cache.get(key);
  if (current) return current;
  const currentPending = pending.get(key);
  if (currentPending) return currentPending;

  const request = (async () => {
    const response = await fetch(`${API_URL}/api/me/entitlements`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return DISABLED_ENTITLEMENTS;
    }
    if (!response.ok || (isRecord(json) && json.ok === false)) return DISABLED_ENTITLEMENTS;
    const normalized = normalizeEntitlements(json);
    cache.set(key, normalized);
    return normalized;
  })().finally(() => {
    pending.delete(key);
  });

  pending.set(key, request);
  return request;
}

export function clearTenantEntitlementsCache() {
  cache.clear();
  pending.clear();
}

export function useTenantEntitlements() {
  const [entitlements, setEntitlements] = useState<Entitlements>(DISABLED_ENTITLEMENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchEntitlements()
      .then((value) => {
        if (!cancelled) setEntitlements(value);
      })
      .catch(() => {
        if (!cancelled) setEntitlements(DISABLED_ENTITLEMENTS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasCapability = useCallback(
    (capabilityKey: string) => entitlements.capabilities[capabilityKey]?.enabled === true,
    [entitlements.capabilities]
  );
  const hasModule = useCallback(
    (moduleKey: string) => entitlements.modules.some((module) => module.module_key === moduleKey && module.enabled !== false),
    [entitlements.modules]
  );
  const getLimit = useCallback((resourceKey: string) => entitlements.limits[resourceKey]?.limit ?? null, [entitlements.limits]);
  const getUsage = useCallback((resourceKey: string) => entitlements.limits[resourceKey]?.usage ?? entitlements.usage[resourceKey] ?? 0, [entitlements.limits, entitlements.usage]);
  const isReadOnly = useCallback((capabilityKey: string) => entitlements.capabilities[capabilityKey]?.read_only === true, [entitlements.capabilities]);
  const canUseAiFeature = useCallback(
    (featureName: string) => {
      if (!entitlements.ai.enabled) return false;
      const key = String(featureName || '').trim();
      if (!key) return false;
      return entitlements.ai.features[key] === true;
    },
    [entitlements.ai]
  );

  return useMemo(
    () => ({
      loading,
      entitlements,
      aiEnabled: entitlements.ai.enabled,
      aiPlan: entitlements.ai.plan,
      aiFeatures: entitlements.ai.features,
      canUseAiFeature,
      hasModule,
      hasCapability,
      getLimit,
      getUsage,
      isReadOnly,
    }),
    [loading, entitlements, canUseAiFeature, hasModule, hasCapability, getLimit, getUsage, isReadOnly]
  );
}
