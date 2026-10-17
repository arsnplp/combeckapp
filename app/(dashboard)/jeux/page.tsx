"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Check, AlertTriangle, Trophy, Users, Stamp, Percent } from "lucide-react";

interface RewardRef { id: string; name: string; emoji: string }
interface PrizeConfig { rewardId: string; probability: number; stock: number | null; wonCount: number }
interface Validation { valid: boolean; total: number; errors: string[]; orphans: string[] }
interface GameConfig {
  gameKey: string; name: string; emoji: string; tagline: string;
  enabled: boolean; cost: number; costType: "stamps" | "points";
  dailyLimit: number; loseProbability: number; prizes: PrizeConfig[];
  validation: Validation;
}

interface Stats {
  kpi: { plays: number; participants: number; spent: number; wins: number; winRate: number; used: number; pending: number };
  perDay: Array<{ date: string; count: number }>;
  breakdown: Array<{ rewardId: string; name: string; emoji: string; count: number; observed: number; configured: number | null }>;
  perGame: Array<{ gameKey: string; name: string; emoji: string; enabled: boolean; plays: number; wins: number; spent: number }>;
  stocks: Array<{ gameKey: string; gameName: string; rewardId: string; name: string; remaining: number; stock: number }>;
  recent: Array<{ playedAt: string; game: string; result: string; win: boolean; used: boolean; code: string | null }>;
}

