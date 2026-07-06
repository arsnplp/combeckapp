import { supabase } from "./supabase";

export async function getMonthlyNotifCount(tenantId: string): Promise<number> {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const { data } = await supabase().from("notification_usage").select("count")
    .eq("merchant_id", tenantId).eq("month", thisMonth).maybeSingle();
  return data?.count ?? 0;
}

export async function incrementNotifCount(tenantId: string, amount: number): Promise<void> {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const current = await getMonthlyNotifCount(tenantId);
  await supabase().from("notification_usage").upsert({
    merchant_id: tenantId,
    month: thisMonth,
    count: current + amount,
  }, { onConflict: "merchant_id,month" });
}
