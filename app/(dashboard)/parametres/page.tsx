"use client";

import { useState, useRef, useEffect } from "react";
import { Store, Moon, CheckCircle, Zap, Upload, Image as ImageIcon, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store-context";
import { useDarkMode } from "@/lib/use-dark-mode";
import { signOut } from "next-auth/react";

export default function ParametresPage() {
  const { settings, updateSettings } = useStore();
  const { dark, toggle: toggleDark } = useDarkMode();
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [logoUploading, setLogoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (settings.logoUrl) {
      setLogoPreview(`/api/settings/logo?t=${Date.now()}`);
    }
  }, [settings.logoUrl]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (key: keyof typeof settings, value: string | number) => {
    updateSettings({ [key]: value } as Parameters<typeof updateSettings>[0]);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);

    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      // Resize to 256×256 on canvas — keeps upload tiny regardless of original size
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 256, 256);
      const data = canvas.toDataURL("image/png");

      setLogoPreview(data);
      try {
        const res = await fetch("/api/settings/logo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        const json = await res.json();
        if (json.url) {
          updateSettings({ logoUrl: json.url });
        } else {
          alert("Erreur upload logo : " + (json.error ?? "inconnu"));
        }
      } catch (err) {
        alert("Erreur réseau lors de l'upload : " + String(err));
      } finally {
        setLogoUploading(false);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setLogoUploading(false);
      alert("Impossible de lire l'image.");
    };
    img.src = objectUrl;
  };

  return (
    <div className="space-y-10 max-w-4xl">
      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-amber-400" />
            Logo de l'établissement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-4">
            Ce logo apparaît sur votre carte Apple Wallet et dans les notifications push.
          </p>
          <div className="flex items-center gap-4">
            <div
              onClick={() => fileRef.current?.click()}
              style={{ width: 64, height: 64, borderRadius: 14, overflow: "hidden", flexShrink: 0, cursor: "pointer", border: "2px dashed #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <Upload className="h-5 w-5 text-slate-300" />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={logoUploading}>
                {logoUploading ? "Envoi…" : logoPreview ? "Changer" : "Choisir un logo"}
              </Button>
              <p className="text-xs text-slate-400">PNG, JPG · Carré recommandé</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
        </CardContent>
      </Card>

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

      {/* Subscription */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.05))",
          border: "1px solid rgba(245,158,11,0.2)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-amber-400" />
              <p className="text-sm font-semibold text-amber-300">Plan Pro</p>
            </div>
            <p className="text-xs text-amber-500/70">Renouvellement le 15 février 2025</p>
            <ul className="mt-3 space-y-1">
              {["Clients illimités", "Notifications illimitées", "Analytics avancées", "Support prioritaire"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-amber-400/80">
                  <CheckCircle className="h-3 w-3 text-amber-500" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-400">29€</p>
            <p className="text-xs text-amber-500/60">/mois</p>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2">
          {saved ? (
            <>
              <CheckCircle className="h-4 w-4" />
              Sauvegardé !
            </>
          ) : (
            "Sauvegarder les paramètres"
          )}
        </Button>
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
