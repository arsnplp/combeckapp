"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import type { Reward } from "@/types";

interface RewardCardProps {
  reward: Reward;
  onEdit?: (reward: Reward) => void;
  onDelete?: (id: string) => void;
  /** Masquer : la récompense reste utilisable comme lot de jeu. */
  onToggleHidden?: (reward: Reward) => void;
}

export default function RewardCard({ reward, onEdit, onDelete, onToggleHidden }: RewardCardProps) {
  return (
    <div
      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
      style={{
        opacity: reward.hidden ? 0.55 : 1,
      }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg text-xl flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        {reward.emoji}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-slate-900">{reward.name}</p>
          <Badge variant={reward.mode === "stamps" ? "default" : "violet"} className="text-[10px]">
            {reward.mode === "stamps" ? `${reward.cost} tampons` : `${reward.cost} pts`}
          </Badge>
          {reward.hidden && (
            <Badge variant="secondary" className="text-[10px]">Masquée · réservée aux jeux</Badge>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{reward.description}</p>
        <p className="text-xs text-slate-600 mt-1">{reward.usageCount} utilisations</p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {onToggleHidden && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleHidden(reward)}
            title={reward.hidden
              ? "Masquée : vos clients ne peuvent pas l'échanger, mais ils peuvent la gagner aux jeux. Cliquez pour la rendre visible."
              : "Visible : vos clients peuvent l'échanger contre leurs tampons. Cliquez pour la réserver aux jeux."}
            aria-label={reward.hidden ? "Rendre visible" : "Masquer"}
            className={reward.hidden ? "text-amber-500" : "text-slate-400"}
          >
            {reward.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={() => onEdit?.(reward)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete?.(reward.id)}
          className="text-red-400 hover:text-red-300"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
