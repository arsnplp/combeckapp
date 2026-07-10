import type { ReactNode } from "react";
import type { Metadata } from "next";

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
};

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-2">
          <span className="text-[15px] font-bold text-gray-900 tracking-tight">Comeback</span>
          <span className="text-[11px] font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Fidélité</span>
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
