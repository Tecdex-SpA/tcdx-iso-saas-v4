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
    <div className="grid gap-2 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-1 shadow-[var(--tcdx-shadow-tecdex-sm)] sm:grid-cols-2 lg:max-w-3xl">
      {options.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={[
              'inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--tcdx-radius-tecdex-sm)] px-4 py-2 text-sm font-semibold transition focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)]',
              active
                ? 'border border-[rgba(240,114,29,0.35)] bg-[rgba(240,114,29,0.10)] text-[var(--tcdx-color-primary)] shadow-sm'
                : 'border border-transparent text-[var(--tcdx-color-text-primary)] hover:bg-[var(--tcdx-color-surface)]',
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
