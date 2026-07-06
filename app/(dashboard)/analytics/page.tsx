"use client";

import { motion } from "framer-motion";
import { Users, Star, Gift, RefreshCw, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VisitsChart, RewardsChart } from "@/components/analytics/AnalyticsChart";
import { useStore } from "@/lib/store-context";

function EmptyChart() {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-slate-400">
      <BarChart2 className="h-8 w-8 opacity-30" />
      <p className="text-sm">Pas encore assez de données</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { customers, rewards } = useStore();

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
  const totalClients = customers.length;

  const retained = customers.filter((c) => c.totalVisits > 1).length;
  const retentionRate = totalClients === 0 ? 0 : Math.round((retained / totalClients) * 100);

  let visitFrequency = 0;
  if (totalClients > 0) {
    const total = customers.reduce((sum, c) => {
      const joinMs = c.joinDate ? new Date(c.joinDate).getTime() : now;
      const months = Math.max(1, (now - joinMs) / (1000 * 60 * 60 * 24 * 30));
      return sum + c.totalVisits / months;
    }, 0);
    visitFrequency = Math.round((total / totalClients) * 10) / 10;
  }

  const activeClients = customers.filter((c) => {
    if (!c.lastVisit) return false;
    return new Date(c.lastVisit).getTime() > thirtyDaysAgo;
  }).length;

  const atRiskClients = customers.filter((c) => {
    if (!c.lastVisit) return false;
    const t = new Date(c.lastVisit).getTime();
    return t <= thirtyDaysAgo && t > ninetyDaysAgo;
  }).length;

  const inactiveClients = customers.filter((c) => {
    if (!c.lastVisit) return true;
    return new Date(c.lastVisit).getTime() <= ninetyDaysAgo;
  }).length;

  const sortedRewards = [...rewards].sort((a, b) => b.usageCount - a.usageCount);
  const bestReward = sortedRewards.find((r) => r.usageCount > 0);

  const withRewards = customers.filter((c) => c.rewardsUsed > 0).length;
  const redemptionRate = totalClients === 0 ? 0 : Math.round((withRewards / totalClients) * 100);

  const weeklyData = Array.from({ length: 12 }, (_, i) => {
    const weekEnd = now - i * 7 * 24 * 60 * 60 * 1000;
    const weekStart = weekEnd - 7 * 24 * 60 * 60 * 1000;
    const count = customers.filter((c) => {
      if (!c.joinDate) return false;
      const jd = new Date(c.joinDate).getTime();
      return jd >= weekStart && jd < weekEnd;
    }).length;
    const d = new Date(weekEnd);
    return { label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }), visits: count };
  }).reverse();

  const rewardsChartData = rewards
    .filter((r) => r.usageCount > 0)
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 8)
    .map((r) => ({ label: r.name.length > 14 ? r.name.slice(0, 13) + "…" : r.name, rewards: r.usageCount }));

  const topRewards = sortedRewards.filter((r) => r.usageCount > 0).slice(0, 5);
  const maxCount = topRewards[0]?.usageCount || 1;

  const hasVisitsData = weeklyData.some((d) => d.visits > 0);
  const hasRewardsData = rewardsChartData.length > 0;

  const kpis = [
    {
      label: "Taux de rétention",
      value: totalClients === 0 ? "—" : `${retentionRate}%`,
      sub: totalClients === 0 ? "Aucun client" : `${retained} / ${totalClients} clients fidèles`,
      icon: Users,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.12)",
    },
    {
      label: "Fréquence de visite",
      value: totalClients === 0 ? "—" : `${visitFrequency}x/mois`,
      sub: "Moyenne par client",
      icon: Star,
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.12)",
    },
    {
      label: "Clients actifs",
      value: String(activeClients),
      sub: "30 derniers jours",
      icon: Users,
      color: "#10b981",
      bg: "rgba(16,185,129,0.12)",
    },
    {
      label: "Meilleure récompense",
      value: bestReward ? `${bestReward.emoji} ${bestReward.name}` : "—",
      sub: bestReward ? `${bestReward.usageCount} utilisation${bestReward.usageCount > 1 ? "s" : ""}` : "Aucune encore",
      icon: Gift,
      color: "#06b6d4",
      bg: "rgba(6,182,212,0.12)",
    },
    {
      label: "Taux de rachat",
      value: totalClients === 0 ? "—" : `${redemptionRate}%`,
      sub: `${withRewards} client${withRewards > 1 ? "s" : ""} ont utilisé une récompense`,
      icon: RefreshCw,
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.12)",
    },
  ];

  return (
    <div className="space-y-10 max-w-7xl">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: kpi.bg }}>
                  <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                </div>
              </div>
              <p className="truncate text-xl font-semibold text-slate-900">{kpi.value}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-700">{kpi.label}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{kpi.sub}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Segmentation clients */}
      {totalClients > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <p className="mb-4 text-[13px] font-semibold text-slate-700">Segmentation clients</p>
          <div className="space-y-3">
            {[
              { label: "Actifs", sub: "Visité dans les 30 derniers jours", count: activeClients, color: "#10b981", bg: "rgba(16,185,129,0.1)", emoji: "🟢" },
              { label: "À risque", sub: "Pas de visite depuis 30 à 90 jours", count: atRiskClients, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", emoji: "🟡" },
              { label: "Inactifs", sub: "Pas de visite depuis plus de 90 jours", count: inactiveClients, color: "#ef4444", bg: "rgba(239,68,68,0.1)", emoji: "🔴" },
            ].map(({ label, sub, count, color, bg, emoji }) => {
              const pct = totalClients === 0 ? 0 : Math.round((count / totalClients) * 100);
              return (
                <div key={label}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px]">{emoji}</span>
                      <div>
                        <span className="text-[13px] font-medium text-slate-800">{label}</span>
                        <span className="ml-2 text-[11px] text-slate-400">{sub}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold" style={{ color }}>{count}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: bg, color }}
                      >{pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6 }}
                      className="h-full rounded-full"
                      style={{ background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {inactiveClients > 0 && (
            <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
              💡 {inactiveClients} client{inactiveClients > 1 ? "s" : ""} inactif{inactiveClients > 1 ? "s" : ""} — pensez à envoyer une campagne de réactivation depuis les{" "}
              <a href="/notifications" className="font-semibold underline">Notifications</a>.
            </p>
          )}
        </div>
      )}

      <Tabs defaultValue="visits">
        <TabsList>
          <TabsTrigger value="visits">Visites</TabsTrigger>
          <TabsTrigger value="rewards">Récompenses</TabsTrigger>
        </TabsList>

        <TabsContent value="visits">
          <Card>
            <CardHeader>
              <CardTitle>Nouveaux clients par semaine (12 semaines)</CardTitle>
            </CardHeader>
            <CardContent>
              {hasVisitsData ? <VisitsChart data={weeklyData} /> : <EmptyChart />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards">
          <Card>
            <CardHeader>
              <CardTitle>Utilisations des récompenses</CardTitle>
            </CardHeader>
            <CardContent>
              {hasRewardsData ? <RewardsChart data={rewardsChartData} /> : <EmptyChart />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Récompenses les plus utilisées</CardTitle>
        </CardHeader>
        <CardContent>
          {topRewards.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">Aucune récompense utilisée pour l&apos;instant</p>
          ) : (
            <div className="space-y-5">
              {topRewards.map((reward, i) => (
                <div key={reward.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{reward.emoji} {reward.name}</span>
                    <span className="text-xs text-slate-500">{reward.usageCount} utilisation{reward.usageCount > 1 ? "s" : ""}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round((reward.usageCount / maxCount) * 100)}%` }}
                      transition={{ duration: 0.7, delay: i * 0.1 }}
                      className="h-full rounded-full"
                      style={{ background: i === 0 ? "#f59e0b" : i === 1 ? "#8b5cf6" : "#10b981" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
