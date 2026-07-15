"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, CreditCard, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import WalletPreview from "@/components/carte/WalletPreview";
import { useStore } from "@/lib/store-context";
import { useNetworkOrigin } from "@/lib/use-network-origin";
import { fetchPlanFeatures } from "@/lib/plan-features";
import type { LoyaltyCard, LoyaltyMode, RankThresholds } from "@/types";
import QRCode from "qrcode";

interface CardForm {
  name: string;
  welcomeMessage: string;
  backgroundColor: string;
  accentColor: string;
  loyaltyMode: LoyaltyMode;
  stampsRequired: number;
  pointsPerEuro: number;
  welcomePoints: number;
  rankThresholds: RankThresholds;
  referral: { enabled: boolean; referrerBonus: number; bonusType: "stamps" | "points" };
}

const defaultForm = (): CardForm => ({
  name: "",
  welcomeMessage: "Merci de votre fidélité !",
  backgroundColor: "#1a0a00",
  accentColor: "#f59e0b",
  loyaltyMode: "stamps",
  stampsRequired: 8,
  pointsPerEuro: 10,
  welcomePoints: 0,
  rankThresholds: { silver: 2, gold: 5, platine: 10 },
  referral: { enabled: false, referrerBonus: 1, bonusType: "stamps" },
});

const colorPresets = [
  { name: "Espresso",   bg: "#1a0a00", accent: "#f59e0b" },
  { name: "Ardoise",    bg: "#0f172a", accent: "#818cf8" },
  { name: "Forêt",      bg: "#052e16", accent: "#4ade80" },
  { name: "Bordeaux",   bg: "#3b0a0a", accent: "#fca5a5" },
  { name: "Océan",      bg: "#082f49", accent: "#38bdf8" },
  { name: "Aubergine",  bg: "#2d0a4e", accent: "#d946ef" },
  { name: "Charcoal",   bg: "#18181b", accent: "#e4e4e7" },
  { name: "Minuit",     bg: "#0c0a3e", accent: "#a78bfa" },
  { name: "Nuit Rose",  bg: "#1a0a14", accent: "#f472b6" },
  { name: "Cuivre",     bg: "#1c0a00", accent: "#fb923c" },
  { name: "Sapin",      bg: "#0a1f0f", accent: "#86efac" },
  { name: "Saphir",     bg: "#0a0f2e", accent: "#60a5fa" },
  { name: "Or Noir",    bg: "#0f0f00", accent: "#eab308" },
  { name: "Rubis",      bg: "#200010", accent: "#fb7185" },
  { name: "Teal",       bg: "#042f2e", accent: "#2dd4bf" },
  { name: "Brun Doux",  bg: "#292524", accent: "#d6d3d1" },
  { name: "Glacier",    bg: "#0c1a2e", accent: "#7dd3fc" },
  { name: "Corail",     bg: "#2d1000", accent: "#fdba74" },
];

function formToCard(form: CardForm): Omit<LoyaltyCard, "id" | "createdAt"> {
  return { ...form, textColor: "#ffffff", active: true };
}

function buildPassUrl(origin: string, card: LoyaltyCard): string {
  const url = new URL(`${origin}/api/wallet/pass`);
  url.searchParams.set("clientId", "preview");
  url.searchParams.set("name", "Aperçu");
  url.searchParams.set("type", card.loyaltyMode);
  url.searchParams.set("stamps", "3");
  url.searchParams.set("required", String(card.stampsRequired));
  url.searchParams.set("points", "120");
  url.searchParams.set("store", card.name || "ComeBack");
  url.searchParams.set("accent", card.accentColor);
  url.searchParams.set("bg", card.backgroundColor);
  return url.toString();
}

void buildPassUrl;

