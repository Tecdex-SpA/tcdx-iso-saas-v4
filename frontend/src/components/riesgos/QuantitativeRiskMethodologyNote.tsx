import { buildMethodologyNote } from './riskSimulationUtils';

export default function QuantitativeRiskMethodologyNote() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
      {buildMethodologyNote()}
    </div>
  );
}
