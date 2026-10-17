"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import GameScreen, { GameInfo, Store } from "./GameScreen";
import PrizeCoffer, { Prize } from "./PrizeCoffer";

/**
 * Les jeux d'un commerce, à l'intérieur de sa page.
 *
 * C'est là que le client les cherche : il ouvre sa boutique, voit sa carte,
 * puis ses jeux. Le coffre à récompenses vient juste en dessous, replié —
 * on joue d'abord, on récupère ensuite.
 *
 * Ne rend rien du tout si le commerce ne propose aucun jeu : une section
 * vide sur la page d'une boutique qui n'en a pas serait du bruit.
 */
export default function ShopGames({ tenantId }: { tenantId: string }) {
  const [store, setStore] = useState<Store | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [ouvert, setOuvert] = useState<GameInfo | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/games/me");
      if (res.ok) {
        const d = await res.json();
        const s = (d.stores ?? []).find((x: Store) => x.merchantId === tenantId) ?? null;
        setStore(s);
        // Filtré sur l'identifiant du commerce : deux boutiques peuvent
        // porter le même nom, pas le même identifiant.
        setPrizes((d.prizes ?? []).filter((p: Prize) => p.merchantId === tenantId));
      }
    } catch { /* la boutique reste affichée sans ses jeux */ }
    setLoading(false);
  }, [tenantId]);
  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
      </div>
    );
  }
  if (!store || store.games.length === 0) return null;

  if (ouvert) {
    return <GameScreen store={store} game={ouvert} onBack={() => { setOuvert(null); load(); }} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold text-slate-900">🎲 Jeux</h2>
        <span className="text-[12.5px] text-slate-500">{store.stamps} tampons</span>
      </div>

      {store.games.map((g) => {
        const reste = g.dailyLimit - g.playsToday;
        const assez = store.stamps >= g.cost;
        return (
          <button key={g.gameKey} onClick={() => setOuvert(g)}
            className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-green-300 hover:shadow-sm active:scale-[0.99]">
            <div className="flex items-center gap-3">
              <span className="text-[30px]">{g.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-slate-900">{g.name}</p>
                <p className="text-[12px] leading-snug text-slate-500">{g.tagline}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[11.5px]">
              <span className="whitespace-nowrap rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-600">
                {g.cost} tampons
              </span>
              <span className={`whitespace-nowrap rounded-lg px-2 py-1 font-medium ${reste > 0 ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                {reste > 0 ? `${reste} partie${reste > 1 ? "s" : ""} aujourd'hui` : "Limite atteinte"}
              </span>
              {!assez && (
                <span className="whitespace-nowrap rounded-lg bg-amber-50 px-2 py-1 font-medium text-amber-700">
                  Pas assez de tampons
                </span>
              )}
            </div>
          </button>
        );
      })}

      {/* Le coffre vient après les jeux : on joue d'abord. */}
      <PrizeCoffer prizes={prizes} />
    </div>
  );
}
