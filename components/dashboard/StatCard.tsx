"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon: LucideIcon;
  index?: number;
}

export default function StatCard({
  title,
  value,
  subtitle,
  trend,
  index = 0,
}: StatCardProps) {
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.05 }}
      className="rounded-xl border border-black/[0.06] bg-white p-5"
    >
      <div className="mb-3.5 flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium text-slate-500">{title}</p>
        {trend !== undefined && (
          <span
            className={`flex flex-shrink-0 items-center gap-[3px] rounded-md px-1.5 py-[3px] text-[11px] font-semibold ${
              isPositive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-600"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" />
            )}
            {isPositive ? "+" : ""}
            {trend}%
          </span>
        )}
      </div>
      <p className="text-[27px] font-bold tracking-tight text-slate-900 leading-none">
        {value}
      </p>
      {subtitle && (
        <p className="mt-2 text-[11.5px] text-slate-400">{subtitle}</p>
      )}
    </motion.div>
  );
}
