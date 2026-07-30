import { supabase } from "./supabase";

export interface SupportMessage {
  id: string;
  merchantId: string;
  sender: "merchant" | "admin";
  body: string;
  createdAt: string;
}

export interface ConversationSummary {
  merchantId: string;
  storeName: string;
  email: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadForAdmin: number;
}

interface MessageRow {
  id: string;
  merchant_id: string;
  sender: "merchant" | "admin";
  body: string;
  created_at: string;
  read_by_admin: boolean;
  read_by_merchant: boolean;
}

function mapMessage(r: MessageRow): SupportMessage {
  return { id: r.id, merchantId: r.merchant_id, sender: r.sender, body: r.body, createdAt: r.created_at };
}

export async function getThread(merchantId: string): Promise<SupportMessage[]> {
  const { data } = await supabase().from("support_messages")
    .select("*").eq("merchant_id", merchantId).order("created_at", { ascending: true });
  return ((data ?? []) as MessageRow[]).map(mapMessage);
}

export async function sendMessage(
  merchantId: string,
  sender: "merchant" | "admin",
  body: string,
): Promise<SupportMessage> {
  const row: MessageRow = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    merchant_id: merchantId,
    sender,
    body,
    created_at: new Date().toISOString(),
    // Chacun a déjà "lu" son propre message — seul le destinataire doit être notifié
    read_by_admin: sender === "admin",
    read_by_merchant: sender === "merchant",
  };
  await supabase().from("support_messages").insert(row);
  return mapMessage(row);
}

export async function markRead(merchantId: string, reader: "admin" | "merchant"): Promise<void> {
  const col = reader === "admin" ? "read_by_admin" : "read_by_merchant";
  const otherSender = reader === "admin" ? "merchant" : "admin";
  await supabase().from("support_messages").update({ [col]: true })
    .eq("merchant_id", merchantId).eq("sender", otherSender).eq(col, false);
}

export async function countUnreadForMerchant(merchantId: string): Promise<number> {
  const { count } = await supabase().from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId).eq("sender", "admin").eq("read_by_merchant", false);
  return count ?? 0;
}

// Une conversation par commerçant — la liste complète des messages, groupée
// côté code (plus simple et déjà largement assez rapide à ce volume que
// d'écrire une requête agrégée côté Supabase).
export async function listConversations(): Promise<ConversationSummary[]> {
  const sb = supabase();
  const { data: messages } = await sb.from("support_messages")
    .select("merchant_id, sender, body, created_at, read_by_admin")
    .order("created_at", { ascending: true });
  if (!messages || messages.length === 0) return [];

  const byMerchant = new Map<string, typeof messages>();
  for (const m of messages) {
    const arr = byMerchant.get(m.merchant_id) ?? [];
    arr.push(m);
    byMerchant.set(m.merchant_id, arr);
  }

  const merchantIds = [...byMerchant.keys()];
  const { data: merchants } = await sb.from("merchants").select("id, store_name, email").in("id", merchantIds);
  const merchantMap = new Map((merchants ?? []).map((m) => [m.id as string, m]));

  return merchantIds.map((id) => {
    const msgs = byMerchant.get(id)!;
    const last = msgs[msgs.length - 1];
    const unread = msgs.filter((m) => m.sender === "merchant" && !m.read_by_admin).length;
    const merchant = merchantMap.get(id);
    return {
      merchantId: id,
      storeName: (merchant?.store_name as string) ?? "Compte supprimé",
      email: (merchant?.email as string) ?? "",
      lastMessage: last.body as string,
      lastMessageAt: last.created_at as string,
      unreadForAdmin: unread,
    };
  });
}
