'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';

export default function EvidenciasPage() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken();

    if (!token || !user?.tenant_id) return;

    fetch(`http://192.168.100.120:3000/api/evidences/${user.tenant_id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setData);
  }, []);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">

        <h1 className="text-2xl font-bold">Evidencias</h1>

        {data.map((e) => (
          <div key={e.id} className="bg-white p-4 rounded shadow">
            <div>{e.description}</div>
            <div className="text-sm text-gray-500">
              {new Date(e.created_at).toLocaleString()}
            </div>
          </div>
        ))}

      </div>
    </AppLayout>
  );
}
