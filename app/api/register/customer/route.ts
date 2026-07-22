import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db_addCustomer, db_getAll } from "@/lib/server-db";
import { getUserById } from "@/lib/users";
import { PLAN_LIMITS } from "@/lib/plan-limits";

// POST — création de client depuis le dashboard restaurant (authentifié)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const tenantId = session.user.id;

  try {
    const { customerId, name, email, phone, joinDate, cardId, customerCardId, stamps, points } = await req.json();

    if (!customerId || !name || !cardId || !customerCardId) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }

    // Vérifier la limite du plan
    const user = await getUserById(tenantId);
    if (user) {
      const limit = (PLAN_LIMITS[user.plan] ?? PLAN_LIMITS["starter"]).clients;
      if (limit !== Infinity) {
        const current = (await db_getAll(tenantId)).customers.length;
        if (current >= limit) {
          return NextResponse.json(
            { error: `Limite de ${limit} clients atteinte pour ce commerce.` },
            { status: 403 },
          );
        }
      }
    }

    const now = joinDate ?? new Date().toISOString();

    await db_addCustomer(
      tenantId,
      { id: customerId, name, email: email || "", phone: phone || "", joinDate: now, totalVisits: 0, lastVisitAt: null },
      { id: customerCardId, customerId, cardId, stamps: stamps ?? 0, points: points ?? 0, referralCount: 0, joinDate: now, lastActivity: now },
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
