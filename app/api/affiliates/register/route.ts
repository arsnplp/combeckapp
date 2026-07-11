import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAffiliate, createAffiliateSession } from "@/lib/affiliates";
import { sendAffiliateWelcome } from "@/lib/mailer";
import { checkRateLimit, getIp, tooManyRequests } from "@/lib/rate-limit";

const Schema = z.object({
  name: z.string().min(2).max(100),
  commerce: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(30).optional().default(""),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`aff-register:${getIp(req)}`, 5, 15 * 60 * 1000)) return tooManyRequests();

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides (mot de passe min. 8 caractères)." }, { status: 400 });
  }

  try {
    const affiliate = await createAffiliate(parsed.data);
    const appUrl = process.env.AUTH_URL ?? "https://app.getcomeback.fr";
    const refLink = `${appUrl}/ref/${affiliate.referralCode}`;

    sendAffiliateWelcome(affiliate.email, affiliate.name, refLink).catch(console.error);

    const token = await createAffiliateSession(affiliate.id);
    const res = NextResponse.json({ ok: true, referralCode: affiliate.referralCode, refLink });
    res.cookies.set("comeback_affiliate", token, {
      httpOnly: true, sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 90, path: "/",
    });
    return res;
  } catch (e) {
    if (e instanceof Error && e.message === "EMAIL_EXISTS") {
      return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
    }
    console.error("[affiliates/register]", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
