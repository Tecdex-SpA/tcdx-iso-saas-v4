'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';
import TcdxIcon from '@/components/icons/TcdxIcon';

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

type RiskControlRow = {
  id: string;
  clause?: string | null;
  category?: string | null;
  description?: string | null;
  status?: string | null;
  iso?: string;
  iso_code?: string;
  standard_code?: string;
  score?: number;
  nivel?: 'BAJO' | 'MEDIO' | 'ALTO';
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

export default function RiskMatrixPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6">Cargando matriz de riesgo...</div>
        </AppLayout>
      }
    >
      <RiskMatrixPageContent />
    </Suspense>
  );
}

function RiskMatrixPageContent() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get('id');
  const focusISO = searchParams.get('iso');

  const [controls, setControls] = useState<RiskControlRow[]>([]);
  const [iso, setIso] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  const [scope, setScope] = useState<ScopeResponse>({ operations: [], standards: [] });
  const [loadingStandards, setLoadingStandards] = useState(true);
  const [loadingControls, setLoadingControls] = useState(false);

  const [focusedControlId, setFocusedControlId] = useState('');
  const [focusMessage, setFocusMessage] = useState('');

  const focusAppliedRef = useRef(false);

  const operationalStandards = useMemo(() => {
    return (scope.standards || []).filter(isOperationalStandard);
  }, [scope.standards]);

  const activeStandardCodes = useMemo(() => {
    return new Set(operationalStandards.map((s) => s.code).filter(Boolean));
  }, [operationalStandards]);

  const loadScope = async () => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken();
    const tenantId = resolveTenantId(user);

    if (!token || !tenantId) {
      setLoadingStandards(false);
      return;
    }

    try {
      setLoadingStandards(true);

      const res = await fetch(`${API_URL}/api/tenant-standards/scope/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD RISK SCOPE:', json);
        setScope({ operations: [], standards: [] });
        setIso('');
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
      console.error('ERROR LOAD RISK SCOPE:', err);
      setScope({ operations: [], standards: [] });
      setIso('');
    } finally {
      setLoadingStandards(false);
    }
  };

  const load = async (selectedISO: string) => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken();
    const tenantId = resolveTenantId(user);

    if (!token || !tenantId || !selectedISO) {
      setControls([]);
      return;
    }

    if (!activeStandardCodes.has(selectedISO)) {
      setControls([]);
      return;
    }

    try {
      setLoadingControls(true);

      const res = await fetch(`${API_URL}/api/dashboard-controls/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD CONTROLS:', data);
        setControls([]);
        return;
      }

      const enriched = (Array.isArray(data) ? data : [])
        .map((c: any) => ({
          ...c,
          iso: c.iso || c.iso_code || c.standard_code || '',
        }))
        .filter((c: any) => activeStandardCodes.has(c.iso))
        .filter((c: any) => c.iso === selectedISO)
        .map((c: any) => {
          let p = 1;
          let i = 1;

          if (c.status === 'parcial') {
            p = 2;
            i = 2;
          }

          if (c.status === 'no cumple') {
            p = 3;
            i = 3;
          }

          const score = p * i;

          let nivel: 'BAJO' | 'MEDIO' | 'ALTO' = 'BAJO';
          if (score >= 6) nivel = 'ALTO';
          else if (score >= 3) nivel = 'MEDIO';

          return { ...c, score, nivel };
        })
        .sort((a: any, b: any) => Number(b.score || 0) - Number(a.score || 0));

      setControls(enriched);
    } catch (err) {
      console.error('ERROR LOAD CONTROLS:', err);
      setControls([]);
    } finally {
      setLoadingControls(false);
    }
  };

  useEffect(() => {
    void loadScope();
  }, []);

  useEffect(() => {
    focusAppliedRef.current = false;
    setFocusedControlId('');
    setFocusMessage('');
    setSelectedLevel(null);
  }, [focusId, focusISO]);

  useEffect(() => {
    if (iso) {
      void load(iso);
    } else {
      setControls([]);
    }

    if (!focusId) {
      setSelectedLevel(null);
    }
  }, [iso, activeStandardCodes]);

  const applyAI = async (tenant_control_id: string) => {
    const token = localStorage.getItem('token');

    try {
      await fetch(`${API_URL}/api/ai/apply/${tenant_control_id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (iso) {
        await load(iso);
      }
    } catch (err) {
      console.error('ERROR APPLY AI:', err);
      alert('Error aplicando acción IA');
    }
  };

  const explainRisk = (nivel: string) => {
    if (nivel === 'ALTO') {
      return 'Este nivel representa riesgos críticos que pueden generar no conformidades mayores en auditoría.';
    }

    if (nivel === 'MEDIO') {
      return 'Existe implementación parcial del control y riesgo de observación.';
    }

    return 'El control está correctamente implementado.';
  };

  const getColor = (value: number) => {
    if (value <= 2) return 'bg-green-500';
    if (value <= 4) return 'bg-yellow-400';
    return 'bg-red-500';
  };

  const filtered = useMemo(() => {
    return selectedLevel
      ? controls.filter((c) => c.nivel === selectedLevel)
      : [];
  }, [controls, selectedLevel]);

  const applyFocus = (control: RiskControlRow) => {
    setFocusedControlId(control.id);
    setSelectedLevel(control.nivel || null);
    setFocusMessage(
      `Resultado abierto desde búsqueda: ${control.iso} · cláusula ${
        control.clause || 'N/A'
      } · riesgo ${control.nivel}`
    );
    focusAppliedRef.current = true;

    setTimeout(() => {
      const el = document.getElementById(`risk-control-${control.id}`);
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
    if (!focusId || loadingControls || !controls.length || focusAppliedRef.current) return;

    const match = controls.find((c) => c.id === focusId);

    if (match) {
      applyFocus(match);
    }
  }, [focusId, controls, loadingControls]);

  if (loadingStandards) {
    return (
      <AppLayout>
        <div className="p-6">Cargando normas disponibles...</div>
      </AppLayout>
    );
  }

  if (!loadingStandards && operationalStandards.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">Matriz de Riesgo</h1>

          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded shadow">
            <h2 className="text-lg font-semibold mb-2">
              No hay normas operativas para esta empresa
            </h2>

            <p className="text-sm text-gray-700">
              Primero debes activar una norma con al menos una operación activa asignada.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Matriz de Riesgo</h1>
          <p className="text-sm text-gray-500 mt-1">
            Solo se calculan riesgos sobre normas dentro del alcance operativo activo.
          </p>
        </div>

        {focusMessage && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl px-5 py-4 shadow-sm">
            <div className="font-semibold">Apertura directa desde búsqueda</div>
            <div className="text-sm mt-1">{focusMessage}</div>
          </div>
        )}

        <select
          value={iso}
          onChange={(e) => {
            setIso(e.target.value);
            setSelectedLevel(null);
            setFocusedControlId('');
            if (!focusId) {
              setFocusMessage('');
            }
          }}
          className="border px-3 py-2 rounded"
        >
          <option value="">Seleccionar ISO</option>
          {operationalStandards.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} - {s.name}
            </option>
          ))}
        </select>

        {!iso && (
          <div className="bg-white p-6 rounded shadow space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <TcdxIcon name="risk" className="h-5 w-5" />
              </span>
              Matriz de Riesgo
            </h2>
            <p className="text-gray-700">
              La matriz de riesgo permite identificar, evaluar y priorizar riesgos en función de su probabilidad e impacto.
            </p>
            <p className="text-gray-700">
              Esta vista traduce automáticamente el estado de los controles en una evaluación visual del riesgo.
            </p>
            <p className="text-gray-600">
              Selecciona una norma operativa para visualizar los riesgos asociados.
            </p>
          </div>
        )}

        {iso && loadingControls && (
          <div className="bg-white p-4 rounded shadow text-gray-500">
            Cargando matriz de riesgo...
          </div>
        )}

        {iso && !loadingControls && (
          <div className="bg-white p-6 rounded shadow">
            <h2 className="font-semibold mb-4">Heatmap — {iso}</h2>

            {controls.length === 0 ? (
              <div className="text-gray-500">
                Esta norma no tiene controles cargados aún para esta empresa.
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 text-center">
                <div></div>
                <div>Prob. Baja</div>
                <div>Media</div>
                <div>Alta</div>

                {[3, 2, 1].map((impact) => (
                  <div key={`row-${impact}`} className="contents">
                    <div className="font-semibold">
                      {impact === 3 ? 'Impacto Alto' : impact === 2 ? 'Medio' : 'Bajo'}
                    </div>

                    {[1, 2, 3].map((prob) => {
                      const value = prob * impact;

                      let nivel = 'BAJO';
                      if (value >= 6) nivel = 'ALTO';
                      else if (value >= 3) nivel = 'MEDIO';

                      const totalEnNivel = controls.filter(
                        (c) => c.nivel === nivel
                      ).length;

                      return (
                        <div
                          key={`${prob}-${impact}`}
                          onClick={() => setSelectedLevel(nivel)}
                          className={`h-20 flex flex-col items-center justify-center text-white font-bold cursor-pointer hover:scale-105 transition ${getColor(
                            value
                          )}`}
                        >
                          <div>{value}</div>
                          <div className="text-xs">{nivel}</div>
                          <div className="text-[10px] opacity-90">
                            {totalEnNivel} ctrl
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedLevel && controls.length > 0 && (
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold">Análisis IA — {selectedLevel}</h3>
            <p className="mt-2 text-gray-700">{explainRisk(selectedLevel)}</p>
          </div>
        )}

        {selectedLevel && controls.length > 0 && (
          <div className="bg-white p-6 rounded shadow space-y-4">
            <h3 className="font-semibold">
              Controles con riesgo {selectedLevel}
            </h3>

            {filtered.length === 0 ? (
              <div className="text-gray-500">
                No hay controles en este nivel de riesgo.
              </div>
            ) : (
              filtered.map((c) => (
                <div
                  key={c.id}
                  id={`risk-control-${c.id}`}
                  className={`border p-4 rounded space-y-2 transition-all ${
                    focusedControlId === c.id
                      ? 'border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50'
                      : ''
                  }`}
                >
                  <div className="font-semibold">
                    Cláusula {c.clause}:{' '}
                    {c.category
                      ?.replace(`Cláusula ${c.clause}:`, '')
                      .replace(':', '')
                      .trim() || c.category}
                  </div>

                  <div className="text-sm text-gray-600">{c.description}</div>

                  <div className="text-sm">
                    Norma: <strong>{c.iso}</strong>
                  </div>

                  <div className="text-sm">
                    Score: <strong>{c.score}</strong>
                  </div>

                  {c.nivel !== 'BAJO' && (
                    <button
                      onClick={() => applyAI(c.id)}
                      className="bg-blue-600 text-white px-3 py-1 rounded"
                    >
                      ✨ Aplicar acción IA
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
