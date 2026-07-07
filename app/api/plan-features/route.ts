import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getPlanFeatures } from "@/lib/plan-features";
import type { PlanId } from "@/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const user = await getUserById(session.user.id);
  const plan = (user?.plan ?? "starter") as PlanId;
  const features = getPlanFeatures(plan);

  return NextResponse.json(features);
}
