'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sections = [
  { href: '/privacidad', label: 'Privacidad' },
  { href: '/incidentes', label: 'Incidentes' },
  { href: '/proveedores', label: 'Terceros' },
  { href: '/conectores', label: 'Integraciones' },
];

export default function Phase2Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Módulos GRC integrados" className="flex flex-wrap gap-2">
      {sections.map(section => {
        const active = pathname === section.href || pathname.startsWith(`${section.href}/`);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'rounded-full border px-4 py-2 text-sm font-semibold transition',
              active
                ? 'border-[var(--tcdx-color-primary)] bg-[var(--tcdx-color-primary)] text-white'
                : 'border-[var(--tcdx-color-border)] bg-white text-[var(--tcdx-color-text-secondary)] hover:border-[var(--tcdx-color-primary)]',
            ].join(' ')}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
