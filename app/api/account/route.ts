import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteUser } from "@/lib/users";
import { supabase } from "@/lib/supabase";
import { walletDb_deletePassesForCards } from "@/lib/wallet-db";
import { markMerchantChurned } from "@/lib/affiliates";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const tenantId = session.user.id;
  const sb = supabase();

  // 1. ANNULER l'abonnement Stripe — sinon la facturation continue après
  //    la suppression du compte
  try {
    const stripe = getStripe();
    const { data: merchant } = await sb.from("merchants")
      .select("stripe_customer_id").eq("id", tenantId).maybeSingle();
    if (stripe && merchant?.stripe_customer_id) {
      const subs = await stripe.subscriptions.list({
        customer: merchant.stripe_customer_id, status: "active", limit: 10,
      });
      for (const sub of subs.data) {
        await stripe.subscriptions.cancel(sub.id);
        console.log(`[account] Abonnement Stripe annulé : ${sub.id}`);
      }
    }
  } catch (e) {
    console.error("[account] annulation Stripe:", e);
    // On continue : mieux vaut supprimer le compte et gérer Stripe à la main
    // que bloquer la suppression
  }

  // 2. Purger les pass wallet des clients (sinon FK → NULL et les appareils
  //    continuent de recevoir des pushs fantômes) + expirer les cartes Google
  try {
    const { data: cards } = await sb.from("customer_cards")
      .select("id").eq("merchant_id", tenantId);
    await walletDb_deletePassesForCards((cards ?? []).map((c) => c.id));
  } catch (e) {
    console.error("[account] purge wallet:", e);
  }

  // 3. Affiliation : marquer le churn (le parrain ne touche plus de commission)
  try {
    await markMerchantChurned(tenantId);
  } catch { /* affiliation non configurée — ignorer */ }

  // 4. Supprimer le commerçant — cartes, clients, soldes, récompenses,
  //    produits et historique suivent via les FK on delete cascade
  await deleteUser(tenantId);

  return NextResponse.json({ ok: true });
}
