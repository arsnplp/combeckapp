import { supabase } from "./supabase";
import type { Actor } from "./actor";

/**
 * Journal d'activité côté SERVEUR.
 *
 * Jusqu'ici l'activité ne vivait que dans le localStorage du navigateur du
 * commerçant : elle disparaissait en changeant d'appareil, et surtout une
 * action faite depuis le téléphone d'un employé n'aurait jamais été visible
 * par le commerçant. La traçabilité « qui a crédité ? » impose donc de
 * l'enregistrer en base.
 */

export type ActivityType = "visit" | "reward" | "new_client" | "points_added";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  customerId: string | null;
  customerCardId: string | null;
  amount: number;
  label: string;
  createdAt: string;
  actorType: "merchant" | "employee";
  actorId: string | null;
  actorName: string;
}

interface Row {
  id: string; merchant_id: string; customer_id: string | null; customer_card_id: string | null;
  type: string; amount: number | null; label: string | null; created_at: string;
  actor_type: string | null; actor_id: string | null; actor_name: string | null;
}

const map = (r: Row): ActivityEntry => ({
  id: r.id,
  type: (r.type as ActivityType) ?? "visit",
  customerId: r.customer_id,
  customerCardId: r.customer_card_id,
  amount: Number(r.amount ?? 0),
  label: r.label ?? "",
  createdAt: r.created_at,
  actorType: (r.actor_type as "merchant" | "employee") ?? "merchant",
  actorId: r.actor_id,
  actorName: r.actor_name ?? "",
});

/**
 * Enregistre une action. Volontairement tolérant aux pannes : un échec
 * d'écriture du journal ne doit JAMAIS faire échouer le crédit de tampons
 * lui-même — le client en caisse passe avant la traçabilité.
 */
export async function logActivity(
  tenantId: string,
  entry: {
    type: ActivityType;
    customerId?: string | null;
    customerCardId?: string | null;
    amount?: number;
    label: string;
  },
  actor: Actor,
): Promise<void> {
  try {
    await supabase().from("activities").insert({
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      merchant_id: tenantId,
      customer_id: entry.customerId ?? null,
      customer_card_id: entry.customerCardId ?? null,
      type: entry.type,
      amount: entry.amount ?? 0,
      label: entry.label,
      created_at: new Date().toISOString(),
      actor_type: actor.type,
      actor_id: actor.id,
      actor_name: actor.name,
    });
  } catch (e) {
    console.error("[activity-log]", e);
  }
}

/** Dernières actions d'un commerce (fil d'activité du tableau de bord). */
export async function getActivities(tenantId: string, limit = 50): Promise<ActivityEntry[]> {
  const { data } = await supabase().from("activities").select("*")
    .eq("merchant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map(map);
}

/** Statistiques par employé, pour la vue rapide côté commerçant. */
export interface EmployeeStats {
  actorId: string;
  actorName: string;
  stampsGiven: number;
  pointsGiven: number;
  rewardsValidated: number;
  actions: number;
  lastActionAt: string | null;
}

export async function getEmployeeStats(tenantId: string, sinceDays = 30): Promise<EmployeeStats[]> {
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString();
  const { data } = await supabase().from("activities").select("*")
    .eq("merchant_id", tenantId)
    .eq("actor_type", "employee")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const byActor = new Map<string, EmployeeStats>();
  for (const row of ((data ?? []) as Row[]).map(map)) {
    if (!row.actorId) continue;
    const s = byActor.get(row.actorId) ?? {
      actorId: row.actorId, actorName: row.actorName,
      stampsGiven: 0, pointsGiven: 0, rewardsValidated: 0, actions: 0, lastActionAt: null,
    };
    s.actions += 1;
    if (row.type === "visit") s.stampsGiven += row.amount;
    if (row.type === "points_added") s.pointsGiven += row.amount;
    if (row.type === "reward") s.rewardsValidated += 1;
    if (!s.lastActionAt) s.lastActionAt = row.createdAt; // trié desc
    byActor.set(row.actorId, s);
  }
  return [...byActor.values()].sort((a, b) => b.actions - a.actions);
}
