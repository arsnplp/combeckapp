import type { PlanId } from "@/types";

export const PLAN_LIMITS: Record<PlanId, {
  clients: number;
  notifs: number;
  cards: number;
  targetingAdvanced: boolean;
  referralEnabled: boolean;
  csvExport: boolean;
  analyticsHistoryDays: number;
}> = {
  // Essai gratuit = niveau Business : le commerçant teste TOUT pendant 3 mois
  free: {
    clients: Infinity,
    notifs: Infinity,
    cards: Infinity,
    targetingAdvanced: true,
    referralEnabled: true,
    csvExport: true,
    analyticsHistoryDays: 730,
  },
  starter: {
    clients: 50,
    notifs: 1000,
    cards: 1,
    targetingAdvanced: false,
    referralEnabled: true,
    csvExport: false,
    analyticsHistoryDays: 7,
  },
  pro: {
    clients: Infinity,
    notifs: 50000,
    cards: 3,
    targetingAdvanced: true,
    referralEnabled: true,
    csvExport: true,
    analyticsHistoryDays: 365,
  },
  business: {
    clients: Infinity,
    notifs: Infinity,
    cards: Infinity,
    targetingAdvanced: true,
    referralEnabled: true,
    csvExport: true,
    analyticsHistoryDays: 730,
  },
};

export const PLAN_LABELS: Record<PlanId, string> = {
  free:     "Essai gratuit",
  starter:  "Starter",
  pro:      "Pro",
  business: "Business",
};

export const PLAN_PRICES: Record<PlanId, number> = {
  free:     0,
  starter:  19,
  pro:      49,
  business: 99,
};
