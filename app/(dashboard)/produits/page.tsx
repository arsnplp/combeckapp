"use client";

import { useState } from "react";
import { Plus, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RewardCard from "@/components/produits/RewardCard";
import { useStore } from "@/lib/store-context";
import type { Reward } from "@/types";

const MAX_POINTS_COST = 10000;
// Plafond de bon sens pour un coût en tampons — un commerce peut avoir plusieurs
// cartes tampons avec des seuils différents, donc pas de valeur "officielle" unique
// (l'ancien réglage global settings.stampsRequired n'existe plus dans le système multi-cartes)
const MAX_STAMPS_COST = 20;

const EMOJIS = [
  "🎁", "☕", "🥐", "🍕", "🍔", "🧁", "🍦", "🥤", "🎀", "💐", "🛍️", "✨",
  "🍰", "🍩", "🥗", "🍜", "🍷", "🍺", "🎂", "🎉", "💎", "🏆", "🎫", "💳",
  "🧊", "🍫", "🥯", "🌮", "🍿", "🧃",
];

function EmojiPickerButton({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[44px] w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white text-lg transition-colors hover:bg-slate-50"
        title="Choisir un emoji"
      >
        {value}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-[calc(100%+6px)] z-20 grid w-64 grid-cols-6 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { onChange(e); setOpen(false); }}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-slate-100 ${
                  e === value ? "bg-green-100 ring-1 ring-green-400" : ""
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ProduitsPage() {
  const { rewards, setRewards } = useStore();

  // Add reward dialog
  const [showAddReward, setShowAddReward] = useState(false);
  const [newRewardName, setNewRewardName] = useState("");
  const [newRewardCost, setNewRewardCost] = useState("");
  const [newRewardMode, setNewRewardMode] = useState<"stamps" | "points">("stamps");
  const [newRewardEmoji, setNewRewardEmoji] = useState("🎁");

  // Edit reward dialog
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [editRewardName, setEditRewardName] = useState("");
  const [editRewardCost, setEditRewardCost] = useState("");
  const [editRewardEmoji, setEditRewardEmoji] = useState("🎁");
  const [editRewardMode, setEditRewardMode] = useState<"stamps" | "points">("stamps");

  const handleDeleteReward = (id: string) => setRewards((prev) => prev.filter((r) => r.id !== id));

  const openEditReward = (reward: Reward) => {
    setEditingReward(reward);
    setEditRewardName(reward.name);
    setEditRewardCost(String(reward.cost));
    setEditRewardEmoji(reward.emoji ?? "🎁");
    setEditRewardMode(reward.mode as "stamps" | "points");
  };

  const handleSaveEditReward = () => {
    if (!editingReward || !editRewardName.trim() || !editRewardCost) return;
    const cost = parseInt(editRewardCost);
    if (isNaN(cost) || cost < 1) return;
    setRewards((prev) => prev.map((r) => r.id !== editingReward.id ? r : {
      ...r,
      name: editRewardName.trim(),
      description: `Récompense : ${editRewardName.trim()}`,
      cost: Math.min(cost, editRewardMode === "stamps" ? MAX_STAMPS_COST : MAX_POINTS_COST),
      mode: editRewardMode,
      emoji: editRewardEmoji,
    }));
    setEditingReward(null);
  };

  const handleAddReward = () => {
    if (!newRewardName || !newRewardCost) return;
    const cost = parseInt(newRewardCost);
    if (isNaN(cost) || cost < 1) return;
    const r: Reward = {
      id: `r${Date.now()}`,
      name: newRewardName,
      description: `Récompense : ${newRewardName}`,
      cost: Math.min(cost, newRewardMode === "stamps" ? MAX_STAMPS_COST : MAX_POINTS_COST),
      mode: newRewardMode,
      emoji: newRewardEmoji,
      usageCount: 0,
      active: true,
    };
    setRewards((prev) => [...prev, r]);
    setShowAddReward(false);
    setNewRewardName("");
    setNewRewardCost("");
    setNewRewardEmoji("🎁");
  };

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-slate-500">
          {rewards.length} récompense{rewards.length > 1 ? "s" : ""} configurée{rewards.length > 1 ? "s" : ""}
        </p>
        <Button className="gap-2" onClick={() => setShowAddReward(true)}>
          <Plus className="h-4 w-4" />
          Ajouter une récompense
        </Button>
      </div>

      {rewards.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
            <Gift className="h-6 w-6 text-slate-300" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-slate-700">Aucune récompense</p>
            <p className="mt-1 text-[12.5px] text-slate-400">Définissez ce que vos clients peuvent échanger.</p>
          </div>
          <Button size="sm" onClick={() => setShowAddReward(true)}>Ajouter une récompense</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {(["stamps", "points"] as const).map((mode) => {
            const list = rewards.filter((r) => r.mode === mode);
            return (
              <div key={mode}>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  {mode === "stamps" ? "Récompenses tampons" : "Récompenses points"}
                </p>
                {list.length > 0 ? (
                  <div className="space-y-2">
                    {list.map((reward) => (
                      <RewardCard key={reward.id} reward={reward} onEdit={openEditReward} onDelete={handleDeleteReward} />
                    ))}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-slate-400">Aucune récompense {mode === "stamps" ? "tampons" : "points"}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Reward Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showAddReward} onOpenChange={(open) => {
        setShowAddReward(open);
        if (!open) { setNewRewardName(""); setNewRewardCost(""); setNewRewardEmoji("🎁"); }
      }}>
        <DialogContent className="sm:max-w-[460px]">
          <div className="px-7 pt-7 pb-5 pr-14">
            <DialogTitle className="text-[16px] font-semibold text-slate-900">Ajouter une récompense</DialogTitle>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="px-7 py-6 space-y-5">
            {/* ── Nom ── */}
            <div className="space-y-2">
              <Label htmlFor="reward-name">Nom de la récompense *</Label>
              <div className="flex gap-2">
                <EmojiPickerButton value={newRewardEmoji} onChange={setNewRewardEmoji} />
                <Input
                  id="reward-name"
                  placeholder="ex: Café offert"
                  value={newRewardName}
                  onChange={(e) => setNewRewardName(e.target.value)}
                  autoFocus
                  className="flex-1"
                />
              </div>
            </div>

            {/* ── Type de programme ── */}
            <div className="space-y-2">
              <Label>Type de programme</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["stamps", "points"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setNewRewardMode(m)}
                    className={`rounded-lg border py-2.5 text-[13px] font-medium transition-colors ${
                      newRewardMode === m
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    }`}
                  >
                    {m === "stamps" ? "🎫 Tampons" : "⭐ Points"}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Coût ── */}
            <div className="space-y-2">
              <Label htmlFor="reward-cost">
                Coût en {newRewardMode === "stamps" ? "tampons" : "points"} *
              </Label>
              <Input
                id="reward-cost"
                type="text"
                inputMode="numeric"
                placeholder={newRewardMode === "stamps" ? `1 – ${MAX_STAMPS_COST}` : `1 – ${MAX_POINTS_COST}`}
                value={newRewardCost}
                onChange={(e) => setNewRewardCost(e.target.value.replace(/\D/g, ""))}
              />
              {newRewardMode === "stamps" && newRewardCost && parseInt(newRewardCost) > MAX_STAMPS_COST && (
                <p className="text-[11.5px] text-amber-600">
                  Le maximum est {MAX_STAMPS_COST} tampons
                </p>
              )}
            </div>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex justify-end gap-2 px-7 py-5">
            <Button variant="secondary" onClick={() => setShowAddReward(false)}>Annuler</Button>
            <Button
              onClick={handleAddReward}
              disabled={!newRewardName.trim() || !newRewardCost || parseInt(newRewardCost) < 1}
            >
              Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Reward Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!editingReward} onOpenChange={(open) => { if (!open) setEditingReward(null); }}>
        <DialogContent className="sm:max-w-[460px]">
          <div className="px-7 pt-7 pb-5 pr-14">
            <DialogTitle className="text-[16px] font-semibold text-slate-900">Modifier la récompense</DialogTitle>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="px-7 py-6 space-y-5">
            {/* Nom */}
            <div className="space-y-2">
              <Label>Nom de la récompense</Label>
              <div className="flex gap-2">
                <EmojiPickerButton value={editRewardEmoji} onChange={setEditRewardEmoji} />
                <Input
                  placeholder="ex: Café offert"
                  value={editRewardName}
                  onChange={(e) => setEditRewardName(e.target.value)}
                  autoFocus
                  className="flex-1"
                />
              </div>
            </div>

            {/* Mode */}
            <div className="space-y-2">
              <Label>Type de programme</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["stamps", "points"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setEditRewardMode(m)}
                    className={`rounded-xl border py-3 text-[13px] font-medium transition-all ${editRewardMode === m ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}
                  >
                    {m === "stamps" ? "🎟️ Tampons" : "⭐ Points"}
                  </button>
                ))}
              </div>
            </div>

            {/* Coût */}
            <div className="space-y-2">
              <Label>Coût ({editRewardMode === "stamps" ? "tampons" : "points"})</Label>
              <Input
                type="number" min="1"
                placeholder={editRewardMode === "stamps" ? "ex: 10" : "ex: 100"}
                value={editRewardCost}
                onChange={(e) => setEditRewardCost(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex justify-end gap-2 px-7 py-5">
            <Button variant="secondary" onClick={() => setEditingReward(null)}>Annuler</Button>
            <Button
              onClick={handleSaveEditReward}
              disabled={!editRewardName.trim() || !editRewardCost || parseInt(editRewardCost) < 1}
            >
              Sauvegarder
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
