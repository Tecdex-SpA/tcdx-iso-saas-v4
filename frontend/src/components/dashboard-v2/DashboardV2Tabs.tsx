import type { DashboardV2Tab } from './types';
import { chipClass, formatNumber, statusLabel } from './utils';

type Props = {
  tabs: DashboardV2Tab[];
  activeTab: string;
  onChange: (tab: string) => void;
};

export default function DashboardV2Tabs({ tabs, activeTab, onChange }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={[
              'min-w-max rounded px-3 py-2 text-left text-xs font-semibold transition',
              activeTab === tab.key
                ? 'bg-slate-950 text-white'
                : 'text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            <span>{tab.title}</span>
            <span
              className={[
                'ml-2 rounded border px-1.5 py-0.5 text-[11px]',
                activeTab === tab.key ? 'border-white/20 bg-white/10 text-white' : chipClass(tab.status),
              ].join(' ')}
            >
              {typeof tab.metric === 'number' ? formatNumber(tab.metric) : statusLabel(tab.status)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
