import { supabase } from "./supabase";
import { db_getAll } from "./server-db";
import { getUserById } from "./users";
import { getMonthlyNotifCount, incrementNotifCount } from "./notif-usage";
import { walletNotificationService } from "./wallet-notification-service";
import { PLAN_LIMITS } from "./plan-limits";

export interface RecurringNotification {
  id: string;
  message: string;
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek: number | null;   // 0 (dimanche) à 6 — pour weekly
  dayOfMonth: number | null;  // 1 à 28 — pour monthly
  hour: number;               // heure d'envoi, Europe/Paris
  active: boolean;
  lastSentAt: string | null;
  createdAt: string;
}

interface Row {
  id: string; merchant_id: string; message: string; frequency: string;
  day_of_week: number | null; day_of_month: number | null; hour: number;
  active: boolean; last_sent_at: string | null; created_at: string;
}

function map(r: Row): RecurringNotification {
  return {
    id: r.id,
    message: r.message,
    frequency: r.frequency as RecurringNotification["frequency"],
    dayOfWeek: r.day_of_week,
    dayOfMonth: r.day_of_month,
    hour: r.hour,
    active: r.active,
    lastSentAt: r.last_sent_at,
    createdAt: r.created_at,
  };
}

// Les notifications automatiques sont réservées aux plans Pro et Business
export function planAllowsRecurring(plan: string): boolean {
  return plan === "pro" || plan === "business";
}

export async function listRecurring(tenantId: string): Promise<RecurringNotification[]> {
  const { data } = await supabase().from("recurring_notifications")
    .select("*").eq("merchant_id", tenantId).order("created_at");
  return ((data ?? []) as Row[]).map(map);
}

export async function createRecurring(
  tenantId: string,
  input: { message: string; frequency: "daily" | "weekly" | "monthly"; dayOfWeek?: number; dayOfMonth?: number; hour: number },
): Promise<RecurringNotification | null> {
  const row = {
    id: `rn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    merchant_id: tenantId,
    message: input.message.trim().slice(0, 300),
    frequency: input.frequency,
    day_of_week: input.frequency === "weekly" ? Math.min(6, Math.max(0, input.dayOfWeek ?? 1)) : null,
    day_of_month: input.frequency === "monthly" ? Math.min(28, Math.max(1, input.dayOfMonth ?? 1)) : null,
    hour: Math.min(23, Math.max(0, input.hour)),
    active: true,
  };
  const { data, error } = await supabase().from("recurring_notifications")
    .insert(row).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? map(data as Row) : null;
}

export async function updateRecurring(
  tenantId: string,
  id: string,
  patch: { active?: boolean; message?: string; hour?: number },
): Promise<void> {
  const upd: Record<string, unknown> = {};
  if (patch.active !== undefined) upd.active = patch.active;
  if (patch.message !== undefined) upd.message = patch.message.trim().slice(0, 300);
  if (patch.hour !== undefined) upd.hour = Math.min(23, Math.max(0, patch.hour));
  if (!Object.keys(upd).length) return;
  await supabase().from("recurring_notifications")
    .update(upd).eq("id", id).eq("merchant_id", tenantId);
}

export async function deleteRecurring(tenantId: string, id: string): Promise<void> {
  await supabase().from("recurring_notifications")
    .delete().eq("id", id).eq("merchant_id", tenantId);
}

// ── Exécution (appelée par le cron toutes les heures) ─────────────────────────

function parisNow(): { hour: number; dayOfWeek: number; dayOfMonth: number; dateKey: string } {
  const now = new Date();
  const paris = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "numeric", hour12: false,
    weekday: "short", day: "numeric",
    year: "numeric", month: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => paris.find((p) => p.type === type)?.value ?? "";
  const weekdays = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  return {
    hour: parseInt(get("hour"), 10),
    dayOfWeek: weekdays.indexOf(get("weekday")),
    dayOfMonth: parseInt(get("day"), 10),
    dateKey: `${get("year")}-${get("month")}-${get("day").padStart(2, "0")}`,
  };
}

export interface RecurringRunResult {
  checked: number;
  sent: Array<{ id: string; merchantId: string; recipients: number }>;
  skipped: Array<{ id: string; reason: string }>;
}

export async function runDueRecurringNotifications(): Promise<RecurringRunResult> {
  const sb = supabase();
  const now = parisNow();
  const result: RecurringRunResult = { checked: 0, sent: [], skipped: [] };

  const { data: rows } = await sb.from("recurring_notifications")
    .select("*").eq("active", true).eq("hour", now.hour);

  for (const r of (rows ?? []) as Row[]) {
    result.checked++;

    // Fréquence : est-ce le bon jour ?
    if (r.frequency === "weekly" && r.day_of_week !== now.dayOfWeek) continue;
    if (r.frequency === "monthly" && r.day_of_month !== now.dayOfMonth) continue;

    // Déjà envoyée aujourd'hui ? (protège contre les doubles exécutions du cron)
    if (r.last_sent_at) {
      const lastKey = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", dateStyle: "short" })
        .format(new Date(r.last_sent_at));
      if (lastKey === now.dateKey) {
        result.skipped.push({ id: r.id, reason: "déjà envoyée aujourd'hui" });
        continue;
      }
    }

    // Gating plan : seuls Pro et Business envoient
    const user = await getUserById(r.merchant_id);
    if (!user || !planAllowsRecurring(user.plan)) {
      result.skipped.push({ id: r.id, reason: `plan ${user?.plan ?? "?"} non éligible` });
      continue;
    }

    // Quota mensuel du plan
    const limit = (PLAN_LIMITS[user.plan] ?? PLAN_LIMITS["starter"]).notifs;
    const used = await getMonthlyNotifCount(r.merchant_id);
    if (limit !== Infinity && used >= limit) {
      result.skipped.push({ id: r.id, reason: "quota mensuel atteint" });
      continue;
    }

    // Envoi ciblé aux clients de CE commerce uniquement
    const db = await db_getAll(r.merchant_id);
    const customerIds = db.customers.map((c) => c.id);
    if (!customerIds.length) {
      result.skipped.push({ id: r.id, reason: "aucun client" });
      continue;
    }

    try {
      const pushResults = await walletNotificationService.sendCampaignToCustomers(r.message, customerIds);
      const success = pushResults.filter((p) => p.success).length;

      await sb.from("recurring_notifications")
        .update({ last_sent_at: new Date().toISOString() }).eq("id", r.id);
      if (success > 0) await incrementNotifCount(r.merchant_id, success);

      // Trace dans l'historique
      await sb.from("notifications").insert({
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        merchant_id: r.merchant_id,
        message: r.message,
        target: "auto",
        sent_count: success,
      });

      result.sent.push({ id: r.id, merchantId: r.merchant_id, recipients: success });
    } catch (err) {
      console.error(`[recurring] envoi ${r.id} échoué:`, err);
      result.skipped.push({ id: r.id, reason: String(err) });
    }
  }

  return result;
}
