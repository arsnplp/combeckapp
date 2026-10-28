"use client";

import {
  CYCLE_PER,
  cycleMonthly,
  cycleSavings,
  cycleTotal,
  formatEuros,
  PLAN_PRICING,
  type BillingCycle,
  type PaidPlan,
} from "@/lib/pricing";

/**
 * Prix d'un plan pour la période choisie. En trimestriel et en annuel :
 * le prix mensuel barré, l'équivalent par mois, l'économie réalisée et le
 * montant réellement facturé à chaque période.
 */
export default function CyclePrice({
  plan,
  cycle,
  size = "lg",
}: {
  plan: PaidPlan;
  cycle: BillingCycle;
  size?: "md" | "lg";
}) {
  const monthly = PLAN_PRICING[plan].monthly;
  const discounted = cycle !== "monthly";
  const big = size === "lg" ? "text-[38px]" : "text-[30px]";
  const strike = size === "lg" ? "text-[20px]" : "text-[16px]";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {discounted && (
          <span className={`${strike} font-semibold text-slate-300 line-through`}>{formatEuros(monthly)}€</span>
        )}
        <span className={`${big} font-bold leading-none text-slate-900`}>{formatEuros(cycleMonthly(plan, cycle))}€</span>
        <span className="text-[13px] text-slate-400">/mois TTC</span>
        {discounted && (
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-green-400">
            économisez {formatEuros(cycleSavings(plan, cycle))}€
          </span>
        )}
      </div>
      <p className="mt-1 text-[12px] text-slate-400">
        {discounted
          ? `Facturé ${formatEuros(cycleTotal(plan, cycle))}€ par ${CYCLE_PER[cycle]} TTC`
          : "Sans engagement · prix TTC"}
      </p>
    </div>
  );
}
