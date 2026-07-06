"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Users, CreditCard,
  Bell, BarChart3, Settings, ScanLine,
} from "lucide-react";
import { useStore } from "@/lib/store-context";

const navSections = [
  {
    items: [{ href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard }],
  },
  {
    label: "Fidélité",
    items: [
      { href: "/carte", label: "Cartes Wallet", icon: CreditCard },
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/produits", label: "Produits & Récompenses", icon: Package },
    ],
  },
  {
    label: "Clients",
    items: [
      { href: "/dashboard/scan", label: "Scanner QR", icon: ScanLine },
    ],
  },
  {
    label: "Outils",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const { settings } = useStore();
  const storeName = settings.name || "Mon Établissement";
  const initial = storeName.charAt(0).toUpperCase();
  const hasLogo = !!settings.logoUrl;

  return (
    <aside className="sticky top-0 z-40 flex h-screen w-full flex-col border-r border-slate-200 bg-white">
      {/* Brand */}
      <div className="flex h-[57px] flex-shrink-0 items-center border-b border-slate-100 px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Comeback" className="h-7 w-auto object-contain" />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {navSections.map((section, i) => (
          <div key={i}>
            {section.label && (
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                {section.label}
              </p>
            )}
            <div className="space-y-px">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors ${
                      isActive ? "bg-green-50 text-green-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className={`h-[15px] w-[15px] flex-shrink-0 transition-colors ${isActive ? "text-green-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="flex-shrink-0 border-t border-slate-100 px-3 py-3">
        <div className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-slate-50 transition-colors">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md overflow-hidden bg-green-600">
            {hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/settings/logo?t=${settings.logoUrl}`} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span className="text-[11px] font-bold text-white">{initial}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-tight text-slate-900">{storeName}</p>
            <p className="text-[11px] leading-tight text-slate-400">{settings.city || "Pro"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
