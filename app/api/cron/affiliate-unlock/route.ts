import { NextRequest, NextResponse } from "next/server";
import { processUnlockJobs, getAffiliateById } from "@/lib/affiliates";
import { sendAffiliateUnlockedEmail } from "@/lib/mailer";

/**
 * Cron horaire : débloque les commissions arrivées à J+18 (pending → disponible).
 * GET /api/cron/affiliate-unlock?secret={CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const unlocked = await processUnlockJobs();
    for (const u of unlocked) {
      const affiliate = await getAffiliateById(u.affiliateId);
      if (affiliate) sendAffiliateUnlockedEmail(affiliate.email, u.amount).catch(console.error);
    }
    return NextResponse.json({ ok: true, unlocked: unlocked.length });
  } catch (e) {
    console.error("[cron/affiliate-unlock]", e);
    return NextResponse.json({ error: "Error." }, { status: 500 });
  }
}
