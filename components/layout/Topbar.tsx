"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useStore } from "@/lib/store-context";

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Vue d'ensemble", subtitle: "" },
  "/produits": { title: "Produits & Récompenses", subtitle: "Gérez votre catalogue et récompenses" },
  "/clients": { title: "Clients", subtitle: "Gérez votre base de clients" },
  "/carte": { title: "Carte Wallet", subtitle: "Personnalisez votre carte de fidélité" },
  "/notifications": { title: "Notifications", subtitle: "Communiquez avec vos clients" },
  "/analytics": { title: "Analytics", subtitle: "Analysez vos performances" },
  "/parametres": { title: "Paramètres", subtitle: "Configurez votre établissement" },
};

function StoreLogo() {
  const { settings } = useStore();
  const initial = (settings.name || "C").charAt(0).toUpperCase();

  if (settings.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/settings/logo?t=${settings.logoUrl}`}
        alt="Logo"
        style={{ width: 30, height: 30, borderRadius: 8, objectFit: "cover", display: "block" }}
      />
    );
  }

  return (
    <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1e40af", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{initial}</span>
    </div>
  );
}

export default function Topbar() {
  const pathname = usePathname();
  const meta = pageMeta[pathname] ?? { title: "Comeback", subtitle: "" };

  return (
    <header className="sticky top-0 z-30 flex h-[57px] flex-shrink-0 items-center border-b border-slate-200 bg-white px-6 lg:px-8">
      <div className="flex flex-1 items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-[14px] font-semibold leading-none text-slate-900">{meta.title}</h1>
          <p className="mt-[4px] text-[12px] leading-none text-slate-400">{meta.subtitle}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="ml-1 flex h-8 w-8 items-center justify-center">
            <StoreLogo />
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Déconnexion"
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <LogOut className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
