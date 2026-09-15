import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getEmployeeByEmail, createEmployeeAccount, setEmployeePassword, isPendingAccount,
} from "@/lib/employees";
import { createEmployeeSession } from "@/lib/employee-sessions";
import { checkRateLimit, getIp, tooManyRequests } from "@/lib/rate-limit";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  name: z.string().min(1).max(80),
});

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`employee-signup:${getIp(req)}`, 10, 15 * 60 * 1000)) return tooManyRequests();

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email, nom et mot de passe (6 caractères min.) requis." }, { status: 400 });
  }
  const { email, password, name } = parsed.data;

  const existing = await getEmployeeByEmail(email);
  if (existing) {
    // Fiche créée d'avance par un commerçant : la personne la « réclame »
    // en définissant son mot de passe. Sinon, c'est un doublon.
    if (!isPendingAccount(existing)) {
      return NextResponse.json(
        { error: "Un compte employé existe déjà avec cet email. Connectez-vous." },
        { status: 409 },
      );
    }
    await setEmployeePassword(email, password, name);
  } else {
    const created = await createEmployeeAccount(email, password, name);
    if (!created) {
      return NextResponse.json({ error: "Impossible de créer le compte." }, { status: 500 });
    }
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
