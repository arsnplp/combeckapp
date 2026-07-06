"use client";

import { Send, Clock, FileText, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { Notification } from "@/types";

const statusConfig = {
  sent: { label: "Envoyé", Icon: Send, color: "text-emerald-600", bg: "rgba(5,150,105,0.10)" },
  scheduled: { label: "Planifié", Icon: Clock, color: "text-amber-700", bg: "rgba(245,158,11,0.12)" },
  draft: { label: "Brouillon", Icon: FileText, color: "text-slate-500", bg: "rgba(15,23,42,0.06)" },
};

const audienceLabels = {
  all: "Tous les clients",
  silver: "🥈 Silver",
  gold: "🥇 Gold",
  platine: "💎 Platine",
};

interface NotificationHistoryProps {
  notifications: Notification[];
}

export default function NotificationHistory({ notifications }: NotificationHistoryProps) {
  return (
    <div className="space-y-3">
      {notifications.map((notif) => {
        const { label, Icon, color, bg } = statusConfig[notif.status];
        return (
          <div key={notif.id} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: bg }}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant={notif.status === "sent" ? "success" : notif.status === "scheduled" ? "default" : "secondary"} className="text-[10px]">
                    {label}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Users className="h-3 w-3" />
                    {audienceLabels[notif.audience]}
                    {notif.recipients > 0 && ` · ${notif.recipients} destinataires`}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">{notif.message}</p>
                <p className="mt-2 text-xs text-slate-500">{formatDateTime(notif.sentAt)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