export default function CartePage() {
  const { loyaltyCards, addLoyaltyCard, updateLoyaltyCard, deleteLoyaltyCard, customerCards } = useStore();
  const networkOrigin = useNetworkOrigin();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<CardForm>(defaultForm());
  const [qrDataUrl, setQrDataUrl]   = useState<string>("");
  const [saved, setSaved]           = useState(false);
  const [limitError, setLimitError] = useState("");
  const [maxCards, setMaxCards]     = useState(Infinity);
  const [deleteTarget, setDeleteTarget] = useState<LoyaltyCard | null>(null);

  const selected = loyaltyCards.find((c) => c.id === selectedId) ?? loyaltyCards[0] ?? null;
  const patch = (p: Partial<CardForm>) => setForm((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    if (!selectedId && loyaltyCards.length > 0) setSelectedId(loyaltyCards[0].id);
  }, [loyaltyCards, selectedId]);

  useEffect(() => {
    fetchPlanFeatures().then((f) => setMaxCards(f?.maxCards ?? 1));
  }, []);

  useEffect(() => {
    if (!selected || !networkOrigin) { setQrDataUrl(""); return; }
    const json = JSON.stringify({
      id: selected.id, name: selected.name, welcomeMessage: selected.welcomeMessage,
      backgroundColor: selected.backgroundColor, accentColor: selected.accentColor,
      textColor: selected.textColor, loyaltyMode: selected.loyaltyMode,
      stampsRequired: selected.stampsRequired, pointsPerEuro: selected.pointsPerEuro,
      welcomePoints: selected.welcomePoints,
    });
    const utf8Bytes = new TextEncoder().encode(json);
    let binary = "";
    utf8Bytes.forEach((b) => { binary += String.fromCharCode(b); });
    const cardData = btoa(binary);
    const url = `${networkOrigin}/join/${selected.id}?d=${cardData}`;
    QRCode.toDataURL(url, { width: 120, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [selected, networkOrigin]);

  const hasStamps = loyaltyCards.some((c) => c.loyaltyMode === "stamps" && c.id !== editingId);
  const hasPoints = loyaltyCards.some((c) => c.loyaltyMode === "points" && c.id !== editingId);

  const openCreate = () => {
    setLimitError("");
    if (loyaltyCards.length >= maxCards) {
      setLimitError(`Limite du plan atteinte : maximum ${maxCards} carte${maxCards > 1 ? 's' : ''}. Passez au plan supérieur pour en ajouter plus.`);
      return;
    }
    const f = defaultForm();
    if (hasStamps) f.loyaltyMode = "points";
    if (hasPoints) f.loyaltyMode = "stamps";
    setForm(f);
    setEditingId(null);
    setShowCreate(true);
  };

  const openEdit = (card: LoyaltyCard) => {
    setLimitError("");
    setForm({
      name: card.name, welcomeMessage: card.welcomeMessage,
      backgroundColor: card.backgroundColor, accentColor: card.accentColor,
      loyaltyMode: card.loyaltyMode, stampsRequired: card.stampsRequired,
      pointsPerEuro: card.pointsPerEuro, welcomePoints: card.welcomePoints,
      rankThresholds: card.rankThresholds ?? { silver: 2, gold: 5, platine: 10 },
      referral: card.referral ? { ...card.referral, bonusType: card.loyaltyMode } : { enabled: false, referrerBonus: 1, bonusType: card.loyaltyMode },
    });
    setEditingId(card.id);
    setShowCreate(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editingId) {
      updateLoyaltyCard(editingId, formToCard(form));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } else {
      const card = addLoyaltyCard(formToCard(form));
      setSelectedId(card.id);
    }
    setShowCreate(false);
    setEditingId(null);
  };

  // Suppression confirmée via la modale de prévention uniquement
  const confirmDelete = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    deleteLoyaltyCard(id);
    if (selectedId === id) setSelectedId(loyaltyCards.find((c) => c.id !== id)?.id ?? null);
    setDeleteTarget(null);
  };

  const deleteTargetClients = deleteTarget
    ? customerCards.filter((cc) => cc.cardId === deleteTarget.id).length
    : 0;

  // Cartes gelées : au-delà de la limite du plan (ordre de création — mêmes
  // règles que le serveur). Données conservées, nouvelles inscriptions bloquées.
  const frozenIds = (() => {
    if (maxCards === Infinity || loyaltyCards.length <= maxCards) return new Set<string>();
    const sorted = [...loyaltyCards].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    return new Set(sorted.slice(maxCards).map((c) => c.id));
  })();

  const modeBlocked = (mode: LoyaltyMode) => {
    if (editingId) return false;
    return mode === "stamps" ? hasStamps : hasPoints;
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Left: card list */}
      <div className="flex w-72 flex-shrink-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-green-600">Cartes</p>
            <h2 className="text-[17px] font-semibold text-slate-900">Mes cartes fidélité</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Max 1 tampons + 1 points</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Créer
          </Button>
        </div>

        {limitError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">{limitError}</div>
        )}

        {loyaltyCards.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
              <CreditCard className="h-6 w-6 text-slate-300" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-slate-700">Aucune carte</p>
              <p className="mt-0.5 text-[12px] text-slate-400">Créez votre première carte de fidélité</p>
            </div>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Créer une carte
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {frozenIds.size > 0 && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5">
                <p className="text-[12px] font-semibold text-sky-800">
                  🧊 {frozenIds.size} carte{frozenIds.size > 1 ? "s" : ""} gelée{frozenIds.size > 1 ? "s" : ""}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-sky-700/70">
                  Votre plan permet {maxCards} carte{maxCards > 1 ? "s" : ""} active{maxCards > 1 ? "s" : ""}.
                  Les clients et soldes des cartes gelées sont conservés, mais les nouvelles inscriptions
                  y sont bloquées. <a href="/abonnement" className="font-semibold underline">Passer au plan supérieur</a> les réactive instantanément.
                </p>
              </div>
            )}
            {loyaltyCards.map((card) => (
              <div key={card.id} onClick={() => setSelectedId(card.id)} role="button" tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelectedId(card.id)}
                className={`w-full rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                  selectedId === card.id ? "border-green-200 bg-green-50 ring-1 ring-green-200" : "border-black/[0.06] bg-white hover:border-slate-200 hover:bg-slate-50"
                }`}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex-shrink-0 rounded-xl" style={{ background: card.backgroundColor, border: `2px solid ${card.accentColor}50` }}>
                    <div className="flex h-full items-center justify-center text-sm font-bold" style={{ color: card.accentColor }}>
                      {card.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-slate-900">{card.name}</p>
                    <p className="text-[11.5px] text-slate-400">
                      {card.loyaltyMode === "stamps" ? `🎫 ${card.stampsRequired} tampons` : `⭐ ${card.pointsPerEuro} pts/€`}
                    </p>
                    {frozenIds.has(card.id) && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
                        🧊 Gelée — limite du plan
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(card); }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(card); }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: preview */}
      <div className="flex flex-1 flex-col items-center gap-6 pt-10">
        {selected ? (
          <>
            <p className="text-[12px] text-slate-400">Aperçu de la carte</p>
            <WalletPreview card={selected} currentStamps={3} points={120} clientName="Marie Dupont" qrDataUrl={qrDataUrl} />
            {qrDataUrl && (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm w-56">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">QR d'inscription</p>
                <div className="rounded-xl bg-white p-2 ring-1 ring-black/[0.06]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="QR inscription" width={130} height={130} className="rounded-md" />
                </div>
                <p className="text-center text-[10.5px] text-slate-400 leading-relaxed">
                  Imprimez et posez sur le comptoir.<br />Le client scanne → s'inscrit → reçoit sa carte.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 pt-20 text-center">
            <CreditCard className="h-10 w-10 text-slate-200" />
            <p className="text-[14px] text-slate-400">Sélectionnez ou créez une carte</p>
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditingId(null); } }}>
        <DialogContent className="sm:max-w-[520px]">
          <div className="px-7 pt-7 pb-5 pr-14">
            <DialogTitle className="text-[16px] font-semibold text-slate-900">
              {editingId ? "Modifier la carte" : "Créer une carte"}
            </DialogTitle>
            <p className="mt-1 text-[12.5px] text-slate-400">Définissez le design et les règles de fidélité</p>
          </div>
          <div className="h-px bg-slate-100" />

          <div className="max-h-[65vh] overflow-y-auto px-7 py-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Nom de la carte</label>
              <input className="h-[44px] w-full rounded-xl border border-slate-300 bg-white px-4 text-[14px] text-slate-900 shadow-sm placeholder:text-slate-400 outline-none transition focus:border-green-500 focus:ring-[3px] focus:ring-green-500/10"
                placeholder="ex: Carte Café, VIP Club..." value={form.name} onChange={(e) => patch({ name: e.target.value })} autoFocus />
            </div>

            <div className="space-y-2">
              <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Message affiché sur la carte</label>
              <input className="h-[44px] w-full rounded-xl border border-slate-300 bg-white px-4 text-[14px] text-slate-900 shadow-sm placeholder:text-slate-400 outline-none transition focus:border-green-500 focus:ring-[3px] focus:ring-green-500/10"
                placeholder="ex: Merci de votre fidélité !" value={form.welcomeMessage} onChange={(e) => patch({ welcomeMessage: e.target.value })} />
            </div>

            <div className="space-y-2">
              <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Type de programme</label>
              <div className="grid grid-cols-2 gap-3">
                {(["stamps", "points"] as LoyaltyMode[]).map((mode) => {
                  const blocked = modeBlocked(mode);
                  return (
                    <button key={mode} type="button" onClick={() => !blocked && patch({ loyaltyMode: mode, referral: { ...form.referral, bonusType: mode } })} disabled={blocked}
                      title={blocked ? "Vous avez déjà une carte de ce type" : undefined}
                      className={`rounded-xl border py-3 text-[13px] font-medium transition-colors ${
                        blocked ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                        : form.loyaltyMode === mode ? "border-green-200 bg-green-50 text-green-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                      }`}>
                      {mode === "stamps" ? "🎫 Tampons" : "⭐ Points"}
                      {blocked && <span className="ml-1 text-[10px]">(déjà créé)</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {form.loyaltyMode === "stamps" ? (
              <div className="space-y-2">
                <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Tampons pour une récompense</label>
                <input type="number" min={1} max={20}
                  className="h-[44px] w-full rounded-xl border border-slate-300 bg-white px-4 text-[14px] text-slate-900 shadow-sm outline-none transition focus:border-green-500 focus:ring-[3px] focus:ring-green-500/10"
                  value={form.stampsRequired || ""}
                  onChange={(e) => { const n = parseInt(e.target.value); patch({ stampsRequired: isNaN(n) ? 0 : n }); }}
                  onBlur={() => { if (!form.stampsRequired || form.stampsRequired < 1) patch({ stampsRequired: 1 }); else if (form.stampsRequired > 20) patch({ stampsRequired: 20 }); }} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Points par euro</label>
                  <input type="number" min={1}
                    className="h-[44px] w-full rounded-xl border border-slate-300 bg-white px-4 text-[14px] text-slate-900 shadow-sm outline-none transition focus:border-green-500 focus:ring-[3px] focus:ring-green-500/10"
                    value={form.pointsPerEuro || ""}
                    onChange={(e) => { const n = parseInt(e.target.value); patch({ pointsPerEuro: isNaN(n) ? 0 : n }); }}
                    onBlur={() => { if (!form.pointsPerEuro || form.pointsPerEuro < 1) patch({ pointsPerEuro: 1 }); }} />
                </div>
                <div className="space-y-2">
                  <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Points de bienvenue</label>
                  <input type="number" min={0}
                    className="h-[44px] w-full rounded-xl border border-slate-300 bg-white px-4 text-[14px] text-slate-900 shadow-sm outline-none transition focus:border-green-500 focus:ring-[3px] focus:ring-green-500/10"
                    value={form.welcomePoints || ""}
                    onChange={(e) => { const n = parseInt(e.target.value); patch({ welcomePoints: isNaN(n) ? 0 : Math.max(0, n) }); }} />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Niveaux de fidélité</label>
                <p className="mt-1 text-[11px] text-slate-400">
                  {form.loyaltyMode === "stamps" ? "Passages par mois minimum pour chaque rang" : "Euros dépensés par mois minimum pour chaque rang"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {([
                  { key: "silver" as const, emoji: "🥈", label: "Silver", color: "#94a3b8" },
                  { key: "gold" as const, emoji: "🥇", label: "Gold", color: "#f59e0b" },
                  { key: "platine" as const, emoji: "💎", label: "Platine", color: "#38bdf8" },
                ]).map(({ key, emoji, label, color }) => (
                  <div key={key} className="flex items-center gap-3 px-4 py-3 bg-white">
                    <span className="text-base">{emoji}</span>
                    <span className="text-[13px] font-medium text-slate-700 w-14">{label}</span>
                    <span className="text-[11px] text-slate-400 flex-1">≥</span>
                    <div className="flex items-center gap-1.5">
                      <input type="number" min={0}
                        className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-[13px] text-slate-900 outline-none focus:border-green-400 text-right"
                        style={{ borderColor: color + "60" }}
                        value={form.rankThresholds[key] || ""}
                        onChange={(e) => { const n = parseInt(e.target.value); patch({ rankThresholds: { ...form.rankThresholds, [key]: isNaN(n) ? 0 : Math.max(0, n) } }); }} />
                      <span className="text-[11px] text-slate-400">{form.loyaltyMode === "stamps" ? "pass./mois" : "€/mois"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Parrainage */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Programme de parrainage</label>
                  <p className="mt-0.5 text-[11px] text-slate-400">Le parrain reçoit un bonus quand son ami s&apos;inscrit</p>
                </div>
                <button
                  type="button"
                  onClick={() => patch({ referral: { ...form.referral, enabled: !form.referral.enabled } })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${form.referral.enabled ? "bg-green-500" : "bg-slate-200"}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.referral.enabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
              {form.referral.enabled && (
                <div className="rounded-xl border border-green-100 bg-green-50 p-4 space-y-3">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-slate-500">Bonus du parrain</label>
                      <input
                        type="number" min={1} max={50}
                        className="h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:border-green-400"
                        value={form.referral.referrerBonus || ""}
                        onChange={(e) => { const n = parseInt(e.target.value); patch({ referral: { ...form.referral, referrerBonus: isNaN(n) ? 0 : n } }); }}
                        onBlur={() => { if (!form.referral.referrerBonus || form.referral.referrerBonus < 1) patch({ referral: { ...form.referral, referrerBonus: 1 } }); else if (form.referral.referrerBonus > 50) patch({ referral: { ...form.referral, referrerBonus: 50 } }); }}
                      />
                    </div>
                    <div className="flex h-[38px] items-center rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-500 whitespace-nowrap">
                      {form.loyaltyMode === "stamps" ? "🎫 Tampons" : "⭐ Points"}
                    </div>
                  </div>
                  <p className="text-[11px] text-green-600">
                    Le parrain reçoit {form.referral.referrerBonus || 1} {form.loyaltyMode === "stamps" ? "tampon(s)" : "point(s)"} à chaque parrainage réussi.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Thème de la carte</label>

              {/* Live card preview */}
              <div className="flex justify-center py-1">
                <div className="relative w-[260px] h-[150px] rounded-2xl overflow-hidden shadow-xl select-none"
                  style={{ background: form.backgroundColor }}>
                  <div className="absolute inset-0 opacity-5"
                    style={{ backgroundImage: "radial-gradient(circle at 70% 30%, white 0%, transparent 60%)" }} />
                  <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-widest opacity-60" style={{ color: form.accentColor }}>Fidélité</p>
                      <p className="text-[13px] font-bold text-white leading-tight mt-0.5">{form.name || "Nom de la carte"}</p>
                    </div>
                    <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: form.accentColor + "25", border: `1.5px solid ${form.accentColor}50` }}>
                      <CreditCard className="h-4 w-4" style={{ color: form.accentColor }} />
                    </div>
                  </div>
                  {form.loyaltyMode === "stamps" ? (
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {Array.from({ length: Math.min(form.stampsRequired, 10) }).map((_, i) => (
                          <div key={i} className="h-4 w-4 rounded-full border"
                            style={{ borderColor: form.accentColor, background: i < 3 ? form.accentColor : "transparent" }} />
                        ))}
                      </div>
                      <p className="mt-1.5 text-[9px] opacity-50 text-white">3 / {form.stampsRequired} tampons</p>
                    </div>
                  ) : (
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-[22px] font-bold" style={{ color: form.accentColor }}>1 250</p>
                      <p className="text-[9px] opacity-50 text-white">points cumulés</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Preset grid */}
              <div className="grid grid-cols-6 gap-1.5">
                {colorPresets.map((p) => {
                  const selected = form.backgroundColor === p.bg && form.accentColor === p.accent;
                  return (
                    <button key={p.name} type="button"
                      onClick={() => patch({ backgroundColor: p.bg, accentColor: p.accent })}
                      title={p.name}
                      className="relative flex flex-col items-center gap-1 rounded-xl overflow-hidden transition-all"
                      style={{ outline: selected ? `2px solid ${p.accent}` : "2px solid transparent", outlineOffset: "1px" }}>
                      <div className="w-full h-8 relative" style={{ background: p.bg }}>
                        <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-0.5">
                          {[0,1,2].map((i) => (
                            <div key={i} className="h-1.5 w-1.5 rounded-full"
                              style={{ background: i < 2 ? p.accent : p.accent + "40" }} />
                          ))}
                        </div>
                      </div>
                      <span className="text-[8px] text-slate-400 pb-0.5 leading-none">{p.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom colors */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <p className="text-[10px] text-slate-400 mb-1">Fond</p>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.backgroundColor} onChange={(e) => patch({ backgroundColor: e.target.value })} className="h-8 w-8 cursor-pointer rounded-lg border border-slate-200 p-0.5" />
                    <Input value={form.backgroundColor} onChange={(e) => patch({ backgroundColor: e.target.value })} className="font-mono text-xs" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 mb-1">Accent</p>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.accentColor} onChange={(e) => patch({ accentColor: e.target.value })} className="h-8 w-8 cursor-pointer rounded-lg border border-slate-200 p-0.5" />
                    <Input value={form.accentColor} onChange={(e) => patch({ accentColor: e.target.value })} className="font-mono text-xs" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />
          <div className="flex justify-end gap-2 px-7 py-5">
            <Button variant="secondary" onClick={() => { setShowCreate(false); setEditingId(null); }}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              {saved ? <><Check className="mr-1.5 h-4 w-4" />Sauvegardé</> : editingId ? "Sauvegarder" : "Créer la carte"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modale de prévention : suppression de carte ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-50">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <p className="text-[16px] font-bold text-slate-900">
                Supprimer la carte « {deleteTarget.name} » ?
              </p>
            </div>

            {deleteTargetClients > 0 ? (
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50/70 px-4 py-3">
                <p className="text-[13.5px] font-semibold text-red-800">
                  ⚠️ {deleteTargetClients} client{deleteTargetClients > 1 ? "s" : ""} utilise{deleteTargetClients > 1 ? "nt" : ""} cette carte
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-red-700/80">
                  Leurs tampons, points et points de parrainage seront <strong>définitivement
                  perdus</strong>, et leur carte Apple/Google Wallet cessera de fonctionner.
                  Cette action est irréversible.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-slate-500">
                Aucun client n'utilise cette carte. La suppression est sans conséquence.
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)}>
                Annuler
              </Button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-red-700 transition-colors"
              >
                {deleteTargetClients > 0 ? `Supprimer (${deleteTargetClients} client${deleteTargetClients > 1 ? "s" : ""} impacté${deleteTargetClients > 1 ? "s" : ""})` : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
