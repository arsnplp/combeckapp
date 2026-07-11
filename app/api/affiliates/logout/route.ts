import { NextRequest, NextResponse } from "next/server";
import { deleteAffiliateSession } from "@/lib/affiliates";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("comeback_affiliate")?.value;
  if (token) await deleteAffiliateSession(token).catch(() => {});
  const res = NextResponse.json({ ok: true });
  res.cookies.set("comeback_affiliate", "", { maxAge: 0, path: "/" });
  return res;
}
