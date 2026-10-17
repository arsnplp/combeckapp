"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Gift, Ticket } from "lucide-react";
import { Chests, Confetti, Scratch, Segment, Wheel } from "@/components/games/Games";

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
interface Prize { code: string; name: string; emoji: string; wonAt: string; storeName: string; game: string }

type Phase = "idle" | "loading" | "playing" | "result";

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

      {prizes.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-amber-900">
            <Gift className="h-4 w-4" /> Mes lots à utiliser
          </p>
          <p className="mt-0.5 text-[12px] text-amber-800/70">
            Montrez le code en caisse. C&apos;est déjà payé, ça ne vous coûte plus rien.
          </p>
          <div className="mt-3 space-y-2">
            {prizes.map((p) => (
              <div key={p.code} className="rounded-xl bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[14px] font-semibold text-slate-900">
                    {p.emoji} {p.name}
                  </span>
                  <span className="text-[11px] text-slate-400">{p.storeName}</span>
                </div>
                <p className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-center font-mono text-[15px] tracking-widest text-white">
                  {p.code.slice(0, 8).toUpperCase()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    <p className="text-[15px] font-bold text-slate-900">{g.name}</p>
                    <p className="text-[12px] text-slate-500">{g.tagline}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[11.5px]">
                  <span className="rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-600">
                    {g.cost} tampons
                  </span>
                  <span className={`rounded-lg px-2 py-1 font-medium ${reste > 0 ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                    {reste > 0 ? `${reste} partie${reste > 1 ? "s" : ""} aujourd'hui` : "Limite atteinte"}
                  </span>
                  {!assez && <span className="rounded-lg bg-amber-50 px-2 py-1 font-medium text-amber-700">Pas assez de tampons</span>}
                </div>
              </button>
            );
          })}
        </div>
      ))}

      <Link href="/client/cards" className="flex items-center justify-center gap-1.5 py-2 text-[13px] text-slate-400">
        <ArrowLeft className="h-3.5 w-3.5" /> Mes cartes
      </Link>
    </div>
  );
}

function GameScreen({ store, game, onBack }: { store: Store; game: GameInfo; onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<{ result: "win" | "lose"; reward: { id: string; name: string; emoji: string } | null; prizeCode: string | null; balance: number } | null>(null);
  const [error, setError] = useState("");
  const [solde, setSolde] = useState(store.stamps);
  const [restantes, setRestantes] = useState(game.dailyLimit - game.playsToday);

  const jouer = async () => {
    if (phase !== "idle") return;
    setPhase("loading"); setError("");
    try {
      const res = await fetch("/api/games/play", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameKey: game.gameKey, customerCardId: store.customerCardId }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Impossible de jouer."); setPhase("idle"); return; }
      setOutcome(d);
      setSolde(d.balance ?? solde - game.cost);
      setRestantes(d.playsLeft ?? restantes - 1);
      setPhase("playing");
    } catch {
      setError("Erreur réseau."); setPhase("idle");
    }
  };

  const rejouer = () => { setOutcome(null); setPhase("idle"); setError(""); };
  const gagne = outcome?.result === "win";
  const segment = outcome
    ? { rewardId: outcome.reward?.id ?? null, label: outcome.reward?.name ?? "Perdu", emoji: outcome.reward?.emoji ?? "🙈" }
    : null;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 py-6">
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 self-start text-[13px] text-slate-400">
        <ArrowLeft className="h-3.5 w-3.5" /> Retour
      </button>

      <div className="text-center">
        <h1 className="text-[20px] font-bold text-slate-900">{game.emoji} {game.name}</h1>
        <p className="mt-0.5 text-[12.5px] text-slate-500">
          {solde} tampons · {restantes} partie{restantes > 1 ? "s" : ""} aujourd&apos;hui
        </p>
      </div>

      <div className="relative my-6 flex flex-1 items-center justify-center">
        {phase === "result" ? (
          <div className="relative w-full text-center">
            {gagne && <Confetti />}
            <div className="relative z-10">
              <p className="text-[64px] leading-none">{gagne ? outcome?.reward?.emoji ?? "🎉" : "🙈"}</p>
              <p className="mt-3 text-[21px] font-bold text-slate-900">
                {gagne ? "Gagné !" : "Perdu cette fois"}
              </p>
              {gagne ? (
                <>
                  <p className="mt-1 text-[15px] text-slate-600">{outcome?.reward?.name}</p>
                  <div className="mx-auto mt-5 max-w-[260px] rounded-2xl bg-slate-900 p-4">
                    <p className="text-[11px] uppercase tracking-wide text-white/50">Code à présenter en caisse</p>
                    <p className="mt-1 font-mono text-[22px] tracking-widest text-white">
                      {outcome?.prizeCode?.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <p className="mt-2 text-[12px] text-slate-400">
                    Retrouvez-le dans « Mes lots ». Valable sans limite de temps.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-[13.5px] text-slate-500">La prochaine est peut-être la bonne.</p>
              )}
            </div>
          </div>
        ) : game.gameKey === "wheel" ? (
          <Wheel segments={game.odds} outcome={segment} onDone={() => setPhase("result")} />
        ) : game.gameKey === "chests" ? (
          <Chests segments={game.odds} outcome={segment} onDone={() => setPhase("result")} />
        ) : phase === "playing" && outcome ? (
          <Scratch onRevealed={() => setTimeout(() => setPhase("result"), 600)}>
            <div className="text-center">
              <p className="text-[48px] leading-none">{gagne ? outcome.reward?.emoji : "🙈"}</p>
              <p className="mt-1.5 text-[14px] font-semibold text-slate-700">
                {gagne ? outcome.reward?.name : "Perdu"}
              </p>
            </div>
          </Scratch>
        ) : (
          <div className="flex aspect-[5/3] w-full max-w-[320px] items-center justify-center rounded-2xl bg-slate-100">
            <span className="text-[44px] opacity-30">{game.emoji}</span>
          </div>
        )}
      </div>

      {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-center text-[13px] text-red-700">{error}</p>}

      {phase === "result" ? (
        <div className="space-y-2">
          {restantes > 0 && solde >= game.cost && (
            <button onClick={rejouer}
              className="h-14 w-full rounded-2xl bg-green-600 text-[16px] font-bold text-white active:scale-[0.99]">
              Rejouer · {game.cost} tampons
            </button>
          )}
          <button onClick={onBack} className="h-12 w-full rounded-2xl bg-slate-100 text-[14px] font-semibold text-slate-600">
            Terminer
          </button>
        </div>
      ) : (
        <button onClick={jouer}
          disabled={phase !== "idle" || solde < game.cost || restantes <= 0}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-green-600 text-[16px] font-bold text-white transition-all active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400">
          {phase === "loading" && <Loader2 className="h-5 w-5 animate-spin" />}
          {restantes <= 0 ? "Limite du jour atteinte"
            : solde < game.cost ? `Il faut ${game.cost} tampons`
            : phase === "idle" ? `Jouer · ${game.cost} tampons` : "C'est parti…"}
        </button>
      )}

      {phase === "idle" && (
        <details className="mt-4 rounded-2xl bg-slate-50 p-4">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-slate-600">
            Mes chances de gagner
          </summary>
          <div className="mt-2.5 space-y-1.5">
            {game.odds.map((o, i) => (
              <div key={i} className="flex justify-between text-[12.5px]">
                <span className="text-slate-600">{o.emoji} {o.label}</span>
                <span className="font-medium text-slate-900">{o.percent} %</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
