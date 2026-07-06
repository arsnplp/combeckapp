import type { Customer, LoyaltyCard, RankType } from "@/types";

const RANK_LABELS: Record<RankType, string> = {
  none: "Aucun",
  silver: "Silver",
  gold: "Gold",
  platine: "Platine",
};

const RANK_COLORS: Record<RankType, { bg: string; text: string; border: string }> = {
  none: { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0" },
  silver: { bg: "#f1f5f9", text: "#475569", border: "#94a3b8" },
  gold: { bg: "#fef9c3", text: "#92400e", border: "#f59e0b" },
  platine: { bg: "#f0f9ff", text: "#0369a1", border: "#38bdf8" },
};

const RANK_EMOJIS: Record<RankType, string> = {
  none: "",
  silver: "🥈",
  gold: "🥇",
  platine: "💎",
};

export function computeRank(customer: Customer, card: LoyaltyCard | null | undefined): RankType {
  if (!card?.rankThresholds) return "none";
  const { silver, gold, platine } = card.rankThresholds;
  if (silver === 0 && gold === 0 && platine === 0) return "none";

  const joinDate = new Date(customer.joinDate || Date.now());
  const months = Math.max(1, (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30));

  let metric: number;
  if (card.loyaltyMode === "stamps") {
    metric = customer.totalVisits / months;
  } else {
    metric = customer.totalSpent / months;
  }

  if (platine > 0 && metric >= platine) return "platine";
  if (gold > 0 && metric >= gold) return "gold";
  if (silver > 0 && metric >= silver) return "silver";
  return "none";
}

export { RANK_LABELS, RANK_COLORS, RANK_EMOJIS };
