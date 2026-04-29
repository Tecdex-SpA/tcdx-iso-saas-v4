'use client';

import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout({ children }: any) {
  return (
    <div className="flex h-screen bg-[#1b2733]">

      {/* SIDEBAR */}
      <Sidebar />

      {/* CONTENIDO */}
      <div className="flex flex-col flex-1">

        {/* HEADER */}
        <Header />

        {/* FRAME */}
        <main className="flex-1 overflow-auto bg-gray-100 p-6">
          {children}
        </main>

      </div>
    </div>
  );
}
