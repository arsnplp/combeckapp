"use client";

import { motion } from "framer-motion";
import { Star, Gift, UserPlus, Zap } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";
import type { ActivityItem } from "@/types";

const iconMap = {
  visit: { Icon: Star, color: "#2563eb", bg: "rgba(37,99,235,0.08)" },
  reward: { Icon: Gift, color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  new_client: { Icon: UserPlus, color: "#059669", bg: "rgba(5,150,105,0.08)" },
  points_added: { Icon: Zap, color: "#0891b2", bg: "rgba(8,145,178,0.08)" },
};

interface ActivityFeedProps {
  items: ActivityItem[];
}

export default function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <div className="divide-y divide-black/[0.04]">
      {items.map((item, i) => {
        const { Icon, color, bg } = iconMap[item.type];
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: i * 0.03 }}
            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: bg }}
            >
              <Icon className="h-3 w-3" style={{ color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-slate-800">
                {item.customerName}
              </p>
              <p className="text-[11.5px] text-slate-400">{item.description}</p>
            </div>
            <span className="flex-shrink-0 text-[11px] tabular-nums text-slate-400">
              {formatTimeAgo(item.time)}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
