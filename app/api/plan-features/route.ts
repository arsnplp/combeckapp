import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getPlanFeatures } from "@/lib/plan-features";
import { supabase } from "@/lib/supabase";
import type { PlanId } from "@/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const user = await getUserById(session.user.id);
  const plan = (user?.plan ?? "starter") as PlanId;
  const features = getPlanFeatures(plan, user?.planExpiresAt);

  // Flags "essai Business offert" (bannière dashboard) — lus directement
  // depuis merchants.settings, indépendamment de StoreSettings (branding).
  const { data: m } = await supabase().from("merchants")
    .select("settings").eq("id", session.user.id).maybeSingle();
  const s = (m?.settings ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    ...features,
    signupChosePlan: (s.signupChosePlan as string | undefined) ?? null,
    businessTrialBannerDismissed: !!s.businessTrialBannerDismissed,
    hasUsedBonusBusinessTrial: !!s.hasUsedBonusBusinessTrial,
  });
}
