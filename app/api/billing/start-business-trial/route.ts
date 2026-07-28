import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

// Bonus ponctuel : offre un essai Business de 30 jours à un commerçant qui a
// choisi un plan directement à l'inscription (Starter/Pro/Business) sans être
// passé par l'essai gratuit standard. Réutilise le même mécanisme que l'essai
// initial (plan "free" + plan_expires_at) — protégé par un flag "usage unique"
// pour éviter qu'un commerçant ne s'octroie plusieurs essais gratuits.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const sb = supabase();
  const { data: merchant } = await sb.from("merchants")
    .select("plan, settings").eq("id", session.user.id).maybeSingle();
  if (!merchant) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  const settings = (merchant.settings ?? {}) as Record<string, unknown>;
  if (settings.hasUsedBonusBusinessTrial) {
    return NextResponse.json({ error: "Vous avez déjà utilisé votre essai Business offert." }, { status: 409 });
  }
  if (merchant.plan === "business") {
    return NextResponse.json({ error: "Vous êtes déjà sur le plan Business." }, { status: 409 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await sb.from("merchants").update({
    plan: "free",
    plan_expires_at: expiresAt.toISOString(),
    settings: { ...settings, hasUsedBonusBusinessTrial: true },
  }).eq("id", session.user.id);

  return NextResponse.json({ ok: true, plan: "free", plan_expires_at: expiresAt.toISOString() });
}
