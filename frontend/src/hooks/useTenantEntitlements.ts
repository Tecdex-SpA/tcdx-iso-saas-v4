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

type Entitlements = {
  tenant_id: string | null;
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

const DISABLED_ENTITLEMENTS: Entitlements = {
  tenant_id: null,
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

let cachedEntitlements: Entitlements | null = null;
let pendingRequest: Promise<Entitlements> | null = null;

function normalizeEntitlements(payload: any): Entitlements {
  const ai = payload?.ai || {};
  const features = ai?.features || {};
  const enabled = ai?.enabled === true && String(ai?.plan || 'none').toLowerCase() !== 'none';

  return {
    tenant_id: payload?.tenant_id || null,
    ai: {
      enabled,
      plan: enabled ? String(ai?.plan || 'standard') : 'none',
      web_enabled: enabled && ai?.web_enabled === true,
      report_enabled: enabled && ai?.report_enabled === true,
      auditor_enabled: enabled && ai?.auditor_enabled === true,
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
        monthly: ai?.quota?.monthly ?? null,
        used: Number(ai?.quota?.used || 0),
      },
    },
  };
}

async function fetchEntitlements(): Promise<Entitlements> {
  if (cachedEntitlements) return cachedEntitlements;
  if (pendingRequest) return pendingRequest;

  pendingRequest = (async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    if (!token) return DISABLED_ENTITLEMENTS;

    const response = await fetch(`${API_URL}/api/me/entitlements`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await response.text();
    let json: any = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return DISABLED_ENTITLEMENTS;
    }

    if (!response.ok || json?.ok === false) return DISABLED_ENTITLEMENTS;

    cachedEntitlements = normalizeEntitlements(json);
    return cachedEntitlements;
  })().finally(() => {
    pendingRequest = null;
  });

  return pendingRequest;
}

export function clearTenantEntitlementsCache() {
  cachedEntitlements = null;
  pendingRequest = null;
}

export function useTenantEntitlements() {
  const [entitlements, setEntitlements] = useState<Entitlements>(cachedEntitlements || DISABLED_ENTITLEMENTS);
  const [loading, setLoading] = useState(!cachedEntitlements);

  useEffect(() => {
    let cancelled = false;

    fetchEntitlements()
      .then((value) => {
        if (!cancelled) {
          setEntitlements(value);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEntitlements(DISABLED_ENTITLEMENTS);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const canUseAiFeature = useCallback(
    (featureName: string) => {
      if (!entitlements.ai.enabled) return false;
      const key = String(featureName || '').trim();
      if (!key) return false;
      return entitlements.ai.features[key] === true;
    },
    [entitlements]
  );

  return useMemo(
    () => ({
      loading,
      entitlements,
      aiEnabled: entitlements.ai.enabled,
      aiPlan: entitlements.ai.plan,
      aiFeatures: entitlements.ai.features,
      canUseAiFeature,
    }),
    [loading, entitlements, canUseAiFeature]
  );
}
