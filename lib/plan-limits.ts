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
  free: {
    clients: 150,
    notifs: 10000,
    cards: 1,
    targetingAdvanced: false,
    referralEnabled: false,
    csvExport: false,
    analyticsHistoryDays: 7,
  },
  starter: {
    clients: 150,
    notifs: 10000,
    cards: 1,
    targetingAdvanced: false,
    referralEnabled: false,
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
  starter:  19,
  pro:      49,
  business: 99,
};
