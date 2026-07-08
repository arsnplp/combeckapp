import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllClientAccounts, deleteClientAccount } from "@/lib/client-accounts";
import { supabase } from "@/lib/supabase";
import { walletDb_deletePassesForCards } from "@/lib/wallet-db";

// Nettoie les pass wallet des clients ciblés AVANT la suppression (FK → NULL sinon)
async function purgeWalletForCustomers(customerIds: string[]): Promise<void> {
  if (!customerIds.length) return;
  const { data: cards } = await supabase().from("customer_cards")
    .select("id").in("customer_id", customerIds);
  await walletDb_deletePassesForCards((cards ?? []).map((c) => c.id));
}

interface ClientSummary {
  email: string;
  name: string;
  phone: string;
  hasPassword: boolean;
  joinDate: string;
  cards: Array<{
    tenantId: string;
    storeName: string;
    cardName: string;
    loyaltyMode: string;
    stamps: number;
    points: number;
  }>;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const [clientAccounts, customersRes] = await Promise.all([
    getAllClientAccounts(),
    supabase().from("customers").select(`
      id, merchant_id, name, email, phone, join_date,
      merchants ( store_name ),
      customer_cards ( stamps, points, loyalty_cards ( name, loyalty_mode ) )
    `).order("join_date"),
  ]);
  const accountsByEmail = new Map(clientAccounts.map((a) => [a.email.toLowerCase(), a]));

  const byEmail = new Map<string, ClientSummary>();

  for (const customer of customersRes.data ?? []) {
    const normalizedEmail = customer.email ? (customer.email as string).toLowerCase().trim() : "";
    const key = normalizedEmail || `__noemail__${customer.id}`;

    if (!byEmail.has(key)) {
      const acct = normalizedEmail ? accountsByEmail.get(normalizedEmail) : undefined;
      byEmail.set(key, {
        email: normalizedEmail,
        name: customer.name as string,
        phone: (customer.phone as string) ?? "",
        hasPassword: !!acct,
        joinDate: customer.join_date as string,
        cards: [],
      });
    }

    const summary = byEmail.get(key)!;
    const merchant = customer.merchants as unknown as { store_name: string } | null;

    for (const cc of (customer.customer_cards as unknown as Array<{
      stamps: number; points: number;
      loyalty_cards: { name: string; loyalty_mode: string } | null;
    }>) ?? []) {
      summary.cards.push({
        tenantId: customer.merchant_id as string,
        storeName: merchant?.store_name ?? "Commerce",
        cardName: cc.loyalty_cards?.name ?? "Carte",
        loyaltyMode: cc.loyalty_cards?.loyalty_mode ?? "stamps",
        stamps: cc.stamps,
        points: cc.points,
      });
    }
  }

  return NextResponse.json(Array.from(byEmail.values()));
}

// DELETE — supprime un client de tous les tenants + compte client
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { email, name } = await req.json();
  if (typeof email !== "string") {
    return NextResponse.json({ error: "Email requis." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedName = (name ?? "").toLowerCase().trim();
  const sb = supabase();

  if (normalizedEmail) {
    const { data: targets } = await sb.from("customers").select("id").ilike("email", normalizedEmail);
    await purgeWalletForCustomers((targets ?? []).map((c) => c.id));
    // Cartes + historique suivent via FK cascade
    await sb.from("customers").delete().ilike("email", normalizedEmail);
    await deleteClientAccount(normalizedEmail);
  } else if (normalizedName) {
    const { data: targets } = await sb.from("customers").select("id").eq("email", "").ilike("name", normalizedName);
    await purgeWalletForCustomers((targets ?? []).map((c) => c.id));
    // Sans email : suppression par nom exact (fiches sans compte)
    await sb.from("customers").delete().eq("email", "").ilike("name", normalizedName);
  }

  return NextResponse.json({ ok: true });
}
