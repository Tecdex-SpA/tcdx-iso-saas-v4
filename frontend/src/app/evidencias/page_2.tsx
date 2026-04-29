'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';

const API = "http://192.168.100.120:3000/api";

export default function EvidenciasPage() {
  const [evidences, setEvidences] = useState<any[]>([]);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = async () => {
    if (!token) return;

    const res = await fetch(`${API}/evidences`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    setEvidences(data);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">

        <h1 className="text-2xl font-bold">Evidencias</h1>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3">Control</th>
                <th className="p-3">Descripción</th>
                <th className="p-3">Fecha</th>
              </tr>
            </thead>

            <tbody>
              {evidences.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3">{e.clause || "-"}</td>
                  <td className="p-3">{e.description}</td>
                  <td className="p-3">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {evidences.length === 0 && (
            <div className="p-4 text-gray-500 text-center">
              No hay evidencias registradas
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
