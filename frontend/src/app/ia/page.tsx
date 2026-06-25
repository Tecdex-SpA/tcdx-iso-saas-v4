'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';
import TcdxIcon from '@/components/icons/TcdxIcon';
import { useTenantEntitlements } from '@/hooks/useTenantEntitlements';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

type AiRiskItem = {
  clause?: string;
  status?: string;
};

type AiRecommendationItem = {
  clause?: string;
  level?: string;
  message?: string;
};

type AiComplianceData = {
  summary?: string;
  riskLevel?: string;
  riskScore?: string | number;
  topRisks: AiRiskItem[];
  recommendations: AiRecommendationItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toAiComplianceData(value: unknown): AiComplianceData | null {
  if (!isRecord(value)) return null;
  return {
    summary: typeof value.summary === 'string' ? value.summary : '',
    riskLevel: typeof value.riskLevel === 'string' ? value.riskLevel : '',
    riskScore: typeof value.riskScore === 'string' || typeof value.riskScore === 'number'
      ? value.riskScore
      : 0,
    topRisks: Array.isArray(value.topRisks) ? value.topRisks as AiRiskItem[] : [],
    recommendations: Array.isArray(value.recommendations) ? value.recommendations as AiRecommendationItem[] : [],
  };
}

export default function IACompliancePage() {
  const { loading: entitlementsLoading, canUseAiFeature } = useTenantEntitlements();
  const canUseAiCompliance = !entitlementsLoading && canUseAiFeature('suggestions');
  const [data, setData] = useState<AiComplianceData | null>(null);

  useEffect(() => {
    if (entitlementsLoading) return;

    if (!canUseAiCompliance) {
      window.location.replace('/dashboard');
      return;
    }

    const user = getUserFromToken();
    const token = localStorage.getItem('token');

    if (user?.tenant_id) {
      fetch(`${API_URL}/api/ai/recommendations/${user.tenant_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then((json: unknown) => setData(toAiComplianceData(json)));
    }
  }, [canUseAiCompliance, entitlementsLoading]);

  if (!data) {
    return <AppLayout><div className="px-3 py-4 sm:p-6">Cargando IA...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6 px-3 py-4 sm:p-6">

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#06173a_0%,#082452_58%,#0f172a_100%)] p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/65">
                <TcdxIcon name="ai" className="h-4 w-4" />
                Inteligencia operacional
              </div>
              <h1 className="mt-3 text-3xl font-bold">IA Compliance</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/68">
                Priorización asistida para controles, riesgos y acciones con foco en operación auditora.
              </p>
            </div>
            <div className="rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-sm text-white/72">
              La IA no aplica cambios directamente. Genera un borrador revisable por una persona autorizada.
            </div>
          </div>
        </section>

        {/* RESUMEN */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <h2 className="font-semibold mb-2">Resumen Ejecutivo</h2>
          <p className="leading-7 text-slate-600">{data.summary}</p>
        </div>

        {/* SEMÁFORO + SCORE */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <h2 className="mb-2 font-semibold">Nivel de Riesgo</h2>

            <div className={`text-3xl font-bold ${
              data.riskLevel === 'ALTO'
                ? 'text-red-600'
                : data.riskLevel === 'MEDIO'
                ? 'text-yellow-600'
                : 'text-green-600'
            }`}>
              {data.riskLevel}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <h2 className="mb-2 font-semibold">Score de Riesgo</h2>
            <div className="text-4xl font-bold text-blue-600">
              {data.riskScore}%
            </div>
          </div>

        </div>

        {/* TOP RIESGOS */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <h2 className="mb-4 font-semibold">Controles Críticos / Pendientes</h2>

          <div className="space-y-2">
            {data.topRisks.map((r, i) => (
              <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                {r.clause} - {r.status}
              </div>
            ))}
          </div>
        </div>

        {/* RECOMENDACIONES */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <h2 className="mb-4 font-semibold">Recomendaciones</h2>

          <div className="space-y-3">
            {data.recommendations.map((r, i) => (
              <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">

                <div className="font-semibold">{r.clause}</div>

                <div className={`text-sm ${
                  r.level === 'alto'
                    ? 'text-red-600'
                    : r.level === 'medio'
                    ? 'text-yellow-600'
                    : 'text-green-600'
                }`}>
                  {r.message}
                </div>

              </div>
            ))}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
