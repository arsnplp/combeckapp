import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { FUNNEL_PERIODS, getFunnel } from "@/lib/acquisition";

/** GET /api/admin/funnel?days=30 : entonnoir d'acquisition par source. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  const asked = Number(req.nextUrl.searchParams.get("days"));
  const days = (FUNNEL_PERIODS as readonly number[]).includes(asked) ? asked : 30;
  try {
    return NextResponse.json(await getFunnel(days));
  } catch {
    return NextResponse.json({ ready: false, days, rows: [] });
  }
}
