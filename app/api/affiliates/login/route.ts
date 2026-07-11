import { NextRequest, NextResponse } from "next/server";
import { verifyAffiliatePassword, createAffiliateSession } from "@/lib/affiliates";
import { checkRateLimit, getIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`aff-login:${getIp(req)}`, 10, 15 * 60 * 1000)) return tooManyRequests();

  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
  }

  const affiliate = await verifyAffiliatePassword(email, password);
  if (!affiliate) {
    return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
  }

  const token = await createAffiliateSession(affiliate.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("comeback_affiliate", token, {
    httpOnly: true, sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90, path: "/",
  });
  return res;
}
