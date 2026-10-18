import type { ReactNode } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { resolveClientSession } from "@/lib/client-sessions";
import AccountMenu from "./AccountMenu";

export const metadata: Metadata = {
  title: "Mes cartes — Comeback",
  // PWA : installable sur l'écran d'accueil (icône permanente)
  appleWebApp: {
    capable: true,
    title: "ComeBack",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
  // Remplace le manifeste commerçant (par défaut sur tout le site, voir
  // app/layout.tsx) par celui de l'espace client — sinon un client qui
  // s'ajoute à l'écran d'accueil récupère par erreur le raccourci
  // de connexion commerçant.
  manifest: "/manifest.webmanifest",
};

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("comeback_client")?.value;
  const email = token ? await resolveClientSession(token) : null;

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* En-tête opaque. En `bg-white/80`, la carte de fidélité — fond
          sombre — transparaissait au défilement : ses pastilles de tampons
          semblaient flotter par-dessus le logo. Le flou d'arrière-plan ne
          suffit pas, il n'est pas appliqué partout. Z-index relevé pour
          repasser au-dessus des éléments internes de la carte. */}
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Comeback" className="h-6 w-auto object-contain" />
          <span className="text-[11px] font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Fidélité</span>
          {email && <AccountMenu email={email} />}
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
