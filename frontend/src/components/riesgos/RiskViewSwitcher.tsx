import TcdxIcon from '@/components/icons/TcdxIcon';

export type RiskViewMode = 'classic' | 'betaPert';

type RiskViewSwitcherProps = {
  value: RiskViewMode;
  onChange: (value: RiskViewMode) => void;
};

const options: Array<{ value: RiskViewMode; label: string; icon: 'risk' | 'trend' }> = [
  { value: 'classic', label: 'Matriz ISO clasica', icon: 'risk' },
  { value: 'betaPert', label: 'Simulacion Operativa Beta-PERT', icon: 'trend' },
];

export default function RiskViewSwitcher({ value, onChange }: RiskViewSwitcherProps) {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:grid-cols-2 lg:max-w-3xl">
      {options.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={[
              'inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition',
              active
                ? 'border border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                : 'border border-transparent text-slate-700 hover:bg-slate-50',
            ].join(' ')}
          >
            <TcdxIcon name={option.icon} className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
