"use client";

import { useState } from "react";
import { Store, Moon, CheckCircle, Zap, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store-context";
import { useDarkMode } from "@/lib/use-dark-mode";
import { signOut } from "next-auth/react";
import SubscriptionSection from "@/components/settings/SubscriptionSection";
import CurrentPlanCard from "@/components/settings/CurrentPlanCard";

export default function ParametresPage() {
  const { settings, updateSettings } = useStore();
  const { dark, toggle: toggleDark } = useDarkMode();

  // Suppression de compte
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const DELETE_WORD = "SUPPRIMER";

  const handleDeleteAccount = async () => {
    if (deleteInput !== DELETE_WORD) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) { setDeleteError("Erreur lors de la suppression."); setDeleting(false); return; }
      await signOut({ callbackUrl: "/login" });
    } catch {
      setDeleteError("Erreur réseau. Réessayez.");
      setDeleting(false);
    }
  };

  const update = (key: keyof typeof settings, value: string | number) => {
    updateSettings({ [key]: value } as Parameters<typeof updateSettings>[0]);
  };

  return (
    <div className="space-y-10 max-w-4xl">
      {/* Abonnement */}
      <SubscriptionSection />

      {/* Store info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-4 w-4 text-amber-400" />
            Informations de l'établissement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nom de l'établissement</Label>
              <Input value={settings.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ville</Label>
              <Input value={settings.city} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input value={settings.address} onChange={(e) => update("address", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={settings.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={settings.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Site web</Label>
              <Input value={settings.website} onChange={(e) => update("website", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-amber-400" />
            Apparence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Thème sombre</p>
              <p className="text-xs text-slate-500">Interface en mode nuit</p>
            </div>
            <Switch checked={dark} onCheckedChange={toggleDark} />
          </div>
        </CardContent>
      </Card>

      {/* Plan actuel (données réelles) */}
      <CurrentPlanCard />

      {/* Sauvegarde automatique — pas de bouton, tout est enregistré au fil de l'eau */}
      <div className="flex items-center justify-end gap-1.5 text-[12.5px] text-slate-400">
        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        Sauvegarde automatique
      </div>

      {/* ── Zone de danger ── */}
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <h3 className="text-[14px] font-semibold text-red-700">Zone de danger</h3>
        </div>
        <p className="text-[13px] text-red-500 mb-4">
          La suppression de votre compte est définitive. Toutes vos données (clients, cartes, paramètres) seront effacées.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-[13px] font-semibold text-red-600 hover:bg-red-100 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer mon compte
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px] font-medium text-red-700">
              Tapez <span className="font-mono font-bold">{DELETE_WORD}</span> pour confirmer :
            </p>
            <input
              autoFocus
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value.toUpperCase())}
              placeholder={DELETE_WORD}
              className="w-full max-w-xs rounded-xl border border-red-300 bg-white px-4 py-2.5 text-[14px] font-mono text-red-700 outline-none focus:ring-2 focus:ring-red-200 placeholder:text-red-200"
            />
            {deleteError && <p className="text-[12px] text-red-600">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInput !== DELETE_WORD || deleting}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {deleting ? "Suppression…" : "Confirmer la suppression"}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); setDeleteError(""); }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
