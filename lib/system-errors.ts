import { supabase } from "./supabase";
import { notifyAdminEmail } from "./mailer";

export interface SystemError {
  id: string;
  source: string;
  message: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  resolved: boolean;
}

const THROTTLE_MS = 15 * 60 * 1000; // 15 min — évite de spammer pour la même cause

/**
 * Enregistre une erreur "systémique" — pas un simple échec ponctuel attendu
 * (device offline, carte pas encore ajoutée), mais quelque chose qui affecte
 * potentiellement TOUS les envois pour une cause donnée (certificat Apple
 * expiré, panne d'authentification Google Wallet, etc.). Visible dans
 * /admin, avec une alerte email au premier signalement — puis silencieux
 * pendant 15 min pour la même source tant qu'elle n'est pas résolue, pour
 * ne pas noyer la boîte mail si la panne persiste.
 */
export async function logSystemError(
  source: string,
  message: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const sb = supabase();
    const since = new Date(Date.now() - THROTTLE_MS).toISOString();
    const { data: recent } = await sb.from("system_errors")
      .select("id").eq("source", source).eq("resolved", false)
      .gte("created_at", since).limit(1).maybeSingle();
    if (recent) return; // déjà signalée récemment pour cette source

    const id = `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await sb.from("system_errors").insert({
      id, source, message, details: details ?? null,
      created_at: new Date().toISOString(), resolved: false,
    });

    notifyAdminEmail(`⚠️ Erreur système : ${source}`, {
      "Message": message,
      ...(details ? { "Détails": JSON.stringify(details).slice(0, 500) } : {}),
    }).catch(console.error);
  } catch (e) {
    // Le logging d'erreur ne doit jamais lui-même faire planter l'appelant
    console.error("[system-errors] échec du logging:", e);
  }
}

export async function listSystemErrors(includeResolved = false): Promise<SystemError[]> {
  const sb = supabase();
  let q = sb.from("system_errors").select("*").order("created_at", { ascending: false }).limit(200);
  if (!includeResolved) q = q.eq("resolved", false);
  const { data } = await q;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    source: r.source as string,
    message: r.message as string,
    details: r.details as Record<string, unknown> | null,
    createdAt: r.created_at as string,
    resolved: r.resolved as boolean,
  }));
}

export async function resolveSystemError(id: string): Promise<void> {
  await supabase().from("system_errors").update({ resolved: true }).eq("id", id);
}
