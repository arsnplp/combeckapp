"use client";

import { useState, useEffect } from "react";
import { Star, Zap } from "lucide-react";

interface QuotaInfo {
  plan: string;
  planLabel: string;
  used: number;
  limit: number | null; // null = illimité
}

const PLAN_STYLES: Record<string, string> = {
  starter: "bg-slate-100 text-slate-700",
  pro: "bg-green-50 text-green-700 border border-green-200",
  business: "bg-violet-50 text-violet-700 border border-violet-200",
  free: "bg-slate-100 text-slate-500",
};

export default function QuotaCard() {
  const [info, setInfo] = useState<QuotaInfo | null>(null);

  useEffect(() => {
    fetch("/api/notifications/recurring")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setInfo({ plan: d.plan, planLabel: d.planLabel ?? d.plan, used: d.used ?? 0, limit: d.limit ?? null });
      })
      .catch(() => {});
  }, []);

  if (!info) return null;

  const pct = info.limit ? Math.min(100, Math.round((info.used / info.limit) * 100)) : 0;
  const nearLimit = info.limit !== null && pct >= 80;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-bold ${PLAN_STYLES[info.plan] ?? PLAN_STYLES.starter}`}>
          {info.plan === "pro" && <Star className="h-4 w-4" fill="currentColor" />}
          {info.plan === "business" && <Zap className="h-4 w-4" fill="currentColor" />}
          Plan {info.planLabel}
        </div>
        <p className="text-[13px] text-slate-500">
          <span className={`font-semibold ${nearLimit ? "text-amber-600" : "text-slate-800"}`}>
            {info.used.toLocaleString("fr-FR")}
          </span>
          {" / "}
          {info.limit === null ? "∞" : info.limit.toLocaleString("fr-FR")} notifications ce mois-ci
        </p>
      </div>
      {info.limit !== null && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 sm:w-48">
          <div
            className={`h-full rounded-full transition-all ${nearLimit ? "bg-amber-500" : "bg-green-500"}`}
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
      )}
    </div>
  );
}
