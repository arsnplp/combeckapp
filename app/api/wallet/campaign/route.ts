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

    const results = customerIds?.length
      ? await walletNotificationService.sendCampaignToCustomers(message.trim(), customerIds)
      : await walletNotificationService.sendCampaignToAll(message.trim());

    const success = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    if (success > 0 && user) await incrementNotifCount(tenantId, success);

    console.log(`[Campaign] Sent to ${success} devices, ${failed} failed`);
    return NextResponse.json({ ok: true, success, failed, total: results.length });
  } catch (e) {
    console.error("[Campaign] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
