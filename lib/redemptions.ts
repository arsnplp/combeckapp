import { supabase } from "./supabase";

export interface Redemption {
  token: string;
  tenantId: string;
  customerId: string;
  customerCardId: string;
  cardId: string;
  rewardName: string;
  rewardEmoji: string;
  cost: number;
  costType: "stamps" | "points" | "referral";
  exp: number;
  used: boolean;
  usedAt: string | null;
  createdAt: string;
}

export async function createRedemption(
  data: Omit<Redemption, "token" | "used" | "usedAt" | "createdAt">,
): Promise<Redemption> {
  const token = crypto.randomUUID();
  const r: Redemption = { ...data, token, used: false, usedAt: null, createdAt: new Date().toISOString() };
  const sb = supabase();
  await sb.from("redemption_tokens").insert({
    id: token,
    merchant_id: data.tenantId,
    payload: r,
    used: false,
  });
  // Nettoyage opportuniste des tokens de plus de 24h
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  sb.from("redemption_tokens").delete().lt("created_at", cutoff).then(() => {});
  return r;
}

export async function getRedemption(token: string): Promise<Redemption | null> {
  const { data } = await supabase().from("redemption_tokens")
    .select("payload, used").eq("id", token).maybeSingle();
  if (!data) return null;
  return { ...(data.payload as Redemption), used: data.used };
}

export async function markUsed(token: string): Promise<void> {
  const { data } = await supabase().from("redemption_tokens")
    .select("payload").eq("id", token).maybeSingle();
  if (!data) return;
  const payload = { ...(data.payload as Redemption), used: true, usedAt: new Date().toISOString() };
  await supabase().from("redemption_tokens")
    .update({ used: true, payload }).eq("id", token);
}

export async function cancelPendingForCard(customerCardId: string): Promise<void> {
  await supabase().from("redemption_tokens").delete()
    .eq("used", false)
    .eq("payload->>customerCardId", customerCardId)
    .gt("payload->exp", Date.now());
}
