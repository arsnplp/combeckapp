import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partenaires — ComeBack",
  // Manifeste + titre dédiés : sinon un partenaire qui s'ajoute à l'écran
  // d'accueil depuis son espace affilié récupère par erreur le raccourci
  // commerçant (celui du site entier par défaut, voir app/layout.tsx).
  manifest: "/manifest-affilie.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Partenaires",
    statusBarStyle: "default",
  },
};

// Espace partenaires/affiliés — totalement séparé du SaaS commerçant
export default function AffiliateLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ComeBack" className="h-7 w-auto" />
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700 border border-green-100">
            Partenaires
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
