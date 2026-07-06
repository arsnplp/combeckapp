import type { PlanId } from "@/types";

export const PLAN_LIMITS: Record<PlanId, { clients: number; notifs: number }> = {
  starter:  { clients: 150,      notifs: 1000     },
  pro:      { clients: Infinity,  notifs: 5000     },
  business: { clients: Infinity,  notifs: Infinity },
};

export const PLAN_LABELS: Record<PlanId, string> = {
  starter:  "Starter",
  pro:      "Pro",
  business: "Business",
};

export const PLAN_PRICES: Record<PlanId, number> = {
  starter:  19,
  pro:      49,
  business: 99,
};
