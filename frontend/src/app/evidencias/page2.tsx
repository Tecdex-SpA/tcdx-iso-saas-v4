'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';

export default function EvidenciasPage() {
  const [data, setData] = useState<any[]>([]);
  const [iso, setIso] = useState('');

  const load = async () => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken();

    if (!token || !user?.tenant_id) return;

    const res = await fetch(
      `http://192.168.100.120:3000/api/evidences/${user.tenant_id}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const json = await res.json();
    setData(json);
  };

  useEffect(() => {
    load();
  }, []);

  // 🔥 FILTRO ISO
  const filtered = iso ? data.filter(d => d.iso === iso) : data;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">

        {/* HEADER */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Evidencias</h1>

          <select
            value={iso}
            onChange={(e) => setIso(e.target.value)}
            className="border px-3 py-1 rounded"
          >
            <option value="">Todas</option>
            <option value="ISO27001">ISO 27001</option>
            <option value="ISO9001">ISO 9001</option>
          </select>
        </div>

        {/* LISTA */}
        <div className="bg-white rounded shadow overflow-hidden">

          {filtered.length === 0 && (
            <div className="p-4 text-gray-500">
              No hay evidencias registradas.
            </div>
          )}

          {filtered.map((e) => (
            <div
              key={e.id}
              className="border-b p-4 space-y-2"
            >

              <div className="font-semibold">
                {e.iso} — Cláusula {e.clause}
              </div>

              <div className="text-sm text-gray-700">
                {e.control_description}
              </div>

              <div className="text-sm">
                <b>Descripción:</b> {e.description}
              </div>

              {e.file_name && (
                <div className="text-sm text-blue-600">
                  📎 {e.file_name}
                </div>
              )}

              <div className="text-xs text-gray-500">
                {new Date(e.created_at).toLocaleString()}
              </div>

            </div>
          ))}

        </div>

      </div>
    </AppLayout>
  );
}
