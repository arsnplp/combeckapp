import { NextRequest, NextResponse } from "next/server";
import { getAffiliateByCode } from "@/lib/affiliates";

/**
 * Lien d'affiliation : https://app.getcomeback.fr/ref/{code}
 * Pose un cookie d'attribution (30 jours, last-click) puis redirige vers /tarifs.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const base = process.env.AUTH_URL ?? "https://app.getcomeback.fr";
  const res = NextResponse.redirect(new URL("/tarifs", base));

  try {
    const affiliate = await getAffiliateByCode(code);
    if (affiliate && affiliate.status === "active") {
      res.cookies.set("comeback_ref", affiliate.referralCode, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30, // attribution 30 jours
        path: "/",
      });
    }
  } catch { /* table absente ou code invalide → simple redirection */ }

  return res;
}
