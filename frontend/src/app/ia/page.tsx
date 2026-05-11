'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';

export default function IACompliancePage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const user = getUserFromToken();
    const token = localStorage.getItem('token');

    if (user?.tenant_id) {
      fetch(`http://192.168.100.120:3000/api/ai/recommendations/${user.tenant_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(setData);
    }
  }, []);

  if (!data) {
    return <AppLayout><div className="px-3 py-4 sm:p-6">Cargando IA...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6 px-3 py-4 sm:p-6">

        <h1 className="text-2xl font-bold">IA Compliance</h1>

        {/* RESUMEN */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="font-semibold mb-2">Resumen Ejecutivo</h2>
          <p>{data.summary}</p>
        </div>

        {/* SEMÁFORO + SCORE */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

          <div className="bg-white p-6 rounded-xl shadow text-center">
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

          <div className="bg-white p-6 rounded-xl shadow text-center">
            <h2 className="mb-2 font-semibold">Score de Riesgo</h2>
            <div className="text-4xl font-bold text-blue-600">
              {data.riskScore}%
            </div>
          </div>

        </div>

        {/* TOP RIESGOS */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="mb-4 font-semibold">Controles Críticos / Pendientes</h2>

          <div className="space-y-2">
            {data.topRisks.map((r: any, i: number) => (
              <div key={i} className="border p-3 rounded">
                {r.clause} - {r.status}
              </div>
            ))}
          </div>
        </div>

        {/* RECOMENDACIONES */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="mb-4 font-semibold">Recomendaciones</h2>

          <div className="space-y-3">
            {data.recommendations.map((r: any, i: number) => (
              <div key={i} className="border p-4 rounded-lg">

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
