import { randomBytes } from "crypto";
import { supabase } from "./supabase";

const TTL_MS = 60 * 60 * 1000; // 1 heure

// Mapping legacy → colonnes auth_tokens.type
const TYPE_MAP = { client: "client_reset", restaurant: "merchant_reset" } as const;

export async function createResetToken(email: string, type: "client" | "restaurant"): Promise<string> {
  const sb = supabase();
  const dbType = TYPE_MAP[type];
  const normalized = email.toLowerCase().trim();
  // Invalider les anciens tokens du même email/type
  await sb.from("auth_tokens").delete().eq("type", dbType).ilike("email", normalized);
  const token = randomBytes(32).toString("hex");
  await sb.from("auth_tokens").insert({
    token,
    type: dbType,
    email: normalized,
    expires_at: new Date(Date.now() + TTL_MS).toISOString(),
  });
  return token;
}

export async function consumeResetToken(token: string, type: "client" | "restaurant"): Promise<string | null> {
  const sb = supabase();
  const { data } = await sb.from("auth_tokens").select("email, expires_at")
    .eq("token", token).eq("type", TYPE_MAP[type]).maybeSingle();
  if (!data) return null;
  await sb.from("auth_tokens").delete().eq("token", token); // usage unique
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data.email;
}
