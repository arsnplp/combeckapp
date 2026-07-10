import { NextRequest, NextResponse } from "next/server";
import { findClientCards } from "@/lib/client-lookup";
import { getClientAccount, verifyClientPassword } from "@/lib/client-accounts";
import { checkRateLimit, getIp, tooManyRequests } from "@/lib/rate-limit";
import { createClientSession } from "@/lib/client-sessions";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().max(128).optional(),
});

export async function POST(req: NextRequest) {
  // 10 tentatives / 15 min par IP
  if (!checkRateLimit(`client-login:${getIp(req)}`, 10, 15 * 60 * 1000)) {
    return tooManyRequests();
  }

  const parsed = LoginSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const cards = await findClientCards(normalizedEmail);
  if (cards.length === 0) {
    return NextResponse.json({ error: "Aucune carte de fidélité trouvée pour cet email." }, { status: 404 });
  }

  const account = await getClientAccount(normalizedEmail);

  if (account) {
    if (!password) {
      return NextResponse.json({ error: "Mot de passe requis.", needsPassword: true }, { status: 401 });
    }
    const valid = await verifyClientPassword(normalizedEmail, password as string);
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
    }
  }

  const firstLogin = !account;

  const token = await createClientSession(normalizedEmail);
  const response = NextResponse.json({ ok: true, count: cards.length, firstLogin });
  response.cookies.set("comeback_client", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
  });
  return response;
}
