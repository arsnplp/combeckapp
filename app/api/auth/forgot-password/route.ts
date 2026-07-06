import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/users";
import { createResetToken } from "@/lib/reset-tokens";
import { sendPasswordResetRestaurant } from "@/lib/mailer";
import { checkRateLimit, getIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // 3 tentatives / heure par IP (évite le spam d'emails)
  if (!checkRateLimit(`forgot-restaurant:${getIp(req)}`, 3, 60 * 60 * 1000)) {
    return tooManyRequests(3600);
  }

  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email requis." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await getUserByEmail(normalizedEmail);

  if (user) {
    try {
      const token = await createResetToken(normalizedEmail, "restaurant");
      await sendPasswordResetRestaurant(normalizedEmail, token);
    } catch (e) {
      console.error("[forgot-password/restaurant]", e);
    }
  }

  return NextResponse.json({ ok: true });
}
