"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface FunnelRow {
  key: string;
  label: string;
  visitors: number;
  scrolled: number;
  clicked: number;
  signups: number;
  trials: number;
}

interface FunnelData {
  ready: boolean;
  days: number;
  rows: FunnelRow[];
}

const PERIODS = [7, 30, 90] as const;

/** « 12 % » de `part` sur `total`, ou rien quand le total est nul. */
function rate(part: number, total: number): string | null {
  if (total <= 0) return null;
  const pct = (part / total) * 100;
  return `${pct >= 10 || pct === 0 ? Math.round(pct) : pct.toFixed(1).replace(".", ",")} %`;
}

function Cell({ value, of }: { value: number; of?: number }) {
  const r = of !== undefined ? rate(value, of) : null;
  return (
    <td className="px-4 py-3 text-right align-top">
      <span className="text-[14px] font-semibold text-white">{value}</span>
      {r && <span className="block text-[11px] text-slate-500">{r}</span>}
    </td>
  );
}

/**
 * Entonnoir d'acquisition : pour chaque landing, combien de visiteurs,
 * combien ont lu la page, cliqué sur le bouton, créé un compte et démarré
 * l'essai. Les pourcentages sont calculés par rapport à l'étape précédente.
 */
export default function AcquisitionFunnel() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/funnel?days=${d}`);
      setData(res.ok ? await res.json() : { ready: false, days: d, rows: [] });
    } catch {
      setData({ ready: false, days: d, rows: [] });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-white">📈 Acquisition : où les visiteurs s&apos;arrêtent</p>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Visiteurs uniques par jour, mesurés sans cookie. Le pourcentage compare chaque étape à la précédente.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setDays(p)}
              className={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
                days === p ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {p} j
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 py-8 text-[13px] text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : data && !data.ready ? (
        <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-300">
          Le suivi n&apos;est pas encore activé : lancez le fichier
          {" "}<code className="font-mono">supabase/migrations/acquisition-tracking.sql</code>{" "}
          dans le SQL Editor de Supabase.
        </p>
      ) : (
        <div className={`mt-4 overflow-x-auto transition-opacity ${loading ? "opacity-50" : ""}`}>
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2 text-right">Visiteurs</th>
                <th className="px-4 py-2 text-right">Ont lu 75 %</th>
                <th className="px-4 py-2 text-right">Clic bouton</th>
                <th className="px-4 py-2 text-right">Comptes créés</th>
                <th className="px-4 py-2 text-right">Essais démarrés</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((r) => {
                const tracked = r.key !== "other";
                return (
                  <tr key={r.key} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-3 align-top text-[13px] text-slate-300">{r.label}</td>
                    {tracked ? (
                      <>
                        <Cell value={r.visitors} />
                        <Cell value={r.scrolled} of={r.visitors} />
                        <Cell value={r.clicked} of={r.visitors} />
                        <Cell value={r.signups} of={r.clicked} />
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right text-slate-600" colSpan={3}>non mesuré</td>
                        <Cell value={r.signups} />
                      </>
                    )}
                    <Cell value={r.trials} of={r.signups} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
