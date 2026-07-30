"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";

export default function PasswordSection() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/account/password")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setHasPassword(d.hasPassword))
      .catch(() => {});
  }, []);

  const reset = () => {
    setEditing(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  };

  const handleSubmit = async () => {
    setError("");
    if (newPassword.length < 8) { setError("Le mot de passe doit faire au moins 8 caractères."); return; }
    if (newPassword !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur."); setSaving(false); return; }
      setHasPassword(true);
      reset();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch {
      setError("Erreur réseau. Réessayez.");
    }
    setSaving(false);
  };

  if (hasPassword === null) return null;
  const inputType = show ? "text" : "password";
  const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13.5px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all";

  return (
    <div className="mt-5 border-t border-slate-100 pt-5">
      {!editing ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-slate-700">Mot de passe</p>
            <p className="text-[12px] text-slate-400">
              {hasPassword ? "••••••••" : "Aucun mot de passe défini — connexion via Google uniquement"}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {success && (
              <span className="flex items-center gap-1 text-[12px] font-medium text-green-600">
                <Check className="h-3.5 w-3.5" /> Mis à jour
              </span>
            )}
            <button
              onClick={() => setEditing(true)}
              className="flex-shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {hasPassword ? "Changer" : "Définir un mot de passe"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 max-w-sm">
          {hasPassword && (
            <input
              type={inputType}
              placeholder="Mot de passe actuel"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
              autoFocus
            />
          )}
          <input
            type={inputType}
            placeholder="Nouveau mot de passe (min. 8 caractères)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
          <div className="relative">
            <input
              type={inputType}
              placeholder="Confirmer le nouveau mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass + " pr-10"}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              onClick={reset}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
