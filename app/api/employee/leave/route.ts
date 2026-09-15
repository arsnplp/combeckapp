import { NextRequest, NextResponse } from "next/server";
import { resolveEmployeeSession } from "@/lib/employee-sessions";
import { getEmployeeByEmail, unlinkEmployeeFromMerchant } from "@/lib/employees";

/**
 * POST { merchantId } — l'employé quitte un commerce de lui-même.
 * Supprime son rattachement là-bas uniquement ; son compte et ses autres
 * commerces sont conservés.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get("comeback_staff")?.value;
  const session = token ? await resolveEmployeeSession(token) : null;
  if (!session) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { merchantId } = await req.json().catch(() => ({}));
  if (!merchantId) return NextResponse.json({ error: "Commerce manquant." }, { status: 400 });

  const account = await getEmployeeByEmail(session.email);
  if (!account) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  await unlinkEmployeeFromMerchant(account.id, merchantId);
  return NextResponse.json({ ok: true });
}
