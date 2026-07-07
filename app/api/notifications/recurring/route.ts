import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getMonthlyNotifCount } from "@/lib/notif-usage";
import { PLAN_LIMITS, PLAN_LABELS } from "@/lib/plan-limits";
import type { PlanId } from "@/types";
import {
  listRecurring, createRecurring, updateRecurring, deleteRecurring, planAllowsRecurring,
} from "@/lib/recurring-notifications";

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user.id;
}

// GET — liste des notifications automatiques du commerçant + éligibilité plan
export async function GET() {
  const tenantId = await requireSession();
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [items, user, used] = await Promise.all([
    listRecurring(tenantId),
    getUserById(tenantId),
    getMonthlyNotifCount(tenantId),
  ]);
  const plan = (user?.plan ?? "starter") as PlanId;
  const limit = (PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter).notifs;
  return NextResponse.json({
    items,
    planAllowed: planAllowsRecurring(plan),
    plan,
    planLabel: PLAN_LABELS[plan] ?? plan,
    used,
    limit: limit === Infinity ? null : limit,
  });
}

// POST — création (Pro / Business uniquement)
export async function POST(req: NextRequest) {
  const tenantId = await requireSession();
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const user = await getUserById(tenantId);
  if (!planAllowsRecurring(user?.plan ?? "starter")) {
    return NextResponse.json(
      { error: "Les notifications automatiques sont réservées aux plans Pro et Business." },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    const message = String(body.message ?? "").trim();
    if (!message) return NextResponse.json({ error: "Message requis." }, { status: 400 });
    const frequency = ["daily", "weekly", "monthly"].includes(body.frequency) ? body.frequency : "weekly";

    const item = await createRecurring(tenantId, {
      message,
      frequency,
      dayOfWeek: Number(body.dayOfWeek ?? 1),
      dayOfMonth: Number(body.dayOfMonth ?? 1),
      hour: Number(body.hour ?? 10),
    });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH — activer/désactiver ou modifier
export async function PATCH(req: NextRequest) {
  const tenantId = await requireSession();
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const { id, active, message, hour } = await req.json();
    if (!id) return NextResponse.json({ error: "id requis." }, { status: 400 });

    // Réactiver une notification exige un plan éligible (la désactivation est toujours permise)
    if (active === true) {
      const user = await getUserById(tenantId);
      if (!planAllowsRecurring(user?.plan ?? "starter")) {
        return NextResponse.json(
          { error: "Les notifications automatiques sont réservées aux plans Pro et Business." },
          { status: 403 },
        );
      }
    }

    await updateRecurring(tenantId, id, { active, message, hour });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE — suppression
export async function DELETE(req: NextRequest) {
  const tenantId = await requireSession();
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id requis." }, { status: 400 });
    await deleteRecurring(tenantId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
