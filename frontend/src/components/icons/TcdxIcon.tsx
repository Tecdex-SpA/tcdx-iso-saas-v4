import type { ReactElement, SVGProps } from 'react';

export type TcdxIconName =
  | 'activity'
  | 'ai'
  | 'alert'
  | 'audit'
  | 'bell'
  | 'building'
  | 'calendar'
  | 'check'
  | 'chevronDown'
  | 'clipboard'
  | 'controls'
  | 'dashboard'
  | 'document'
  | 'evidence'
  | 'export'
  | 'finding'
  | 'heart'
  | 'home'
  | 'hourglass'
  | 'kpi'
  | 'logout'
  | 'plan'
  | 'puzzle'
  | 'refresh'
  | 'risk'
  | 'search'
  | 'settings'
  | 'shield'
  | 'soa'
  | 'trend'
  | 'user';

type IconProps = SVGProps<SVGSVGElement> & {
  name: TcdxIconName;
};

const paths: Record<TcdxIconName, ReactElement> = {
  activity: (
    <>
      <path d="M4 13h3l2-7 4 12 2-7h5" />
      <path d="M4 19h16" />
    </>
  ),
  ai: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="3" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
      <path d="M10 12h4M12 10v4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.8 19a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L12 3Z" />
      <path d="M12 9v5M12 18h.01" />
    </>
  ),
  audit: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6" />
      <path d="M8 14l2 2 5-6" />
    </>
  ),
  bell: (
    <>
      <path d="M18 15v-4a6 6 0 1 0-12 0v4l-2 3h16Z" />
      <path d="M9.5 21h5" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M16 9h2a2 2 0 0 1 2 2v10M3 21h18" />
      <path d="M8 7h3M8 11h3M8 15h3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.6 2.6L16.5 9" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  clipboard: (
    <>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
      <path d="M8 13h8M8 17h5" />
    </>
  ),
  controls: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="8" cy="6" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="10" cy="18" r="2" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="8" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="15" width="7" height="6" rx="2" />
    </>
  ),
  document: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6M8 13h8M8 17h6" />
    </>
  ),
  evidence: (
    <>
      <path d="M4 7h5l2 3h9v9a2 2 0 0 1-2 2H4Z" />
      <path d="m9 15 2 2 4-5" />
    </>
  ),
  export: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6M12 12v6M9 15l3 3 3-3" />
    </>
  ),
  finding: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2 4 2 4H5" />
      <circle cx="18" cy="18" r="3" />
    </>
  ),
  heart: (
    <>
      <path d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21l8.8-8a5.2 5.2 0 0 0 0-7.4Z" />
      <path d="M4 12h4l1.5-3 3 6 2-4H20" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6 3h12M6 21h12M8 3v5a4 4 0 0 0 2 3.4L12 12l2 1.6A4 4 0 0 1 16 17v4" />
      <path d="M16 3v5a4 4 0 0 1-2 3.4L12 12l-2 1.6A4 4 0 0 0 8 17v4" />
    </>
  ),
  kpi: (
    <>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15l3-4 3 2 4-7" />
      <path d="M8 19v-4M12 19v-8M16 19v-6" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M21 3v18h-8" />
    </>
  ),
  plan: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9h8M8 13h5M8 17h7" />
      <path d="m15 13 1.5 1.5L20 11" />
    </>
  ),
  puzzle: (
    <>
      <path d="M9 3h6v4h2a3 3 0 1 1 0 6h-2v8H9v-4H7a3 3 0 1 1 0-6h2Z" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 6v5h-5" />
      <path d="M4 18v-5h5" />
      <path d="M18 10a6 6 0 0 0-10-4.2L4 9.5M6 14a6 6 0 0 0 10 4.2l4-3.7" />
    </>
  ),
  risk: (
    <>
      <path d="M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6Z" />
      <path d="M12 8v5M12 17h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2 3.4-.2-.1a1.8 1.8 0 0 0-2.1.2 1.8 1.8 0 0 0-.8 1.8V22H9.2v-.3a1.8 1.8 0 0 0-.8-1.8 1.8 1.8 0 0 0-2.1-.2l-.2.1-2-3.4.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.6-1.2H3V9h.1a1.8 1.8 0 0 0 1.6-1.2 1.8 1.8 0 0 0-.4-2L4.2 5.7l2-3.4.2.1a1.8 1.8 0 0 0 2.1-.2A1.8 1.8 0 0 0 9.2.4V0h5.6v.3a1.8 1.8 0 0 0 .8 1.8 1.8 1.8 0 0 0 2.1.2l.2-.1 2 3.4-.1.1a1.8 1.8 0 0 0-.4 2A1.8 1.8 0 0 0 21 9h.1v6H21a1.8 1.8 0 0 0-1.6 1Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2 5 5v6c0 4.8 3 8.4 7 10 4-1.6 7-5.2 7-10V5Z" />
      <path d="m9 12 2 2 4-5" />
    </>
  ),
  soa: (
    <>
      <path d="M12 2 5 5v6c0 4.8 3 8.4 7 10 4-1.6 7-5.2 7-10V5Z" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </>
  ),
  trend: (
    <>
      <path d="M4 18h16" />
      <path d="M7 14l3-4 4 3 4-7" />
      <path d="M17 6h3v3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
    </>
  ),
};

export default function TcdxIcon({ name, className = 'h-5 w-5', ...props }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
