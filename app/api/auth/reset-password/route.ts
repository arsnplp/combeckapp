import { NextRequest, NextResponse } from "next/server";
import { consumeResetToken } from "@/lib/reset-tokens";
import { updateUserPassword, getUserByEmail } from "@/lib/users";
import { checkRateLimit, getIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // 5 tentatives / 15 min par IP
  if (!checkRateLimit(`reset-restaurant:${getIp(req)}`, 5, 15 * 60 * 1000)) {
    return tooManyRequests();
  }

  const { token, password } = await req.json();
  if (!token || !password || typeof token !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Le mot de passe doit faire au moins 8 caractères." }, { status: 400 });
  }

  const email = consumeResetToken(token, "restaurant");
  if (!email) {
    return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 400 });
  }

  const user = getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }

  await updateUserPassword(user.id, password);
  return NextResponse.json({ ok: true });
}
