import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

// Ferme définitivement la bannière "essayez Business gratuit 30 jours" —
// lecture/fusion/écriture du JSON pour ne jamais écraser les autres clés de
// merchants.settings (logo, signupChosePlan, etc.).
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const sb = supabase();
  const { data: m } = await sb.from("merchants").select("settings").eq("id", session.user.id).maybeSingle();
  const settings = (m?.settings ?? {}) as Record<string, unknown>;

  await sb.from("merchants").update({
    settings: { ...settings, businessTrialBannerDismissed: true },
  }).eq("id", session.user.id);

  return NextResponse.json({ ok: true });
}
