import type { PlanId } from "@/types";

export const PLAN_LIMITS: Record<PlanId, {
  clients: number;
  notifs: number;
  cards: number;
  /** Comptes employés rattachables au commerce (Infinity = illimité). */
  employees: number;
  targetingAdvanced: boolean;
  referralEnabled: boolean;
  csvExport: boolean;
  analyticsHistoryDays: number;
}> = {
  // Essai gratuit = niveau Business : le commerçant teste TOUT pendant 30 jours
  free: {
    clients: Infinity,
    notifs: Infinity,
    cards: 2,
    employees: Infinity,
    targetingAdvanced: true,
    referralEnabled: true,
    csvExport: true,
    analyticsHistoryDays: 730,
  },
  starter: {
    clients: 30,
    notifs: 1000,
    cards: 1,
    // 1 employé même sur le plan gratuit : sinon le commerçant partage son
    // propre mot de passe, ce qui donnerait à l'employé l'accès aux réglages,
    // à la facturation et à l'export du fichier clients.
    employees: 1,
    targetingAdvanced: false,
    referralEnabled: true,
    csvExport: false,
    analyticsHistoryDays: 7,
  },
  pro: {
    clients: 100,
    notifs: 10000,
    cards: 2,
    employees: 3,
    targetingAdvanced: true,
    referralEnabled: true,
    csvExport: true,
    analyticsHistoryDays: 365,
  },
  business: {
    clients: Infinity,
    notifs: Infinity,
    cards: 2,
    employees: Infinity,
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

// Starter est gratuit à vie (plafonné en clients) — ne passe jamais par Stripe.
export const PLAN_PRICES: Record<PlanId, number> = {
  free:     0,
  starter:  0,
  pro:      9.99,
  business: 39.99,
};
