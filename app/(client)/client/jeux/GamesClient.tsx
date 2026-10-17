"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Ticket } from "lucide-react";
import { Segment } from "@/components/games/Games";
import GameScreen from "@/components/games/GameScreen";
import PrizeCoffer, { Prize } from "@/components/games/PrizeCoffer";

interface GameInfo {
  gameKey: "wheel" | "scratch" | "chests";
  name: string; emoji: string; tagline: string;
  cost: number; costType: "stamps" | "points";
  dailyLimit: number; playsToday: number;
  odds: Segment[];
}
interface Store {
  merchantId: string; storeName: string; customerCardId: string;
  stamps: number; points: number; games: GameInfo[];
}

export default function GamesClient() {
  const [stores, setStores] = useState<Store[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<{ store: Store; game: GameInfo } | null>(null);

  const load = async () => {
    const res = await fetch("/api/games/me");
    if (res.ok) { const d = await res.json(); setStores(d.stores ?? []); setPrizes(d.prizes ?? []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>;
  }

  if (open) {
    return <GameScreen store={open.store} game={open.game} onBack={() => { setOpen(null); load(); }} />;
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <div>
        <h1 className="text-[22px] font-bold text-slate-900">Jeux</h1>
        <p className="mt-0.5 text-[13px] text-slate-500">Tentez votre chance avec vos tampons.</p>
      </div>

      {stores.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-14 text-center">
          <Ticket className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-[14px] font-medium text-slate-700">Aucun jeu pour le moment</p>
          <p className="mt-1 px-8 text-[12.5px] text-slate-400">
            Vos commerces n&apos;en proposent pas encore. Revenez bientôt.
          </p>
        </div>
      ) : stores.map((s) => (
        <div key={s.merchantId} className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-bold text-slate-900">{s.storeName}</h2>
            <span className="text-[12.5px] text-slate-500">{s.stamps} tampons</span>
          </div>
          {s.games.map((g) => {
            const reste = g.dailyLimit - g.playsToday;
            const assez = s.stamps >= g.cost;
            return (
              <button key={g.gameKey} onClick={() => setOpen({ store: s, game: g })}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all active:scale-[0.99] hover:border-green-300 hover:shadow-sm">
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
                  {!assez && <span className="whitespace-nowrap rounded-lg bg-amber-50 px-2 py-1 font-medium text-amber-700">Pas assez de tampons</span>}
                </div>
              </button>
            );
          })}
        </div>
      ))}

      {/* Le coffre vient après les jeux : on joue d'abord. */}
      <PrizeCoffer prizes={prizes} />

      <Link href="/client/cards" className="flex items-center justify-center gap-1.5 py-2 text-[13px] text-slate-400">
        <ArrowLeft className="h-3.5 w-3.5" /> Mes cartes
      </Link>
    </div>
  );
}
