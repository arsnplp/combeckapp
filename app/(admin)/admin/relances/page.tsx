"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { ArrowLeft, Loader2, Mail, Phone, LogIn, RefreshCw } from "lucide-react";

type RelanceReason =
  | "payant_inactif" | "jamais_configure" | "jamais_lance"
  | "endormi" | "essai_bientot_fini" | "essai_expire";

interface RelanceEntry {
  merchantId: string; storeName: string; email: string;
  phone: string | null; city: string | null; plan: string;
  daysSinceSignup: number; cards: number; clients: number;
  daysSinceLastVisit: number | null; trialDaysLeft: number | null;
  reason: RelanceReason;
}

/**
 * Chaque motif porte ce qu'il faut dire au commerçant. Le `pitch` n'est pas
 * décoratif : c'est l'angle de la relance, pour ne pas avoir à le réinventer
 * à chaque appel.
 */
const REASONS: Record<RelanceReason, {
  label: string; color: string; dot: string; pitch: string;
}> = {
  payant_inactif: {
    label: "Payant mais inactif",
    color: "bg-red-500/10 text-red-400 ring-red-500/20",
    dot: "bg-red-400",
    pitch: "Il paie et n'en tire rien : c'est la résiliation qui arrive. À appeler en priorité.",
  },
  essai_bientot_fini: {
    label: "Essai qui se termine",
    color: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    dot: "bg-amber-400",
    pitch: "Dernière fenêtre pour le convaincre avant la fin de l'essai.",
  },
  jamais_configure: {
    label: "Jamais configuré",
    color: "bg-orange-500/10 text-orange-400 ring-orange-500/20",
    dot: "bg-orange-400",
    pitch: "Aucune carte créée : il n'a rien pu faire. Proposer de la configurer avec lui.",
  },
  jamais_lance: {
    label: "Configuré, jamais lancé",
    color: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
    dot: "bg-sky-400",
    pitch: "La carte existe mais aucun client inscrit : il manque le QR code sur le comptoir.",
  },
  endormi: {
    label: "Endormi",
    color: "bg-violet-500/10 text-violet-400 ring-violet-500/20",
    dot: "bg-violet-400",
    pitch: "Il a démarré puis s'est arrêté. Comprendre ce qui a coincé.",
  },
  essai_expire: {
    label: "Essai expiré sans suite",
    color: "bg-slate-500/10 text-slate-400 ring-slate-500/20",
    dot: "bg-slate-400",
    pitch: "Compte bloqué depuis la fin de l'essai. Ses données sont intactes, le lui rappeler.",
  },
};

export default function RelancesPage() {
  const [entries, setEntries] = useState<RelanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RelanceReason | "all">("all");
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/admin/relances");
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch { /* la page reste utilisable avec les données précédentes */ }
    if (!silent) setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of entries) c[e.reason] = (c[e.reason] ?? 0) + 1;
    return c;
  }, [entries]);

  const shown = filter === "all" ? entries : entries.filter((e) => e.reason === filter);

  /** Ouvre le compte du commerçant — même mécanisme que le tableau de bord :
   *  l'API délivre un jeton à usage unique, échangé contre une session. */
  const handleAccess = async (userId: string) => {
    setImpersonating(userId);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const { token, error } = await res.json();
      if (error || !token) { alert(error ?? "Erreur"); setImpersonating(null); return; }
      const result = await signIn("credentials", { impersonateToken: token, redirect: false });
      if (result?.error) { alert("Échec de l'accès au compte"); setImpersonating(null); return; }
      window.location.href = "/dashboard";
    } catch {
      alert("Erreur réseau");
      setImpersonating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Tableau de bord
          </Link>
          <h1 className="mt-2 text-[26px] font-bold text-white">Relances</h1>
          <p className="mt-0.5 text-[13px] text-slate-400">
            Les comptes qui méritent un appel, classés par ce qui les bloque.
          </p>
        </div>
        <button
          onClick={() => load()}
          className="flex w-fit items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-slate-400 transition-colors hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {/* Filtres par motif */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-xl px-3 py-2 text-[12.5px] font-medium transition-colors ${
            filter === "all" ? "bg-white/[0.08] text-white" : "bg-white/[0.03] text-slate-400 hover:text-white"
          }`}
        >
          Tous <span className="ml-1 opacity-60">{entries.length}</span>
        </button>
        {(Object.keys(REASONS) as RelanceReason[]).filter((r) => counts[r]).map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[12.5px] font-medium transition-colors ${
              filter === r ? "bg-white/[0.08] text-white" : "bg-white/[0.03] text-slate-400 hover:text-white"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${REASONS[r].dot}`} />
            {REASONS[r].label} <span className="opacity-60">{counts[r]}</span>
          </button>
        ))}
      </div>

      {filter !== "all" && (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-[12.5px] text-slate-400">
          {REASONS[filter].pitch}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] py-16 text-center text-[13px] text-slate-500">
          Personne à relancer ici — tout le monde est actif.
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map((e) => {
            const r = REASONS[e.reason];
            return (
              <div key={e.merchantId} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold text-white">{e.storeName}</p>
                    <p className="truncate text-[12px] text-slate-400">{e.email}</p>
                  </div>
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${r.color}`}>
                    {r.label}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.06] pt-3 text-[11.5px] text-slate-500">
                  <span>inscrit il y a {e.daysSinceSignup} j</span>
                  <span>{e.cards} carte{e.cards > 1 ? "s" : ""}</span>
                  <span>{e.clients} client{e.clients > 1 ? "s" : ""}</span>
                  {e.daysSinceLastVisit !== null
                    ? <span>dernière visite il y a {e.daysSinceLastVisit} j</span>
                    : <span>aucune visite</span>}
                  {e.trialDaysLeft !== null && <span className="text-amber-400">essai J-{e.trialDaysLeft}</span>}
                  {e.city && <span>{e.city}</span>}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`mailto:${e.email}`}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-slate-300 transition-colors hover:border-green-500/30 hover:text-green-300"
                  >
                    <Mail className="h-3.5 w-3.5" /> Email
                  </a>
                  {e.phone && (
                    <a
                      href={`tel:${e.phone.replace(/\s/g, "")}`}
                      className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-slate-300 transition-colors hover:border-green-500/30 hover:text-green-300"
                    >
                      <Phone className="h-3.5 w-3.5" /> {e.phone}
                    </a>
                  )}
                  <button
                    onClick={() => handleAccess(e.merchantId)}
                    disabled={impersonating === e.merchantId}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-slate-300 transition-colors hover:border-green-500/30 hover:text-green-300 disabled:opacity-40"
                  >
                    {impersonating === e.merchantId
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <LogIn className="h-3.5 w-3.5" />}
                    Voir son compte
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