export default function JeuxPage() {
  const [games, setGames] = useState<GameConfig[]>([]);
  const [rewards, setRewards] = useState<RewardRef[]>([]);
  const [moduleEnabled, setModuleEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  // `null` tant que la page n'a rien pu charger : sans ça, un appel refusé
  // produisait un écran qui conseillait de créer des récompenses alors que
  // le vrai problème était ailleurs.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<"reglages" | "chiffres">("reglages");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [stats, setStats] = useState<Stats | null>(null);
  const [period, setPeriod] = useState<"7" | "30" | "all">("30");
  const [gameFilter, setGameFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/games/config");
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setGames(d.games ?? []); setRewards(d.rewards ?? []);
        setModuleEnabled(d.moduleEnabled); setLoadError(null);
      } else if (res.status === 401) {
        setLoadError("admin");
      } else {
        setLoadError(d.error ?? `Chargement impossible (erreur ${res.status}).`);
      }
    } catch {
      setLoadError("Impossible de joindre le serveur.");
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadStats = useCallback(async () => {
    const q = new URLSearchParams({ period });
    if (gameFilter) q.set("game", gameFilter);
    const res = await fetch(`/api/games/stats?${q}`);
    if (res.ok) setStats(await res.json());
  }, [period, gameFilter]);
  useEffect(() => { if (tab === "chiffres") loadStats(); }, [tab, loadStats]);

  const patch = (key: string, p: Partial<GameConfig>) =>
    setGames((g) => g.map((x) => (x.gameKey === key ? { ...x, ...p } : x)));

  const envoyer = async (config: GameConfig) => {
    const res = await fetch("/api/games/config", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  };

  const save = async (g: GameConfig) => {
    setSaving(g.gameKey); setError("");
    let r = await envoyer(g);

    // Le serveur refuse d'activer un jeu dont le total n'est pas à 100 %.
    // Retirer un lot d'un jeu actif tombe forcément dans ce cas : plutôt
    // que de perdre la modification, on met le jeu en pause et on
    // l'enregistre quand même. Le commerçant règle ses pourcentages puis
    // réactive, sans avoir à ressaisir quoi que ce soit.
    if (!r.ok && r.status === 422 && g.enabled) {
      r = await envoyer({ ...g, enabled: false });
      if (r.ok) setError("Jeu mis en pause : le total des chances doit faire 100 % pour le réactiver.");
    }

    if (r.ok) setGames(r.data.games ?? []);
    else setError(r.data.error ?? "Enregistrement impossible.");
    setSaving(null);
  };

  const toggleModule = async (on: boolean) => {
    setModuleEnabled(on);
    await fetch("/api/games/config", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: on }),
    });
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Jeux</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            Vos clients dépensent des tampons pour tenter de gagner vos récompenses.
          </p>
        </div>
        <button
          onClick={() => toggleModule(!moduleEnabled)}
          role="switch"
          aria-checked={moduleEnabled}
          aria-label="Activer le module Jeux"
          className={`relative mt-1 h-7 w-12 flex-shrink-0 rounded-full transition-colors ${moduleEnabled ? "bg-green-600" : "bg-slate-300"}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${moduleEnabled ? "left-6" : "left-1"}`} />
        </button>
      </div>

      {!moduleEnabled && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-[13px] text-slate-600">
          Module désactivé — vos clients ne voient aucun jeu. Activez-le pour commencer.
        </p>
      )}

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {([["reglages", "Réglages"], ["chiffres", "Chiffres"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`h-10 flex-1 rounded-lg text-[13px] font-semibold transition-all ${
              tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>}

      {loadError === "admin" ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
          <p className="text-[15px] font-semibold text-slate-800">Cette page appartient à un commerce</p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-slate-500">
            Vous êtes connecté avec le compte administrateur, qui n&apos;a ni récompenses
            ni clients. Ouvrez le compte d&apos;un commerçant depuis la console admin
            (« Accéder au compte ») pour configurer ses jeux.
          </p>
        </div>
      ) : loadError ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{loadError}</p>
      ) : tab === "reglages" ? (
        <div className="space-y-4">
          {rewards.length === 0 && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              Créez d&apos;abord des récompenses dans « Produits » : ce sont elles que vos clients gagneront.
            </p>
          )}
          {games.map((g) => (
            <GameCard key={g.gameKey} g={g} rewards={rewards} saving={saving === g.gameKey}
              onPatch={(p) => patch(g.gameKey, p)} onSave={(c) => save(c ?? g)} />
          ))}
        </div>
      ) : (
        <Chiffres stats={stats} period={period} setPeriod={setPeriod}
          gameFilter={gameFilter} setGameFilter={setGameFilter} />
      )}
    </div>
  );
}

function GameCard({ g, rewards, saving, onPatch, onSave }: {
  g: GameConfig; rewards: RewardRef[]; saving: boolean;
  onPatch: (p: Partial<GameConfig>) => void; onSave: (config?: GameConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = g.prizes.reduce((s, p) => s + p.probability, 0) + g.loseProbability;
  const libre = rewards.filter((r) => !g.prizes.some((p) => p.rewardId === r.id));

  const setPrize = (id: string, p: Partial<PrizeConfig>) =>
    onPatch({ prizes: g.prizes.map((x) => (x.rewardId === id ? { ...x, ...p } : x)) });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          <p className="text-[15px] font-bold text-slate-900">{g.emoji} {g.name}</p>
          <p className="mt-0.5 text-[12.5px] text-slate-500">{g.tagline}</p>
          {g.enabled && (
            <p className="mt-1.5 text-[12px] text-slate-400">
              {g.cost} {g.costType === "points" ? "points" : "tampons"} la partie · {g.dailyLimit}/jour · {g.prizes.length} lot{g.prizes.length > 1 ? "s" : ""}
            </p>
          )}
        </button>
        <button
          onClick={() => {
            // La config patchée est transmise directement : s'appuyer sur
            // l'état mis à jour enverrait encore la version précédente, et
            // la réponse du serveur écraserait la modification à l'écran.
            const suivant = { ...g, enabled: !g.enabled };
            onPatch({ enabled: suivant.enabled });
            onSave(suivant);
            if (suivant.enabled) setOpen(true);
          }}
          disabled={saving}
          role="switch" aria-checked={g.enabled} aria-label={`Activer ${g.name}`}
          className={`relative mt-1 h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${g.enabled ? "bg-green-600" : "bg-slate-300"}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${g.enabled ? "left-6" : "left-1"}`} />
        </button>
      </div>

      {g.validation.orphans.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          Une récompense de ce jeu a été supprimée ou désactivée. Elle est retirée du tirage.
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Coût (tampons)</span>
              <input type="number" min={1} value={g.cost}
                onChange={(e) => onPatch({ cost: Math.max(1, +e.target.value || 1) })}
                onBlur={() => onSave()}
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-[14px] outline-none focus:border-green-500" />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Parties / jour</span>
              <input type="number" min={1} value={g.dailyLimit}
                onChange={(e) => onPatch({ dailyLimit: Math.max(1, +e.target.value || 1) })}
                onBlur={() => onSave()}
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-[14px] outline-none focus:border-green-500" />
            </label>
          </div>

          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Lots à gagner</p>
            <div className="mt-2 space-y-2">
              {g.prizes.map((p) => {
                const r = rewards.find((x) => x.id === p.rewardId);
                return (
                  <div key={p.rewardId} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">
                      {r?.emoji ?? "🎁"} {r?.name ?? "Récompense supprimée"}
                    </span>
                    <input type="number" min={1} max={100} value={p.probability}
                      onChange={(e) => setPrize(p.rewardId, { probability: Math.min(100, Math.max(0, +e.target.value || 0)) })}
                      onBlur={() => onSave()}
                      className="h-9 w-16 rounded-lg border border-slate-200 px-2 text-center text-[13px] outline-none focus:border-green-500" />
                    <span className="text-[12px] text-slate-400">%</span>
                    <input type="number" min={0} placeholder="∞" value={p.stock ?? ""}
                      onChange={(e) => setPrize(p.rewardId, { stock: e.target.value === "" ? null : Math.max(0, +e.target.value) })}
                      onBlur={() => onSave()}
                      title="Stock maximum gagnable, vide = illimité"
                      className="h-9 w-16 rounded-lg border border-slate-200 px-2 text-center text-[13px] outline-none focus:border-green-500" />
                    <button onClick={() => {
                      const suivant = { ...g, prizes: g.prizes.filter((x) => x.rewardId !== p.rewardId) };
                      onPatch({ prizes: suivant.prizes });
                      onSave(suivant);
                    }}
                      className="text-[12px] text-slate-400 hover:text-red-500">retirer</button>
                  </div>
                );
              })}

              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <span className="min-w-0 flex-1 text-[13px] text-slate-700">🙈 Perdu</span>
                <input type="number" min={0} max={100} value={g.loseProbability}
                  onChange={(e) => onPatch({ loseProbability: Math.min(100, Math.max(0, +e.target.value || 0)) })}
                  onBlur={() => onSave()}
                  className="h-9 w-16 rounded-lg border border-slate-200 px-2 text-center text-[13px] outline-none focus:border-green-500" />
                <span className="text-[12px] text-slate-400">%</span>
                <span className="w-16" />
                <span className="w-[52px]" />
              </div>
            </div>

            {libre.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  const suivant = {
                    ...g,
                    prizes: [...g.prizes, { rewardId: e.target.value, probability: 10, stock: null, wonCount: 0 }],
                  };
                  onPatch({ prizes: suivant.prizes });
                  onSave(suivant);
                }}
                className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-600 outline-none focus:border-green-500"
              >
                <option value="">+ Ajouter une récompense existante…</option>
                {libre.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>)}
              </select>
            )}

            <p className={`mt-2 text-[12.5px] font-medium ${total === 100 ? "text-green-600" : "text-amber-600"}`}>
              {total === 100
                ? <><Check className="mr-1 inline h-3.5 w-3.5" />Total : 100 %</>
                : `Total : ${total} % — il doit faire exactement 100 % pour activer le jeu.`}
            </p>
          </div>

          {saving && <p className="text-[12px] text-slate-400">Enregistrement…</p>}
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 text-[24px] font-bold leading-none text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-[11.5px] text-slate-400">{sub}</p>}
    </div>
  );
}

function Chiffres({ stats, period, setPeriod, gameFilter, setGameFilter }: {
  stats: Stats | null;
  period: "7" | "30" | "all"; setPeriod: (p: "7" | "30" | "all") => void;
  gameFilter: string | null; setGameFilter: (g: string | null) => void;
}) {
  if (!stats) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;
  const max = Math.max(1, ...stats.perDay.map((d) => d.count));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {([["7", "7 jours"], ["30", "30 jours"], ["all", "Tout"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setPeriod(k)}
            className={`rounded-xl px-3 py-1.5 text-[12.5px] font-medium ${period === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
            {l}
          </button>
        ))}
        {gameFilter && (
          <button onClick={() => setGameFilter(null)}
            className="rounded-xl bg-green-100 px-3 py-1.5 text-[12.5px] font-medium text-green-700">
            {stats.perGame.find((g) => g.gameKey === gameFilter)?.name} · tout voir ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Trophy} label="Parties" value={stats.kpi.plays} sub={`${stats.kpi.wins} gagnées`} />
        <Kpi icon={Users} label="Joueurs" value={stats.kpi.participants} />
        <Kpi icon={Stamp} label="Tampons dépensés" value={stats.kpi.spent} />
        <Kpi icon={Percent} label="Taux de gain" value={`${stats.kpi.winRate} %`} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[13px] font-semibold text-slate-900">Lots gagnés</p>
        <p className="mt-0.5 text-[12.5px] text-slate-500">
          <strong className="text-green-600">{stats.kpi.used}</strong> utilisés en caisse ·{" "}
          <strong className="text-amber-600">{stats.kpi.pending}</strong> en attente
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-[13px] font-semibold text-slate-900">Parties par jour</p>
        <div className="flex h-28 items-end gap-[2px]">
          {stats.perDay.map((d) => (
            <div key={d.date} title={`${d.date} — ${d.count} partie${d.count > 1 ? "s" : ""}`}
              className="flex-1 rounded-t bg-green-500/80 transition-all hover:bg-green-600"
              style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }} />
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.perGame.map((g) => (
          <button key={g.gameKey} onClick={() => setGameFilter(gameFilter === g.gameKey ? null : g.gameKey)}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              gameFilter === g.gameKey ? "border-green-400 bg-green-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
            <p className="text-[13.5px] font-semibold text-slate-900">{g.emoji} {g.name}</p>
            <p className="mt-1 text-[20px] font-bold text-slate-900">{g.plays}</p>
            <p className="text-[11.5px] text-slate-400">
              parties · {g.wins} gains · {g.spent} tampons
              {!g.enabled && " · désactivé"}
            </p>
          </button>
        ))}
      </div>

      {stats.breakdown.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-[13px] font-semibold text-slate-900">Ce qui a été gagné</p>
          <div className="space-y-2.5">
            {stats.breakdown.map((b) => (
              <div key={b.rewardId}>
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-slate-700">{b.emoji} {b.name}</span>
                  <span className="text-slate-500">
                    {b.count}× · {b.observed} %
                    {b.configured !== null && <span className="text-slate-400"> (réglé {b.configured} %)</span>}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(100, b.observed)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.stocks.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-[13px] font-semibold text-slate-900">Stock restant</p>
          {stats.stocks.map((s) => (
            <div key={`${s.gameKey}-${s.rewardId}`} className="flex justify-between py-1 text-[12.5px]">
              <span className="text-slate-600">{s.name} <span className="text-slate-400">· {s.gameName}</span></span>
              <span className={s.remaining === 0 ? "font-semibold text-red-500" : "text-slate-500"}>
                {s.remaining} / {s.stock}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-[13px] font-semibold text-slate-900">Dernières parties</p>
        {stats.recent.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-slate-400">Aucune partie sur la période.</p>
        ) : stats.recent.map((r, i) => (
          <div key={i} className="flex items-center justify-between border-t border-slate-100 py-2 text-[12.5px] first:border-0">
            <span className="text-slate-400">{new Date(r.playedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
            <span className="min-w-0 flex-1 truncate px-3 text-slate-600">{r.game}</span>
            <span className={r.win ? "font-medium text-green-600" : "text-slate-400"}>{r.result}</span>
            {r.code && (
              <span className={`ml-2 rounded px-1.5 py-0.5 font-mono text-[10.5px] ${r.used ? "bg-slate-100 text-slate-400 line-through" : "bg-amber-50 text-amber-700"}`}>
                {r.code}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
