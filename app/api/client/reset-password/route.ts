import { NextRequest, NextResponse } from "next/server";
import { consumeResetToken } from "@/lib/reset-tokens";
import { resetClientPassword } from "@/lib/client-accounts";
import { findClientCards } from "@/lib/client-lookup";
import { checkRateLimit, getIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // 5 tentatives / 15 min par IP
  if (!checkRateLimit(`reset-client:${getIp(req)}`, 5, 15 * 60 * 1000)) {
    return tooManyRequests();
  }

  const { token, password } = await req.json();
  if (!token || !password || typeof token !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Le mot de passe doit faire au moins 6 caractères." }, { status: 400 });
  }

  const email = await consumeResetToken(token, "client");
  if (!email) {
    return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 400 });
  }

  const cards = await findClientCards(email);
  if (cards.length === 0) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }

  await resetClientPassword(email, password);
  return NextResponse.json({ ok: true });
}
