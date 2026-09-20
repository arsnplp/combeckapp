import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUpsellState } from "@/lib/upsell";

/**
 * État de l'offre « premier mois à -50 % » pour le commerçant connecté.
 *
 * Endpoint dédié (et non un ajout à /api/plan-features) : il compte les
 * clients en base, donc on ne l'impose pas aux nombreuses pages qui ne lisent
 * que les capacités du plan.
 */
export async function GET() {
  const session = await auth();
  const merchantId = session?.user?.id;
  if (!merchantId || merchantId === "admin") {
    return NextResponse.json({ eligible: false }, { status: 200 });
  }
  try {
    const state = await getUpsellState(merchantId);
    return NextResponse.json(state);
  } catch (e) {
    // Une offre commerciale ne doit jamais casser une page : en cas de
    // problème, on répond « pas d'offre » plutôt qu'une erreur.
    console.error("[upsell]", e);
    return NextResponse.json({ eligible: false }, { status: 200 });
  }
}
