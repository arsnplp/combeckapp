"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { Shield, LogOut, Loader2 } from "lucide-react";

export default function ImpersonationBanner({ storeName }: { storeName: string }) {
  const [exiting, setExiting] = useState(false);

  const handleExit = async () => {
    setExiting(true);
    try {
      // 1. Obtenir le token admin AVANT de se déconnecter (session impersonnée encore active)
      const res = await fetch("/api/admin/restore", { method: "POST" });
      const { token, error } = await res.json();
      if (error || !token) { window.location.href = "/admin/login"; return; }

      // 2. Déconnecter la session impersonnée
      await signOut({ redirect: false });

      // 3. Se reconnecter en admin avec le token one-time
      await signIn("credentials", { adminRestoreToken: token, redirect: false });

      // 4. Retour sur le dashboard admin (full reload pour forcer la nouvelle session)
      window.location.href = "/admin";
    } catch {
      window.location.href = "/admin/login";
    }
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between bg-amber-500 px-5 py-2.5">
      <div className="flex items-center gap-2.5">
        <Shield className="h-4 w-4 text-amber-900" />
        <span className="text-[13px] font-semibold text-amber-900">
          Mode admin — Vous consultez le compte de <span className="font-bold">{storeName}</span>
        </span>
      </div>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="flex items-center gap-1.5 rounded-lg bg-amber-900/10 px-3 py-1.5 text-[12px] font-semibold text-amber-900 hover:bg-amber-900/20 transition-colors disabled:opacity-60"
      >
        {exiting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
        {exiting ? "Retour…" : "Quitter"}
      </button>
    </div>
  );
}
