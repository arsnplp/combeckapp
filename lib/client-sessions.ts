import { randomBytes } from "crypto";
import { supabase } from "./supabase";

/** Crée une session pour un email, retourne le token opaque. */
export async function createClientSession(email: string, ttlDays = 180): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  await supabase().from("client_sessions").insert({
    token,
    client_email: email.toLowerCase().trim(),
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
  return token;
}

/** Résout un token → email, ou null si invalide/expiré. */
export async function resolveClientSession(token: string): Promise<string | null> {
  if (!token) return null;
  const { data } = await supabase().from("client_sessions")
    .select("client_email, expires_at").eq("token", token).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await supabase().from("client_sessions").delete().eq("token", token);
    return null;
  }
  return data.client_email;
}

/** Supprime une session (logout). */
export async function deleteClientSession(token: string): Promise<void> {
  await supabase().from("client_sessions").delete().eq("token", token);
}

/** Supprime toutes les sessions d'un email (suppression de compte). */
export async function deleteAllClientSessions(email: string): Promise<void> {
  await supabase().from("client_sessions").delete()
    .ilike("client_email", email.toLowerCase().trim());
}
