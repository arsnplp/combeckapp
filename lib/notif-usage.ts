import { supabase } from "./supabase";

export async function getMonthlyNotifCount(tenantId: string): Promise<number> {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const { data } = await supabase().from("notification_usage").select("count")
    .eq("merchant_id", tenantId).eq("month", thisMonth).maybeSingle();
  return data?.count ?? 0;
}

// Incrémente le compteur de façon atomique (compare-and-swap avec retry) —
// deux envois de campagne concurrents (deux onglets, ou dashboard + cron)
// ne doivent jamais s'écraser l'un l'autre ("lost update").
export async function incrementNotifCount(tenantId: string, amount: number): Promise<void> {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const sb = supabase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await sb.from("notification_usage").select("count")
      .eq("merchant_id", tenantId).eq("month", thisMonth).maybeSingle();

    if (!existing) {
      const { error } = await sb.from("notification_usage")
        .insert({ merchant_id: tenantId, month: thisMonth, count: amount });
      if (!error) return;
      continue; // une requête concurrente a créé la ligne entre-temps → on boucle pour l'incrémenter
    }

    const current = existing.count ?? 0;
    const { data: updated } = await sb.from("notification_usage")
      .update({ count: current + amount })
      .eq("merchant_id", tenantId).eq("month", thisMonth).eq("count", current)
      .select("merchant_id").maybeSingle();
    if (updated) return;
    // sinon quelqu'un d'autre a modifié la ligne entre notre lecture et notre
    // écriture → on relit la valeur fraîche et on réessaie
  }
  console.error(`[notif-usage] incrementNotifCount(${tenantId}): échec après plusieurs tentatives (forte contention)`);
}
