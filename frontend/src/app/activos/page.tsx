'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';
import { useTranslation } from '@/hooks/useTranslation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

type ScopeStandard = {
  code: string;
  name?: string;
  is_active?: boolean | string | number;
  active_operations_count?: number | string;
  active_operation_ids?: string[];
};

type ScopeResponse = {
  operations: any[];
  standards: ScopeStandard[];
};

type AssetRow = {
  id: string;
  tenant_id?: string;
  name: string;
  type?: string | null;
  iso?: string | null;
  criticality?: string | null;
  owner?: string | null;
  related_standards?: string[];
  created_at?: string | null;
};

type RiskRow = {
  id: string;
  asset_id?: string;
  risk: string;
  impact?: string | null;
  probability?: string | null;
  level?: string | null;
};

type RiskSummaryRow = {
  level: string;
  total: string | number;
};

function resolveTenantId(user: any): string {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    ''
  );
}

function isOperationalStandard(s: ScopeStandard) {
  return (
    (s?.is_active === true || s?.is_active === 'true' || s?.is_active === 1) &&
    Number(s?.active_operations_count || 0) > 0 &&
    Array.isArray(s?.active_operation_ids) &&
    s.active_operation_ids.length > 0
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);

  return d.toLocaleDateString('es-CL');
}

function riskLevelLabel(value?: string | null) {
  return String(value || 'bajo').toLowerCase();
}

function riskLevelClasses(value?: string | null) {
  const level = riskLevelLabel(value);

  if (level === 'alto') return 'border-red-200 bg-red-50 text-red-700';
  if (level === 'medio') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function criticalityClasses(value?: string | null) {
  const level = String(value || '').toLowerCase();

  if (level === 'alta') return 'border-red-200 bg-red-50 text-red-700';
  if (level === 'media') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

export default function ActivosPage() {
  const { t } = useTranslation();

  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6">{t('assets.loading')}</div>
        </AppLayout>
      }
    >
      <ActivosPageContent />
    </Suspense>
  );
}

function ActivosPageContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const focusId = searchParams.get('id');
  const focusISO = searchParams.get('iso');

  const [iso, setIso] = useState('');
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [riskSummary, setRiskSummary] = useState<RiskSummaryRow[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const [scope, setScope] = useState<ScopeResponse>({ operations: [], standards: [] });
  const [loadingStandards, setLoadingStandards] = useState(true);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [loadingRisks, setLoadingRisks] = useState(false);
  const [loadingRiskSummary, setLoadingRiskSummary] = useState(false);

  const [selectedAsset, setSelectedAsset] = useState<AssetRow | null>(null);
  const [focusedAssetId, setFocusedAssetId] = useState('');
  const [focusMessage, setFocusMessage] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const focusAppliedRef = useRef(false);

  const [form, setForm] = useState({
    name: '',
    type: '',
    criticality: '',
    owner: '',
  });

  const [riskForm, setRiskForm] = useState({
    risk: '',
    impact: '',
    probability: '',
  });

  const tenantId = resolveTenantId(user);

  const operationalStandards = useMemo(() => {
    return (scope.standards || []).filter(isOperationalStandard);
  }, [scope.standards]);

  const visibleAssets = useMemo(() => {
    if (!iso) return [];

    return assets
      .filter((asset) => {
        const related = new Set<string>([
          ...(Array.isArray(asset.related_standards) ? asset.related_standards : []),
          ...(asset.iso ? [asset.iso] : []),
        ]);

        return related.has(iso);
      })
      .sort((a, b) => {
        const criticalityRank = (v?: string | null) => {
          if (v === 'alta') return 0;
          if (v === 'media') return 1;
          return 2;
        };

        const byCriticality =
          criticalityRank(a.criticality) - criticalityRank(b.criticality);
        if (byCriticality !== 0) return byCriticality;

        return String(a.name || '').localeCompare(String(b.name || ''));
      });
  }, [assets, iso]);

  const riskTotals = useMemo(() => {
    const map = { alto: 0, medio: 0, bajo: 0 };

    riskSummary.forEach((row) => {
      const level = riskLevelLabel(row.level) as 'alto' | 'medio' | 'bajo';
      const total = Number(row.total || 0);

      if (map[level] !== undefined) {
        map[level] += total;
      }
    });

    return map;
  }, [riskSummary]);

  const selectedAssetRisks = useMemo(() => {
    return {
      total: risks.length,
      alto: risks.filter((r) => riskLevelLabel(r.level) === 'alto').length,
      medio: risks.filter((r) => riskLevelLabel(r.level) === 'medio').length,
      bajo: risks.filter((r) => riskLevelLabel(r.level) === 'bajo').length,
    };
  }, [risks]);

  const displayLevel = (value?: string | null) => {
    const raw = String(value || '').toLowerCase();
    if (raw === 'alto' || raw === 'alta') return t('assets.levels.high');
    if (raw === 'medio' || raw === 'media') return t('assets.levels.medium');
    return t('assets.levels.low');
  };

  const highCriticalityCount = useMemo(() => {
    return visibleAssets.filter((a) => String(a.criticality || '').toLowerCase() === 'alta')
      .length;
  }, [visibleAssets]);

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = getUserFromToken();

    setToken(t);
    setUser(u);
  }, []);

  useEffect(() => {
    focusAppliedRef.current = false;
    setFocusedAssetId('');
    setFocusMessage('');
  }, [focusId, focusISO]);

  const loadScope = async (tenantIdValue: string, authToken: string) => {
    try {
      setLoadingStandards(true);
      setErrorMessage('');

      const res = await fetch(`${API_URL}/api/tenant-standards/scope/${tenantIdValue}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD ASSETS SCOPE:', json);
        setScope({ operations: [], standards: [] });
        setIso('');
        setErrorMessage(t('assets.scopeLoadError'));
        return;
      }

      const nextScope: ScopeResponse = {
        operations: Array.isArray(json?.operations) ? json.operations : [],
        standards: Array.isArray(json?.standards) ? json.standards : [],
      };

      const activeStandards = nextScope.standards.filter(isOperationalStandard);

      setScope(nextScope);

      if (activeStandards.length > 0) {
        setIso((prev) => {
          if (focusISO) {
            const existsFocus = activeStandards.some((s) => s.code === focusISO);
            if (existsFocus) return focusISO;
          }

          const exists = activeStandards.some((s) => s.code === prev);
          return exists ? prev : activeStandards[0].code;
        });
      } else {
        setIso('');
      }
    } catch (err) {
      console.error('ERROR LOAD ASSETS SCOPE:', err);
      setScope({ operations: [], standards: [] });
      setIso('');
      setErrorMessage(t('assets.scopeLoadGenericError'));
    } finally {
      setLoadingStandards(false);
    }
  };

  const loadAssets = async (tenantIdValue: string, authToken: string) => {
    try {
      setLoadingAssets(true);

      const res = await fetch(`${API_URL}/api/assets/${tenantIdValue}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD ASSETS:', json);
        setAssets([]);
        return;
      }

      setAssets(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error('ERROR LOAD ASSETS:', err);
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  };

  const loadRiskSummary = async (tenantIdValue: string, authToken: string) => {
    try {
      setLoadingRiskSummary(true);

      const res = await fetch(`${API_URL}/api/assets/risk-summary/${tenantIdValue}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD RISK SUMMARY:', json);
        setRiskSummary([]);
        return;
      }

      setRiskSummary(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error('ERROR LOAD RISK SUMMARY:', err);
      setRiskSummary([]);
    } finally {
      setLoadingRiskSummary(false);
    }
  };

  const loadRisks = async (assetId: string, authToken?: string | null) => {
    try {
      const tkn = authToken || token;
      if (!tkn) return;

      setLoadingRisks(true);

      const res = await fetch(`${API_URL}/api/assets/risk/${assetId}`, {
        headers: { Authorization: `Bearer ${tkn}` },
      });

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD RISKS:', json);
        setRisks([]);
        return;
      }

      setRisks(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error('ERROR LOAD RISKS:', err);
      setRisks([]);
    } finally {
      setLoadingRisks(false);
    }
  };

  useEffect(() => {
    if (!token || !tenantId) {
      setLoadingStandards(false);
      setLoadingAssets(false);
      return;
    }

    void loadScope(tenantId, token);
    void loadAssets(tenantId, token);
    void loadRiskSummary(tenantId, token);
  }, [token, tenantId]);

  useEffect(() => {
    if (!selectedAsset) {
      setRisks([]);
      return;
    }

    const stillVisible = visibleAssets.find((a) => a.id === selectedAsset.id);
    if (!stillVisible) {
      setSelectedAsset(null);
      setRisks([]);
    }
  }, [visibleAssets, selectedAsset]);

  const refreshAll = async () => {
    if (!tenantId || !token) return;

    await Promise.all([
      loadAssets(tenantId, token),
      loadRiskSummary(tenantId, token),
      selectedAsset ? loadRisks(selectedAsset.id, token) : Promise.resolve(),
    ]);
  };

  const save = async () => {
    if (!user || !token || !tenantId) return;

    if (!iso) {
      alert(t('assets.selectContextIso'));
      return;
    }

    if (!form.name || !form.type || !form.criticality || !form.owner) {
      alert(t('assets.completeAssetFields'));
      return;
    }

    const res = await fetch(`${API_URL}/api/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        iso,
        ...form,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || t('assets.createError'));
      return;
    }

    setForm({ name: '', type: '', criticality: '', owner: '' });
    await refreshAll();
    alert(
      `${t('assets.createdLinkedTo')} ${(data.related_standards || []).join(', ')}`
    );
  };

  const saveRisk = async () => {
    if (!selectedAsset || !token) return;

    if (!riskForm.risk || !riskForm.impact || !riskForm.probability) {
      alert(t('assets.completeRiskFields'));
      return;
    }

    const res = await fetch(`${API_URL}/api/assets/risk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        asset_id: selectedAsset.id,
        risk: riskForm.risk,
        impact: riskForm.impact,
        probability: riskForm.probability,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || t('assets.saveRiskError'));
      return;
    }

    setRiskForm({ risk: '', impact: '', probability: '' });
    await loadRisks(selectedAsset.id, token);
    await loadRiskSummary(tenantId, token);
  };

  const createFindingFromRisk = async (asset: AssetRow, risk: RiskRow) => {
    if (!token || !tenantId) return;

    const title = window.prompt(
      `${t('assets.findingPromptTitle')} ${asset.name}`,
      `${t('assets.findingDefaultTitle')} ${asset.name}`
    );

    if (!title) return;

    const description =
      window.prompt(
        t('assets.findingPromptDescription'),
        `${risk.risk} — Activo: ${asset.name}`
      ) || '';

    const findingType =
      risk.level === 'alto'
        ? 'no conformidad'
        : risk.level === 'medio'
        ? 'observacion'
        : 'oportunidad de mejora';

    const severity =
      risk.level === 'alto'
        ? 'alta'
        : risk.level === 'medio'
        ? 'media'
        : 'baja';

    try {
      setActionLoading(`finding-${risk.id}`);

      const res = await fetch(`${API_URL}/api/findings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          iso_code: iso || asset.iso,
          title,
          description,
          finding_type: findingType,
          severity,
          source_type: 'risk',
          asset_id: asset.id,
          owner: asset.owner || '',
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || t('assets.createFindingError'));
        return;
      }

      alert(t('assets.findingCreated'));
    } catch (err) {
      console.error('ERROR CREATE FINDING FROM RISK:', err);
      alert(t('assets.createFindingError'));
    } finally {
      setActionLoading('');
    }
  };

  const createActionFromRisk = async (asset: AssetRow, risk: RiskRow) => {
    if (!token || !tenantId) return;

    const title = window.prompt(
      `${t('assets.actionPromptTitle')} ${asset.name}`,
      `${t('assets.actionDefaultTitle')} ${asset.name}`
    );

    if (!title) return;

    const description =
      window.prompt(
        t('assets.actionPromptDescription'),
        `${risk.risk} — Activo: ${asset.name}`
      ) || '';

    const owner =
      window.prompt(t('assets.actionPromptOwner'), asset.owner || '') ||
      asset.owner ||
      '';

    const priority =
      risk.level === 'alto'
        ? 'alta'
        : risk.level === 'medio'
        ? 'media'
        : 'baja';

    try {
      setActionLoading(`action-${risk.id}`);

      const res = await fetch(`${API_URL}/api/action-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          iso_code: iso || asset.iso,
          title,
          description,
          priority,
          owner,
          source_type: 'risk',
          asset_id: asset.id,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || t('assets.createActionError'));
        return;
      }

      alert(t('assets.actionCreated'));
    } catch (err) {
      console.error('ERROR CREATE ACTION FROM RISK:', err);
      alert(t('assets.createActionError'));
    } finally {
      setActionLoading('');
    }
  };

  const applyFocus = async (asset: AssetRow) => {
    setFocusedAssetId(asset.id);
    setSelectedAsset(asset);
    setFocusMessage(
      `${t('assets.directOpen')}: ${t('assets.title').toLowerCase()} ${asset.name}${asset.type ? ` (${asset.type})` : ''}`
    );
    focusAppliedRef.current = true;

    if (token) {
      await loadRisks(asset.id, token);
    }

    setTimeout(() => {
      const el = document.getElementById(`asset-${asset.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 250);
  };

  useEffect(() => {
    if (loadingStandards || !operationalStandards.length) return;

    if (focusISO) {
      const exists = operationalStandards.some((s) => s.code === focusISO);
      if (exists && iso !== focusISO) {
        setIso(focusISO);
      }
    }
  }, [focusISO, operationalStandards, loadingStandards, iso]);

  useEffect(() => {
    if (!focusId || !assets.length || focusAppliedRef.current) return;

    const match = assets.find((a) => a.id === focusId);
    if (!match) return;

    const assetStandards = new Set<string>([
      ...(Array.isArray(match.related_standards) ? match.related_standards : []),
      ...(match.iso ? [match.iso] : []),
    ]);

    if (focusISO) {
      const hasIso = assetStandards.has(focusISO);
      if (hasIso && iso !== focusISO) {
        setIso(focusISO);
      }
    } else {
      const preferredIso = match.iso || (Array.from(assetStandards)[0] ?? '');
      if (preferredIso && iso !== preferredIso) {
        setIso(preferredIso);
      }
    }

    void applyFocus(match);
  }, [focusId, assets, iso, focusISO, token]);

  if (loadingStandards) {
    return (
      <AppLayout>
        <div className="p-6">{t('assets.loadingStandards')}</div>
      </AppLayout>
    );
  }

  if (!loadingStandards && operationalStandards.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">{t('assets.title')}</h1>

          <div className="rounded-[28px] border border-yellow-200 bg-yellow-50 p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">
              {t('assets.noOperationalStandards')}
            </h2>

            <p className="text-sm text-gray-700">
              {t('assets.noOperationalStandardsHelp')}
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loadingAssets) {
    return (
      <AppLayout>
        <div className="p-6">{t('assets.loading')}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1800px] space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#edf4ff_100%)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                  {t('assets.eyebrow')}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {t('assets.badge')}
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                {t('assets.title')}
              </h1>

              <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">
                {t('assets.subtitle')}
              </p>
            </div>

            <div className="grid min-w-[320px] grid-cols-1 gap-3 md:grid-cols-2">
              <MetricCard title={t('assets.metrics.visibleAssets')} value={visibleAssets.length} tone="slate" />
              <MetricCard title={t('assets.metrics.highCriticality')} value={highCriticalityCount} tone="red" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
            <MetricCard title={t('assets.metrics.highRisks')} value={loadingRiskSummary ? '...' : riskTotals.alto} tone="red" />
            <MetricCard title={t('assets.metrics.mediumRisks')} value={loadingRiskSummary ? '...' : riskTotals.medio} tone="amber" />
            <MetricCard title={t('assets.metrics.lowRisks')} value={loadingRiskSummary ? '...' : riskTotals.bajo} tone="green" />
            <MetricCard title={t('assets.metrics.selectedAssetRisks')} value={selectedAssetRisks.total} tone="blue" />
            <MetricCard title={t('assets.metrics.selectedHigh')} value={selectedAssetRisks.alto} tone="red" />
            <MetricCard title={t('assets.metrics.selectedMedium')} value={selectedAssetRisks.medio} tone="amber" />
            <MetricCard title={t('assets.metrics.selectedLow')} value={selectedAssetRisks.bajo} tone="green" />
            <MetricCard title={t('assets.metrics.visibleStandard')} value={iso || '-'} tone="slate" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_340px]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <FilterLabel>{t('assets.contextStandard')}</FilterLabel>
              <select
                value={iso}
                onChange={(e) => {
                  setIso(e.target.value);
                  setFocusedAssetId('');
                  if (!focusId) {
                    setFocusMessage('');
                  }
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
              >
                <option value="">{t('assets.selectIso')}</option>
                {operationalStandards.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {t('assets.selectedAsset')}
              </div>
              <div className="mt-3 text-sm text-slate-700">
                {selectedAsset ? (
                  <>
                    <div className="font-semibold text-slate-900">{selectedAsset.name}</div>
                    <div>{selectedAsset.type || t('assets.noType')}</div>
                    <div className="mt-1">{t('assets.owner')}: {selectedAsset.owner || '-'}</div>
                  </>
                ) : (
                  t('assets.selectAssetHelp')
                )}
              </div>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-red-700 shadow-sm">
            {errorMessage}
          </div>
        )}

        {focusMessage && (
          <div className="rounded-[24px] border border-indigo-200 bg-indigo-50 px-5 py-4 text-indigo-900 shadow-sm">
            <div className="font-semibold">{t('assets.directOpen')}</div>
            <div className="mt-1 text-sm">{focusMessage}</div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
          <div className="space-y-6">
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="mb-5">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {t('assets.createAsset')}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t('assets.createAssetHelp')}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="space-y-4">
                  <FieldBlock label={t('assets.fields.assetName')}>
                    <input
                      placeholder={t('assets.placeholders.assetName')}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
                    />
                  </FieldBlock>

                  <FieldBlock label={t('assets.fields.type')}>
                    <input
                      placeholder={t('assets.placeholders.type')}
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
                    />
                  </FieldBlock>
                </div>

                <div className="space-y-4">
                  <FieldBlock label={t('assets.fields.criticality')}>
                    <select
                      value={form.criticality}
                      onChange={(e) => setForm({ ...form, criticality: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                    >
                      <option value="">{t('assets.selectCriticality')}</option>
                      <option value="alta">{t('assets.levels.high')}</option>
                      <option value="media">{t('assets.levels.medium')}</option>
                      <option value="baja">{t('assets.levels.low')}</option>
                    </select>
                  </FieldBlock>

                  <FieldBlock label={t('assets.fields.owner')}>
                    <input
                      placeholder={t('assets.placeholders.owner')}
                      value={form.owner}
                      onChange={(e) => setForm({ ...form, owner: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
                    />
                  </FieldBlock>
                </div>
              </div>

              <div className="mt-4 rounded-[24px] border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-slate-700">
                {t('assets.contextStandard')}: <strong>{iso || t('assets.notSelected')}</strong>
              </div>

              <div className="mt-4">
                <button
                  onClick={save}
                  className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  {t('assets.saveAsset')}
                </button>
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                    {t('assets.relatedAssets')} {iso || t('assets.theStandard')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('assets.relatedAssetsHelp')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={refreshAll}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t('common.refresh')}
                </button>
              </div>

              {visibleAssets.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  {t('assets.noAssetsForStandard')}
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleAssets.map((asset) => (
                    <article
                      key={asset.id}
                      id={`asset-${asset.id}`}
                      className={`rounded-[24px] border bg-white p-5 shadow-sm transition ${
                        focusedAssetId === asset.id
                          ? 'border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50/30'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {asset.iso || t('assets.noIso')}
                            </span>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${criticalityClasses(
                                asset.criticality
                              )}`}
                            >
                              {t('assets.fields.criticality')} {displayLevel(asset.criticality)}
                            </span>
                          </div>

                          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                            {asset.name}
                          </h3>

                          <div className="mt-2 text-sm text-slate-500">
                            {asset.type || t('assets.noType')} · {t('assets.owner')}: {asset.owner || '-'}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {Array.from(
                              new Set<string>([
                                ...(Array.isArray(asset.related_standards) ? asset.related_standards : []),
                                ...(asset.iso ? [asset.iso] : []),
                              ])
                            ).map((code) => (
                              <span
                                key={code}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 xl:min-w-[280px]">
                          <InfoBox label={t('assets.fields.type')} value={asset.type || '-'} />
                          <InfoBox label={t('assets.fields.owner')} value={asset.owner || '-'} />
                          <InfoBox label={t('assets.fields.criticality')} value={asset.criticality ? displayLevel(asset.criticality) : '-'} />
                          <InfoBox label={t('assets.fields.created')} value={formatDate(asset.created_at)} />
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          onClick={async () => {
                            setSelectedAsset(asset);
                            setFocusedAssetId(asset.id);
                            await loadRisks(asset.id, token);
                          }}
                          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                        >
                          {t('assets.viewRisks')}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="mb-5">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {t('assets.assetRisks')}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t('assets.assetRisksHelp')}
                </p>
              </div>

              {!selectedAsset ? (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  {t('assets.selectAssetRisksHelp')}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      {selectedAsset.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {selectedAsset.type || t('assets.noType')} · {selectedAsset.owner || t('assets.noOwner')}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <MetricTiny title={t('assets.levels.highPlural')} value={selectedAssetRisks.alto} tone="red" />
                    <MetricTiny title={t('assets.levels.mediumPlural')} value={selectedAssetRisks.medio} tone="amber" />
                    <MetricTiny title={t('assets.levels.lowPlural')} value={selectedAssetRisks.bajo} tone="green" />
                  </div>

                  <div className="space-y-3">
                    <FieldBlock label={t('assets.fields.riskDescription')}>
                      <input
                        placeholder={t('assets.placeholders.riskDescription')}
                        value={riskForm.risk}
                        onChange={(e) => setRiskForm({ ...riskForm, risk: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
                      />
                    </FieldBlock>

                    <FieldBlock label={t('assets.fields.impact')}>
                      <select
                        value={riskForm.impact}
                        onChange={(e) => setRiskForm({ ...riskForm, impact: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                      >
                        <option value="">{t('assets.selectImpact')}</option>
                        <option value="alto">{t('assets.levels.high')}</option>
                        <option value="medio">{t('assets.levels.medium')}</option>
                        <option value="bajo">{t('assets.levels.low')}</option>
                      </select>
                    </FieldBlock>

                    <FieldBlock label={t('assets.fields.likelihood')}>
                      <select
                        value={riskForm.probability}
                        onChange={(e) =>
                          setRiskForm({ ...riskForm, probability: e.target.value })
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                      >
                        <option value="">{t('assets.selectLikelihood')}</option>
                        <option value="alta">{t('assets.levels.high')}</option>
                        <option value="media">{t('assets.levels.medium')}</option>
                        <option value="baja">{t('assets.levels.low')}</option>
                      </select>
                    </FieldBlock>

                    <button
                      onClick={saveRisk}
                      className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
                    >
                      {t('assets.addRisk')}
                    </button>
                  </div>

                  {loadingRisks ? (
                    <div className="text-sm text-slate-500">{t('assets.loadingRisks')}</div>
                  ) : risks.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                      {t('assets.noRisks')}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {risks.map((risk) => (
                        <div
                          key={risk.id}
                          className="rounded-[22px] border border-slate-200 bg-white p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskLevelClasses(
                                risk.level
                              )}`}
                            >
                              {risk.level ? displayLevel(risk.level) : t('assets.levels.low')}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                              {t('assets.fields.impact')} {risk.impact ? displayLevel(risk.impact) : '-'}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                              {t('assets.fields.likelihood')} {risk.probability ? displayLevel(risk.probability) : '-'}
                            </span>
                          </div>

                          <div className="mt-3 text-sm font-semibold text-slate-900">
                            {risk.risk}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              onClick={() => createFindingFromRisk(selectedAsset, risk)}
                              disabled={actionLoading === `finding-${risk.id}`}
                              className="rounded-2xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              {actionLoading === `finding-${risk.id}` ? t('assets.creating') : t('assets.createFinding')}
                            </button>

                            <button
                              onClick={() => createActionFromRisk(selectedAsset, risk)}
                              disabled={actionLoading === `action-${risk.id}`}
                              className="rounded-2xl bg-purple-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              {actionLoading === `action-${risk.id}` ? t('assets.creating') : t('assets.createAction')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}

function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      {children}
    </label>
  );
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function MetricCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string | number;
  tone: 'slate' | 'red' | 'amber' | 'green' | 'blue';
}) {
  const tones: Record<string, string> = {
    slate: 'border-slate-200 bg-white text-slate-900',
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return (
    <div className={`rounded-[24px] border p-4 shadow-sm ${tones[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">
        {title}
      </div>
      <div className="mt-3 text-4xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function MetricTiny({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: 'red' | 'amber' | 'green';
}) {
  const tones: Record<string, string> = {
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  return (
    <div className={`rounded-[18px] border p-3 text-center ${tones[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-75">
        {title}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
