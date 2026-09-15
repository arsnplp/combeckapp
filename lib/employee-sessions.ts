import { randomBytes } from "crypto";
import { supabase } from "./supabase";

/**
 * Sessions employé — même principe que les sessions client (cookie opaque,
 * vérité en base), donc totalement indépendant de NextAuth : l'authentification
 * commerçant n'est pas touchée.
 *
 * Particularité : la session mémorise le commerce « déverrouillé ». L'employé
 * saisit le mot de passe d'accès une fois par service, pas à chaque scan —
 * sinon c'est inutilisable quand on enchaîne les clients en caisse. Comme le
 * déverrouillage vit côté serveur, retirer un employé coupe son accès
 * immédiatement, même sur un téléphone déjà ouvert.
 */

/** Durée d'un déverrouillage de commerce (un service). */
const UNLOCK_HOURS = 12;

export interface EmployeeSession {
  email: string;
  unlockedMerchantId: string | null;
}

export async function createEmployeeSession(email: string, ttlDays = 180): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  await supabase().from("employee_sessions").insert({
    token,
    employee_email: email.toLowerCase().trim(),
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlDays * 86400_000).toISOString(),
  });
  return token;
}

/** Token → session, ou null si invalide/expirée. */
export async function resolveEmployeeSession(token: string): Promise<EmployeeSession | null> {
  if (!token) return null;
  const { data } = await supabase().from("employee_sessions")
    .select("employee_email, expires_at, unlocked_merchant_id, unlocked_until")
    .eq("token", token).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at as string).getTime() <= Date.now()) {
    await supabase().from("employee_sessions").delete().eq("token", token);
    return null;
  }
  // Déverrouillage expiré : la session reste valide, mais il faudra ressaisir
  // le mot de passe d'accès du commerce.
  const until = data.unlocked_until ? new Date(data.unlocked_until as string).getTime() : 0;
  const stillUnlocked = until > Date.now();
  return {
    email: data.employee_email as string,
    unlockedMerchantId: stillUnlocked ? ((data.unlocked_merchant_id as string) ?? null) : null,
  };
}

export async function unlockMerchantForSession(token: string, merchantId: string): Promise<void> {
  await supabase().from("employee_sessions").update({
    unlocked_merchant_id: merchantId,
    unlocked_until: new Date(Date.now() + UNLOCK_HOURS * 3600_000).toISOString(),
  }).eq("token", token);
}

/** Quitter le commerce en cours sans se déconnecter du compte. */
export async function lockMerchantForSession(token: string): Promise<void> {
  await supabase().from("employee_sessions")
    .update({ unlocked_merchant_id: null, unlocked_until: null })
    .eq("token", token);
}

export async function deleteEmployeeSession(token: string): Promise<void> {
  await supabase().from("employee_sessions").delete().eq("token", token);
}

export async function deleteAllEmployeeSessions(email: string): Promise<void> {
  await supabase().from("employee_sessions").delete()
    .ilike("employee_email", email.toLowerCase().trim());
}
