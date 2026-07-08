import { NextRequest, NextResponse } from "next/server";
import { walletNotificationService } from "@/lib/wallet-notification-service";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import { getMonthlyNotifCount, incrementNotifCount } from "@/lib/notif-usage";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const { message, customerIds } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: "Missing message" }, { status: 400 });

    const tenantId = session.user.id;
    const user = await getUserById(tenantId);
    if (user) {
      const limit = (PLAN_LIMITS[user.plan] ?? PLAN_LIMITS["starter"]).notifs;
      if (limit !== Infinity) {
        const used = await getMonthlyNotifCount(tenantId);
        if (used >= limit) {
          return NextResponse.json(
            { error: `Limite mensuelle de ${limit} notifications atteinte (plan ${user.plan}).` },
            { status: 403 },
          );
        }
      }
    }

    // Toujours scopé au tenant — jamais d'envoi aux clients d'autres commerces
    const result = await walletNotificationService.sendCampaignToTenant(
      tenantId,
      message.trim(),
      customerIds?.length ? customerIds : undefined,
    );

    if (result.clientsReached > 0 && user) await incrementNotifCount(tenantId, result.clientsReached);

    console.log(`[Campaign] tenant=${tenantId} clients=${result.clientsReached}/${result.clientsTotal} devicePushes=${result.devicePushes.length}`);
    return NextResponse.json({
      ok: true,
      success: result.clientsReached,
      total: result.clientsTotal,
      failed: result.clientsTotal - result.clientsReached,
    });
  } catch (e) {
    console.error("[Campaign] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
