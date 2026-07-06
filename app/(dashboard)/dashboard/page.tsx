"use client";

import Link from "next/link";
import { Users, Star, Gift, TrendingUp, ArrowRight, Zap, CheckCircle2, UserPlus, CreditCard } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import VisitorChart from "@/components/dashboard/VisitorChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useStore } from "@/lib/store-context";
import { useMemo } from "react";

const quickActions = [
  { label: "Ajouter un client", desc: "Enregistrez un nouveau client", icon: Users, color: "#2563eb", bg: "rgba(37,99,235,0.08)", href: "/clients" },
  { label: "Envoyer une notification", desc: "Communiquer avec vos clients", icon: Zap, color: "#7c3aed", bg: "rgba(124,58,237,0.08)", href: "/notifications" },
  { label: "Voir l'analytics", desc: "Analysez vos performances", icon: TrendingUp, color: "#059669", bg: "rgba(5,150,105,0.08)", href: "/analytics" },
];

export default function DashboardPage() {
  const { customers, rewards, activity, settings, walletConfig, loyaltyCards } = useStore();

  const stats = useMemo(() => {
    const active = customers.filter((c) => c.status !== "inactive").length;
    const totalVisits = customers.reduce((s, c) => s + c.totalVisits, 0);
    const totalRewards = customers.reduce((s, c) => s + c.rewardsUsed, 0);
    const retention =
      customers.length > 0
        ? Math.round((customers.filter((c) => c.status === "active" || c.status === "vip").length / customers.length) * 100)
        : 0;
    return [
      { title: "Clients actifs", value: String(active), icon: Users, subtitle: `${customers.length} inscrits au total` },
      { title: "Visites totales", value: String(totalVisits), icon: Star, subtitle: "depuis le début" },
      { title: "Récompenses utilisées", value: String(totalRewards), icon: Gift, subtitle: "depuis le début" },
      { title: "Taux de rétention", value: `${retention}%`, icon: TrendingUp, subtitle: "actifs / total inscrits" },
    ];
  }, [customers]);

  // Build 30-day visitor data from activity log
  const visitorData = useMemo(() => {
    const map = new Map<string, { visits: number; newClients: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      map.set(d.toISOString().split("T")[0], { visits: 0, newClients: 0 });
    }
    activity.forEach((item) => {
      const day = item.time.split("T")[0];
      if (!map.has(day)) return;
      const curr = map.get(day)!;
      if (item.type === "visit") curr.visits++;
      if (item.type === "new_client") curr.newClients++;
    });
    return Array.from(map.entries()).map(([date, d]) => ({ date, ...d }));
  }, [activity]);

  const recentActivity = activity.slice(0, 7);
  const hasData = customers.length > 0;

  const hasCard = loyaltyCards.length > 0;

  return (
    <div className="space-y-6">
      {/* Onboarding — aucune carte configurée */}
      {!hasCard && (
        <div className="flex items-start gap-4 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-600">
            <CreditCard className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-green-900">Créez votre première carte de fidélité</p>
            <p className="mt-0.5 text-[12.5px] text-green-700">
              Configurez votre carte, personnalisez les couleurs et générez votre QR code en quelques minutes.
            </p>
          </div>
          <Link
            href="/carte"
            className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Commencer
          </Link>
        </div>
      )}
      {/* Greeting */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-slate-900">
            Vue d&apos;ensemble
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            {hasData
              ? "Voici un résumé de votre programme fidélité."
              : "Bienvenue ! Commencez par configurer votre programme et ajouter vos premiers clients."}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1">
          <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-emerald-500" />
          <span className="text-[11.5px] font-medium text-emerald-700">Programme actif</span>
        </div>
      </div>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <StatCard key={stat.title} {...stat} index={i} />
        ))}
      </section>

      {/* Empty state OR chart + activity */}
      {!hasData ? (
        <div className="flex flex-col items-center gap-5 rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <UserPlus className="h-7 w-7 text-slate-300" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-slate-700">Aucun client pour l'instant</p>
            <p className="mt-1 text-[13px] text-slate-400">
              Ajoutez votre premier client pour commencer à suivre les visites et les récompenses.
            </p>
          </div>
          <Link
            href="/clients"
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-green-700"
          >
            <UserPlus className="h-4 w-4" />
            Ajouter un client
          </Link>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.65fr_1fr]">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Visiteurs</CardTitle>
                  <CardDescription className="mt-1">30 derniers jours</CardDescription>
                </div>
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
                    <span className="h-[6px] w-[6px] rounded-full bg-green-500" />
                    Visites
                  </span>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
                    <span className="h-[6px] w-[6px] rounded-full bg-teal-400" />
                    Nouveaux
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <VisitorChart data={visitorData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activité récente</CardTitle>
              <CardDescription className="mt-1">Dernières interactions</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <ActivityFeed items={recentActivity} />
              ) : (
                <p className="py-6 text-center text-[12.5px] text-slate-400">
                  Aucune activité récente
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Quick Actions */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="group flex items-center gap-3.5 rounded-xl border border-black/[0.06] bg-white p-4 transition-colors hover:bg-slate-50"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: action.bg }}>
                <Icon className="h-[15px] w-[15px]" style={{ color: action.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-slate-800">{action.label}</p>
                <p className="mt-0.5 text-[11.5px] text-slate-400">{action.desc}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
            </Link>
          );
        })}
      </section>

      {/* Programme summary */}
      <div className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white px-4 py-3">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
        <p className="text-[12.5px] text-slate-500">
          <span className="font-medium text-slate-700">
            {settings.loyaltyMode === "stamps" ? "Programme tampons" : "Programme points"}
          </span>
          {settings.loyaltyMode === "stamps"
            ? ` · ${settings.stampsRequired} tampons pour une récompense`
            : ` · ${settings.pointsPerEuro} points par euro`}
          {rewards.length > 0 && ` · ${rewards.length} récompense${rewards.length > 1 ? "s" : ""} configurée${rewards.length > 1 ? "s" : ""}`}
        </p>
      </div>
    </div>
  );
}
