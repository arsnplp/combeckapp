"use client";

import { useState, useEffect } from "react";
import { Loader2, CreditCard, ExternalLink } from "lucide-react";

interface PlanInfo {
  plan: string;
  label: string;
  isExpired: boolean;
  daysLeft: number | null;
}

export default function SubscriptionSection() {
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/plan-features")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setInfo({ plan: d.plan, label: d.label, isExpired: d.isExpired, daysLeft: d.daysLeft }))
      .catch(() => {});
  }, []);

  const openPortal = async () => {
    if (opening) return;
    setOpening(true);
    setError("");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setError(data?.error ?? "Erreur.");
    } catch {
      setError("Erreur réseau.");
    }
    setOpening(false);
  };

  if (!info) return null;
  const isFree = info.plan === "free";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
          <CreditCard className="h-4 w-4 text-green-600" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-slate-900">Abonnement</p>
          <p className="text-[12px] text-slate-500">
            Plan actuel : <strong className="text-slate-700">{info.label}</strong>
            {isFree && info.daysLeft !== null && ` — ${info.daysLeft} jour${info.daysLeft > 1 ? "s" : ""} d'essai restant${info.daysLeft > 1 ? "s" : ""}`}
            {isFree && info.isExpired && " — essai expiré"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {isFree ? (
          <a href="/tarifs"
            className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-green-700 transition-colors">
            Passer à un plan payant
          </a>
        ) : (
          <>
            <button onClick={openPortal} disabled={opening}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors">
              {opening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
              Gérer mon abonnement
            </button>
            <a href="/tarifs"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Changer de plan
            </a>
          </>
        )}
      </div>
      <p className="mt-2 text-[11.5px] text-slate-400">
        Factures, moyen de paiement et résiliation — géré en toute sécurité par Stripe.
      </p>
      {error && <p className="mt-2 text-[12px] text-red-500">{error}</p>}
    </div>
  );
}
