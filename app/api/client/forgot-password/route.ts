import { NextRequest, NextResponse } from "next/server";
import { findClientCards } from "@/lib/client-lookup";
import { createResetToken } from "@/lib/reset-tokens";
import { sendPasswordResetClient } from "@/lib/mailer";
import { checkRateLimit, getIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // 3 tentatives / heure par IP (évite le spam d'emails)
  if (!checkRateLimit(`forgot-client:${getIp(req)}`, 3, 60 * 60 * 1000)) {
    return tooManyRequests(3600);
  }

  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email requis." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const cards = findClientCards(normalizedEmail);

  if (cards.length > 0) {
    try {
      const token = createResetToken(normalizedEmail, "client");
      await sendPasswordResetClient(normalizedEmail, token);
    } catch (e) {
      console.error("[forgot-password/client]", e);
    }
  }

  return NextResponse.json({ ok: true });
}
