import { NextRequest, NextResponse } from "next/server";
import { lockMerchantForSession } from "@/lib/employee-sessions";

/** Quitter le commerce en cours sans se déconnecter du compte. */
export async function POST(req: NextRequest) {
  const token = req.cookies.get("comeback_staff")?.value;
  if (token) await lockMerchantForSession(token);
  return NextResponse.json({ ok: true });
}
