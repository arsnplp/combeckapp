"use client";

import { useState, useEffect } from "react";
import { Send, Loader2, CheckCircle, Plus, Pencil, Trash2, X, Check, ChevronDown } from "lucide-react";
import { useStore } from "@/lib/store-context";
import { computeRank } from "@/lib/rank";
import NotificationHistory from "@/components/notifications/NotificationHistory";
import RecurringNotifications from "@/components/notifications/RecurringNotifications";
import QuotaCard from "@/components/notifications/QuotaCard";
import type { AudienceType, RankType } from "@/types";

// ── Suggestions persistées ────────────────────────────────────────────────────

const DEFAULT_SUGGESTIONS = [
  "Bonjour ! Profitez de -20% sur toutes les pâtisseries ce weekend 🥐",
  "Votre prochain café est offert ! Validez votre tampon avant dimanche ☕",
  "Nouveau menu de saison disponible, venez découvrir nos spécialités ! 🍽️",
  "Rappel : vos tampons expirent bientôt. Venez nous rendre visite 🎁",
  "Offre spéciale fidèles : brunch du dimanche à -30% sur présentation de votre carte 🌟",
];
const SUGGESTIONS_KEY = "cc_notification_suggestions";

function loadSuggestions(): string[] {
  if (typeof window === "undefined") return DEFAULT_SUGGESTIONS;
  try {
    const s = localStorage.getItem(SUGGESTIONS_KEY);
    return s ? JSON.parse(s) : DEFAULT_SUGGESTIONS;
  } catch { return DEFAULT_SUGGESTIONS; }
}
function saveSuggestions(s: string[]) {
  localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(s));
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { customers, loyaltyCards } = useStore();
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<AudienceType>("all");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentHistory, setSentHistory] = useState<import("@/types").Notification[]>([]);

  // Filtre inactivité
  const [inactiveFilter, setInactiveFilter] = useState(false);
  const [inactiveDays, setInactiveDays] = useState(30);

  // Suggestions
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [editingSuggestions, setEditingSuggestions] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [newSuggestion, setNewSuggestion] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  // Replié par défaut : déplié, le bloc faisait descendre le bouton d'envoi
  // hors de l'écran, alors que c'est l'action principale de la page.
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  useEffect(() => { setSuggestions(loadSuggestions()); }, []);

  const persistSuggestions = (next: string[]) => { setSuggestions(next); saveSuggestions(next); };
  const deleteSuggestion = (i: number) => persistSuggestions(suggestions.filter((_, j) => j !== i));
  const saveEdit = (i: number) => {
    if (!editingValue.trim()) return;
    const next = [...suggestions]; next[i] = editingValue.trim();
    persistSuggestions(next);
    setEditingIdx(null);
  };
  const addSuggestion = () => {
    if (!newSuggestion.trim()) return;
    persistSuggestions([...suggestions, newSuggestion.trim()]);
    setNewSuggestion(""); setAddingNew(false);
  };

  // Audience
  const card = loyaltyCards[0] ?? null;
  const byRank = (rank: RankType) => customers.filter((c) => computeRank(c, card) === rank);
  const silverClients = byRank("silver");
  const goldClients = byRank("gold");
  const platineClients = byRank("platine");

  // Chaque rang porte sa couleur : `soft` en fond au repos, `strong` en fond
  // une fois sélectionné (texte blanc). Pas d'emoji — il mangeait la largeur
  // et faisait passer « Platine » à la ligne.
  const audienceConfig: Record<AudienceType, {
    label: string; count: number; soft: string; strong: string; text: string; ids: string[];
  }> = {
    all:     { label: "Tous",    count: customers.length,       soft: "#dcfce7", strong: "#16a34a", text: "#15803d", ids: customers.map((c) => c.id) },
    silver:  { label: "Silver",  count: silverClients.length,   soft: "#e2e8f0", strong: "#94a3b8", text: "#475569", ids: silverClients.map((c) => c.id) },
    gold:    { label: "Gold",    count: goldClients.length,     soft: "#fef3c7", strong: "#f59e0b", text: "#92400e", ids: goldClients.map((c) => c.id) },
    platine: { label: "Platine", count: platineClients.length,  soft: "#e0f2fe", strong: "#38bdf8", text: "#0369a1", ids: platineClients.map((c) => c.id) },
  };

  const getEffectiveIds = (): string[] => {
    const base = audienceConfig[audience].ids;
    if (!inactiveFilter) return base;
    const cutoff = Date.now() - inactiveDays * 24 * 60 * 60 * 1000;
    const baseSet = new Set(base);
    return customers
      .filter((c) => {
        if (!baseSet.has(c.id)) return false;
        if (!c.lastVisit) return true;
        return new Date(c.lastVisit).getTime() < cutoff;
      })
      .map((c) => c.id);
  };
  const effectiveIds = getEffectiveIds();
  const effectiveCount = effectiveIds.length;

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    const cfg = audienceConfig[audience];
    const ids = getEffectiveIds();
    try {
      const res = await fetch("/api/wallet/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, customerIds: ids.length === customers.length && !inactiveFilter ? undefined : ids }),
      });
      const data = await res.json();
      setSent(true);
      setSentHistory((prev) => [{
        id: `n${Date.now()}`, message, audience, status: "sent",
        sentAt: new Date().toISOString(), recipients: data.success ?? effectiveCount,
      }, ...prev]);
      setMessage("");
      setTimeout(() => setSent(false), 3000);
    } catch {
      setSentHistory((prev) => [{
        id: `n${Date.now()}`, message, audience, status: "sent",
        sentAt: new Date().toISOString(), recipients: 0,
      }, ...prev]);
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-green-600">Outils</p>
        <h2 className="mt-1 text-[22px] font-bold text-slate-900">Notifications</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">Envoyez des messages ciblés à vos clients Apple Wallet.</p>
      </div>

      {/* ── Plan actuel + compteur mensuel ── */}
      <QuotaCard />

      {/* ── Notifications automatiques ── */}
      <RecurringNotifications />

      {/* ── Composer ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

        {/* Audience */}
        <div className="border-b border-slate-100 p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Audience</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {(Object.entries(audienceConfig) as [AudienceType, typeof audienceConfig[AudienceType]][]).map(([key, cfg]) => {
              const active = audience === key;
              return (
                <button
                  key={key}
                  onClick={() => setAudience(key)}
                  aria-pressed={active}
                  className="rounded-xl border px-2 py-2 text-center transition-all active:scale-[0.97]"
                  style={{
                    background: active ? cfg.strong : cfg.soft,
                    borderColor: active ? cfg.strong : "transparent",
                  }}
                >
                  <p
                    className="truncate text-[12.5px] font-semibold leading-tight"
                    style={{ color: active ? "#ffffff" : cfg.text }}
                  >
                    {cfg.label}
                  </p>
                  <p
                    className="mt-0.5 text-[11px] font-medium leading-tight"
                    style={{ color: active ? "rgba(255,255,255,0.75)" : cfg.text, opacity: active ? 1 : 0.6 }}
                  >
                    {cfg.count}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtre inactivité */}
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Campagne ciblée — Inactifs</p>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {inactiveFilter
                  ? `${effectiveCount} client${effectiveCount !== 1 ? "s" : ""} inactif${effectiveCount !== 1 ? "s" : ""} depuis ≥ ${inactiveDays} j.`
                  : "Filtrer par date de dernière visite"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInactiveFilter((v) => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${inactiveFilter ? "bg-orange-500" : "bg-slate-200"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${inactiveFilter ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          {inactiveFilter && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[12px] text-slate-500">Inactifs depuis plus de</span>
              <input
                type="number" min={1} max={365}
                value={inactiveDays || ""}
                onChange={(e) => { const n = parseInt(e.target.value); setInactiveDays(isNaN(n) ? 0 : n); }}
                onBlur={() => { if (!inactiveDays || inactiveDays < 1) setInactiveDays(1); }}
                className="h-8 w-16 rounded-lg border border-orange-200 bg-orange-50 px-2 text-center text-[13px] font-semibold text-orange-700 outline-none focus:border-orange-400"
              />
              <span className="text-[12px] text-slate-500">jours</span>
            </div>
          )}
        </div>

        {/* Message */}
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Message</p>
            <span className={`text-[11px] ${message.length > 180 ? "text-amber-500 font-semibold" : "text-slate-400"}`}>{message.length}/200</span>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 200))}
            placeholder="Écrivez votre message ici..."
            rows={4}
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[14px] text-slate-800 outline-none placeholder:text-slate-300 focus:border-green-300 focus:bg-white focus:ring-2 focus:ring-green-100"
            style={{ fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.6 }}
          />
        </div>

        {/* Suggestions — repliées par défaut pour ne pas repousser l'envoi */}
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => {
                setSuggestionsOpen((v) => {
                  // En refermant, on abandonne toute édition en cours pour ne
                  // pas rouvrir sur un champ à moitié rempli.
                  if (v) { setEditingSuggestions(false); setEditingIdx(null); setAddingNew(false); }
                  return !v;
                });
              }}
              aria-expanded={suggestionsOpen}
              className="group flex min-w-0 items-center gap-1.5 text-left"
            >
              <ChevronDown
                size={14}
                className={`flex-shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-slate-600 ${suggestionsOpen ? "rotate-180" : ""}`}
              />
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 transition-colors group-hover:text-slate-600">
                Suggestions rapides
              </p>
              <span className="flex-shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {suggestions.length}
              </span>
            </button>
            {suggestionsOpen && (
              <button
                onClick={() => { setEditingSuggestions((v) => !v); setEditingIdx(null); setAddingNew(false); }}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  editingSuggestions
                    ? "border-green-300 bg-green-50 text-green-600"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Pencil size={11} />
                {editingSuggestions ? "Terminer" : "Modifier"}
              </button>
            )}
          </div>

          {suggestionsOpen && (
          <div className="mt-3 flex flex-col gap-2">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                {editingIdx === i ? (
                  <>
                    <input
                      autoFocus
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(i); if (e.key === "Escape") setEditingIdx(null); }}
                      className="flex-1 rounded-xl border border-green-400 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none ring-2 ring-green-100"
                      style={{ fontFamily: "inherit" }}
                    />
                    <button onClick={() => saveEdit(i)} className="rounded-lg border border-green-300 bg-green-50 p-1.5 text-green-600 hover:bg-green-100">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setEditingIdx(null)} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => !editingSuggestions && setMessage(s)}
                      className={`flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-[13px] text-slate-700 leading-snug transition-colors ${
                        editingSuggestions ? "cursor-default" : "hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      {s}
                    </button>
                    {editingSuggestions && (
                      <div className="flex flex-shrink-0 gap-1.5">
                        <button
                          onClick={() => { setEditingIdx(i); setEditingValue(s); }}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => deleteSuggestion(i)}
                          className="rounded-lg border border-red-100 bg-red-50 p-1.5 text-red-400 hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {/* Add new */}
            {editingSuggestions && (
              addingNew ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newSuggestion}
                    onChange={(e) => setNewSuggestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addSuggestion(); if (e.key === "Escape") setAddingNew(false); }}
                    placeholder="Nouvelle suggestion..."
                    className="flex-1 rounded-xl border border-green-400 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none ring-2 ring-green-100"
                    style={{ fontFamily: "inherit" }}
                  />
                  <button onClick={addSuggestion} disabled={!newSuggestion.trim()} className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-[12px] font-semibold text-green-600 hover:bg-green-100 disabled:opacity-50">
                    Ajouter
                  </button>
                  <button onClick={() => setAddingNew(false)} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingNew(true)}
                  className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-500 transition-colors hover:border-slate-400 hover:bg-white"
                >
                  <Plus size={13} /> Ajouter une suggestion
                </button>
              )
            )}
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4">
          <p className="text-[12px] text-slate-500">
            Envoi à :{" "}
            <span className="font-semibold" style={{ color: inactiveFilter ? "#f97316" : audienceConfig[audience].text }}>
              {effectiveCount} destinataire{effectiveCount !== 1 ? "s" : ""}
              {inactiveFilter && <span className="ml-1 font-normal text-orange-400">(filtrés)</span>}
            </span>
          </p>
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: sent ? "#16a34a" : "#2563eb" }}
          >
            {sending ? <><Loader2 size={15} className="animate-spin" /> Envoi...</>
              : sent ? <><CheckCircle size={15} /> Envoyé !</>
              : <><Send size={15} /> Envoyer</>}
          </button>
        </div>
      </div>

      {/* ── Historique ── */}
      {sentHistory.length > 0 && (
        <div>
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Historique des envois
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <NotificationHistory notifications={sentHistory} />
          </div>
        </div>
      )}
    </div>
  );
}
