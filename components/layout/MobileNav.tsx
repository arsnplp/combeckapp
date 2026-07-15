"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, CreditCard, ScanLine, Menu, X,
  Package, Bell, BarChart3, Settings, Gem, LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useStore } from "@/lib/store-context";

const tabs = [
  { href: "/dashboard", label: "Accueil", icon: LayoutDashboard, exact: true, scanner: false },
  { href: "/clients", label: "Clients", icon: Users, exact: false, scanner: false },
  { href: "/dashboard/scan", label: "Scanner", icon: ScanLine, exact: false, scanner: true },
  { href: "/carte", label: "Cartes", icon: CreditCard, exact: false, scanner: false },
];

const menuItems = [
  { href: "/produits", label: "Produits & Récompenses", icon: Package },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { settings } = useStore();
  const storeName = settings.name || "Mon Établissement";

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const menuActive = menuItems.some((m) => isActive(m.href)) || isActive("/abonnement");

  return (
    <>
      {/* Barre de navigation basse — mobile uniquement */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="grid h-16 grid-cols-5">
          {tabs.map((tab) => {
            const active = isActive(tab.href, tab.exact);
            const Icon = tab.icon;
            // Bouton Scanner central, mis en avant (l'action n°1 en boutique)
            if (tab.scanner) {
              return (
                <Link key={tab.href} href={tab.href} className="relative flex items-end justify-center pb-1.5">
                  <span
                    className={`absolute -top-5 flex h-[54px] w-[54px] items-center justify-center rounded-full shadow-lg transition-all active:scale-95 ${
                      active
                        ? "bg-gradient-to-br from-green-600 to-emerald-700 shadow-green-600/40 ring-4 ring-green-100"
                        : "bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/30"
                    }`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </span>
                  <span className={`text-[10px] font-semibold ${active ? "text-green-700" : "text-slate-400"}`}>
                    {tab.label}
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex flex-col items-center justify-center gap-1 transition-colors active:bg-slate-50"
              >
                <Icon className={`h-[21px] w-[21px] ${active ? "text-green-600" : "text-slate-400"}`} />
                <span className={`text-[10px] font-semibold ${active ? "text-green-700" : "text-slate-400"}`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 transition-colors active:bg-slate-50"
          >
            <Menu className={`h-[21px] w-[21px] ${menuActive ? "text-green-600" : "text-slate-400"}`} />
            <span className={`text-[10px] font-semibold ${menuActive ? "text-green-700" : "text-slate-400"}`}>Menu</span>
          </button>
        </div>
      </nav>

      {/* Feuille "Menu" — le reste des pages, gros boutons tactiles */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] lg:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white pb-[calc(16px+env(safe-area-inset-bottom))] shadow-2xl lg:hidden"
            >
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-200" />
              <div className="flex items-center justify-between px-5 pb-2 pt-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-slate-900">{storeName}</p>
                  {settings.city && <p className="text-[12px] text-slate-400">{settings.city}</p>}
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:bg-slate-200"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="space-y-1 px-3 pt-1">
                {menuItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-[15px] font-medium transition-colors ${
                        active ? "bg-green-50 text-green-700" : "text-slate-700 active:bg-slate-50"
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${active ? "text-green-600" : "text-slate-400"}`} />
                      {item.label}
                    </Link>
                  );
                })}

                <Link
                  href="/abonnement"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3.5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3.5 text-[15px] font-bold text-white shadow-md shadow-green-500/25 active:scale-[0.99]"
                >
                  <Gem className="h-5 w-5 text-white" />
                  Choisir un plan
                </Link>
              </div>

              <div className="mt-3 border-t border-slate-100 px-3 pt-2">
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-[15px] font-medium text-red-600 active:bg-red-50"
                >
                  <LogOut className="h-5 w-5" />
                  Déconnexion
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
