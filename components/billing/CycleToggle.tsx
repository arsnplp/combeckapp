"use client";

import { BILLING_CYCLES, CYCLE_LABEL, cycleDiscountPercent, type BillingCycle } from "@/lib/pricing";

/**
 * Sélecteur Mensuel / Trimestriel / Annuel. La remise affichée est calculée
 * depuis la grille (lib/pricing.ts), jamais écrite en dur.
 */
export default function CycleToggle({
  value,
  onChange,
  className = "",
}: {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Période de facturation" className={`inline-flex items-center rounded-xl bg-slate-100 p-1 ${className}`}>
      {BILLING_CYCLES.map((cycle) => {
        const percent = cycleDiscountPercent("business", cycle);
        const active = value === cycle;
        return (
          <button
            key={cycle}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(cycle)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all sm:px-4 ${
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {CYCLE_LABEL[cycle]}
            {percent > 0 && (
              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10.5px] font-bold text-green-700">-{percent} %</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
