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
    cards: 1,
    employees: Infinity,
    targetingAdvanced: true,
    referralEnabled: true,
    csvExport: true,
    analyticsHistoryDays: 730,
  },
  // Ancienne offre gratuite, retirée le 27 octobre 2026. Plus aucun compte
  // n'est créé ni basculé sur Starter ; les comptes qui l'avaient déjà le
  // gardent tel quel (limites ci-dessous inchangées).
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
    // 300 depuis le 26 octobre 2026 (avant : 100). Une hausse : aucun abonné
    // Pro existant ne perd quoi que ce soit.
    clients: 300,
    notifs: 10000,
    cards: 1,
    employees: 3,
    targetingAdvanced: true,
    referralEnabled: true,
    csvExport: true,
    analyticsHistoryDays: 365,
  },
  business: {
    clients: Infinity,
    notifs: Infinity,
    cards: 1,
    employees: Infinity,
    targetingAdvanced: true,
    referralEnabled: true,
    csvExport: true,
    analyticsHistoryDays: 730,
  },
};

export const PLAN_LABELS: Record<PlanId, string> = {
  free:     "Essai gratuit",
  starter:  "Starter (ancienne offre)",
  pro:      "Pro",
  business: "Business",
};

// Starter : ancienne offre gratuite, conservée pour les comptes qui l'ont déjà.
export const PLAN_PRICES: Record<PlanId, number> = {
  free:     0,
  starter:  0,
  // Aligné sur PLAN_PRICING (lib/plan-billing.ts), prix des nouveaux abonnements.
  pro:      14.99,
  business: 29.99,
};
