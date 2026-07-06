import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import Link from "next/link";
import { Zap, Shield, LogOut } from "lucide-react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  // Page de login admin : pas besoin d'être authentifié
  // (le middleware laisse passer /admin/login comme public)

  // Pour toutes les autres pages admin, vérifier isAdmin
  const isLoginPage = false; // géré par le middleware
  void isLoginPage;

  if (!session?.user?.isAdmin) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Admin topbar */}
      <header className="flex h-12 items-center justify-between border-b border-white/10 bg-slate-900 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-600">
            <Zap className="h-3 w-3 text-white" fill="currentColor" />
          </div>
          <span className="text-[13px] font-bold text-white">Comeback</span>
          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            <Shield className="h-2.5 w-2.5" /> Super Admin
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-[12px] text-slate-400 hover:text-white transition-colors">
            Dashboard
          </Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/admin/login" }); }}>
            <button type="submit" className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-white transition-colors">
              <LogOut className="h-3.5 w-3.5" /> Déconnexion
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
