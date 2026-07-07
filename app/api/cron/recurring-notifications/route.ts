import { NextRequest, NextResponse } from "next/server";
import { runDueRecurringNotifications } from "@/lib/recurring-notifications";

// Appelé toutes les heures par le cron du VPS.
// Sécurisé par CRON_SECRET — jamais exposé côté client.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const result = await runDueRecurringNotifications();
    if (result.sent.length > 0) {
      console.log(`[cron/recurring] ${result.sent.length} notification(s) envoyée(s)`, result.sent);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron/recurring]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
