import type { ReactNode } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { resolveEmployeeSession } from "@/lib/employee-sessions";
import StaffAccountMenu from "./StaffAccountMenu";

export const metadata: Metadata = {
  title: "Espace employé — Comeback",
  // Raccourci écran d'accueil propre à l'espace employé : sans ça, une
  // employée qui installe l'app récupérerait le raccourci commerçant.
  manifest: "/manifest-employe.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ComeBack Staff",
    statusBarStyle: "default",
  },
  icons: { apple: "/apple-touch-icon.png" },
};

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("comeback_staff")?.value;
  const session = token ? await resolveEmployeeSession(token) : null;

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Comeback" className="h-6 w-auto object-contain" />
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">Employé</span>
          {session && <StaffAccountMenu email={session.email} />}
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-6">{children}</main>
    </div>
  );
}
