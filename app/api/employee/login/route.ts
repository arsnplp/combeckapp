import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEmployeeByEmail, verifyEmployeePassword, isPendingAccount } from "@/lib/employees";
import { createEmployeeSession } from "@/lib/employee-sessions";
import { checkRateLimit, getIp, tooManyRequests } from "@/lib/rate-limit";

const Schema = z.object({ email: z.string().email(), password: z.string().max(128) });

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`employee-login:${getIp(req)}`, 10, 15 * 60 * 1000)) return tooManyRequests();

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  const { email, password } = parsed.data;

  const account = await getEmployeeByEmail(email);
  if (!account) {
    return NextResponse.json({ error: "Aucun compte employé avec cet email." }, { status: 404 });
  }
  // Fiche créée par un commerçant mais jamais réclamée : on oriente vers la
  // création de compte au lieu d'un « mot de passe incorrect » incompréhensible.
  if (isPendingAccount(account)) {
    return NextResponse.json(
      { error: "Votre compte n'est pas encore activé — créez votre mot de passe.", needsSignup: true },
      { status: 409 },
    );
  }
  if (!(await verifyEmployeePassword(email, password))) {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  const token = await createEmployeeSession(email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("comeback_staff", token, {
    httpOnly: true, sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 180, path: "/",
  });
  return res;
}
