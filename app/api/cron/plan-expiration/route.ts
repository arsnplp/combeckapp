import { NextRequest, NextResponse } from "next/server";
import { checkAndDowngradeExpiredPlans } from "@/lib/plan-billing";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const count = await checkAndDowngradeExpiredPlans();
    return NextResponse.json({ ok: true, downgraded: count });
  } catch (e) {
    console.error("[cron/plan-expiration]", e);
    return NextResponse.json({ error: "Error." }, { status: 500 });
  }
}
